import { Router } from 'express';
import { verifyWebhook, receiveMessage, getMessages, sendWhatsAppMessage,getMessagesByPhoneNumber } from '../modules/whatsapp/controller/whatsapp.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/webhook', verifyWebhook);
router.post('/webhook', asyncHandler(receiveMessage));
router.get('/messages', asyncHandler(getMessages));
router.get('/messages/:phoneNumber', asyncHandler(getMessagesByPhoneNumber));
router.post('/send-message', asyncHandler(sendWhatsAppMessage));

export default router;
