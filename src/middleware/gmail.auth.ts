import { google } from 'googleapis';
import { GMAIL_CONFIG } from '../config/gmail.config';

export const getAuthenticatedGmailClient = async (refreshToken: string) => {
    const oauth2Client = new google.auth.OAuth2(
        GMAIL_CONFIG.clientId,
        GMAIL_CONFIG.clientSecret,
        GMAIL_CONFIG.redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Refresh access token if needed
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Now oauth2Client has a valid access token
    return google.gmail({ version: 'v1', auth: oauth2Client });
};
