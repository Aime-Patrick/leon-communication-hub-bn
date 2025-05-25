import { google } from 'googleapis';
import { User } from '../models/User';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * Returns a valid Gmail access token for a user, refreshing it if needed.
 */
export async function getValidGmailAccessToken(userId: string): Promise<string | null> {
    const user = await User.findById(userId);

    if (!user || !user.gmailRefreshToken) {
        console.warn('User not found or no refresh token available.');
        return null;
    }

    const now = Date.now();
    const expiry = user.gmailAccessTokenExpires?.getTime() || 0;

    // Refresh if token is expired or will expire within 1 minute
    if (!user.gmailAccessToken || expiry < now + 60_000) {
        console.log('Refreshing Gmail access token...');
        oauth2Client.setCredentials({ refresh_token: user.gmailRefreshToken });

        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            user.gmailAccessToken = credentials.access_token!;
            user.gmailAccessTokenExpires = credentials.expiry_date
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000); // fallback 1 hour

            await user.save();

            return credentials.access_token!;
        } catch (error) {
            console.error('Failed to refresh Gmail token:', error);
            return null;
        }
    }

    return user.gmailAccessToken;
}
