import express from 'express';
import { TikTokService } from '../services/tiktok.service';

const router = express.Router();
const tiktokService = new TikTokService();

// Create a new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const campaign = await tiktokService.createCampaign(req.body);
        res.json(campaign);
    } catch (error: any) {
        res.status(400).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// Get all campaigns
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await tiktokService.getCampaigns();
        res.json(campaigns);
    } catch (error: any) {
        res.status(400).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// Create a new ad group
router.post('/adgroups', async (req, res) => {
    try {
        const adGroup = await tiktokService.createAdGroup(req.body);
        res.json(adGroup);
    } catch (error: any) {
        res.status(400).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// Get ad groups for a campaign
router.get('/campaigns/:campaignId/adgroups', async (req, res) => {
    try {
        const adGroups = await tiktokService.getAdGroups(req.params.campaignId);
        res.json(adGroups);
    } catch (error: any) {
        res.status(400).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

export default router; 