import { Request, Response, RequestHandler } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { generateToken, generateResetToken } from '../utils/auth';
import { getResetPasswordEmailTemplate } from '../templates/resetPasswordEmail';
import { sendEmail } from '../utils/email';
import { verifyResetToken } from '../utils/auth';
import { AuthRequest } from '../middleware/auth';

// Login user
export const login: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found for email:', email);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate token
        const token = generateToken(user);

        // Set session data
        (req as any).session.userId = user._id;
        (req as any).session.user = {
            id: user._id,
            email: user.email,
            role: user.role
        };

        // Save session
        (req as any).session.save((err: any) => {
            if (err) {
                console.error('Error saving session:', err);
                res.status(500).json({ error: 'Failed to create session' });
                return;
            }

            // If this is the first login, update isFirstLogin to false
            if (user.isFirstLogin) {
                user.isFirstLogin = false;
                user.save().catch(err => console.error('Error updating isFirstLogin:', err));
            }

            console.log('Session created for user:', {
                userId: user._id,
                sessionId: (req as any).sessionID
            });

            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isFirstLogin: user.isFirstLogin,
                    // Include Facebook-related data
                    facebookAccessToken: user.facebookAccessToken,
                    facebookAdAccountId: user.facebookAdAccountId,
                    facebookBusinessId: user.facebookBusinessId,
                    facebookPageId: user.facebookPageId,
                    facebookPageAccessToken: user.facebookPageAccessToken
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
};

// Register user
export const register: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists' });
            return;
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: 'USER'
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isFirstLogin: user.isFirstLogin
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register' });
    }
};

// Get user profile
export const getProfile: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

// Change password
export const changePassword: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            res.status(400).json({ error: 'Current password is incorrect' });
            return;
        }

        // Set new password (will be hashed by the pre-save middleware)
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Request password reset
export const requestPasswordReset: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Generate reset token with user's email
        const resetToken = generateResetToken(user.email);
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();

        // Create reset URL
        const resetUrl = `${process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL_PROD : process.env.FRONTEND_URL_DEV}/reset-password?token=${resetToken}`;

        // Send reset email
        const emailContent = getResetPasswordEmailTemplate(resetUrl, user.name);
        await sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            html: emailContent
        });

        res.json({ 
            message: 'Password reset instructions have been sent to your email'
        });
    } catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ error: 'Failed to send reset email' });
    }
};

// Reset password
export const resetPassword: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, newPassword } = req.body;
        console.log('Reset password attempt with token:', token);

        // Verify the reset token and get the email
        const email = await verifyResetToken(token);
        if (!email) {
            console.log('Invalid reset token');
            res.status(400).json({ error: 'Invalid or expired token' });
            return;
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            console.log('No user found for email:', email);
            res.status(400).json({ error: 'User not found' });
            return;
        }

        // Verify the token matches the stored token
        if (user.resetPasswordToken !== token) {
            console.log('Token mismatch');
            res.status(400).json({ error: 'Invalid token' });
            return;
        }

        // Check if token has expired
        if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
            console.log('Token expired');
            res.status(400).json({ error: 'Token has expired' });
            return;
        }

        console.log('Found user for password reset:', user.email);

        // Set the new password (will be hashed by the pre-save middleware)
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        console.log('Password updated successfully for user:', user.email);

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}; 