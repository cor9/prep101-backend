# PREP101 User Dashboard API Documentation

## 🎯 Overview

The PREP101 backend now provides a comprehensive user dashboard system that allows users to:
- View and manage their guides
- Track subscription usage and billing
- Access account information and statistics
- Search and filter their content
- Share guides publicly
- View usage analytics and recommendations

## 🔐 Authentication Required Endpoints

All dashboard endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 📊 Dashboard Endpoints

### 1. Main Dashboard
**GET** `/api/auth/dashboard`

Returns comprehensive user dashboard information including:
- User profile and subscription details
- Guide statistics and recent activity
- Subscription usage and limits
- Available plan options

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "subscription": "basic",
    "guidesUsed": 5,
    "guidesLimit": 10,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "subscription": {
    "currentPlan": {
      "name": "Basic",
      "price": 9.99,
      "guidesLimit": 10,
      "features": ["10 guides per month", "Full methodology access"]
    },
    "usagePercentage": 50.0,
    "guidesRemaining": 5,
    "isAtLimit": false,
    "canGenerateMore": true
  },
  "guides": {
    "total": 8,
    "completed": 6,
    "pending": 1,
    "processing": 1,
    "recent": [...]
  },
  "statistics": {
    "totalGuides": 8,
    "averageGuidesPerMonth": 2.5
  },
  "availablePlans": {...}
}
```

### 2. Guide Management

#### Get User's Guides
**GET** `/api/guides`

Returns all guides for the authenticated user.

#### Search Guides
**GET** `/api/guides/search?q=searchterm&status=completed&sortBy=createdAt&order=DESC`

**Query Parameters:**
- `q`: Search term (searches title, character name, production title, type)
- `status`: Filter by guide status (pending, processing, completed, failed)
- `characterName`: Filter by character name
- `productionType`: Filter by production type
- `sortBy`: Sort field (createdAt, updatedAt, title)
- `order`: Sort order (ASC, DESC)

#### Guide Statistics
**GET** `/api/guides/stats`

Returns detailed statistics about user's guides:
```json
{
  "totalGuides": 15,
  "statusCounts": {
    "completed": 12,
    "pending": 2,
    "processing": 1
  },
  "monthlyStats": {
    "2024-01": 5,
    "2024-02": 7,
    "2024-03": 3
  },
  "totalViews": 45,
  "averageViews": 3.0,
  "recentMonths": ["2024-01", "2024-02", "2024-03"]
}
```

#### Get Full Guide Details
**GET** `/api/guides/:id/full`

Returns complete guide information including generated content.

#### Toggle Guide Sharing
**PUT** `/api/guides/:id/share`

**Body:** `{"isPublic": true}`

Makes a guide public or private.

### 3. Subscription & Billing

#### Subscription Status
**GET** `/api/payments/subscription-status`

Returns current subscription information and limits.

#### Billing History
**GET** `/api/payments/billing-history`

Returns user's invoice history from Stripe:
```json
{
  "customerId": "cus_xxx",
  "invoices": [
    {
      "id": "in_xxx",
      "amount": 999,
      "currency": "usd",
      "status": "paid",
      "date": "2024-01-01T00:00:00.000Z",
      "description": "Basic Plan - Monthly",
      "invoiceUrl": "https://...",
      "pdfUrl": "https://..."
    }
  ],
  "totalInvoices": 3
}
```

#### Usage Analytics
**GET** `/api/payments/usage-analytics`

Returns detailed usage analysis and recommendations:
```json
{
  "currentUsage": {
    "guidesUsed": 7,
    "guidesLimit": 10,
    "efficiency": 70,
    "remaining": 3
  },
  "monthlyUsage": {
    "2024-01": 3,
    "2024-02": 4
  },
  "subscriptionEfficiency": 70,
  "recommendations": [
    {
      "type": "upgrade",
      "message": "You're approaching your monthly limit...",
      "suggestedPlan": "premium"
    }
  ],
  "currentPlan": {...}
}
```

#### Upgrade Plan
**POST** `/api/payments/upgrade-plan`

**Body:** `{"plan": "premium"}`

Upgrades user to a higher tier plan.

### 4. Public Guides (No Auth Required)

#### Browse Public Guides
**GET** `/api/guides/public?page=1&limit=10&sortBy=createdAt&order=DESC`

Returns paginated list of public guides from all users.

#### View Public Guide
**GET** `/api/guides/public/:id`

Returns a specific public guide (increments view count).

## 🎨 Frontend Integration Examples

### Dashboard Component
```javascript
const fetchDashboard = async () => {
  const response = await fetch('/api/auth/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  // Display user info, subscription status, recent guides
  setDashboardData(data);
};
```

### Guide Search
```javascript
const searchGuides = async (searchTerm, filters) => {
  const params = new URLSearchParams({
    q: searchTerm,
    ...filters
  });
  
  const response = await fetch(`/api/guides/search?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  setSearchResults(data.guides);
};
```

### Usage Analytics
```javascript
const fetchAnalytics = async () => {
  const response = await fetch('/api/payments/usage-analytics', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Display usage charts and recommendations
  setAnalytics(data);
};
```

## 📱 Dashboard Features

### User Profile Section
- Account information (name, email, join date)
- Subscription plan and status
- Usage progress bar
- Plan upgrade/downgrade options

### Guide Management
- List of all user's guides with status
- Search and filtering capabilities
- Guide sharing controls
- Guide statistics and analytics

### Subscription Management
- Current plan details
- Usage tracking and limits
- Billing history and invoices
- Plan recommendations

### Analytics & Insights
- Monthly guide creation trends
- Subscription efficiency metrics
- Usage recommendations
- Performance insights

## 🔒 Security Features

- All dashboard endpoints require authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- User data isolation (users can only access their own data)
- Secure subscription management through Stripe

## 🚀 Getting Started

1. **User Registration/Login**: Use `/api/auth/register` and `/api/auth/login`
2. **Get Dashboard**: Fetch `/api/auth/dashboard` for main user interface
3. **Manage Guides**: Use guide endpoints for CRUD operations
4. **Monitor Usage**: Check `/api/payments/usage-analytics` for insights
5. **Handle Billing**: Use payment endpoints for subscription management

The dashboard system provides a complete user experience for managing PREP101 accounts, guides, and subscriptions!
