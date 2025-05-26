import { AdAccount, Campaign, AdSet, Ad, AbstractCrudObject, User, Business, FacebookAdsApi, Page } from 'facebook-nodejs-business-sdk';
import { FACEBOOK_CONFIG, initializeFacebookAPI } from '../config/facebook.config';
import axios from 'axios'; // For making HTTP requests to Facebook's Graph API directly

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
    | 'Business'
    | 'Company'
    | 'Organization'
    | 'Brand'
    | 'Product/Service'
    | 'Local Business'
    | 'Restaurant'
    | 'Retail'
    | 'Shopping & Retail'
    | 'E-commerce Website'
    | 'Website'
    | 'Blog'
    | 'Media'
    | 'Entertainment'
    | 'Technology'
    | 'Education'
    | 'Non-profit Organization'
    | 'Community Organization'
    | 'Public Figure'
    | 'Artist'
    | 'Musician'
    | 'Writer'
    | 'Personal Blog';

export interface PageData {
    name: string;
    category: PageCategory;
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

export class FacebookService {
    private api: FacebookAdsApi;
    private adAccount: AdAccount;
    private accessToken: string;
    private adAccountId: string;

    constructor(accessToken: string, adAccountId?: string) {
        try {
            this.accessToken = accessToken;
            
            // Initialize the global API instance with the access token
            this.api = new FacebookAdsApi(this.accessToken);
            console.log('FacebookService Constructor: Initialized API instance with access token');
            
            // Only set up adAccount if adAccountId is provided
            if (adAccountId) {
                // Fix the adAccountId: Ensure it's not empty and formatted correctly
                if (adAccountId.trim() === '') {
                    throw new Error('Ad Account ID cannot be empty. Please ensure FACEBOOK_AD_ACCOUNT_ID is set in your .env or provided by the user.');
                }
                const cleanId = adAccountId.replace(/^act_/, '');
                this.adAccountId = `act_${cleanId}`;
                console.log('FacebookService Constructor: Using adAccountId:', this.adAccountId);
                
                // Create the AdAccount instance
                this.adAccount = new AdAccount(this.adAccountId);
                console.log('FacebookService Constructor: AdAccount instance created. AdAccount ID:', (this.adAccount as any)?._data?.id);
            } else {
                console.log('FacebookService Constructor: No adAccountId provided, skipping AdAccount initialization');
            }

        } catch (error: any) {
            console.error('Error in FacebookService constructor:', error);
            throw error;
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
    // This method now uses the internal accessToken
    async verifyAccessToken(retries = 3): Promise<void> {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Verifying access token (attempt ${i + 1}/${retries})...`);

                if (!this.accessToken) {
                    throw new Error('Access token is missing from service instance');
                }

                // Use the global API instance for calls
                const userResponse = await this.api.call(
                    'GET',
                    '/me',
                    {
                        fields: ['id', 'name']
                    }
                ) as {
                    id: string;
                    name: string;
                };

                console.log('User verification response:', userResponse);

                if (!userResponse || !userResponse.id) {
                    throw new Error('Invalid access token - unable to fetch user data');
                }

                // Now check permissions
                const permissionsResponse = await this.api.call(
                    'GET',
                    '/me/permissions',
                    {}
                ) as {
                    data: Array<{
                        permission: string;
                        status: string;
                    }>;
                };

                console.log('Permissions response:', permissionsResponse);

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

                const grantedPermissions = permissionsResponse.data
                    .filter(p => p.status === 'granted')
                    .map(p => p.permission);

                console.log('Granted permissions:', grantedPermissions);

                const missingPermissions = requiredPermissions.filter(required =>
                    !grantedPermissions.includes(required)
                );

                if (missingPermissions.length > 0) {
                    throw new Error(`Missing required permissions: ${missingPermissions.join(', ')}. Please request these permissions when generating a new token.`);
                }

                console.log('Access token verified successfully with permissions:', grantedPermissions);
                return;
            } catch (error: any) {
                console.error(`Token verification attempt ${i + 1} failed:`, {
                    message: error.message,
                    code: error.code,
                    subcode: error.subcode,
                    error_user_msg: error.error_user_msg
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
            const response = await this.adAccount.get([
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
            const users = await this.adAccount.get([
                'users'
            ]);

            // If we have a business ID, get assigned users
            let assignedUsers = null;
            if (accountDetails.business?.id) {
                const business = accountDetails.business;
                assignedUsers = await this.adAccount.get([
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
            const account = await this.adAccount.get(['id', 'name', 'account_status']);

            // Check user permissions - User constructor should pick up global API
            const user = new User('me'); // Removed this.api
            const permissions = await user.getPermissions(
                ['permission']
            );

            // Check if we can read campaigns
            const campaigns = await this.adAccount.getCampaigns(['id']);

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
        if (!data.category) {
            throw new Error('Page category is required');
        }
        // Validate category is one of the allowed values
        const validCategories: PageCategory[] = [
            'Business', 'Company', 'Organization', 'Brand', 'Product/Service',
            'Local Business', 'Restaurant', 'Retail', 'Shopping & Retail',
            'E-commerce Website', 'Website', 'Blog', 'Media', 'Entertainment',
            'Technology', 'Education',
            'Non-profit Organization',
            'Community Organization', 'Public Figure', 'Artist', 'Musician',
            'Writer', 'Personal Blog'
        ];
        if (!validCategories.includes(data.category)) {
            throw new Error(`Invalid page category. Must be one of: ${validCategories.join(', ')}`);
        }
    }

    // Create a new campaign
    async createCampaign(data: CampaignData) {
        try {
            // First verify permissions
            const permissions = await this.verifyPermissions();
            console.log('Permissions verified:', permissions);

            // Verify page association - this is now required
            const pages = await this.verifyPageAssociation();
            console.log(pages)
            if (!pages || pages.length === 0) {
                throw new Error('No Facebook Pages associated with this ad account. Please create a page first using the /api/facebook/pages endpoint.');
            }

            this.validateCampaignData(data);
            
            const params = {
                name: data.name,
                objective: data.objective,
                status: data.status || 'PAUSED',
                special_ad_categories: data.special_ad_categories || [],
                buying_type: data.buying_type || 'AUCTION',
                campaign_optimization_type: data.campaign_optimization_type || 'NONE'
            };


            // Create campaign using the correct method
            const campaign = await (this.adAccount as any).createCampaign(
                [],
                params
            );
            return campaign;
        } catch (error: any) {
            console.error('Error creating campaign:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg
            });
            throw error;
        }
    }

    // Get all campaigns
    async getCampaigns() {
        try {
            const campaigns = await this.adAccount.getCampaigns(
                ['id', 'name', 'status', 'objective', 'created_time', 'special_ad_categories', 'buying_type']
            );
            return campaigns;
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            throw error;
        }
    }

    // Get ad sets for a campaign
    async getAdSets(campaignId: string) {
        try {
            // Campaign constructor should pick up global API
            const campaign = new Campaign(campaignId); // Removed this.api
            const adSets = await campaign.getAdSets(
                ['id', 'name', 'status', 'daily_budget', 'lifetime_budget']
            );
            return adSets;
        } catch (error) {
            console.error('Error fetching ad sets:', error);
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
            return await (AdSet as any).create(this.adAccount.id, params); // Removed { api: this.api }
        } catch (error) {
            console.error('Error creating ad set:', error);
            throw error;
        }
    }

    // Get ads for an ad set
    async getAds(adSetId: string) {
        try {
            // AdSet constructor should pick up global API
            const adSet = new AdSet(adSetId); // Removed this.api
            const ads = await adSet.getAds(
                ['id', 'name', 'status', 'creative']
            );
            return ads;
        } catch (error) {
            console.error('Error fetching ads:', error);
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
            return await (Ad as any).create(this.adAccount.id, params); // Removed { api: this.api }
        } catch (error) {
            console.error('Error creating ad:', error);
            throw error;
        }
    }

    // Get ad account insights
    async getInsights(params: any = {}) {
        try {
            const insights = await this.adAccount.getInsights(
                ['impressions', 'clicks', 'spend', 'reach'],
                params
            );
            return insights;
        } catch (error) {
            console.error('Error fetching insights:', error);
            throw error;
        }
    }

    // Create a new Facebook Page
    async createPage(data: PageData): Promise<PageCreationResponse> {
        try {
            // First verify access token (already done by constructor, but good to re-verify permissions)
            await this.verifyAccessToken();

            // Then verify user permissions
            const permissions = await this.verifyPermissions();
            console.log('Permissions verified:', permissions);

            // Validate page data
            this.validatePageData(data);

            console.log('Creating page with data:', {
                name: data.name,
                category: data.category,
                hasAbout: !!data.about,
                hasWebsite: !!data.website
            });

            // Create the page using the business account
            // Ensure the access token is passed for this API call
            const response = await this.api.call( // Use this.api
                'POST',
                `/${FACEBOOK_CONFIG.businessId}/owned_pages`,
                {
                    name: data.name,
                    category: data.category,
                    about: data.about,
                    website: data.website,
                    phone: data.phone,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    zip: data.zip,
                    country: data.country,
                    access_token: this.accessToken // Explicitly pass the user's access token
                }
            ) as {
                id: string;
                name: string;
                category: string;
                access_token: string; // This is the page access token
                tasks?: string[];
                perms?: string[];
            };

            console.log('Page creation response:', response);

            // Ensure response has the required fields
            if (!response || !response.id || !response.name || !response.category || !response.access_token) {
                throw new Error('Invalid response from Facebook API');
            }

            const page: PageCreationResponse = {
                id: response.id,
                name: response.name,
                category: response.category,
                access_token: response.access_token,
                tasks: response.tasks,
                perms: response.perms
            };

            console.log('Page created successfully:', page);

            // Connect the page to the ad account (this part needs careful testing)
            // This might be more about assigning user roles/permissions within Business Manager
            // rather than a direct API "connection" for advertising.
            // Consider if this step is truly necessary or if the page is implicitly available
            // once created under the business and the user has correct permissions.
            await this.connectPageToAdAccount(page.id);
            
            return page;
        } catch (error: any) {
            console.error('Error creating page:', {
                message: error.message,
                code: error.code,
                subcode: error.subcode,
                error_user_msg: error.error_user_msg
            });
            throw error;
        }
    }

    // Connect a page to the ad account
    // This method's purpose might need re-evaluation based on Facebook's current API behavior
    private async connectPageToAdAccount(pageId: string) {
        try {
            // Ensure we're using the correct ad account ID format
            const adAccountId = this.adAccount.id;
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
            
            // First get business info to ensure we have the business ID
            const businessInfo = await this.getBusinessInfo();
            const businessId = businessInfo.businesses.data[0]?.id;
            
            if (!businessId) {
                throw new Error('No business found. Please create a business first.');
            }

            // Get pages through the business account
            const pagesUrl = `https://graph.facebook.com/v22.0/${businessId}/owned_pages`;
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
    async updatePage(pageId: string, data: Partial<PageData>) {
        try {
            // When updating a page, you typically need the PAGE access token, not the user access token.
            // You would need to retrieve the page's access token first (e.g., from your database where you stored it).
            // For simplicity, this example still uses the user's access token, which might work for some fields
            // if the user has sufficient permissions, but it's not the standard way for page management.
            const pageAccessToken = this.accessToken; // Placeholder: Replace with actual page access token
            
            const result = await this.api.call( // Use this.api
                'POST',
                `/${pageId}`,
                {
                    ...data,
                    access_token: pageAccessToken // Use the page access token
                }
            );
            console.log('Page updated successfully:', result);
            return result;
        } catch (error) {
            console.error('Error updating page:', error);
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
}
