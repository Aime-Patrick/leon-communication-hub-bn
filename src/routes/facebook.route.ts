import express from 'express';
import { FacebookService, CampaignData, PageData } from '../services/facebook.service';

const router = express.Router();
const facebookService = new FacebookService();

// Verify permissions
router.get('/verify-permissions', async (req, res) => {
    try {
        const permissions = await facebookService.verifyPermissions();
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to verify permissions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get all campaigns
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await facebookService.getCampaigns();
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// Create a new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const campaignData: CampaignData = req.body;
        const campaign = await facebookService.createCampaign(campaignData);
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to create campaign',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get ad sets for a campaign
router.get('/campaigns/:campaignId/ad-sets', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const adSets = await facebookService.getAdSets(campaignId);
        res.json(adSets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ad sets' });
    }
});

// Create a new ad set
router.post('/campaigns/:campaignId/ad-sets', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const adSet = await facebookService.createAdSet(campaignId, req.body);
        res.json(adSet);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ad set' });
    }
});

// Get ads for an ad set
router.get('/ad-sets/:adSetId/ads', async (req, res) => {
    try {
        const { adSetId } = req.params;
        const ads = await facebookService.getAds(adSetId);
        res.json(ads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});

// Create a new ad
router.post('/ad-sets/:adSetId/ads', async (req, res) => {
    try {
        const { adSetId } = req.params;
        const ad = await facebookService.createAd(adSetId, req.body);
        res.json(ad);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ad' });
    }
});

// Get insights
router.get('/insights', async (req, res) => {
    try {
        const insights = await facebookService.getInsights(req.query);
        res.json(insights);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

// Get business information
router.get('/business-info', async (req, res) => {
    try {
        const businessInfo = await facebookService.getBusinessInfo();
        res.json(businessInfo);
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            code: error.code,
            subcode: error.subcode,
            error_user_msg: error.error_user_msg
        });
    }
});

// Create a new Facebook Page
router.post('/pages', async (req, res) => {
    try {
        const pageData: PageData = req.body;
        const page = await facebookService.createPage(pageData);
        res.json(page);
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            code: error.code,
            subcode: error.subcode,
            error_user_msg: error.error_user_msg
        });
    }
});

// Get all pages
router.get('/pages', async (req, res) => {
    try {
        const pages = await facebookService.getPages();
        res.json(pages);
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            code: error.code,
            subcode: error.subcode,
            error_user_msg: error.error_user_msg
        });
    }
});

// Update page information
router.put('/pages/:pageId', async (req, res) => {
    try {
        const { pageId } = req.params;
        const updates: Partial<PageData> = req.body;
        const page = await facebookService.updatePage(pageId, updates);
        res.json(page);
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            code: error.code,
            subcode: error.subcode,
            error_user_msg: error.error_user_msg
        });
    }
});

export default router; 