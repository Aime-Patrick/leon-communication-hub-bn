import dotenv from 'dotenv';

dotenv.config();

// TikTok API Configuration
export const TIKTOK_CONFIG = {
    appId: process.env.TIKTOK_APP_ID,
    appSecret: process.env.TIKTOK_APP_SECRET,
    accessToken: process.env.TIKTOK_ACCESS_TOKEN,
    advertiserId: process.env.TIKTOK_ADVERTISER_ID,
    businessId: process.env.TIKTOK_BUSINESS_ID
};

// Initialize TikTok API
export const initializeTikTokAPI = () => {
    try {
        if (!TIKTOK_CONFIG.appId) {
            throw new Error('TikTok app ID is required. Please check your .env file.');
        }
        if (!TIKTOK_CONFIG.appSecret) {
            throw new Error('TikTok app secret is required. Please check your .env file.');
        }
        if (!TIKTOK_CONFIG.accessToken) {
            throw new Error('TikTok access token is required. Please check your .env file.');
        }
        if (!TIKTOK_CONFIG.advertiserId) {
            throw new Error('TikTok advertiser ID is required. Please check your .env file.');
        }

        console.log('TikTok config validation passed:', {
            hasAppId: !!TIKTOK_CONFIG.appId,
            hasAppSecret: !!TIKTOK_CONFIG.appSecret,
            hasAccessToken: !!TIKTOK_CONFIG.accessToken,
            hasAdvertiserId: !!TIKTOK_CONFIG.advertiserId
        });

        return {
            appId: TIKTOK_CONFIG.appId,
            appSecret: TIKTOK_CONFIG.appSecret,
            accessToken: TIKTOK_CONFIG.accessToken,
            advertiserId: TIKTOK_CONFIG.advertiserId
        };
    } catch (error) {
        console.error('Error initializing TikTok API:', error);
        throw error;
    }
}; 