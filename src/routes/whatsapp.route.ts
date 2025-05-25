import { Router } from 'express';
import { verifyWebhook, receiveMessage, getMessages, sendWhatsAppMessage, getMessagesByPhoneNumber } from '../modules/whatsapp/controller/whatsapp.controller';
import { asyncHandler } from '../utils/asyncHandler';
import whatsappMessageModel from '../models/whatsappMessage.model';

const router = Router();

// Get WhatsApp statistics
router.get('/stats', asyncHandler(async (req, res) => {
    try {
        // Get unique phone numbers (users) from messages
        const uniqueUsers = await whatsappMessageModel.distinct('from');
        
        res.json({
            totalUsers: uniqueUsers.length,
            success: true
        });
    } catch (error) {
        console.error('Error fetching WhatsApp stats:', error);
        res.status(500).json({
            error: 'Failed to fetch WhatsApp statistics',
            success: false
        });
    }
}));

router.get('/webhook', verifyWebhook);
router.post('/webhook', asyncHandler(receiveMessage));
router.get('/messages', asyncHandler(getMessages));
router.post('/send-message', asyncHandler(sendWhatsAppMessage));
router.get('/messages/:phoneNumber', asyncHandler(getMessagesByPhoneNumber));

export default router;
