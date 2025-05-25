import { Request, Response } from 'express';
import axios from 'axios';
import { TikTokToken } from '../models/tiktok.model';
import { tiktokConfig } from '../config/tiktok.config';

export const getAuthUrl = async (req: Request, res: Response) => {
  try {
    const csrfState = Math.random().toString(36).substring(7);
    const authUrl = `${tiktokConfig.authUrl}?client_key=${tiktokConfig.clientKey}&scope=${tiktokConfig.scopes.join(',')}&response_type=code&redirect_uri=${tiktokConfig.redirectUri}&state=${csrfState}`;
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to get auth URL' });
  }
};

export const handleCallback = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(tiktokConfig.tokenUrl, {
      client_key: tiktokConfig.clientKey,
      client_secret: tiktokConfig.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: tiktokConfig.redirectUri,
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens in database
    await TikTokToken.findOneAndUpdate(
      { userId: req.user?.id },
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
      { upsert: true, new: true }
    );

    res.redirect('/tiktok');
  } catch (error) {
    console.error('Error handling callback:', error);
    res.status(500).json({ error: 'Failed to handle callback' });
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const token = await TikTokToken.findOne({ userId: req.user?.id });

    if (!token) {
      return res.json({ success: false });
    }

    // Check if token is expired
    if (token.expiresAt < new Date()) {
      // Try to refresh token
      try {
        const refreshResponse = await axios.post(tiktokConfig.tokenUrl, {
          client_key: tiktokConfig.clientKey,
          client_secret: tiktokConfig.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
        });

        const { access_token, refresh_token, expires_in } = refreshResponse.data;

        // Update tokens in database
        await TikTokToken.findOneAndUpdate(
          { userId: req.user?.id },
          {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: new Date(Date.now() + expires_in * 1000),
          }
        );

        return res.json({ success: true });
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return res.json({ success: false });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
};

export const getVideos = async (req: Request, res: Response) => {
  try {
    const token = await TikTokToken.findOne({ userId: req.user?.id });

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated with TikTok' });
    }

    const response = await axios.get(`${tiktokConfig.apiBase}/video/query/`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
      params: {
        fields: ['id', 'description', 'create_time', 'author', 'statistics', 'video'].join(','),
        max_count: 20,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

export const searchVideos = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const token = await TikTokToken.findOne({ userId: req.user?.id });

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated with TikTok' });
    }

    const response = await axios.get(`${tiktokConfig.apiBase}/video/search/`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
      params: {
        keyword: query,
        fields: ['id', 'description', 'create_time', 'author', 'statistics', 'video'].join(','),
        max_count: 20,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.status(500).json({ error: 'Failed to search videos' });
  }
}; 