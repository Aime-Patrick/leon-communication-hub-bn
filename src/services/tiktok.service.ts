import axios from 'axios';
import { TIKTOK_CONFIG } from '../config/tiktok.config';

export interface TikTokAccountInfo {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    followersCount: number;
    followingCount: number;
    likesCount: number;
    videoCount: number;
}

export interface TikTokVideo {
    id: string;
    description: string;
    videoUrl: string;
    coverImageUrl: string;
    privacyLevel: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
    createdAt: string;
    statistics: {
        viewCount: number;
        likeCount: number;
        commentCount: number;
        shareCount: number;
    };
}

export class TikTokService {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    // Verify access token and get user info
    async verifyAccessToken() {
        try {
            console.log('Verifying TikTok access token...');
            const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            console.log('TikTok user info response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error verifying TikTok access token:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }

    // Get account information
    async getAccountInfo(): Promise<TikTokAccountInfo> {
        try {
            console.log('Getting TikTok account info...');
            const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            console.log('TikTok account info response:', response.data);

            const userInfo = response.data.data.user;
            return {
                id: userInfo.open_id,
                username: userInfo.unique_id,
                displayName: userInfo.display_name,
                avatarUrl: userInfo.avatar_url,
                followersCount: userInfo.follower_count,
                followingCount: userInfo.following_count,
                likesCount: userInfo.likes_count,
                videoCount: userInfo.video_count
            };
        } catch (error: any) {
            console.error('Error getting TikTok account info:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }

    // Upload a video
    async uploadVideo(videoData: {
        description: string;
        video: Buffer;
        coverImage?: Buffer;
        privacyLevel?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
    }): Promise<TikTokVideo> {
        try {
            // First, create a video upload session
            const createResponse = await axios.post(
                'https://open.tiktokapis.com/v2/post/publish/video/init/',
                {
                    post_info: {
                        title: videoData.description,
                        privacy_level: videoData.privacyLevel || 'PUBLIC'
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            const { publish_id, upload_url } = createResponse.data.data;

            // Upload the video file
            await axios.put(upload_url, videoData.video, {
                headers: {
                    'Content-Type': 'video/mp4'
                }
            });

            // If there's a cover image, upload it
            if (videoData.coverImage) {
                await axios.post(
                    'https://open.tiktokapis.com/v2/post/publish/video/cover/',
                    {
                        publish_id,
                        cover_image: videoData.coverImage
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    }
                );
            }

            // Complete the upload
            const completeResponse = await axios.post(
                'https://open.tiktokapis.com/v2/post/publish/video/complete/',
                {
                    publish_id
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            return completeResponse.data.data;
        } catch (error: any) {
            console.error('Error uploading TikTok video:', error);
            throw error;
        }
    }

    // Get user's videos
    async getVideos(cursor?: string): Promise<{ videos: TikTokVideo[]; nextCursor?: string }> {
        try {
            const response = await axios.get('https://open.tiktokapis.com/v2/post/publish/video/list/', {
                params: {
                    cursor,
                    max_count: 20
                },
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const videos = response.data.data.videos.map((video: any) => ({
                id: video.id,
                description: video.title,
                videoUrl: video.video_url,
                coverImageUrl: video.cover_image_url,
                privacyLevel: video.privacy_level,
                createdAt: video.create_time,
                statistics: {
                    viewCount: video.stats.view_count,
                    likeCount: video.stats.like_count,
                    commentCount: video.stats.comment_count,
                    shareCount: video.stats.share_count
                }
            }));

            return {
                videos,
                nextCursor: response.data.data.cursor
            };
        } catch (error: any) {
            console.error('Error getting TikTok videos:', error);
            throw error;
        }
    }

    // Get video statistics
    async getVideoStats(videoId: string): Promise<TikTokVideo['statistics']> {
        try {
            const response = await axios.get(`https://open.tiktokapis.com/v2/post/publish/video/stats/${videoId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            return response.data.data.stats;
        } catch (error: any) {
            console.error('Error getting TikTok video stats:', error);
            throw error;
        }
    }
} 