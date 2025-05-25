import express from 'express';
import { FacebookService, CampaignData, PageData } from '../services/facebook.service';
import { FACEBOOK_CONFIG } from '../config/facebook.config';
import { User, IUser } from '../models/User';
import crypto from 'crypto';
import { AuthRequest, protect } from '../middleware/auth';
import { Response } from 'express';

const router = express.Router();

// Helper function for consistent error responses
const sendErrorResponse = (res: express.Response, statusCode: number, error: any, defaultMessage: string) => {
    console.error('API Error:', {
        endpoint: res.req.path,
        message: error.message,
        code: error.code,
        subcode: error.subcode,
        error_user_msg: error.error_user_msg,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(statusCode).json({
        error: defaultMessage,
        details: error.message,
        code: error.code,
        subcode: error.subcode,
        error_user_msg: error.error_user_msg
    });
};

// Add a Set to track processed callbacks
const processedCallbacks = new Set<string>();

// --- OAuth Authentication Endpoints --- 

/**
 * GET /api/facebook/auth/login
 * Initiates the Facebook OAuth login process.
 * Redirects the user to Facebook's authorization dialog.
 */
router.get('/auth/login', protect, async (req:AuthRequest, res) => {
    const user: IUser = req.user as IUser;
    if (!user) {
        console.error('GET /auth/login: User not authenticated in your application. Cannot initiate Facebook OAuth.');
        res.status(401).json({
            error: 'Authentication Required',
            message: 'Please log in to your account before connecting Facebook.' 
        });
        return;
    }

    const permissions = [
        'ads_management', 'business_management', 'pages_show_list',
        'pages_read_engagement', 'pages_manage_ads', 'pages_manage_metadata',
        'pages_read_user_content', 'pages_manage_posts', 'pages_manage_engagement',
        'email', 'public_profile',
    ];

    const loginUrl = FacebookService.getLoginUrl(FACEBOOK_CONFIG.redirectUri!, permissions) + `&state=${req.session.oauthState}`;
    res.json(loginUrl);
});

/**
 * GET /api/facebook/auth/callback
 * This is the redirect URI Facebook calls after the user grants/denies permissions.
 * It exchanges the authorization code for an access token and saves it to the user's database record.
 */
router.get('/auth/callback', protect, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { code, state, error, error_description } = req.query;

        // Reload session to ensure we have the latest data
        await new Promise<void>((resolve, reject) => {
            req.session.reload((err) => {
                if (err) {
                    console.error('Error reloading session in callback:', err);
                    reject(err);
                    return;
                }
                console.log('Session reloaded in callback:', {
                    sessionId: req.sessionID,
                    state: req.session.oauthState,
                    userId: req.session.userId
                });
                resolve();
            });
        });

        // Log session state
        console.log('Callback session state:', {
            sessionId: req.sessionID,
            state: req.session.oauthState,
            userId: req.session.userId,
            queryState: state
        });

        // Verify state parameter
        if (!state || state !== req.session.oauthState) {
            console.error('CSRF attack detected:', {
                sessionState: req.session.oauthState,
                queryState: state
            });
            res.status(401).json({ error: 'Invalid state parameter' });
        }

        // Handle errors returned by Facebook
        if (error) {
            console.error('Facebook OAuth Error:', error, error_description);
            res.status(400).json({
                error: 'Facebook OAuth Error',
                message: error_description || 'Authentication failed. Please try again.'
            });
            return;
        }

        // Check if the authorization code is present
        if (!code) {
            console.error('Missing Authorization Code in callback.');
            res.status(400).json({
                error: 'Missing Authorization Code',
                message: 'No authorization code received from Facebook.'
            });
            return;
        }

        // Load the user based on the stored ID from the session (from when login was initiated)
        const user = await User.findById(req.session.facebookConnectUserId);
        if (!user) {
            console.error('GET /auth/callback: User not found in DB for stored ID:', req.session.facebookConnectUserId);
            res.status(401).json({ 
                error: 'User not found', 
                message: 'The user associated with this Facebook connection could not be found.' 
            });
            return;
        }
        console.log('GET /auth/callback: Authenticated user email (from stored session ID):', user.email);

        try {
            const shortLivedAccessToken = await FacebookService.exchangeCodeForAccessToken(code as string, FACEBOOK_CONFIG.redirectUri!);
            console.log('GET /auth/callback: Successfully obtained short-lived Access Token.');

            const longLivedAccessToken = await FacebookService.getLongLivedAccessToken(shortLivedAccessToken);
            console.log('GET /auth/callback: Successfully obtained long-lived Access Token (first 30 chars):', longLivedAccessToken.substring(0, 30) + '...');

            const expiresInSeconds = 60 * 24 * 60 * 60; // 60 days
            const expirationDate = new Date(Date.now() + expiresInSeconds * 1000);

            // Initialize a temporary FacebookService to fetch user's ad accounts/businesses
            const tempFacebookService = new FacebookService(longLivedAccessToken, FACEBOOK_CONFIG.adAccountId ?? '');
                                                                                                                   
            let primaryAdAccountId: string | undefined;
            let primaryBusinessId: string | undefined;

            try {
                console.log('GET /auth/callback: Attempting to fetch user ad accounts and businesses with temp service.');
                const userAdAccountsAndBusinesses = await tempFacebookService.getBusinessInfo();
                
                const adAccounts = userAdAccountsAndBusinesses.adAccounts as { data: Array<{ id: string }> } | undefined;
                if (adAccounts && adAccounts.data && adAccounts.data.length > 0) {
                    primaryAdAccountId = adAccounts.data[0].id;
                    console.log('GET /auth/callback: Found primary Ad Account:', primaryAdAccountId);
                } else {
                    console.warn('GET /auth/callback: No ad accounts found for the authenticated Facebook user.');
                }

                const businesses = userAdAccountsAndBusinesses.businesses as { data: Array<{ id: string }> } | undefined;
                if (businesses && businesses.data && businesses.data.length > 0) {
                    primaryBusinessId = businesses.data[0].id;
                    console.log('GET /auth/callback: Found primary Business ID:', primaryBusinessId);
                } else {
                    console.warn('GET /auth/callback: No business accounts found for the authenticated Facebook user.');
                }
            } catch (infoError) {
                console.error('GET /auth/callback: Error fetching user ad accounts/businesses after OAuth:', infoError);
            }

            // Save the tokens and IDs to the authenticated user's database record
            user.facebookAccessToken = longLivedAccessToken;
            user.facebookAccessTokenExpires = expirationDate;
            user.facebookAdAccountId = primaryAdAccountId;
            user.facebookBusinessId = primaryBusinessId;

            await user.save();
            console.log('GET /auth/callback: Facebook access token and IDs saved to user database.');
            console.log('GET /auth/callback: Token saved to DB (first 30 chars):', user.facebookAccessToken?.substring(0, 30) + '...');
            console.log('GET /auth/callback: Ad Account ID saved to DB:', user.facebookAdAccountId);


            res.status(200).json({
                status: 'success',
                message: 'Facebook account connected successfully!',
                fbData: {
                    adAccountId: primaryAdAccountId,
                    businessId: primaryBusinessId,
                    accessToken: longLivedAccessToken,
                    expiresAt: expirationDate
                }
            });

        } catch (error: any) {
            sendErrorResponse(res, 500, error, 'Failed to complete Facebook authentication process');
        }
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to complete Facebook authentication process');
    }
});

// Middleware to initialize FacebookService with the current user's access token.
// This middleware will run ONLY for routes *after* the OAuth endpoints,
// and it assumes req.user is populated by your main application's 'protect' middleware.

router.use(protect);
router.use(async (req, res, next) => {
    console.log('--- Facebook Router Protected Middleware ---');
    const user: IUser = req.user as IUser; // req.user should be populated by app.use(protect
    console.log('user', user)
    if (!user) {
        console.error('Facebook Router Protected Middleware: User not authenticated (req.user is null/undefined).');
         res.status(401).json({
            error: 'Authentication Required',
            message: 'User not authenticated in your application. Please log in first.'
        });
        return;
    }

    const facebookAccessToken = user.facebookAccessToken;
    const facebookAdAccountId = user.facebookAdAccountId;

    console.log('Facebook Router Protected Middleware: User email:', user.email);
    console.log('Facebook Router Protected Middleware: Token from DB (first 30 chars):', facebookAccessToken?.substring(0, 30) + '...');
    console.log('Facebook Router Protected Middleware: Ad Account ID from DB:', facebookAdAccountId);

    if (!facebookAccessToken || !facebookAdAccountId) {
        console.error('Facebook Router Protected Middleware: Missing Facebook access token or Ad Account ID in DB.');
         res.status(401).json({
            error: 'Facebook Integration Required',
            message: 'Your Facebook account is not connected or an Ad Account is not selected. Please visit /api/facebook/auth/login to connect.'
        });
        return;
    }

    (req as any).facebookService = new FacebookService(facebookAccessToken, facebookAdAccountId);
    console.log('Facebook Router Protected Middleware: FacebookService initialized successfully.');
    next();
});


// --- Existing Marketing API Endpoints (now use the middleware for authentication) ---
// These routes are now protected by the router.use middleware above.
router.get('/verify-permissions', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const permissions = await facebookService.verifyPermissions();
        res.json(permissions);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to verify permissions');
    }
});

router.get('/campaigns', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const campaigns = await facebookService.getCampaigns();
        res.json(campaigns);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch campaigns');
    }
});

router.post('/campaigns', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const campaignData: CampaignData = req.body;
        const campaign = await facebookService.createCampaign(campaignData);
        res.json(campaign);
    } catch (error: any) {
        if (error.message.includes('No Facebook Pages associated')) {
            res.status(400).json({
                error: 'Page Required',
                message: 'You need to create a Facebook Page before creating a campaign.',
                details: error.message,
                nextSteps: [
                    'Use the /api/facebook/pages endpoint to create a new page',
                    'After creating the page, try creating the campaign again'
                ]
            });
        } else {
            sendErrorResponse(res, 500, error, 'Failed to create campaign');
        }
    }
});

router.get('/campaigns/:campaignId/ad-sets', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const { campaignId } = req.params;
        const adSets = await facebookService.getAdSets(campaignId);
        res.json(adSets);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch ad sets');
    }
});

router.post('/campaigns/:campaignId/ad-sets', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const { campaignId } = req.params;
        const adSet = await facebookService.createAdSet(campaignId, req.body);
        res.json(adSet);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to create ad set');
    }
});

router.get('/ad-sets/:adSetId/ads', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const { adSetId } = req.params;
        const ads = await facebookService.getAds(adSetId);
        res.json(ads);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch ads');
    }
});

router.post('/ad-sets/:adSetId/ads', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const { adSetId } = req.params;
        const ad = await facebookService.createAd(adSetId, req.body);
        res.json(ad);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to create ad');
    }
});

router.get('/insights', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const insights = await facebookService.getInsights(req.query);
        res.json(insights);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch insights');
    }
});

router.get('/business-info', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const businessInfo = await facebookService.getBusinessInfo();
        res.json(businessInfo);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch business information');
    }
});

router.post('/pages', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const pageData: PageData = req.body;
        const page = await facebookService.createPage(pageData);

        const user: IUser = req.user as IUser; // req.user should be populated by 'protect'
        user.facebookPageId = page.id;
        user.facebookPageAccessToken = page.access_token;
        await user.save();
        console.log('POST /pages: Facebook Page ID and Access Token saved to user database.');

        res.json(page);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to create page');
    }
});

router.get('/pages', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const pages = await facebookService.getPages();
        res.json(pages);
    } catch (error: any) {
        if (error.message.includes('Invalid or expired access token')) {
            res.status(401).json({
                error: 'Authentication Required',
                message: 'Your Facebook access token is invalid or has expired.',
                details: error.message,
                nextSteps: [
                    'Reconnect your Facebook account to get a new access token',
                    'Make sure you have granted all required permissions'
                ]
            });
        } else {
            sendErrorResponse(res, 500, error, 'Failed to fetch pages');
        }
    }
});

router.put('/pages/:pageId', async (req, res) => {
    try {
        const facebookService: FacebookService = (req as any).facebookService;
        const { pageId } = req.params;
        const updates: Partial<PageData> = req.body;
        const page = await facebookService.updatePage(pageId, updates);
        res.json(page);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to update page');
    }
});

export default router;
