import axios from 'axios';
import WhatsAppMessage from '../models/whatsappMessage.model';
import dotenv from 'dotenv';
import { io } from '../server';
dotenv.config();
const WHATSAPP_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

export const handleIncomingMessage = async (message: any) => {
  const from = message.from;
  const text = message.text?.body || 'No message text';

  console.log(`📥 New message from ${from}: ${text}`);
  await WhatsAppMessage.create({
    from,
    type: 'incoming',
    message: text,
  });

  // // Echo back the message
  // await sendMessage(from, `Received: ${text}`);

  io.emit('new_message', {
    from,
    message: text,
    timestamp: new Date(),
  });
};

export const sendMessage = async (to: string, text: string) => {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    await WhatsAppMessage.create({
        from: 'LeonHub',
        to,
        type: 'outgoing',
        message: text,
      });

    console.log(`📤 Sent message to ${to}`);
  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
  }
};
