import { google } from 'googleapis';
import { GMAIL_CONFIG } from '../config/gmail.config';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User';

export class GmailService {
    private oauth2Client: OAuth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            GMAIL_CONFIG.clientId,
            GMAIL_CONFIG.clientSecret,
            GMAIL_CONFIG.redirectUri
        );
    }

    async getGmailClient(userId: string) {
        const user = await User.findById(userId);
        if (!user?.gmailRefreshToken) {
            throw new Error('No Gmail refresh token found');
        }

        // Set up the OAuth2 client with the stored tokens
        this.oauth2Client.setCredentials({
            refresh_token: user.gmailRefreshToken,
            access_token: user.gmailAccessToken,
            expiry_date: user.gmailAccessTokenExpires?.getTime()
        });

        // Refresh token if needed
        if (user.gmailAccessTokenExpires && user.gmailAccessTokenExpires.getTime() < Date.now()) {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            
            // Update user's tokens
            user.gmailAccessToken = credentials.access_token!;
            user.gmailAccessTokenExpires = credentials.expiry_date 
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000); // fallback 1 hour
            
            await user.save();
        }

        return google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    async getEmails(userId: string, folder: string = 'INBOX', maxResults: number = 10, pageToken?: string) {
        try {
            const gmail = await this.getGmailClient(userId);
            const query = folder === 'STARRED' ? 'is:starred' : `in:${folder.toLowerCase()}`;
            
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q: query,
                pageToken
            });

            const messages = response.data.messages || [];
            const emails = await Promise.all(
                messages.map(async (message) => {
                    const email = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id!
                    });
                    return this.formatEmail(email.data);
                })
            );

            return {
                emails,
                nextPageToken: response.data.nextPageToken,
                resultSizeEstimate: response.data.resultSizeEstimate
            };
        } catch (error) {
            console.error('Error fetching emails:', error);
            throw error;
        }
    }

    private formatEmail(email: any) {
        const headers = email.payload.headers;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';
        const to = headers.find((h: any) => h.name === 'To')?.value || '';

        // Get email body and attachments
        let body = '';
        let images: { id: string; url: string }[] = [];

        if (email.payload.parts) {
            email.payload.parts.forEach((part: any) => {
                if (part.mimeType === 'text/plain') {
                    body = Buffer.from(part.body.data, 'base64').toString();
                } else if (part.mimeType.startsWith('image/')) {
                    images.push({
                        id: part.body.attachmentId || '',
                        url: `data:${part.mimeType};base64,${part.body.data}`
                    });
                }
            });
        } else if (email.payload.body.data) {
            body = Buffer.from(email.payload.body.data, 'base64').toString();
        }

        return {
            id: email.id,
            threadId: email.threadId,
            subject,
            from,
            to: to.split(',').map((email: string) => email.trim()),
            date,
            snippet: email.snippet,
            body,
            images,
            isRead: !email.labelIds?.includes('UNREAD'),
            isStarred: email.labelIds?.includes('STARRED') || false
        };
    }

    // Send an email
    async sendEmail(userId: string, to: string, subject: string, body: string) {
        try {
            const gmail = await this.getGmailClient(userId);
    
            const message = [
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `To: ${to}`,
                'From: me',
                `Subject: ${subject}`,
                '',
                body
            ].join('\n');
    
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
    
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });
    
            return response.data;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
    
    async getEmailById(userId: string, messageId: string) {
        try {
            const gmail = await this.getGmailClient(userId);
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId
            });
            return this.formatEmail(response.data);
        } catch (error) {
            console.error('Error fetching email:', error);
            throw error;
        }
    }
} 