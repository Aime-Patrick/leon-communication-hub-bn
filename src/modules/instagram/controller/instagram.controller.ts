import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
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