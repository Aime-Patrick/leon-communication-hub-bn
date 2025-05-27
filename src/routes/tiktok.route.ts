import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { TikTokService } from '../services/tiktok.service';
import { TIKTOK_CONFIG } from '../config/tiktok.config';
import { IUser, User } from '../models/User';
import { sendErrorResponse } from './facebook.route';
import axios from 'axios';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = express.Router();

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
        if (file.fieldname === 'video') {
            // Accept only video files for video field
            if (file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else {
                cb(new Error('Only video files are allowed for video upload'));
            }
        } else if (file.fieldname === 'coverImage') {
            // Accept only image files for cover image
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed for cover image'));
            }
        } else {
            cb(new Error('Invalid field name'));
        }
    }
});

// TikTok OAuth login
router.get('/auth/login', async (req, res) => {
    try {
        const authUrl = `https://www.tiktok.com/auth/authorize/?client_key=${TIKTOK_CONFIG.clientKey}&scope=${TIKTOK_CONFIG.scope}&response_type=code&redirect_uri=${TIKTOK_CONFIG.redirectUri}&state=${Date.now()}`;
        res.json({authUrl});
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to initiate TikTok login');
    }
});

// TikTok OAuth callback
router.get('/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            res.status(400).json({
                error: 'Missing Code',
                message: 'Authorization code is required'
            });
            return;
        }

        console.log('TikTok callback received:', { code, state });

        // Exchange code for access token
        try {
            const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
                client_key: TIKTOK_CONFIG.clientKey,
                client_secret: TIKTOK_CONFIG.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: TIKTOK_CONFIG.redirectUri
            });

            console.log('TikTok token response:', tokenResponse.data);

            const { access_token, refresh_token, expires_in } = tokenResponse.data;

            // Get user info to verify the token
            const tiktokService = new TikTokService(access_token);
            const userInfo = await tiktokService.verifyAccessToken();

            console.log('TikTok user info:', userInfo);

            // Find or create user
            let user = await User.findOne({ 'tiktok.id': userInfo.data.user.open_id });
            if (!user) {
                user = await User.create({
                    tiktok: {
                        id: userInfo.data.user.open_id,
                        accessToken: access_token,
                        refreshToken: refresh_token,
                        expiresAt: new Date(Date.now() + expires_in * 1000)
                    }
                });
            } else {
                user.tiktok = {
                    id: userInfo.data.user.open_id,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt: new Date(Date.now() + expires_in * 1000)
                };
                await user.save();
            }

            // Redirect back to frontend with success message
            res.redirect(`${process.env.FRONTEND_URL}/tiktok?message=TikTok account connected successfully`);
        } catch (error: any) {
            console.error('TikTok API Error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers,
                    data: error.config?.data
                }
            });
            throw error;
        }
    } catch (error: any) {
        console.error('TikTok callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/tiktok?error=Failed to connect TikTok account: ${error.response?.data?.message || error.message}`);
    }
});

// Get account information
router.get('/account', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.tiktok?.accessToken) {
            res.status(401).json({
                error: 'TikTok Integration Required',
                message: 'Your TikTok account is not connected. Please visit /api/tiktok/auth/login to connect.'
            });
            return;
        }

        // Check if token is expired
        if (user.tiktok.expiresAt && new Date(user.tiktok.expiresAt) < new Date()) {
            res.status(401).json({
                error: 'Token Expired',
                message: 'Your TikTok access token has expired. Please reconnect your TikTok account.',
                nextSteps: ['Visit /api/tiktok/auth/login to reconnect your TikTok account']
            });
            return;
        }

        const tiktokService = new TikTokService(user.tiktok.accessToken);
        const accountInfo = await tiktokService.getAccountInfo();
        res.json(accountInfo);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch TikTok account info');
    }
});

// Upload video
router.post('/videos', protect, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.tiktok?.accessToken) {
            res.status(401).json({
                error: 'TikTok Integration Required',
                message: 'Your TikTok account is not connected. Please visit /api/tiktok/auth/login to connect.'
            });
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files || !files['video']) {
            res.status(400).json({
                error: 'No Video File',
                message: 'Please provide a video file to upload.'
            });
            return;
        }

        const videoFile = files['video'][0];
        const coverImageFile = files['coverImage']?.[0];

        const tiktokService = new TikTokService(user.tiktok.accessToken);
        const video = await tiktokService.uploadVideo({
            description: req.body.description,
            video: fs.readFileSync(videoFile.path),
            coverImage: coverImageFile ? fs.readFileSync(coverImageFile.path) : undefined,
            privacyLevel: req.body.privacyLevel
        });

        // Clean up uploaded files
        fs.unlinkSync(videoFile.path);
        if (coverImageFile) {
            fs.unlinkSync(coverImageFile.path);
        }

        res.json(video);
    } catch (error: any) {
        // Clean up uploaded files in case of error
        if (req.files) {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (files['video']) {
                fs.unlinkSync(files['video'][0].path);
            }
            if (files['coverImage']) {
                fs.unlinkSync(files['coverImage'][0].path);
            }
        }
        sendErrorResponse(res, 500, error, 'Failed to upload video');
    }
});

// Get user's videos
router.get('/videos', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.tiktok?.accessToken) {
            res.status(401).json({
                error: 'TikTok Integration Required',
                message: 'Your TikTok account is not connected. Please visit /api/tiktok/auth/login to connect.'
            });
            return;
        }

        const tiktokService = new TikTokService(user.tiktok.accessToken);
        const { videos, nextCursor } = await tiktokService.getVideos(req.query.cursor as string);
        res.json({ videos, nextCursor });
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch videos');
    }
});

// Get video statistics
router.get('/videos/:videoId/stats', protect, async (req: AuthRequest, res) => {
    try {
        const user: IUser = req.user as IUser;
        if (!user || !user.tiktok?.accessToken) {
            res.status(401).json({
                error: 'TikTok Integration Required',
                message: 'Your TikTok account is not connected. Please visit /api/tiktok/auth/login to connect.'
            });
            return;
        }

        const tiktokService = new TikTokService(user.tiktok.accessToken);
        const stats = await tiktokService.getVideoStats(req.params.videoId);
        res.json(stats);
    } catch (error: any) {
        sendErrorResponse(res, 500, error, 'Failed to fetch video statistics');
    }
});

export default router; 