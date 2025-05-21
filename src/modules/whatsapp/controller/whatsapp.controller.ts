import { Request, Response } from "express";
import { handleIncomingMessage, sendMessage } from "../../../services/whatsapp.service";
import WhatsAppMessage from "../../../models/whatsappMessage.model";
import dotenv from "dotenv";
dotenv.config();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
console.log(VERIFY_TOKEN)

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];


  if (!mode || !token || !challenge) {
    res.sendStatus(400);
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const receiveMessage = async (req: Request, res: Response) => {
  const entry = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (entry) {
    await handleIncomingMessage(entry);
  }

  res.sendStatus(200);
};

export const sendWhatsAppMessage = async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "Missing fields" });
    await sendMessage(to, message);
    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const messages = await WhatsAppMessage.find();
    res.json(messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessagesByPhoneNumber = async (req: Request, res: Response) => {
  const { phoneNumber } = req.params;
  try {
    const messages = await WhatsAppMessage.find({ from: phoneNumber });
    res.json(messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
