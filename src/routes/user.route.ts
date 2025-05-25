import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { auth } from '../middleware/auth';
import {
    updateProfile,
    forgotPasswordAdmin,
    forgotPasswordUser,
    resetPasswordWithToken,
    resetPasswordWithOTP,
    getProfile
} from '../controllers/user.controller';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Get user profile
router.get('/profile', auth.protect, getProfile as any);

// Update profile
router.put('/profile',
    auth.protect,
    upload.single('profilePicture'),
    [
        body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
        body('email').optional().isEmail().withMessage('Invalid email address')
    ],
    updateProfile as any
);

// Forgot password - Admin
router.post('/forgot-password/admin',
    [
        body('email').isEmail().withMessage('Invalid email address')
    ],
    forgotPasswordAdmin as any
);

// Forgot password - User
router.post('/forgot-password/user',
    [
        body('email').isEmail().withMessage('Invalid email address')
    ],
    forgotPasswordUser as any
);

// Reset password with token (Admin)
router.post('/reset-password/token',
    [
        body('token').notEmpty().withMessage('Token is required'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
    ],
    resetPasswordWithToken as any
);

// Reset password with OTP (User)
router.post('/reset-password/otp',
    [
        body('email').isEmail().withMessage('Invalid email address'),
        body('otp').isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
    ],
    resetPasswordWithOTP as any
);

export default router; 