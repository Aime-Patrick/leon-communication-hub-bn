import dotenv from 'dotenv';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';

dotenv.config();

// Facebook API Configuration
export const FACEBOOK_CONFIG = {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    adAccountId: `act_${process.env.FACEBOOK_AD_ACCOUNT_ID}`,
    businessId: process.env.FACEBOOK_BUSINESS_ID
};

// Initialize Facebook API
export const initializeFacebookAPI = () => {
    try {
        console.log('Initializing Facebook API...');
        
        if (!FACEBOOK_CONFIG.accessToken) {
            throw new Error('Facebook access token is required. Please check your .env file.');
        }
        if (!FACEBOOK_CONFIG.adAccountId) {
            throw new Error('Facebook ad account ID is required. Please check your .env file.');
        }

        console.log('Config validation passed:', {
            hasAccessToken: !!FACEBOOK_CONFIG.accessToken,
            tokenLength: FACEBOOK_CONFIG.accessToken.length,
            adAccountId: FACEBOOK_CONFIG.adAccountId,
            businessId: FACEBOOK_CONFIG.businessId
        });

        // Initialize the API with the access token
        const api = FacebookAdsApi.init(FACEBOOK_CONFIG.accessToken);
        console.log('API initialized successfully');
        
        // Enable debug mode for development
        api.setDebug(true);
        console.log('Debug mode enabled');

        // Return the API instance immediately
        return api;
    } catch (error) {
        console.error('Error initializing Facebook API:', error);
        throw error;
    }
}; 