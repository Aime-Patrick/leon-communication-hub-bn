import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/auth';
import { AppConfig } from '../models/AppConfig';
import { User, IUser } from '../models/User';
import multer from 'multer';
import { uploadToCloudinary } from '../config/cloudinary';

const router = Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
    },
});

// Check if setup is complete
router.get('/status', async (req: Request, res: Response) => {
    try {
        const adminCount = await User.countDocuments({ role: 'ADMIN' });
        res.json({ isSetupComplete: adminCount > 0 });
    } catch (error) {
        console.error('Setup status check error:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// Upload logo route
router.post('/upload-logo', upload.single('logo'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        // Convert buffer to base64
        const base64Image = req.file.buffer.toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

        // Upload to Cloudinary
        const logoUrl = await uploadToCloudinary(dataURI, 'app-logos');

        // Save to database
        await AppConfig.findOneAndUpdate(
            {},
            { logoUrl },
            { upsert: true, new: true }
        );

        res.json({ logoUrl });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});

// Save app information
router.post('/app-info',
    [
        body('appName').trim().notEmpty().withMessage('App name is required'),
        body('logoUrl').optional().isURL().withMessage('Invalid logo URL')
    ],
    async (req: Request, res: Response) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { appName, logoUrl } = req.body;

            // Save app configuration
            await AppConfig.findOneAndUpdate(
                {},
                { appName, logoUrl },
                { upsert: true, new: true }
            );

            res.json({ message: 'App information saved successfully' });
        } catch (error) {
            console.error('Save app info error:', error);
            res.status(500).json({ error: 'Failed to save app information' });
        }
    }
);

// Create admin account
router.post('/admin-account',
    [
        body('email').isEmail().withMessage('Invalid email address'),
        body('name').trim().notEmpty().withMessage('Name is required')
    ],
    async (req: Request, res: Response) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, name, password } = req.body;

            // Check if admin already exists
            const existingAdmin = await User.findOne({ role: 'ADMIN' });

            if (existingAdmin) {
                res.status(400).json({ error: 'Admin account already exists' });
                return;
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            // Create admin user
            const admin = await User.create({
                email,
                name,
                password: hashedPassword,
                role: 'ADMIN'
            });

            // Generate token using the Mongoose document directly
            const token = generateToken(admin);

            res.json({
                message: 'Admin account created successfully',
                token,
            });
        } catch (error) {
            console.error('Create admin account error:', error);
            res.status(500).json({ error: 'Failed to create admin account' });
        }
    }
);

export default router; 