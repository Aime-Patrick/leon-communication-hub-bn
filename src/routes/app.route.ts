import { Router, Request, Response } from 'express';
import { AppConfig } from '../models/AppConfig';

const router = Router();

// Get app configuration
router.get('/config', async (req: Request, res: Response) => {
    try {
        const config = await AppConfig.findOne();
        if (!config) {
            // Return default config if none exists
            res.json({
                appName: 'Leon',
                logoUrl: null
            });
            return;
        }
        res.json({
            appName: config.appName,
            logoUrl: config.logoUrl
        });
    } catch (error) {
        console.error('Error fetching app config:', error);
        res.status(500).json({ error: 'Failed to fetch app configuration' });
    }
});

export default router; 