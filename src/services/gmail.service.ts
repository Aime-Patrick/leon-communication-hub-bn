import { google } from 'googleapis';
import { GMAIL_CONFIG } from '../config/gmail.config';

export class GmailService {
    private gmail;

    constructor() {
        const oauth2Client = new google.auth.OAuth2(
            GMAIL_CONFIG.clientId,
            GMAIL_CONFIG.clientSecret,
            GMAIL_CONFIG.redirectUri
        );

        oauth2Client.setCredentials({
            refresh_token: GMAIL_CONFIG.refreshToken
        });

        this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    }

    // Send an email
    async sendEmail(to: string, subject: string, body: string) {
        try {
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

            const response = await this.gmail.users.messages.send({
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

    // Get list of emails
    async getEmails(maxResults: number = 10) {
        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                maxResults
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching emails:', error);
            throw error;
        }
    }

    // Get a specific email by ID
    async getEmailById(messageId: string) {
        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageId
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching email:', error);
            throw error;
        }
    }
} 