export const TIKTOK_CONFIG = {
    clientKey: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
    redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/tiktok/auth/callback',
    scope: [
        'user.info.basic',
        'user.info.stats',
        'video.publish',
        'video.list',
        'video.stats'
    ].join(','),
    apiVersion: 'v2'
};

// Validate required environment variables
const requiredEnvVars = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
} 