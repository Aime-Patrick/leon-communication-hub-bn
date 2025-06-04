import { Request, Response } from "express";
import dotenv from "dotenv";
import { InstagramService } from '../../../services/instagram.service';
import { INSTAGRAM_CONFIG } from '../../../config/instagram.config';
import { User } from '../../../models/User';
import { FACEBOOK_CONFIG } from "../../../config/facebook.config";
dotenv.config();
const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ID;

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!mode || !token || !challenge) {
    res.sendStatus(400);
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export class InstagramController {
    /**
     * Initialize Instagram OAuth flow
     */
    static async initiateAuth(req: Request, res: Response) {
        try {
            const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_CONFIG.appId}&redirect_uri=${INSTAGRAM_CONFIG.redirectUri}&scope=${INSTAGRAM_CONFIG.scopes.join(',')}&response_type=code`;
            res.json({ authUrl });
        } catch (error: any) {
            console.error('Error initiating Instagram auth:', error);
            res.status(500).json({ error: 'Failed to initiate Instagram authentication' });
        }
    }

    /**
     * Handle Instagram OAuth callback
     */
    static async handleCallback(req: Request, res: Response) {
        try {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ error: 'Authorization code is required' });
            }

            console.log('Starting Instagram OAuth flow with code:', code);
            console.log('Using app ID:', INSTAGRAM_CONFIG.appId);
            console.log('Using redirect URI:', INSTAGRAM_CONFIG.redirectUri);

            // Exchange code for access token using Facebook Graph API
            const tokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
            tokenUrl.searchParams.append('client_id', INSTAGRAM_CONFIG.appId!);
            tokenUrl.searchParams.append('client_secret', INSTAGRAM_CONFIG.appSecret!);
            tokenUrl.searchParams.append('redirect_uri', INSTAGRAM_CONFIG.redirectUri!);
            tokenUrl.searchParams.append('code', code as string);

            console.log('Token exchange URL:', tokenUrl.toString());

            const tokenResponse = await fetch(tokenUrl.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            const responseText = await tokenResponse.text();
            console.log('Token exchange response:', responseText);

            if (!tokenResponse.ok) {
                throw new Error(`Failed to exchange code for token: ${responseText}`);
            }

            const tokenData = JSON.parse(responseText) as { access_token: string };
            if (!tokenData.access_token) {
                throw new Error('No access token in response');
            }

            console.log('Successfully obtained short-lived token');

            // Get long-lived access token
            const longLivedTokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
            longLivedTokenUrl.searchParams.append('grant_type', 'fb_exchange_token');
            longLivedTokenUrl.searchParams.append('client_id', INSTAGRAM_CONFIG.appId!);
            longLivedTokenUrl.searchParams.append('client_secret', INSTAGRAM_CONFIG.appSecret!);
            longLivedTokenUrl.searchParams.append('fb_exchange_token', tokenData.access_token);

            console.log('Long-lived token exchange URL:', longLivedTokenUrl.toString());

            const longLivedTokenResponse = await fetch(longLivedTokenUrl.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            const longLivedResponseText = await longLivedTokenResponse.text();
            console.log('Long-lived token response:', longLivedResponseText);

            if (!longLivedTokenResponse.ok) {
                throw new Error(`Failed to get long-lived token: ${longLivedResponseText}`);
            }

            const longLivedTokenData = JSON.parse(longLivedResponseText) as { access_token: string };
            if (!longLivedTokenData.access_token) {
                throw new Error('No long-lived access token in response');
            }

            console.log('Successfully obtained long-lived token');

            // Get user's Instagram business account
            const instagramService = new InstagramService(longLivedTokenData.access_token);
            const userProfile = await instagramService.getUserProfile();

            console.log('Successfully retrieved user profile:', userProfile);

            // Update user in database
            const user = await User.findById(req.user?._id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.instagram = {
                accessToken: longLivedTokenData.access_token,
                userId: userProfile.id,
                username: userProfile.username,
            };

            await user.save();
            console.log('Successfully saved user Instagram data');

            res.json({ message: 'Instagram account connected successfully' });
        } catch (error: any) {
            console.error('Error handling Instagram callback:', error);
            res.status(500).json({ 
                error: 'Failed to connect Instagram account',
                details: error.message 
            });
        }
    }

    /**
     * Get user's Instagram profile
     */
    static async getProfile(req: Request, res: Response) {
        try {
            const user = await User.findById(req.user?._id);
            // Use user's token if present, otherwise use dev token
            const accessToken = user?.instagram?.accessToken || VERIFY_TOKEN;
            if (!accessToken) {
                return res.status(400).json({ error: 'Instagram account not connected' });
            }

            const instagramService = new InstagramService(accessToken);
            const profile = await instagramService.getUserProfile();
            res.json(profile);
        } catch (error: any) {
            console.error('Error getting Instagram profile:', error);
            res.status(500).json({ error: 'Failed to get Instagram profile' });
        }
    }

    /**
     * Get user's Instagram media
     */
    static async getMedia(req: Request, res: Response) {
        try {
            const user = await User.findById(req.user?._id);
            const accessToken = user?.instagram?.accessToken || VERIFY_TOKEN;
            if (!accessToken) {
                return res.status(400).json({ error: 'Instagram account not connected' });
            }

            const instagramService = new InstagramService(accessToken);
            const media = await instagramService.getMedia();
            res.json(media);
        } catch (error: any) {
            console.error('Error getting Instagram media:', error);
            res.status(500).json({ error: 'Failed to get Instagram media' });
        }
    }

    /**
     * Create a new Instagram post
     */
    static async createPost(req: Request, res: Response) {
        try {
            const user = await User.findById(req.user?._id);
            const accessToken = user?.instagram?.accessToken || VERIFY_TOKEN;
            if (!accessToken) {
                return res.status(400).json({ error: 'Instagram account not connected' });
            }

            const instagramService = new InstagramService(accessToken);

            const { image_url, video_url, caption, media_type } = req.body;
            if (!image_url && !video_url) {
                return res.status(400).json({ error: 'Either image_url or video_url is required' });
            }
            const result = await instagramService.createMediaPost({
                image_url,
                video_url,
                caption,
                media_type,
            });

            res.json(result);
        } catch (error: any) {
            console.error('Error creating Instagram post:', error);
            res.status(500).json({ error: 'Failed to create Instagram post' });
        }
    }

    /**
     * Get Instagram insights
     */
    static async getInsights(req: Request, res: Response) {
        try {
            const user = await User.findById(req.user?._id);
            const accessToken = user?.instagram?.accessToken || VERIFY_TOKEN;
            const businessAccountId = user?.instagram?.userId || FACEBOOK_CONFIG.businessId;
            if (!accessToken) {
                return res.status(400).json({ error: 'Instagram account not connected' });
            }

            const instagramService = new InstagramService(accessToken, businessAccountId);
            const insights = await instagramService.getAccountInsights();
            res.json(insights);
        } catch (error: any) {
            console.error('Error getting Instagram insights:', error);
            res.status(500).json({ error: 'Failed to get Instagram insights' });
        }
    }

    /**
     * Handle Instagram webhook events
     */
    static async handleWebhook(req: Request, res: Response) {
        try {
            const { object, entry } = req.body;

            if (object === 'instagram') {
                for (const item of entry) {
                    const changes = item.changes;
                    for (const change of changes) {
                        // Handle different types of webhook events
                        switch (change.field) {
                            case 'mentions':
                                // Handle new mentions
                                break;
                            case 'comments':
                                // Handle new comments
                                break;
                            case 'story_insights':
                                // Handle story insights
                                break;
                            default:
                                console.log('Unhandled webhook event:', change.field);
                        }
                    }
                }
            }

            res.sendStatus(200);
        } catch (error: any) {
            console.error('Error handling webhook:', error);
            res.sendStatus(500);
        }
    }
}