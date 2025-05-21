# Facebook Marketing API Integration Guide

## Setup Requirements

### 1. Facebook Developer Account Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add the Marketing API product to your app:
   - Go to your app's dashboard
   - Click "Add Products" in the left menu
   - Find "Marketing API" and click "Set Up"
   - Complete the setup process

4. Configure App Permissions:
   - Go to "App Review" → "Permissions and Features"
   - Request the following permissions:
     - `ads_management`
     - `ads_read`
     - `business_management`
     - `pages_read_engagement`
     - `pages_manage_ads`

5. Configure App Capabilities:
   - Go to "App Settings" → "Basic"
   - Under "App Capabilities", enable:
     - "Marketing API"
     - "Ads API"
     - "Business Manager API"

6. Get your credentials:
   - App ID
   - App Secret
   - Access Token (with required permissions)
   - Ad Account ID (format: just the number, e.g., "123456789")

### 2. Access Token Setup
1. Generate a long-lived access token:
   - Go to [Facebook Access Token Tool](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Click "Generate Access Token"
   - Request the required permissions
   - Click "Generate Long-Lived Token"

2. Verify token permissions:
   - The token should have `ads_management` and `ads_read` permissions
   - You can verify this in the token debugger

### 3. Environment Variables
Create a `.env` file in the root directory with:
```env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_ACCESS_TOKEN=your_access_token  # Long-lived token with required permissions
FACEBOOK_AD_ACCOUNT_ID=your_ad_account_id  # Just the number, without 'act_' prefix
```

## API Endpoints

### Campaigns

#### Get All Campaigns
```http
GET /api/facebook/campaigns
```
Response:
```json
[
  {
    "id": "campaign_id",
    "name": "Campaign Name",
    "status": "ACTIVE",
    "objective": "OUTCOME_SALES",
    "created_time": "2024-03-20T10:00:00Z"
  }
]
```

#### Create Campaign
```http
POST /api/facebook/campaigns
```
Request Body:
```json
{
  "name": "Campaign Name",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "special_ad_categories": [],
  "buying_type": "AUCTION",
  "campaign_optimization_type": "NONE"
}
```

### Campaign Objectives
Available objectives:
- `OUTCOME_TRAFFIC` - Website traffic
- `OUTCOME_AWARENESS` - Brand awareness
- `OUTCOME_ENGAGEMENT` - Post engagement
- `OUTCOME_LEADS` - Lead generation
- `OUTCOME_SALES` - Conversions
- `OUTCOME_APP_PROMOTION` - App installs
- `OUTCOME_MESSAGES` - Messages
- `OUTCOME_REACH` - Reach
- `OUTCOME_VIDEO_VIEWS` - Video views
- `OUTCOME_STORE_VISITS` - Store visits

### Campaign Optimization Types
- `NONE` - Default optimization type
  - Used for most standard campaigns
  - No special optimization
  - Good for general advertising goals
- `ICO_ONLY` - Instagram Checkout Only
  - Specifically for Instagram shopping campaigns
  - Optimizes for Instagram Checkout conversions
  - Only available for certain campaign objectives

### Special Ad Categories
Special categories that require additional compliance:
1. `HOUSING`
   - For real estate and housing ads
   - Must comply with fair housing laws
   - Cannot target based on protected characteristics

2. `EMPLOYMENT`
   - For job postings
   - Must comply with employment discrimination laws
   - Cannot target based on protected characteristics

3. `CREDIT`
   - For financial products
   - Must comply with financial regulations
   - Cannot target based on protected characteristics

4. `ISSUES_ELECTIONS_POLITICS`
   - For political ads
   - Requires additional verification
   - Must comply with political advertising laws

## Campaign Status Options
- `ACTIVE` - Campaign is running
- `PAUSED` - Campaign is paused
- `DELETED` - Campaign is deleted

## Buying Types
- `AUCTION` - Default, real-time bidding
- `RESERVED` - Reserved buying

## Example Campaigns

### Standard Campaign
```json
{
  "name": "Website Traffic Campaign",
  "objective": "OUTCOME_TRAFFIC",
  "status": "PAUSED",
  "campaign_optimization_type": "NONE",
  "buying_type": "AUCTION"
}
```

### Instagram Shopping Campaign
```json
{
  "name": "Instagram Shop Promotion",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "campaign_optimization_type": "ICO_ONLY",
  "buying_type": "AUCTION"
}
```

## Error Handling
The API returns standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (invalid credentials)
- 500: Server Error

Error Response Format:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Best Practices
1. Always validate campaign data before creation
2. Use appropriate special ad categories
3. Start campaigns in PAUSED status for review
4. Monitor campaign performance regularly
5. Follow Facebook's advertising policies
6. Use 'NONE' optimization type for standard campaigns
7. Use 'ICO_ONLY' only for Instagram shopping features

## Rate Limits
- Facebook API has rate limits
- Implement proper error handling for rate limit errors
- Use appropriate retry mechanisms

## Security Considerations
1. Never expose API credentials
2. Use environment variables for sensitive data
3. Implement proper access control
4. Regularly rotate access tokens
5. Monitor API usage

## Troubleshooting
Common issues and solutions:
1. Invalid credentials
   - Verify App ID and Secret
   - Check Access Token validity
   - Ensure proper permissions

2. Campaign creation failures
   - Verify all required fields
   - Check special ad category compliance
   - Ensure proper objective selection
   - Verify campaign optimization type

3. API rate limiting
   - Implement exponential backoff
   - Monitor API usage
   - Contact Facebook support if needed

## Support
For additional support:
1. Check [Facebook Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis/)
2. Visit [Facebook Business Help Center](https://www.facebook.com/business/help)
3. Contact Facebook Developer Support 