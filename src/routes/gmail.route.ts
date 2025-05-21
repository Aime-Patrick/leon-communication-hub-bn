import express, { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { GMAIL_CONFIG } from '../config/gmail.config';

const router = express.Router();

// Create Gmail API client
const gmail = google.gmail('v1');

// Extend Express Request type to include oauth2Client
declare global {
    namespace Express {
        interface Request {
            oauth2Client: any;
        }
    }
}

// Middleware to verify Gmail access token
const verifyGmailToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No access token provided' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const oauth2Client = new google.auth.OAuth2(
            GMAIL_CONFIG.clientId,
            GMAIL_CONFIG.clientSecret,
            GMAIL_CONFIG.redirectUri
        );

        oauth2Client.setCredentials({ access_token: token });
        req.oauth2Client = oauth2Client;
        next();
    } catch (error) {
        next(error);
    }
};

// Get list of emails
router.get('/messages', verifyGmailToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const response = await gmail.users.messages.list({
            auth: req.oauth2Client,
            userId: 'me',
            maxResults: 20,
            q: 'in:inbox'
        });

        const messages = await Promise.all(
            response.data.messages?.map(async (message) => {
                const email = await gmail.users.messages.get({
                    auth: req.oauth2Client,
                    userId: 'me',
                    id: message.id!
                });

                const headers = email.data.payload?.headers;
                const subject = headers?.find(h => h.name === 'Subject')?.value || '(No subject)';
                const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
                const date = headers?.find(h => h.name === 'Date')?.value || '';

                return {
                    id: message.id,
                    from,
                    subject,
                    snippet: email.data.snippet,
                    date,
                    isRead: !email.data.labelIds?.includes('UNREAD')
                };
            }) || []
        );

        res.json({ messages });
    } catch (error) {
        next(error);
    }
});

// Send email
router.post('/send', verifyGmailToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { to, subject, body } = req.body;

        if (!to || !subject || !body) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const message = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            'MIME-Version: 1.0\n',
            `To: ${to}\n`,
            `Subject: ${subject}\n\n`,
            body
        ].join('');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            auth: req.oauth2Client,
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        res.json({ message: 'Email sent successfully' });
    } catch (error) {
        next(error);
    }
});

// Get email details
router.get('/messages/:messageId', verifyGmailToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const response = await gmail.users.messages.get({
            auth: req.oauth2Client,
            userId: 'me',
            id: messageId
        });

        const headers = response.data.payload?.headers;
        const subject = headers?.find(h => h.name === 'Subject')?.value || '(No subject)';
        const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
        const date = headers?.find(h => h.name === 'Date')?.value || '';

        // Get email body
        let body = '';
        if (response.data.payload?.body?.data) {
            body = Buffer.from(response.data.payload.body.data, 'base64').toString();
        } else if (response.data.payload?.parts?.[0]?.body?.data) {
            body = Buffer.from(response.data.payload.parts[0].body.data, 'base64').toString();
        }

        res.json({
            id: messageId,
            from,
            subject,
            date,
            body,
            isRead: !response.data.labelIds?.includes('UNREAD')
        });
    } catch (error) {
        next(error);
    }
});

export default router; 