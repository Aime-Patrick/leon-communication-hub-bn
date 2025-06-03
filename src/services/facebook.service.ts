import { AdAccount, Campaign, AdSet, Ad, AbstractCrudObject, User, Business, FacebookAdsApi, Page } from 'facebook-nodejs-business-sdk';
import { FACEBOOK_CONFIG, initializeFacebookAPI } from '../config/facebook.config';
import axios from 'axios'; // For making HTTP requests to Facebook's Graph API directly
import { Business as BusinessModel, IBusiness } from '../models/Business';

// Type definitions for campaign data
export type CampaignObjective =
    | 'OUTCOME_TRAFFIC'
    | 'OUTCOME_AWARENESS'
    | 'OUTCOME_ENGAGEMENT'
    | 'OUTCOME_LEADS'
    | 'OUTCOME_SALES'
    | 'OUTCOME_APP_PROMOTION'
    | 'OUTCOME_MESSAGES'
    | 'OUTCOME_REACH'
    | 'OUTCOME_VIDEO_VIEWS'
    | 'OUTCOME_STORE_VISITS';

export type SpecialAdCategory = 'HOUSING' | 'EMPLOYMENT' | 'CREDIT' | 'ISSUES_ELECTIONS_POLITICS';

// Add type definitions for AdAccount response
interface AdAccountBusiness {
    id: string;
    name: string;
}

interface FacebookPage {
    id: string;
    name: string;
    category: string;
    tasks: string[];
}

interface PageResponse {
    data: FacebookPage[];
}

interface AdAccountDetails {
    id: string;
    name: string;
    account_status: number;
    business_name: string;
    currency: string;
    timezone_name: string;
    business?: AdAccountBusiness;
    owner?: {
        id: string;
        name: string;
    };
    owned_pages?: PageResponse;
    connected_pages?: PageResponse;
}

export interface AdAccountResponse {
    id: string;
    name: string;
    account_status: number;
    business?: {
        id: string;
        name: string;
    };
    currency: string;
    timezone_name: string;
    owner?: {
        id: string;
        name: string;
    };
    account_id: string;
}

export interface AdAccountsResponse {
    data: AdAccountResponse[];
}

export interface CampaignData {
    name: string;
    objective: CampaignObjective;
    status?: 'ACTIVE' | 'PAUSED' | 'DELETED';
    special_ad_categories?: SpecialAdCategory[];
    buying_type?: 'AUCTION' | 'RESERVED';
    campaign_optimization_type?: 'NONE' | 'ICO_ONLY';
}

// Add type definitions for Page creation
export type PageCategory =
    | 'COMPANY'
    | 'ORGANIZATION'
    | 'BRAND'
    | 'PRODUCT_SERVICE'
    | 'LOCAL_BUSINESS'
    | 'RESTAURANT'
    | 'RETAIL'
    | 'SHOPPING_RETAIL'
    | 'ECOMMERCE_WEBSITE'
    | 'WEBSITE'
    | 'BLOG'
    | 'MEDIA'
    | 'ENTERTAINMENT'
    | 'TECHNOLOGY'
    | 'EDUCATION'
    | 'NONPROFIT_ORGANIZATION'
    | 'COMMUNITY_ORGANIZATION'
    | 'PUBLIC_FIGURE'
    | 'ARTIST'
    | 'MUSICIAN'
    | 'WRITER'
    | 'PERSONAL_BLOG';

export interface PageData {
    name?: string;
    category?: PageCategory;
    about?: string;
    website?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
}

// Add interface for page creation response
export interface PageCreationResponse {
    id: string;
    name: string;
    category: string;
    access_token: string; // This is the page access token
    tasks?: string[];
    perms?: string[];
}

// Add these interfaces at the top with other interfaces
interface UploadSession {
    id: string;
}

interface UploadResponse {
    h: string;
}

interface UploadStatus {
    id: string;
    file_offset: number;
}

export class FacebookService {
    private api: FacebookAdsApi;
    private adAccount: AdAccount | null;
    private accessToken: string;
    private adAccountId?: string | null;

    constructor(accessToken: string, adAccountId?: string) {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }

            this.accessToken = accessToken;
            this.adAccount = null;
            this.adAccountId = null;
            
            // Initialize the global API instance with the access token
            this.api = FacebookAdsApi.init(this.accessToken);
            
            // Set up adAccount if adAccountId is provided
            if (adAccountId) {
                // Clean and format the adAccountId
                const cleanId = adAccountId.replace(/^act_/, '');
                this.adAccountId = `act_${cleanId}`;
                
                // Create the AdAccount instance
                this.adAccount = new AdAccount(this.adAccountId);
                
            } else {
                this.adAccount = null;
            }
        } catch (error: any) {
            throw new Error(`Failed to initialize Facebook service: ${error.message}`);
        }
    }

    /**
     * Generates the Facebook OAuth login URL.
     * @param redirectUri The URI Facebook will redirect to after authorization.
     * @param scope An array of permissions your app needs.
     * @returns The Facebook login URL.
     */
    static getLoginUrl(redirectUri: string, scope: string[]): string {
        const baseUrl = 'https://www.facebook.com/v22.0/dialog/oauth'; // Use a specific API version
        const params = new URLSearchParams({
            client_id: FACEBOOK_CONFIG.appId!,
            redirect_uri: redirectUri,
            scope: scope.join(','),
            response_type: 'code',
            auth_type: 'rerequest', // To ask for permissions again if they were previously denied
        });
        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Exchanges the authorization code for a user access token.
     * @param code The authorization code received from Facebook.
     * @param redirectUri The same redirect URI used in the login URL.
     * @returns The user access token.
     */
    static async exchangeCodeForAccessToken(code: string, redirectUri: string): Promise<string> {
        const tokenUrl = 'https://graph.facebook.com/v22.0/oauth/access_token'; // Use a specific API version
        try {
            const response = await axios.get(tokenUrl, {
                params: {
                    client_id: FACEBOOK_CONFIG.appId!,
                    client_secret: FACEBOOK_CONFIG.appSecret!,
                    redirect_uri: redirectUri,
                    code: code,
                },
            });

            if (response.data && response.data.access_token) {
                return response.data.access_token;
            } else {
                throw new Error('Failed to get access token from Facebook.');
            }
        } catch (error: any) {
            console.error('Error exchanging code for access token:', error.response?.data || error.message);
            throw new Error(`Failed to exchange code for access token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Exchanges a short-lived user access token for a long-lived one.
     * @param shortLivedToken The short-lived user access token.
     * @returns The long-lived user access token.
     */
    static async getLongLivedAccessToken(shortLivedToken: string): Promise<string> {
        const tokenUrl = 'https://graph.facebook.com/v22.0/oauth/access_token';
        try {
            const response = await axios.get(tokenUrl, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: FACEBOOK_CONFIG.appId!,
                    client_secret: FACEBOOK_CONFIG.appSecret!,
                    fb_exchange_token: shortLivedToken,
                },
            });

            if (response.data && response.data.access_token) {
                return response.data.access_token;
            } else {
                throw new Error('Failed to get long-lived access token from Facebook.');
            }
        } catch (error: any) {
            console.error('Error getting long-lived access token:', error.response?.data || error.message);
            throw new Error(`Failed to get long-lived access token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Verify access token with retry
    async verifyAccessToken(retries = 3): Promise<void> {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Verifying access token (attempt ${i + 1}/${retries})...`);

                if (!this.accessToken) {
                    throw new Error('Access token is missing from service instance');
                }

                // Get user info using axios
                const userUrl = 'https://graph.facebook.com/v22.0/me';
                const userParams = {
                    fields: ['id', 'name'].join(','),
                    access_token: this.accessToken
                };

                const userResponse = await axios.get(userUrl, { params: userParams });
                console.log('User verification response:', userResponse.data);

                if (!userResponse.data || !userResponse.data.id) {
                    throw new Error('Invalid access token - unable to fetch user data');
                }

                // Get permissions using axios
                const permissionsUrl = 'https://graph.facebook.com/v22.0/me/permissions';
                const permissionsResponse = await axios.get(permissionsUrl, {
                    params: { access_token: this.accessToken }
                });

                console.log('Permissions response:', permissionsResponse.data);

                const requiredPermissions = [
                    'ads_management',
                    'business_management',
                    'pages_show_list',
                    'pages_read_engagement',
                    'pages_manage_ads',
                    'pages_manage_metadata',
                    'pages_read_user_content',
                    'pages_manage_posts',
                    'pages_manage_engagement',
                ];

                const grantedPermissions = permissionsResponse.data.data
                    .filter((p: { permission: string; status: string }) => p.status === 'granted')
                    .map((p: { permission: string; status: string }) => p.permission);

                console.log('Granted permissions:', grantedPermissions);

                const missingPermissions = requiredPermissions.filter(required =>
                    !grantedPermissions.includes(required)
                );

                if (missingPermissions.length > 0) {
                    throw new Error(`Missing required permissions: ${missingPermissions.join(', ')}. Please request these permissions when generating a new token.`);
                }
                return;
            } catch (error: any) {
                console.error(`Token verification attempt ${i + 1} failed:`, {
                    message: error.message,
                    code: error.code,
                    subcode: error.subcode,
                    error_user_msg: error.error_user_msg,
                    response: error.response?.data
                });
                
                lastError = error;
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }
        throw new Error(`Failed to verify access token after ${retries} attempts. Last error: ${lastError.message}`);
    }

    // Verify app capabilities
    async verifyAppCapabilities() {
        try {
            // First get basic ad account details
            const response = await this.adAccount?.get([
                'id',
                'name',
                'account_status',
                'business_name',
                'currency',
                'timezone_name',
                'business',
                'owner'
            ]);
            const accountDetails = response as unknown as AdAccountDetails;

            // Get users with access
            const users = await this.adAccount?.get([
                'users'
            ]);

            // If we have a business ID, get assigned users
            let assignedUsers = null;
            if (accountDetails.business?.id) {
                const business = accountDetails.business;
                assignedUsers = await this.adAccount?.get([
                    'assigned_users'
                ], {
                    business: business.id
                });
            }

            return {
                adAccountDetails: accountDetails,
                users: users,
                assignedUsers: assignedUsers
            };
        } catch (error) {
            console.error('App Capability Verification Error:', error);
            throw error;
        }
    }

    // Verify permissions and capabilities
    async verifyPermissions() {
        try {
            // Check if we can access the ad account
            const account = await this.adAccount?.get(['id', 'name', 'account_status']);

            // Check user permissions - User constructor should pick up global API
            const user = new User('me'); // Removed this.api
            const permissions = await user.getPermissions(
                ['permission']
            );

            // Check if we can read campaigns
            const campaigns = await this.adAccount?.getCampaigns(['id']);

            // Check app capabilities
            const appCapabilities = await this.verifyAppCapabilities();
            console.log('App Capabilities:', appCapabilities);

            return {
                accountAccess: true,
                permissions: permissions,
                campaignAccess: true,
                appCapabilities: appCapabilities
            };
        } catch (error) {
            console.error('Permission Verification Error:', error);
            throw error;
        }
    }

    // Verify page association
    async verifyPageAssociation() {
        try {
            // Get the business account - Business constructor should pick up global API
            const business = new Business(FACEBOOK_CONFIG.businessId); // Removed this.api
            
            // Get owned pages through the business account
            const pages = await business.getOwnedPages(
                ['id', 'name', 'category', 'access_token'],
            );
            
            console.log('Owned pages:', pages);
            return pages;
        } catch (error) {
            console.error('Error verifying page association:', error);
            throw error;
        }
    }

    // Validate campaign data
    private validateCampaignData(data: CampaignData): void {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Campaign name is required');
        }
        if (!data.objective) {
            throw new Error('Campaign objective is required');
        }
    }

    // Validate page data
    private validatePageData(data: PageData): void {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Page name is required');
        }
        // if (!data.category) {
        //     throw new Error('Page category is required');
        // }
        // // Validate category is one of the allowed values
        // const validCategories: PageCategory[] = [
        //     'COMPANY',
        //     'ORGANIZATION',
        //     'BRAND',
        //     'PRODUCT_SERVICE',
        //     'LOCAL_BUSINESS',
        //     'RESTAURANT',
        //     'RETAIL',
        //     'SHOPPING_RETAIL',
        //     'ECOMMERCE_WEBSITE',
        //     'WEBSITE',
        //     'BLOG',
        //     'MEDIA',
        //     'ENTERTAINMENT',
        //     'TECHNOLOGY',
        //     'EDUCATION',
        //     'NONPROFIT_ORGANIZATION',
        //     'COMMUNITY_ORGANIZATION',
        //     'PUBLIC_FIGURE',
        //     'ARTIST',
        //     'MUSICIAN',
        //     'WRITER',
        //     'PERSONAL_BLOG'
        // ];
        // if (!validCategories.includes(data.category as PageCategory)) {
        //     throw new Error(`Invalid page category. Must be one of: ${validCategories.join(', ')}`);
        // }
    }

    // Create a new campaign
    async createCampaign(data: CampaignData) {
        try {
            if (!this.adAccount) {
                throw new Error('Ad Account not initialized');
            }

            // Validate campaign data
            this.validateCampaignData(data);

            // First verify permissions
            await this.verifyPermissions();

            // Create the campaign using the Facebook SDK with v22.0
            const campaign = await this.adAccount.createCampaign(
                [],
                {
                    name: data.name,
                    objective: data.objective,
                    status: data.status || 'PAUSED',
                    special_ad_categories: data.special_ad_categories || [],
                    buying_type: data.buying_type || 'AUCTION',
                    campaign_optimization_type: data.campaign_optimization_type || 'NONE'
                }
            );

            console.log('Campaign created successfully:', campaign.id);
            return campaign;
        } catch (error: any) {
            console.error('Error creating campaign:', error);
            if (error.message.includes('Application does not have the capability')) {
                throw new Error('Your Facebook app needs to be configured for the Marketing API. Please ensure your app has the "ads_management" capability enabled in the Facebook Developer Console.');
            }
            throw error;
        }
    }

    // Get all campaigns
    async getCampaigns() {
        try {
            if (!this.adAccountId) {
                throw new Error('Ad Account ID is required');
            }

            const campaignsUrl = `https://graph.facebook.com/v22.0/${this.adAccountId}/campaigns`;
            const response = await axios.get(campaignsUrl, {
                params: {
                    fields: [
                        'id',
                        'name',
                        'status',
                        'objective',
                        'created_time',
                        'special_ad_categories',
                        'buying_type'
                    ].join(','),
                    access_token: this.accessToken
                }
            });

            console.log('Campaigns response:', response.data);
            return response.data.data || []; // Return just the campaigns array, or empty array if no data
        } catch (error: any) {
            console.error('Error fetching campaigns:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Get ad sets for a campaign
    async getAdSets(campaignId: string) {
        try {
            if (!this.adAccountId) {
                throw new Error('Ad Account ID is required');
            }

            const adSetsUrl = `https://graph.facebook.com/v22.0/${campaignId}/adsets`;
            const response = await axios.get(adSetsUrl, {
                params: {
                    fields: [
                        'id',
                        'name',
                        'status',
                        'daily_budget',
                        'lifetime_budget',
                        'campaign_id',
                        'targeting',
                        'optimization_goal',
                        'billing_event',
                        'bid_amount'
                    ].join(','),
                    access_token: this.accessToken
                }
            });

            console.log('Ad Sets response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching ad sets:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Create a new ad set
    async createAdSet(campaignId: string, data: any) {
        try {
            const params = {
                campaign_id: campaignId,
                ...data,
            };
            // AdSet.create should pick up global API
            return await (AdSet as any).create(this.adAccount?.id, params); // Removed { api: this.api }
        } catch (error) {
            console.error('Error creating ad set:', error);
            throw error;
        }
    }

    // Get ads for an ad set
    async getAds(adSetId: string) {
        try {
            if (!this.adAccountId) {
                throw new Error('Ad Account ID is required');
            }

            const adsUrl = `https://graph.facebook.com/v22.0/${adSetId}/ads`;
            const response = await axios.get(adsUrl, {
                params: {
                    fields: [
                        'id',
                        'name',
                        'status',
                        'creative',
                        'adset_id',
                        'campaign_id',
                        'created_time',
                        'updated_time',
                        'tracking_specs'
                    ].join(','),
                    access_token: this.accessToken
                }
            });

            console.log('Ads response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching ads:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Create a new ad
    async createAd(adSetId: string, data: any) {
        try {
            const params = {
                adset_id: adSetId,
                ...data,
            };
            // Ad.create should pick up global API
            return await (Ad as any).create(this.adAccount?.id, params); // Removed { api: this.api }
        } catch (error) {
            console.error('Error creating ad:', error);
            throw error;
        }
    }

    // Get ad account insights
    async getInsights(params: any = {}) {
        try {
            if (!this.adAccountId) {
                throw new Error('Ad Account ID is required');
            }

            const insightsUrl = `https://graph.facebook.com/v22.0/${this.adAccountId}/insights`;
            const response = await axios.get(insightsUrl, {
                params: {
                    fields: [
                        'impressions',
                        'clicks',
                        'spend',
                        'reach',
                        'cpc',
                        'cpm',
                        'ctr',
                        'frequency',
                        'unique_clicks',
                        'unique_ctr',
                        'social_reach',
                        'social_impressions',
                        'social_clicks',
                        'social_spend'
                    ].join(','),
                    time_range: params.time_range || { 'since': '2024-01-01', 'until': '2024-12-31' },
                    level: params.level || 'account',
                    access_token: this.accessToken
                }
            });

            console.log('Insights response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching insights:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Create a new Facebook Page
    async createPage(data: PageData): Promise<PageCreationResponse> {
        try {
            // First verify access token
            await this.verifyAccessToken();

            // Validate page data
            this.validatePageData(data);

            console.log('Creating page with data:', {
                name: data.name,
                category: data.category,
                hasAbout: !!data.about,
                hasWebsite: !!data.website
            });

            // Get business info to ensure we have the business ID
            const businessInfo = await this.getBusinessInfo();
            const businessId = businessInfo.businesses.data[0]?.id;
            
            if (!businessId) {
                throw new Error('No business found. Please create a business first.');
            }

            // Create the page using the business account
            const pageUrl = `https://graph.facebook.com/v22.0/${businessId}/pages`;
            const response = await axios.post(pageUrl, null, {
                params: {
                    name: data.name,
                    category: data.category,
                    about: data.about,
                    access_token: this.accessToken
                }
            });

            console.log('Page creation response:', response.data);

            // Ensure response has the required fields
            if (!response.data || !response.data.id || !response.data.name || !response.data.category || !response.data.access_token) {
                throw new Error('Invalid response from Facebook API');
            }

            // If we have additional data to update, do it in a separate call
            if (data.website || data.phone || data.address) {
                const updateUrl = `https://graph.facebook.com/v22.0/${response.data.id}`;
                await axios.post(updateUrl, null, {
                    params: {
                        website: data.website,
                        phone: data.phone,
                        address: data.address,
                        city: data.city,
                        state: data.state,
                        zip: data.zip,
                        country: data.country,
                        access_token: response.data.access_token  // Use the page access token for updates
                    }
                });
            }

            const page: PageCreationResponse = {
                id: response.data.id,
                name: response.data.name,
                category: response.data.category,
                access_token: response.data.access_token,
                tasks: response.data.tasks,
                perms: response.data.perms
            };

            console.log('Page created successfully:', page);
            return page;
        } catch (error: any) {
            console.error('Error creating page:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Connect a page to the ad account
    // This method's purpose might need re-evaluation based on Facebook's current API behavior
    private async connectPageToAdAccount(pageId: string) {
        try {
            // Ensure we're using the correct ad account ID format
            const adAccountId = this.adAccount?.id;
            // This call seems to be assigning the app's user to the ad account within the business.
            // This is a Business Manager operation, not directly linking a page for advertising.
            // For advertising, you'd typically select the page when creating an ad creative.
            const result = await this.api.call( // Use this.api
                'POST',
                `/${adAccountId}/assigned_users`,
                {
                    user: FACEBOOK_CONFIG.appId, // This might be incorrect; typically it's a user ID
                    business: FACEBOOK_CONFIG.businessId,
                    tasks: ['MANAGE', 'ADVERTISE'],
                    access_token: this.accessToken // Ensure user's access token is used
                }
            );
            console.log('Page connected to ad account (via assigned_users):', result);
            return result;
        } catch (error) {
            console.error('Error connecting page to ad account:', error);
            throw error;
        }
    }

    // Get all pages associated with the user
    async getPages() {
        try {
            console.log('=== getPages: Starting API call ===');
            
            // First get user info to get the Facebook user ID
            const userInfo = await this.getUserInfo();
            if (!userInfo || !userInfo.id) {
                throw new Error('Failed to get Facebook user ID');
            }

            // Get pages through the user account
            const pagesUrl = `https://graph.facebook.com/v22.0/${userInfo.id}/accounts`;
            console.log('getPages: Calling Facebook Graph API:', pagesUrl);
            
            const pagesParams = {
                fields: [
                    'id',
                    'name',
                    'category',
                    'access_token',
                    'tasks',
                    'verification_status',
                    'fan_count',
                    'link'
                ].join(','),
                access_token: this.accessToken
            };

            const response = await axios.get(pagesUrl, { params: pagesParams });
            console.log('getPages: Response:', JSON.stringify(response.data, null, 2));

            if (!response.data || !response.data.data) {
                return [];
            }

            return response.data.data;
        } catch (error: any) {
            console.error('getPages: Error fetching pages:', error);
            console.error('getPages: Error details:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Update page information
    async updatePage(pageId: string, pageAccessToken: string, updates: Partial<PageData> = {}) {
        try {
            console.log('Updating page with data:', {
                pageId,
                hasAbout: !!updates.about,
                hasWebsite: !!updates.website,
                hasPhone: !!updates.phone,
                hasAddress: !!updates.address
            });

            const updateUrl = `https://graph.facebook.com/v22.0/${pageId}`;
            const response = await axios.post(updateUrl, null, {
                params: {
                    ...updates,
                    access_token: pageAccessToken
                }
            });

            console.log('Page update response:', response.data);

            if (!response.data || response.data.error) {
                throw new Error(response.data?.error?.message || 'Failed to update page');
            }

            return response.data;
        } catch (error: any) {
            console.error('Error updating page:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Get page information
    async getPageInfo(pageId: string, pageAccessToken: string) {
        try {
            const pageUrl = `https://graph.facebook.com/v22.0/${pageId}`;
            const response = await axios.get(pageUrl, {
                params: {
                    fields: [
                        'id',
                        'name',
                        'category',
                        'about',
                        'website',
                        'phone',
                        'location',
                        'fan_count',
                        'verification_status',
                        'link',
                        'access_token'
                    ].join(','),
                    access_token: pageAccessToken
                }
            });

            console.log('Page info response:', response.data);

            if (!response.data || response.data.error) {
                throw new Error(response.data?.error?.message || 'Failed to get page info');
            }

            return response.data;
        } catch (error: any) {
            console.error('Error getting page info:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Get business information
    async getBusinessInfo() {
        try {
            console.log('=== getBusinessInfo: Starting API calls ===');
            console.log('getBusinessInfo: Using access token (first 30 chars):', this.accessToken.substring(0, 30) + '...');

            // Get user information
            const meUrl = 'https://graph.facebook.com/v22.0/me';
            console.log('getBusinessInfo: Calling Facebook Graph API:', meUrl);
            const meParams = {
                fields: ['id', 'name', 'email'].join(','),
                access_token: this.accessToken
            };
            console.log('getBusinessInfo: Request parameters:', {
                ...meParams,
                access_token: meParams.access_token.substring(0, 30) + '...'
            });

            const response = await axios.get(meUrl, { params: meParams });
            console.log('getBusinessInfo: User Info Response:', JSON.stringify(response.data, null, 2));

            // Get businesses
            const businessesUrl = 'https://graph.facebook.com/v22.0/me/businesses';
            console.log('getBusinessInfo: Calling Facebook Graph API:', businessesUrl);
            const businessesParams = {
                fields: ['id', 'name'].join(','),
                access_token: this.accessToken
            };
            console.log('getBusinessInfo: Request parameters:', {
                ...businessesParams,
                access_token: businessesParams.access_token.substring(0, 30) + '...'
            });

            const businessesResponse = await axios.get(businessesUrl, { params: businessesParams });
            console.log('getBusinessInfo: Businesses Response:', JSON.stringify(businessesResponse.data, null, 2));

            // Get ad accounts
            const adAccountsUrl = 'https://graph.facebook.com/v22.0/me/adaccounts';
            console.log('getBusinessInfo: Calling Facebook Graph API:', adAccountsUrl);
            const adAccountsParams = {
                fields: [
                    'id',
                    'name',
                    'account_status',
                    'business{id,name}',
                    'currency',
                    'timezone_name',
                    'owner{id,name}',
                    'account_id',
                    'balance',
                    'spend_cap',
                    'amount_spent'
                ].join(','),
                access_token: this.accessToken
            };
            console.log('getBusinessInfo: Request parameters:', {
                ...adAccountsParams,
                access_token: adAccountsParams.access_token.substring(0, 30) + '...'
            });

            const adAccountsResponse = await axios.get(adAccountsUrl, { params: adAccountsParams });
            const adAccounts = adAccountsResponse.data as AdAccountsResponse;
            console.log('getBusinessInfo: Raw Ad Accounts Response:', JSON.stringify(adAccounts, null, 2));

            // Process ad accounts
            const processedAdAccounts = {
                data: Array.isArray(adAccounts) ? adAccounts : adAccounts?.data || []
            };
            console.log('getBusinessInfo: Processed Ad Accounts:', JSON.stringify(processedAdAccounts, null, 2));

            // Log account statuses
            if (processedAdAccounts.data.length > 0) {
                console.log('getBusinessInfo: Ad Account Statuses:');
                processedAdAccounts.data.forEach(account => {
                    console.log(`- Account ${account.name} (${account.id}): Status ${account.account_status}`);
                });
            } else {
                console.warn('getBusinessInfo: No ad accounts found in the response');
            }

            // If we have a business ID in config, get its details
            if (FACEBOOK_CONFIG.businessId) {
                if (!FACEBOOK_CONFIG.businessId.match(/^\d+$/)) {
                    console.warn(`getBusinessInfo: FACEBOOK_CONFIG.businessId (${FACEBOOK_CONFIG.businessId}) seems malformed or is an Ad Account ID. Skipping business details fetch.`);
                    return { 
                        userInfo: response.data, 
                        businesses: businessesResponse.data, 
                        adAccounts: processedAdAccounts 
                    };
                }
                const businessUrl = `https://graph.facebook.com/v22.0/${FACEBOOK_CONFIG.businessId}`;
                console.log('getBusinessInfo: Calling Facebook Graph API:', businessUrl);
                const businessParams = {
                    fields: ['id', 'name'].join(','),
                    access_token: this.accessToken
                };
                console.log('getBusinessInfo: Request parameters:', {
                    ...businessParams,
                    access_token: businessParams.access_token.substring(0, 30) + '...'
                });

                const businessResponse = await axios.get(businessUrl, { params: businessParams });
                console.log('getBusinessInfo: Business Details Response:', JSON.stringify(businessResponse.data, null, 2));

                // Save or update business info in database
                const businessData = {
                    facebookUserId: response.data.id,
                    businessId: FACEBOOK_CONFIG.businessId,
                    name: businessResponse.data.name,
                    adAccounts: processedAdAccounts.data,
                    lastUpdated: new Date()
                };

                await BusinessModel.findOneAndUpdate(
                    { facebookUserId: response.data.id, businessId: FACEBOOK_CONFIG.businessId },
                    businessData,
                    { upsert: true, new: true }
                );

                return {
                    userInfo: response.data,
                    businesses: businessesResponse.data,
                    adAccounts: processedAdAccounts,
                    currentBusiness: businessResponse.data
                };
            }

            console.log('=== getBusinessInfo: API calls completed successfully ===');
            return { 
                userInfo: response.data, 
                businesses: businessesResponse.data, 
                adAccounts: processedAdAccounts 
            };
        } catch (error: any) {
            console.error('getBusinessInfo: Error fetching business information:', error);
            console.error('getBusinessInfo: Error details:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Add a new method to get cached business info
    async getCachedBusinessInfo(facebookUserId: string) {
        try {
            const business = await BusinessModel.findOne({ facebookUserId });
            if (!business) {
                return null;
            }

            // Check if the data is older than 1 hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (business.lastUpdated < oneHourAgo) {
                // Data is stale, fetch fresh data
                return this.getBusinessInfo();
            }

            return {
                businessId: business.businessId,
                name: business.name,
                adAccounts: { data: business.adAccounts },
                lastUpdated: business.lastUpdated
            };
        } catch (error) {
            console.error('Error getting cached business info:', error);
            // If there's an error with the cache, fall back to API call
            return this.getBusinessInfo();
        }
    }

    // Get basic user information
    async getUserInfo() {
        try {
            const meUrl = 'https://graph.facebook.com/v22.0/me';
            const meParams = {
                fields: ['id', 'name', 'email'].join(','),
                access_token: this.accessToken
            };

            const response = await axios.get(meUrl, { params: meParams });
            return response.data;
        } catch (error: any) {
            console.error('Error getting user info:', error);
            throw error;
        }
    }

    // Create a post on a Facebook page
    async createPost(pageId: string, pageAccessToken: string, content: {
        message?: string;
        link?: string;
        video_url?: string;
        video_title?: string;
        video_description?: string;
        image_url?: string;
        scheduled_publish_time?: number;
        video_file?: {
            name: string;
            buffer: Buffer;
            size: number;
        };
    }) {
        try {
            console.log('Creating post with data:', {
                pageId,
                hasMessage: !!content.message,
                hasLink: !!content.link,
                hasVideo: !!content.video_url || !!content.video_file,
                hasImage: !!content.image_url,
                scheduledTime: content.scheduled_publish_time
            });

            // If we have a video file, upload it first
            if (content.video_file) {
                // Start upload session
                const uploadSession = await this.startVideoUpload(
                    content.video_file.name,
                    content.video_file.size
                );

                // Upload the video
                const uploadResponse = await this.uploadVideoChunk(
                    uploadSession.id,
                    content.video_file.buffer
                );

                // Publish the video
                const videoResponse = await this.publishVideo(
                    pageId,
                    pageAccessToken,
                    uploadResponse.h,
                    content.video_title,
                    content.video_description
                );

                // If we have a message, create a post with the video
                if (content.message) {
                    const postUrl = `https://graph.facebook.com/v22.0/${pageId}/feed`;
                    const response = await axios.post(postUrl, null, {
                        params: {
                            message: content.message,
                            video_id: videoResponse.id,
                            access_token: pageAccessToken
                        }
                    });

                    console.log('Post with video response:', response.data);
                    return response.data;
                }

                return videoResponse;
            }

            // If we have a video URL, use the existing logic
            if (content.video_url) {
                // First, create a video container
                const videoContainerUrl = `https://graph.facebook.com/v22.0/${pageId}/videos`;
                const videoContainerResponse = await axios.post(videoContainerUrl, null, {
                    params: {
                        file_url: content.video_url,
                        title: content.video_title,
                        description: content.video_description,
                        access_token: pageAccessToken
                    }
                });

                console.log('Video upload response:', videoContainerResponse.data);

                if (!videoContainerResponse.data || videoContainerResponse.data.error) {
                    throw new Error(videoContainerResponse.data?.error?.message || 'Failed to upload video');
                }

                // If we have a message, create a post with the video
                if (content.message) {
                    const postUrl = `https://graph.facebook.com/v22.0/${pageId}/feed`;
                    const response = await axios.post(postUrl, null, {
                        params: {
                            message: content.message,
                            video_id: videoContainerResponse.data.id,
                            access_token: pageAccessToken
                        }
                    });

                    console.log('Post with video response:', response.data);
                    return response.data;
                }

                return videoContainerResponse.data;
            }

            // If we have an image, we need to upload it first
            if (content.image_url) {
                const photoUrl = `https://graph.facebook.com/v22.0/${pageId}/photos`;
                const response = await axios.post(photoUrl, null, {
                    params: {
                        url: content.image_url,
                        message: content.message,
                        access_token: pageAccessToken
                    }
                });

                console.log('Photo upload response:', response.data);
                return response.data;
            }

            // Regular post (text and/or link)
            const postUrl = `https://graph.facebook.com/v22.0/${pageId}/feed`;
            const response = await axios.post(postUrl, null, {
                params: {
                    ...content,
                    access_token: pageAccessToken
                }
            });

            console.log('Post creation response:', response.data);

            if (!response.data || response.data.error) {
                throw new Error(response.data?.error?.message || 'Failed to create post');
            }

            return response.data;
        } catch (error: any) {
            console.error('Error creating post:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg,
                response: error.response?.data
            });
            throw error;
        }
    }

    // Get comments for a post
    async getComments(postId: string, pageAccessToken: string) {
        try {
            const commentsUrl = `https://graph.facebook.com/v22.0/${postId}/comments`;
            const response = await axios.get(commentsUrl, {
                params: {
                    fields: [
                        'id',
                        'message',
                        'created_time',
                        'from',
                        'like_count',
                        'comment_count',
                        'parent'
                    ].join(','),
                    access_token: pageAccessToken
                }
            });

            console.log('Comments response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error getting comments:', error);
            throw error;
        }
    }

    // Get likes for a post
    async getLikes(postId: string, pageAccessToken: string) {
        try {
            const likesUrl = `https://graph.facebook.com/v22.0/${postId}/likes`;
            const response = await axios.get(likesUrl, {
                params: {
                    fields: ['id', 'name'].join(','),
                    access_token: pageAccessToken
                }
            });

            console.log('Likes response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error getting likes:', error);
            throw error;
        }
    }

    // Add a comment to a post
    async addComment(postId: string, pageAccessToken: string, message: string) {
        try {
            const commentUrl = `https://graph.facebook.com/v22.0/${postId}/comments`;
            const response = await axios.post(commentUrl, null, {
                params: {
                    message,
                    access_token: pageAccessToken
                }
            });

            console.log('Comment response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error adding comment:', error);
            throw error;
        }
    }

    // Reply to a comment
    async replyToComment(commentId: string, pageAccessToken: string, message: string) {
        try {
            // Extract the post ID from the comment ID
            const postId = commentId.split('_')[0];
            
            // Create a new comment on the post with the reply message
            const replyUrl = `https://graph.facebook.com/v22.0/${postId}/comments`;
            const response = await axios.post(replyUrl, null, {
                params: {
                    message,
                    access_token: pageAccessToken
                }
            });

            console.log('Reply response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error replying to comment:', error);
            throw error;
        }
    }

    // Get post insights (engagement metrics)
    async getPostInsights(postId: string, pageAccessToken: string) {
        try {
            const insightsUrl = `https://graph.facebook.com/v22.0/${postId}/insights`;
            const response = await axios.get(insightsUrl, {
                params: {
                    metric: [
                        'post_impressions',
                        'post_engagements',
                        'post_reactions_by_type_total',
                        'post_clicks',
                        'post_shares'
                    ].join(','),
                    access_token: pageAccessToken
                }
            });

            console.log('Post insights response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error getting post insights:', error);
            throw error;
        }
    }

    // Get all posts from a page
    async getPagePosts(pageId: string, pageAccessToken: string) {
        try {
            const postsUrl = `https://graph.facebook.com/v22.0/${pageId}/posts`;
            const response = await axios.get(postsUrl, {
                params: {
                    fields: [
                        'id',
                        'message',
                        'created_time',
                        'full_picture',
                        'permalink_url',
                        'shares',
                        'likes.summary(true)',
                        'comments.summary(true)'
                    ].join(','),
                    access_token: pageAccessToken
                }
            });

            console.log('Page posts response:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error getting page posts:', error);
            throw error;
        }
    }

    // Add these methods to the FacebookService class
    async startVideoUpload(fileName: string, fileSize: number): Promise<UploadSession> {
        try {
            const uploadUrl = `https://graph.facebook.com/v22.0/${FACEBOOK_CONFIG.appId}/uploads`;
            const response = await axios.post(uploadUrl, null, {
                params: {
                    file_name: fileName,
                    file_length: fileSize,
                    file_type: 'video/mp4',
                    access_token: this.accessToken
                }
            });

            console.log('Upload session started:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error starting video upload:', error);
            throw error;
        }
    }

    async uploadVideoChunk(sessionId: string, fileBuffer: Buffer, offset: number = 0): Promise<UploadResponse> {
        try {
            const uploadUrl = `https://graph.facebook.com/v22.0/${sessionId}`;
            const response = await axios.post(uploadUrl, fileBuffer, {
                headers: {
                    'Authorization': `OAuth ${this.accessToken}`,
                    'file_offset': offset.toString(),
                    'Content-Type': 'application/octet-stream'
                }
            });

            console.log('Video chunk uploaded:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error uploading video chunk:', error);
            throw error;
        }
    }

    async getUploadStatus(sessionId: string): Promise<UploadStatus> {
        try {
            const statusUrl = `https://graph.facebook.com/v22.0/${sessionId}`;
            const response = await axios.get(statusUrl, {
                headers: {
                    'Authorization': `OAuth ${this.accessToken}`
                }
            });

            console.log('Upload status:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error getting upload status:', error);
            throw error;
        }
    }

    async publishVideo(pageId: string, pageAccessToken: string, videoHandle: string, title?: string, description?: string) {
        try {
            const publishUrl = `https://graph-video.facebook.com/v22.0/${pageId}/videos`;
            const response = await axios.post(publishUrl, null, {
                params: {
                    access_token: pageAccessToken,
                    title: title,
                    description: description,
                    fbuploader_video_file_chunk: videoHandle
                }
            });

            console.log('Video published:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Error publishing video:', error);
            throw error;
        }
    }
}
