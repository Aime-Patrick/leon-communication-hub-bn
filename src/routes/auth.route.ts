import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { GMAIL_CONFIG } from '../config/gmail.config';
import { body } from 'express-validator';
import { auth, AuthRequest, protect } from '../middleware/auth';
import { User } from '../models/User';
import {
    login,
    register,
    getProfile,
    changePassword,
    requestPasswordReset,
    resetPassword
} from '../controllers/auth.controller';

const router = express.Router();

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    GMAIL_CONFIG.clientId,
    GMAIL_CONFIG.clientSecret,
    GMAIL_CONFIG.redirectUri
);

// Generate authentication URL
router.get('/google', (req: Request, res: Response): void => {
    try {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly'
        ];

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            include_granted_scopes: true,
            redirect_uri: GMAIL_CONFIG.redirectUri,
            state: Math.random().toString(36).substring(7) // Add state parameter for security
        });

        console.log('Generated auth URL:', authUrl);
        res.json({ authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({
            error: 'Failed to generate authentication URL',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Handle OAuth callback (protected)
router.get('/google/callback', protect, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { code, error } = req.query;
        
        if (error) {
            console.error('OAuth error:', error);
            res.status(400).json({
                error: 'Authentication failed',
                details: error
            });
            return;
        }
        
        if (!code || typeof code !== 'string') {
            res.status(400).json({ error: 'Authorization code is required' });
            return;
        }

        console.log('Received authorization code');
        
        try {
            const { tokens } = await oauth2Client.getToken({
                code,
                redirect_uri: GMAIL_CONFIG.redirectUri // <-- Must match exactly!
            });
            console.log('Successfully obtained tokens');
            
            if (!tokens.refresh_token) {
                throw new Error('No refresh token received');
            }

            // Set up the OAuth2 client with the new tokens
            oauth2Client.setCredentials(tokens);
            const userId = req.user?.id;
            console.log('Authenticated user ID:', userId);
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Save tokens to the user in the database
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            user.gmailAccessToken = tokens.access_token;
            user.gmailRefreshToken = tokens.refresh_token;

            if (tokens.expiry_date) {
                user.gmailAccessTokenExpires = new Date(tokens.expiry_date);
            }

            await user.save();

            res.json({
                message: 'Authentication successful',
                accessToken: tokens.access_token
            });
        } catch (tokenError) {
            console.error('Error getting tokens:', tokenError);
            res.status(400).json({
                error: 'Failed to get access token',
                details: tokenError instanceof Error ? tokenError.message : 'Unknown error'
            });
        }
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).json({
            error: 'Authentication failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Login route
router.post('/login',
    [
        body('email').isEmail().withMessage('Invalid email address'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    login as any
);

// Register route
router.post('/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Invalid email address'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
    ],
    register as any
);
// Get user profile
router.get('/profile', protect, getProfile as any);

// Change password
router.put('/change-password',
    protect as any,
    [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('New password must be at least 6 characters long')
    ],
    changePassword as any
);

// Request password reset
router.post('/forgot-password',
    [
        body('email').isEmail().withMessage('Invalid email address')
    ],
    requestPasswordReset as any
);

// Reset password
router.post('/reset-password',
    [
        body('token').notEmpty().withMessage('Token is required'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
    ],
    resetPassword as any
);

export default router;