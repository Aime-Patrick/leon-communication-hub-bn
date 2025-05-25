export const tiktokConfig = {
  clientKey: process.env.TIKTOK_CLIENT_KEY,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  redirectUri: process.env.TIKTOK_REDIRECT_URI,
  apiBase: 'https://open.tiktokapis.com/v2',
  scopes: ['user.info.basic', 'video.list'],
  authUrl: 'https://www.tiktok.com/auth/authorize/',
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
} as const;

// Validate required environment variables
const requiredEnvVars = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
} 