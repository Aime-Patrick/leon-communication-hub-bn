import { AdAccount, Campaign, AdSet, Ad, AbstractCrudObject, User, Business, FacebookAdsApi, Page } from 'facebook-nodejs-business-sdk';
import { FACEBOOK_CONFIG, initializeFacebookAPI } from '../config/facebook.config';

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
    access_token: string;
    tasks?: string[];
    perms?: string[];
}

export class FacebookService {
    private api: FacebookAdsApi;
    private adAccount: AdAccount;

    constructor() {
        try {
            this.api = initializeFacebookAPI();
            this.adAccount = new AdAccount(FACEBOOK_CONFIG.adAccountId);
        } catch (error: any) {
            console.error('Error in FacebookService constructor:', error);
            throw error;
        }
    }

    // Verify access token with retry
    private async verifyAccessToken(retries = 3): Promise<void> {
        let lastError: any;
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Verifying access token (attempt ${i + 1}/${retries})...`);
                
                if (!FACEBOOK_CONFIG.accessToken) {
                    throw new Error('Access token is missing');
                }

                // First verify the token is valid by making a simple API call
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

                // Check for required permissions
                const requiredPermissions = [
                    'ads_management',
                    'business_management',
                    'pages_messaging'
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
                
                // If it's not the last attempt, wait before retrying
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }

        // If we get here, all retries failed
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
            console.log('Ad Account Details:', accountDetails);

            // Get users with access
            const users = await this.adAccount.get([
                'users'
            ]);
            console.log('Users with Access:', users);

            // If we have a business ID, get assigned users
            let assignedUsers = null;
            if (accountDetails.business?.id) {
                const business = accountDetails.business;
                assignedUsers = await this.adAccount.get([
                    'assigned_users'
                ], {
                    business: business.id
                });
                console.log('Assigned Users:', assignedUsers);
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
            console.log('Ad Account Access:', account);

            // Check user permissions
            const user = new User('me');
            const permissions = await user.getPermissions(
                ['permission'],
                { access_token: FACEBOOK_CONFIG.accessToken }
            );
            console.log('User Permissions:', permissions);

            // Check if we can read campaigns
            const campaigns = await this.adAccount.getCampaigns(['id']);
            console.log('Campaign Access:', campaigns);

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
            // Get pages associated with the ad account
            const response = await this.adAccount.get([
                'owned_pages',
                'connected_pages'
            ]);
            const pages = response as unknown as AdAccountDetails;
            console.log('Associated Pages:', pages);

            if (!pages.owned_pages?.data?.length && !pages.connected_pages?.data?.length) {
                throw new Error('No Facebook Pages associated with this ad account. Please connect a Page to your Business Manager and Ad Account.');
            }

            return pages;
        } catch (error) {
            console.error('Page Association Verification Error:', error);
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
            'Technology', 'Education', 'Non-profit Organization',
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

            // Verify page association
            const pages = await this.verifyPageAssociation();
            console.log('Page association verified:', pages);

            this.validateCampaignData(data);
            
            const params = {
                name: data.name,
                objective: data.objective,
                status: data.status || 'PAUSED',
                special_ad_categories: data.special_ad_categories || [],
                buying_type: data.buying_type || 'AUCTION',
                campaign_optimization_type: data.campaign_optimization_type || 'NONE'
            };

            console.log('Creating campaign with params:', params);

            // Create campaign using the correct method
            const campaign = await (this.adAccount as any).createCampaign(
                [],
                params
            );
            console.log('Campaign created successfully:', campaign);
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
            const campaign = new Campaign(campaignId);
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
            return await (AdSet as any).create(this.adAccount.id, params);
        } catch (error) {
            console.error('Error creating ad set:', error);
            throw error;
        }
    }

    // Get ads for an ad set
    async getAds(adSetId: string) {
        try {
            const adSet = new AdSet(adSetId);
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
            return await (Ad as any).create(this.adAccount.id, params);
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
            // First verify access token
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
            const response = await this.api.call(
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
                    country: data.country
                }
            ) as {
                id: string;
                name: string;
                category: string;
                access_token: string;
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

            // Connect the page to the ad account
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
    private async connectPageToAdAccount(pageId: string) {
        try {
            // Ensure we're using the correct ad account ID format
            const adAccountId = this.adAccount.id;
            const result = await this.api.call(
                'POST',
                `/${adAccountId}/assigned_users`,
                {
                    user: FACEBOOK_CONFIG.appId,
                    business: FACEBOOK_CONFIG.businessId,
                    tasks: ['MANAGE', 'ADVERTISE']
                }
            );
            console.log('Page connected to ad account:', result);
            return result;
        } catch (error) {
            console.error('Error connecting page to ad account:', error);
            throw error;
        }
    }

    // Get all pages associated with the user
    async getPages() {
        try {
            const pages = await this.api.call(
                'GET',
                '/me/accounts',
                {
                    fields: ['id', 'name', 'category', 'tasks', 'access_token']
                }
            );
            return pages;
        } catch (error) {
            console.error('Error fetching pages:', error);
            throw error;
        }
    }

    // Update page information
    async updatePage(pageId: string, data: Partial<PageData>) {
        try {
            const result = await this.api.call(
                'POST',
                `/${pageId}`,
                data
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
            // Initialize API with access token
            const api = FacebookAdsApi.init(FACEBOOK_CONFIG.accessToken!);
            api.setDebug(true);

            // Get user information
            const response = await api.call(
                'GET',
                '/me',
                {
                    fields: ['id', 'name', 'businesses', 'accounts']
                }
            );
            console.log('User Info:', response);

            // Get businesses
            const businesses = await api.call(
                'GET',
                '/me/businesses',
                {
                    fields: ['id', 'name', 'verification_status']
                }
            );
            console.log('Available Businesses:', businesses);

            // Get ad accounts
            const adAccounts = await api.call(
                'GET',
                '/me/adaccounts',
                {
                    fields: ['id', 'name', 'account_status', 'business']
                }
            );
            console.log('Available Ad Accounts:', adAccounts);

            // If we have a business ID in config, get its details
            if (FACEBOOK_CONFIG.businessId) {
                const businessDetails = await api.call(
                    'GET',
                    `/${FACEBOOK_CONFIG.businessId}`,
                    {
                        fields: ['id', 'name', 'verification_status', 'owned_pages', 'owned_instagram_accounts']
                    }
                );
                console.log('Current Business Details:', businessDetails);
                return {
                    userInfo: response,
                    businesses,
                    adAccounts,
                    currentBusiness: businessDetails
                };
            }

            return { userInfo: response, businesses, adAccounts };
        } catch (error) {
            console.error('Error fetching business information:', error);
            throw error;
        }
    }
} 