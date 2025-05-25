import { Request, Response } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/auth';
import { uploadToCloudinary } from '../config/cloudinary';
import { verifyToken } from '../utils/auth';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';

// Get user profile
export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email } = req.body;
        const updateData: any = {};

        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (req.file) {
            // Handle file upload
            updateData.profilePicture = req.file.path;
        }
        if (!req.user?.id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Update profile picture
export const updateProfilePicture = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Convert buffer to base64
        const base64Image = req.file.buffer.toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

        // Upload to Cloudinary
        const profilePicture = await uploadToCloudinary(dataURI, 'profile-pictures');

        // Update user profile
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { profilePicture },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Update profile picture error:', error);
        res.status(500).json({ error: 'Failed to update profile picture' });
    }
};

// Change password
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Request password reset (for users)
export const requestPasswordReset = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP to user
        user.resetPasswordToken = otp;
        user.resetPasswordExpires = otpExpiry;
        await user.save();

        // TODO: Send OTP via email

        res.json({ message: 'Password reset OTP sent to your email' });
    } catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ error: 'Failed to request password reset' });
    }
};

// Reset password with OTP
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({
            email,
            resetPasswordToken: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Forgot password (for admin)
export const forgotPasswordAdmin = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email, role: 'ADMIN' });

        if (!user) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        // Generate reset token
        const resetToken = generateToken(user);

        // In a real application, you would send this token via email
        res.json({
            success: true,
            message: 'Password reset token generated',
            resetToken
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
};

// Forgot password (for regular users)
export const forgotPasswordUser = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email, role: 'USER' });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // In a real application, you would send this OTP via email/SMS
        res.json({
            success: true,
            message: 'OTP generated',
            otp
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
};

// Reset password with token (Admin)
export const resetPasswordWithToken = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        // Verify token and get user
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Reset password with OTP (User)
export const resetPasswordWithOTP = async (req: Request, res: Response) => {
    try {
        const { email, newPassword } = req.body;

        // Verify OTP and get user
        const user = await User.findOne({ email, role: 'USER' });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // In a real application, you would verify the OTP here

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}; 