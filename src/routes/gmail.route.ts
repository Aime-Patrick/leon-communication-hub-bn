import express, { NextFunction, Request, Response } from "express";
import { google } from "googleapis";
import { GMAIL_CONFIG } from "../config/gmail.config";
import { Email } from "../models/Email";
import { auth } from "../middleware/auth";
import { GmailService } from "../services/gmail.service";
import { getAuthenticatedGmailClient } from "../middleware/gmail.auth";
import { getValidGmailAccessToken } from "../utils/refreshToken";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";

const gmailService = new GmailService();
const router = express.Router();

// Create Gmail API client
const gmail = google.gmail("v1");

// Extend Express Request type to include oauth2Client
declare global {
  namespace Express {
    interface Request {
      oauth2Client: any;
    }
  }
}

// Middleware to verify Gmail access token
const verifyGmailToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: "User not authenticated",
        success: false,
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user?.gmailAccessToken || !user?.gmailRefreshToken) {
      res.status(401).json({
        error: "PLease connect your Gmail account first",
        success: false,
      });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CONFIG.clientId,
      GMAIL_CONFIG.clientSecret,
      GMAIL_CONFIG.redirectUri
    );

    // Set up the OAuth2 client with the stored tokens
    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken,
      expiry_date: user.gmailAccessTokenExpires?.getTime()
    });

    // Try to refresh the token if it's expired
    if (user.gmailAccessTokenExpires && user.gmailAccessTokenExpires.getTime() < Date.now()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update user's tokens in database
        user.gmailAccessToken = credentials.access_token!;
        user.gmailAccessTokenExpires = credentials.expiry_date 
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000); // fallback 1 hour
        
        await user.save();

        // Update the OAuth2 client with new credentials
        oauth2Client.setCredentials(credentials);
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        res.status(401).json({
          error: "Failed to refresh Gmail token",
          success: false,
        });
        return;
      }
    }

    req.oauth2Client = oauth2Client;
    next();
  } catch (error) {
    console.error("Error in verifyGmailToken:", error);
    res.status(401).json({
      error: "Invalid or expired token",
      success: false,
    });
  }
};

router.get('/verify', auth.protect, verifyGmailToken, async (req: AuthRequest, res: Response) => {
  try{
    res.json({
      success: true,
    });
  }catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to verify Gmail token",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
})

// Get Gmail statistics
router.get("/stats", auth.protect, verifyGmailToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
    res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const gmail = await gmailService.getGmailClient(userId);
    const response = await gmail.users.getProfile({ userId: 'me' });

    res.json({
      success: true,
      data: {
        totalEmails: response.data.messagesTotal || 0,
        historyId: response.data.historyId,
        emailAddress: response.data.emailAddress
      }
    });
  } catch (error) {
    console.error("Error fetching Gmail stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Gmail statistics",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get emails by folder
router.get(
  "/messages/:folder",
  auth.protect,
  verifyGmailToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'User not authenticated' 
        });
        return;
      }

      const folder = req.params.folder || 'inbox';
      const maxResults = parseInt(req.query.maxResults as string) || 10;
      const pageToken = req.query.pageToken as string;

      const result = await gmailService.getEmails(userId, folder, maxResults, pageToken);

      res.json({
        success: true,
        data: result.emails,
        pagination: {
          nextPageToken: result.nextPageToken,
          resultSizeEstimate: result.resultSizeEstimate
        }
      });
    } catch (error) {
      console.error('Failed to fetch Gmail messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Gmail messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get email details
router.get(
  "/messages/:messageId",
  auth.protect,
  verifyGmailToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'User not authenticated' 
        });
      }

      const messageId = req.params.messageId;
      const email = await gmailService.getEmailById(userId, messageId);

      res.json({
        success: true,
        data: email
      });
    } catch (error) {
      console.error('Error fetching email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch email',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/gmail/messages', auth.protect, async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;

        if (!user.gmailRefreshToken) {
            res.status(403).json({ message: 'Gmail not connected' });
        }

        // Get a valid Gmail access token (refresh if expired)
        const accessToken = await getValidGmailAccessToken(user._id);

        if (!accessToken) {
            res.status(401).json({ message: 'Could not get Gmail access token' });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const response = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });

        res.json(response.data);
    } catch (error) {
        console.error('Failed to fetch Gmail messages:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail messages' });
    }
});

// Send email
router.post('/send', auth.protect, verifyGmailToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ 
                success: false, 
                error: 'User not authenticated' 
            });
            return;
        }

        const { to, subject, body } = req.body;
        if (!to || !subject || !body) {
            res.status(400).json({ 
                success: false,
                error: 'Missing required fields'
            });
            return;
        }

        const result = await gmailService.sendEmail(userId, to, subject, body);

        res.json({
            success: true,
            message: 'Email sent successfully',
            data: result
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
