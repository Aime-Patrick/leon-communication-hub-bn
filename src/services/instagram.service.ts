import axios from 'axios';
import {INSTAGRAM_CONFIG} from '../config/instagram.config'
import { User, IUser } from '../models/User';
import dotenv from 'dotenv';
dotenv.config();

// Type definitions for Instagram data
export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL' | 'STORY';

export interface InstagramMedia {
    id: string;
    media_type: InstagramMediaType;
    media_url: string;
    permalink: string;
    thumbnail_url?: string;
    caption?: string;
    timestamp: string;
    username: string;
}

export interface InstagramInsights {
    engagement: number;
    impressions: number;
    reach: number;
    saved: number;
    profile_views: number;
    follower_count: number;
}

export interface InstagramBusinessAccount {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string;
    website?: string;
    biography?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
}

const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

export class InstagramService {
    private accessToken: string;
    private businessAccountId?: string;

    constructor(accessToken?: string, businessAccountId?: string) {
        // Use provided token or fallback to env token for development
        this.accessToken = accessToken || INSTAGRAM_ACCESS_TOKEN!;
        this.businessAccountId = businessAccountId;
        if (!this.accessToken) {
            throw new Error('Access token is required');
        }
    }

    /**
     * Get basic user profile information
     */
    async getUserProfile() {
        try {
            const response = await axios.get(`https://graph.instagram.com/me`, {
                params: {
                    fields: 'id,username,account_type',
                    access_token: this.accessToken
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Get business account information
     */
    async getBusinessAccount() {
        try {
            if (!this.businessAccountId) {
                throw new Error('Business account ID is required');
            }

            const response = await axios.get(`https://graph.facebook.com/v22.0/${this.businessAccountId}`, {
                params: {
                    fields: 'id,username,name,profile_picture_url,website,biography,followers_count,follows_count,media_count',
                    access_token: this.accessToken
                }
            });
            return response.data as InstagramBusinessAccount;
        } catch (error: any) {
            console.error('Error getting business account:', error);
            throw error;
        }
    }

    /**
     * Get media from the business account
     */
    async getMedia(limit: number = 10) {
        try {
            if (!this.businessAccountId) {
                throw new Error('Business account ID is required');
            }

            const response = await axios.get(`https://graph.facebook.com/v22.0/${this.businessAccountId}/media`, {
                params: {
                    fields: 'id,media_type,media_url,permalink,thumbnail_url,caption,timestamp,username',
                    limit,
                    access_token: this.accessToken
                }
            });
            return response.data.data as InstagramMedia[];
        } catch (error: any) {
            console.error('Error getting media:', error);
            throw error;
        }
    }

    /**
     * Get insights for a specific media
     */
    async getMediaInsights(mediaId: string) {
        try {
            const response = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}/insights`, {
                params: {
                    metric: 'engagement,impressions,reach,saved',
                    access_token: this.accessToken
                }
            });
            return response.data.data as InstagramInsights;
        } catch (error: any) {
            console.error('Error getting media insights:', error);
            throw error;
        }
    }

    /**
     * Get account insights
     */
    async getAccountInsights() {
        try {
            if (!this.businessAccountId) {
                throw new Error('Business account ID is required');
            }

            const response = await axios.get(`https://graph.facebook.com/v22.0/${this.businessAccountId}/insights`, {
                params: {
                    metric: 'profile_views,follower_count',
                    period: 'day',
                    access_token: this.accessToken
                }
            });
            return response.data.data as InstagramInsights;
        } catch (error: any) {
            console.error('Error getting account insights:', error);
            throw error;
        }
    }

    /**
     * Create a new media post
     */
    async createMediaPost(data: {
        image_url?: string;
        video_url?: string;
        caption?: string;
        media_type: InstagramMediaType;
    }) {
        try {
            if (!this.businessAccountId) {
                throw new Error('Business account ID is required');
            }

            // First, create a container for the media
            const containerResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${this.businessAccountId}/media`,
                null,
                {
                    params: {
                        image_url: data.image_url,
                        video_url: data.video_url,
                        caption: data.caption,
                        media_type: data.media_type,
                        access_token: this.accessToken
                    }
                }
            );

            // Then publish the container
            const publishResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${this.businessAccountId}/media_publish`,
                null,
                {
                    params: {
                        creation_id: containerResponse.data.id,
                        access_token: this.accessToken
                    }
                }
            );

            return publishResponse.data;
        } catch (error: any) {
            console.error('Error creating media post:', error);
            throw error;
        }
    }

    /**
     * Delete a media post
     */
    async deleteMediaPost(mediaId: string) {
        try {
            const response = await axios.delete(`https://graph.facebook.com/v22.0/${mediaId}`, {
                params: {
                    access_token: this.accessToken
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error deleting media post:', error);
            throw error;
        }
    }

    /**
     * Get hashtag information
     */
    async getHashtagInfo(hashtag: string) {
        try {
            if (!this.businessAccountId) {
                throw new Error('Business account ID is required');
            }

            // First, search for the hashtag
            const searchResponse = await axios.get(
                `https://graph.facebook.com/v22.0/${this.businessAccountId}/hashtag_search`,
                {
                    params: {
                        user_id: this.businessAccountId,
                        q: hashtag,
                        access_token: this.accessToken
                    }
                }
            );

            if (!searchResponse.data.data.length) {
                throw new Error('Hashtag not found');
            }

            const hashtagId = searchResponse.data.data[0].id;

            // Then get top media for the hashtag
            const mediaResponse = await axios.get(
                `https://graph.facebook.com/v22.0/${hashtagId}/top_media`,
                {
                    params: {
                        user_id: this.businessAccountId,
                        fields: 'id,media_type,media_url,permalink,thumbnail_url,caption,timestamp,username',
                        access_token: this.accessToken
                    }
                }
            );

            return {
                hashtag_id: hashtagId,
                media: mediaResponse.data.data
            };
        } catch (error: any) {
            console.error('Error getting hashtag info:', error);
            throw error;
        }
    }
}
