import dotenv from 'dotenv';

dotenv.config();

export const INSTAGRAM_CONFIG = {
    appId: process.env.INSTAGRAM_CLIENT_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
    apiVersion: 'v22.0',
    scopes: [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
        'instagram_business_manage_insights',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
    ],
    webhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
}; 