import express from 'express';
import { FacebookService, CampaignData, PageData, AdAccountResponse } from '../services/facebook.service';
import { FACEBOOK_CONFIG } from '../config/facebook.config';
import { User, IUser } from '../models/User';
import crypto from 'crypto';
import { AuthRequest, protect } from '../middleware/auth';
import { Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Helper function for consistent error responses
export const sendErrorResponse = (res: express.Response, statusCode: number, error: any, defaultMessage: string) => {
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

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        cb(null, `${uniqueId}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only video files
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

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

    // Generate a new state for this OAuth attempt
    const state = crypto.randomBytes(16).toString('hex');
    
    // Set session data
    req.session.oauthState = state;
    req.session.facebookConnectUserId = user._id.toString();
    req.session.userId = user._id.toString();

    // Save session before proceeding
    await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session in login route:', err);
                reject(err);
                return;
            }
            console.log('Session saved in login route:', {
                sessionId: req.sessionID,
                state: req.session.oauthState,
                userId: req.session.userId
            });
            resolve();
        });
    });

    const permissions = [
        'ads_management', 'business_management', 'pages_show_list',
        'pages_read_engagement', 'pages_manage_ads', 'pages_manage_metadata',
        'pages_read_user_content', 'pages_manage_posts', 'pages_manage_engagement',
        'email', 'public_profile',
    ];

    const loginUrl = FacebookService.getLoginUrl(FACEBOOK_CONFIG.redirectUri!, permissions) + `&state=${state}`;
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

        // Log initial session state
        console.log('Callback initial session state:', {
            sessionId: req.sessionID,
            state: req.session.oauthState,
            userId: req.session.userId,
            queryState: state
        });

        // Verify state parameter
        if (!state || !req.session.oauthState || state !== req.session.oauthState) {
            console.error('CSRF attack detected or session expired:', {
                sessionState: req.session.oauthState,
                queryState: state,
                sessionId: req.sessionID
            });
            res.status(401).json({ 
                error: 'Invalid state parameter',
                message: 'Session may have expired. Please try connecting your Facebook account again.'
            });
            return;
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

        // Load the user based on the stored ID from the session
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

            // Save the token first
            console.log('GET /auth/callback: Saving token to user record...');
            user.facebookAccessToken = longLivedAccessToken;
            user.facebookAccessTokenExpires = expirationDate;
            
            try {
                await user.save();
                console.log('GET /auth/callback: Successfully saved token to user record');
            } catch (saveError) {
                console.error('GET /auth/callback: Error saving token to user record:', saveError);
                throw saveError;
            }

            // Now try to get business info
            let adAccountId: string | undefined;
            try {
                // Initialize a temporary FacebookService to fetch user's ad accounts/businesses
                const tempFacebookService = new FacebookService(longLivedAccessToken, FACEBOOK_CONFIG.adAccountId ?? '');
                                                                                                                       
                console.log('GET /auth/callback: Fetching business info...');
                const userAdAccountsAndBusinesses:any = await tempFacebookService.getBusinessInfo();
                console.log('GET /auth/callback: Raw Facebook API response:', JSON.stringify(userAdAccountsAndBusinesses, null, 2));
                
                // Handle ad accounts
                const adAccounts = userAdAccountsAndBusinesses.adAccounts?.data || [];
                console.log('GET /auth/callback: Ad Accounts data:', JSON.stringify(adAccounts, null, 2));

                if (adAccounts.length === 0) {
                    console.warn('GET /auth/callback: No ad accounts found in the response');
                    // Check user permissions
                    const permissions = await tempFacebookService.verifyPermissions();
                    console.log('GET /auth/callback: User permissions:', permissions);
                } else {
                    // Log all available ad accounts and their statuses
                    console.log('GET /auth/callback: Available Ad Accounts:');
                    adAccounts.forEach(account => {
                        console.log(`- ${account.name} (${account.id}): Status ${account.account_status}`);
                    });

                    // Find the first active ad account (account_status === 1)
                    const activeAdAccount = adAccounts.find(account => account.account_status === 1);
                    console.log('GET /auth/callback: Active ad account found:', activeAdAccount);

                    if (activeAdAccount) {
                        // Use the active ad account
                        adAccountId = activeAdAccount.id;
                        console.log('GET /auth/callback: Using active ad account:', adAccountId);
                    } else {
                        // Fallback to first available account
                        adAccountId = adAccounts[0].id;
                        console.log('GET /auth/callback: No active ad account found, using first available:', adAccountId);
                    }

                    // Save the ad account ID
                    user.facebookAdAccountId = adAccountId;
                    await user.save();
                    console.log('GET /auth/callback: Successfully saved ad account ID to user record');
                }

                // Handle businesses
                const businesses = userAdAccountsAndBusinesses.businesses?.data || [];
                console.log('GET /auth/callback: Businesses data:', JSON.stringify(businesses, null, 2));

                if (businesses.length === 0) {
                    console.warn('GET /auth/callback: No businesses found in the response');
                } else {
                    console.log('GET /auth/callback: Available Businesses:');
                    businesses.forEach(business => {
                        console.log(`- ${business.name} (${business.id})`);
                    });
                }

                // Log user info
                console.log('GET /auth/callback: User info:', JSON.stringify(userAdAccountsAndBusinesses.userInfo, null, 2));

            } catch (error) {
                console.error('GET /auth/callback: Error fetching business info:', error);
                console.error('GET /auth/callback: Error details:', {
                    message: error.message,
                    code: error.code,
                    subcode: error.subcode,
                    error_user_msg: error.error_user_msg
                });
                // Don't throw here, just log the error and continue
            }

            // Clear the OAuth state from session after successful connection
            req.session.oauthState = undefined;
            req.session.facebookConnectUserId = undefined;
            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        console.error('Error saving session after successful connection:', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            res.status(200).json({
                status: 'success',
                message: 'Facebook account connected successfully!',
                fbData: {
                    adAccountId: adAccountId,
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
router.use(async (req:AuthRequest, res, next) => {
    console.log('--- Facebook Router Protected Middleware ---');
    const user: IUser = req.user as IUser;
    console.log('user', user);
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

    if (!facebookAccessToken) {
        console.error('Facebook Router Protected Middleware: Missing Facebook access token in DB.');
        res.status(401).json({
            error: 'Facebook Integration Required',
            message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
        });
        return;
    }

    // Initialize FacebookService with just the access token
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

router.get('/business-info', async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        // Create FacebookService instance with just the access token
        const facebookService = new FacebookService(user.facebookAccessToken);
        
        // First get user info to get the Facebook user ID
        const userInfo = await facebookService.getUserInfo();
        if (!userInfo || !userInfo.id) {
            throw new Error('Failed to get Facebook user ID');
        }

        // Try to get cached business info first
        const cachedInfo = await facebookService.getCachedBusinessInfo(userInfo.id);
        if (cachedInfo) {
            console.log('Using cached business info from database');
            res.json(cachedInfo);
            return;
        }

        // If no cached data or it's stale, fetch fresh data
        console.log('Fetching fresh business info from Facebook API');
        const businessInfo = await facebookService.getBusinessInfo();
        res.json(businessInfo);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch business information');
    }
});

router.post('/pages', async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        // Check if token is expired
        if (user.facebookAccessTokenExpires && new Date(user.facebookAccessTokenExpires) < new Date()) {
            res.status(401).json({
                error: 'Token Expired',
                message: 'Your Facebook access token has expired. Please reconnect your Facebook account.',
                nextSteps: ['Visit /api/facebook/auth/login to reconnect your Facebook account']
            });
            return;
        }

        // Create FacebookService instance with just the access token
        const facebookService = new FacebookService(user.facebookAccessToken);
        
        // First verify the token and get user info
        try {
            const userInfo = await facebookService.getUserInfo();
            console.log('User info retrieved successfully:', userInfo);
        } catch (error: any) {
            console.error('Error verifying token:', error);
            res.status(401).json({
                error: 'Invalid Token',
                message: 'Your Facebook access token is invalid. Please reconnect your Facebook account.',
                nextSteps: ['Visit /api/facebook/auth/login to reconnect your Facebook account']
            });
            return;
        }

        const pageData: PageData = req.body;
        const page = await facebookService.createPage(pageData);

        // Save the page ID and access token to the user's record
        user.facebookPageId = page.id;
        user.facebookPageAccessToken = page.access_token;
        await user.save();
        console.log('POST /pages: Facebook Page ID and Access Token saved to user database.');

        res.json(page);
    } catch (error: any) {
        if (error.message.includes('No business found')) {
            res.status(400).json({
                error: 'Business Required',
                message: 'You need to create a Facebook Business account first.',
                details: error.message,
                nextSteps: [
                    'Create a Facebook Business account',
                    'Connect it to your Facebook account',
                    'Try creating the page again'
                ]
            });
        } else {
            sendErrorResponse(res, 500, error, 'Failed to create page');
        }
    }
});

router.get('/pages', async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        // Create FacebookService instance with just the access token
        const facebookService = new FacebookService(user.facebookAccessToken);
        const pages = await facebookService.getPages();
        res.json({ data: pages }); // Return the pages array in a data property
    } catch (error: any) {
        if (error.message.includes('No business found')) {
            res.status(400).json({
                error: 'Business Required',
                message: 'You need to create a Facebook Business account first.',
                details: error.message,
                nextSteps: [
                    'Create a Facebook Business account',
                    'Connect it to your Facebook account',
                    'Try fetching pages again'
                ]
            });
        } else {
            sendErrorResponse(res, 500, error, 'Failed to fetch pages');
        }
    }
});

router.put('/pages/:pageId', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        // Initialize FacebookService with the user's access token
        const facebookService = new FacebookService(user.facebookAccessToken);
        const { pageId } = req.params;
        const updates: Partial<PageData> = req.body;

        // First get the page access token
        const pageInfo = await facebookService.getPageInfo(pageId, user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        // Now update the page using the page access token
        const page = await facebookService.updatePage(pageId, pageInfo.access_token, updates);
        res.json(page);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to update page');
    }
});

router.post('/pages/:pageId/posts', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        // Initialize FacebookService with the user's access token
        const facebookService = new FacebookService(user.facebookAccessToken);
        const { pageId } = req.params;
        const content = req.body;

        // First get the page access token
        const pageInfo = await facebookService.getPageInfo(pageId, user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        // Create the post using the page access token
        const post = await facebookService.createPost(pageId, pageInfo.access_token, content);
        res.json(post);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to create post');
    }
});

// Get all posts from a page
router.get('/pages/:pageId/posts', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { pageId } = req.params;

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(pageId, user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const posts = await facebookService.getPagePosts(pageId, pageInfo.access_token);
        res.json(posts);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch page posts');
    }
});

// Get comments for a post
router.get('/posts/:postId/comments', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { postId } = req.params;

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(postId.split('_')[0], user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const comments = await facebookService.getComments(postId, pageInfo.access_token);
        res.json(comments);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch comments');
    }
});

// Get likes for a post
router.get('/posts/:postId/likes', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { postId } = req.params;

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(postId.split('_')[0], user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const likes = await facebookService.getLikes(postId, pageInfo.access_token);
        res.json(likes);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch likes');
    }
});

// Add a comment to a post
router.post('/posts/:postId/comments', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { postId } = req.params;
        const { message } = req.body;

        if (!message) {
            res.status(400).json({
                error: 'Message Required',
                message: 'Please provide a message for the comment.'
            });
            return;
        }

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(postId.split('_')[0], user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const comment = await facebookService.addComment(postId, pageInfo.access_token, message);
        res.json(comment);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to add comment');
    }
});

// Reply to a comment
router.post('/comments/:commentId/replies', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { commentId } = req.params;
        const { message } = req.body;

        if (!message) {
            res.status(400).json({
                error: 'Message Required',
                message: 'Please provide a message for the reply.'
            });
            return;
        }

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(commentId.split('_')[0], user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const reply = await facebookService.replyToComment(commentId, pageInfo.access_token, message);
        res.json(reply);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to add reply');
    }
});

// Get post insights
router.get('/posts/:postId/insights', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { postId } = req.params;

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(postId.split('_')[0], user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        const insights = await facebookService.getPostInsights(postId, pageInfo.access_token);
        res.json(insights);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch post insights');
    }
});

// Upload video to a page
router.post('/pages/:pageId/videos', protect, upload.single('video'), async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                error: 'No Video File',
                message: 'Please provide a video file to upload.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { pageId } = req.params;
        const { title, description, message } = req.body;

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(pageId, user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        // Read the file
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileSize = fs.statSync(req.file.path).size;

        // Create post with video
        const post = await facebookService.createPost(pageId, pageInfo.access_token, {
            message,
            video_file: {
                name: req.file.originalname,
                buffer: fileBuffer,
                size: fileSize
            },
            video_title: title,
            video_description: description
        });

        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);

        res.json(post);
    } catch (error: any) {
        // Clean up the uploaded file in case of error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        sendErrorResponse(res, 500, error, 'Failed to upload video');
    }
});

// Upload video in chunks
router.post('/pages/:pageId/videos/chunked', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { pageId } = req.params;
        const { fileName, fileSize, chunk, chunkIndex, totalChunks, sessionId } = req.body;

        if (!fileName || !fileSize || !chunk || chunkIndex === undefined || !totalChunks) {
            res.status(400).json({
                error: 'Missing Parameters',
                message: 'Please provide all required parameters for chunked upload.'
            });
            return;
        }

        // Get page access token
        const pageInfo = await facebookService.getPageInfo(pageId, user.facebookAccessToken);
        if (!pageInfo || !pageInfo.access_token) {
            res.status(400).json({
                error: 'Page Access Error',
                message: 'Could not get access token for this page. Please ensure you have the necessary permissions.'
            });
            return;
        }

        let uploadSession;
        if (chunkIndex === 0) {
            // Start new upload session for first chunk
            uploadSession = await facebookService.startVideoUpload(fileName, fileSize);
        } else if (sessionId) {
            // Get upload status for resuming
            const status = await facebookService.getUploadStatus(sessionId);
            uploadSession = { id: status.id };
        } else {
            throw new Error('Session ID required for chunked upload');
        }

        // Upload the chunk
        const uploadResponse = await facebookService.uploadVideoChunk(
            uploadSession.id,
            Buffer.from(chunk, 'base64'),
            chunkIndex * chunk.length
        );

        // If this is the last chunk, publish the video
        if (chunkIndex === totalChunks - 1) {
            const { title, description, message } = req.body;
            const post = await facebookService.createPost(pageId, pageInfo.access_token, {
                message,
                video_file: {
                    name: fileName,
                    buffer: Buffer.from(chunk, 'base64'),
                    size: fileSize
                },
                video_title: title,
                video_description: description
            });
            res.json({ ...post, sessionId: uploadSession.id });
        } else {
            res.json({ sessionId: uploadSession.id });
        }
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to upload video chunk');
    }
});

// Get upload status
router.get('/videos/upload/:sessionId/status', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.facebookAccessToken) {
            res.status(401).json({
                error: 'Facebook Integration Required',
                message: 'Your Facebook account is not connected. Please visit /api/facebook/auth/login to connect.'
            });
            return;
        }

        const facebookService = new FacebookService(user.facebookAccessToken);
        const { sessionId } = req.params;

        const status = await facebookService.getUploadStatus(sessionId);
        res.json(status);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to get upload status');
    }
});

export default router;
