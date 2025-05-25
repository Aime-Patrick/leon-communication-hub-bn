import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getAuthUrl,
  handleCallback,
  verifyToken,
  getVideos,
  searchVideos,
} from '../controllers/tiktok.controller';

const router = Router();

// Public routes
router.get('/auth', getAuthUrl);
router.get('/callback', handleCallback);

// Protected routes
router.get('/verify', authenticateToken, verifyToken);
router.get('/videos', authenticateToken, getVideos);
router.get('/search', authenticateToken, searchVideos);

export default router; 