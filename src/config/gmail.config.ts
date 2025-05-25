import { env } from './env';

// Gmail API Configuration
export const GMAIL_CONFIG = {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    redirectUri: env.GMAIL_REDIRECT_URI,
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

        console.log('Gmail config validation passed:', {
            hasClientId: !!GMAIL_CONFIG.clientId,
            hasClientSecret: !!GMAIL_CONFIG.clientSecret,
            hasRedirectUri: !!GMAIL_CONFIG.redirectUri,
            environment: env.NODE_ENV
        });

        return {
            clientId: GMAIL_CONFIG.clientId,
            clientSecret: GMAIL_CONFIG.clientSecret,
            redirectUri: GMAIL_CONFIG.redirectUri,
        };
    } catch (error) {
        console.error('Error initializing Gmail API:', error);
        throw error;
    }
}; 