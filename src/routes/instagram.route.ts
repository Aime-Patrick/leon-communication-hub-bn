import { Router } from 'express';
import { InstagramController } from '../modules/instagram/controller/instagram.controller';
import { verifyWebhook } from '../modules/instagram/controller/instagram.controller';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
const router = Router();

// Public routes
router.get('/auth', InstagramController.initiateAuth);
router.get('/callback', asyncHandler(InstagramController.handleCallback));
router.get('/webhook', verifyWebhook);
router.post('/webhook', InstagramController.handleWebhook);

// Protected routes
router.get('/profile', protect, asyncHandler(InstagramController.getProfile));
router.get('/media', protect, asyncHandler(InstagramController.getMedia));
router.post('/media', protect, asyncHandler(InstagramController.createPost));
router.get('/insights', protect, asyncHandler(InstagramController.getInsights));

export default router;