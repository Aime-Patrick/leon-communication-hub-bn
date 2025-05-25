import dotenv from 'dotenv';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';

dotenv.config();

// Facebook API Configuration
export const FACEBOOK_CONFIG = {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    adAccountId: `act_${process.env.FACEBOOK_AD_ACCOUNT_ID}`, // Ensure this is correctly set in .env
    businessId: process.env.FACEBOOK_BUSINESS_ID, // Ensure this is correctly set in .env
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/facebook/auth/callback', // IMPORTANT: This must match your Facebook App settings
};

// Initialize Facebook API
// This function will now use FacebookAdsApi.init() to set the global API instance.
// This is the SDK's intended way to manage its singleton API instance.
export const initializeFacebookAPI = (accessToken: string): FacebookAdsApi => {
    try {
        console.log('Initializing Facebook API (via FacebookAdsApi.init())...');
        
        if (!accessToken) {
            throw new Error('Facebook access token is required for API initialization.');
        }

        // Set the App ID and App Secret globally (usually done once at app startup)
        // FacebookAdsApi.set){ // This is usually done once at app startup, not per request
        //     FacebookAdsApi.setAppId(FACEBOOK_CONFIG.appId!);
        //     FacebookAdsApi.setAppSecret(FACEBOOK_CONFIG.appSecret!);
        // }

        // Initialize the global API instance with the provided access token
        const api = FacebookAdsApi.init(accessToken);
        
        console.log('Config validation passed:', {
            hasAppId: !!FACEBOOK_CONFIG.appId,
            hasAppSecret: !!FACEBOOK_CONFIG.appSecret,
            hasAccessToken: !!accessToken,
            tokenLength: accessToken.length,
            adAccountId: FACEBOOK_CONFIG.adAccountId,
            businessId: FACEBOOK_CONFIG.businessId
        });

        console.log('API initialized successfully (via FacebookAdsApi.init())');
        
        // Enable debug mode for development (this applies to the global instance)
        api.setDebug(true);
        console.log('Debug mode enabled');

        // Return the API instance (which is the globally set instance)
        return api;
    } catch (error) {
        console.error('Error initializing Facebook API:', error);
        throw error;
    }
};
