import dotenv from 'dotenv';
dotenv.config();

// Export environment variables
export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.NODE_ENV === 'production' ? process.env.MONGO_URI_PROD : process.env.MONGO_URI_DEV,
    JWT_SECRET: process.env.JWT_SECRET,
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI: process.env.NODE_ENV === 'production' ? process.env.GMAIL_REDIRECT_URI_PROD : process.env.GMAIL_REDIRECT_URI_DEV,
    FRONTEND_URL:process.env.NODE_ENV === 'production'? process.env.FRONTEND_URL_PROD : process.env.FRONTEND_URL_DEV,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET

}; 