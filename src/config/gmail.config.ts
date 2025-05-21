import dotenv from 'dotenv';

dotenv.config();

// Gmail API Configuration
export const GMAIL_CONFIG = {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN
};

// Initialize Gmail API
export const initializeGmailAPI = () => {
    try {
        if (!GMAIL_CONFIG.clientId) {
            throw new Error('Gmail client ID is required. Please check your .env file.');
        }
        if (!GMAIL_CONFIG.clientSecret) {
            throw new Error('Gmail client secret is required. Please check your .env file.');
        }
        if (!GMAIL_CONFIG.redirectUri) {
            throw new Error('Gmail redirect URI is required. Please check your .env file.');
        }
        if (!GMAIL_CONFIG.refreshToken) {
            throw new Error('Gmail refresh token is required. Please check your .env file.');
        }

        console.log('Gmail config validation passed:', {
            hasClientId: !!GMAIL_CONFIG.clientId,
            hasClientSecret: !!GMAIL_CONFIG.clientSecret,
            hasRedirectUri: !!GMAIL_CONFIG.redirectUri,
            hasRefreshToken: !!GMAIL_CONFIG.refreshToken
        });

        return {
            clientId: GMAIL_CONFIG.clientId,
            clientSecret: GMAIL_CONFIG.clientSecret,
            redirectUri: GMAIL_CONFIG.redirectUri,
            refreshToken: GMAIL_CONFIG.refreshToken
        };
    } catch (error) {
        console.error('Error initializing Gmail API:', error);
        throw error;
    }
}; 