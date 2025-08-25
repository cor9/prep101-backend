# PREP101 Backend Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/prep101_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs (create these in your Stripe dashboard)
STRIPE_BASIC_PRICE_ID=price_your_basic_plan_price_id
STRIPE_PREMIUM_PRICE_ID=price_your_premium_plan_price_id

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Anthropic API (for existing functionality)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 3. Database Setup
Make sure you have PostgreSQL running and create a database named `prep101_db`.

### 4. Start the Server
```bash
npm start
```

## 🔐 Authentication System

### Features
- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Password reset functionality
- Profile management
- Token refresh

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token validity

#### Profile Management
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

## 💳 Payment System

### Features
- Stripe integration for payments
- Subscription management (Free, Basic, Premium)
- Webhook handling for payment events
- Usage tracking and limits

### Subscription Plans
- **Free**: 1 guide per month
- **Basic**: 10 guides per month ($9.99/month)
- **Premium**: 50 guides per month ($19.99/month)

### API Endpoints

#### Payments
- `GET /api/payments/plans` - Get subscription plans
- `POST /api/payments/create-subscription` - Create subscription
- `POST /api/payments/cancel-subscription` - Cancel subscription
- `POST /api/payments/update-subscription` - Update subscription plan
- `GET /api/payments/subscription-status` - Get subscription status
- `POST /api/payments/webhook` - Stripe webhook handler

## 📚 Guide Management

### Features
- Create, read, update, delete guides
- File upload support (PDF, TXT, DOC, DOCX)
- Subscription-based access control
- Usage tracking for free users

### API Endpoints

#### Guides
- `GET /api/guides` - Get user's guides
- `GET /api/guides/:id` - Get specific guide
- `POST /api/guides` - Create new guide
- `PUT /api/guides/:id` - Update guide
- `DELETE /api/guides/:id` - Delete guide
- `POST /api/guides/:id/generate` - Generate guide content
- `GET /api/guides/:id/status` - Check generation status

#### File Upload
- `POST /api/upload/script` - Upload script file
- `POST /api/upload/pdf` - Upload PDF (legacy)
- `GET /api/upload/files` - Get uploaded files
- `DELETE /api/upload/files/:id` - Delete uploaded file

## 🛡️ Security Features

### Middleware
- Rate limiting for all endpoints
- CORS configuration
- Helmet security headers
- Input validation
- Authentication middleware
- Subscription checking

### Rate Limits
- Authentication: 5 requests per 15 minutes
- Payments: 10 requests per 15 minutes
- General API: 100 requests per 15 minutes

## 🔧 Stripe Setup

### 1. Create Products and Prices
In your Stripe dashboard, create:
- Basic Plan product with recurring price of $9.99/month
- Premium Plan product with recurring price of $19.99/month

### 2. Get Price IDs
Copy the price IDs and add them to your `.env` file:
```env
STRIPE_BASIC_PRICE_ID=price_xxxxx
STRIPE_PREMIUM_PRICE_ID=price_xxxxx
```

### 3. Configure Webhooks
Set up webhooks in Stripe for:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Webhook endpoint: `https://yourdomain.com/api/payments/webhook`

## 📁 Project Structure

```
prep101-backend/
├── config/
│   └── config.js          # Configuration management
├── database/
│   └── connection.js      # Database connection
├── middleware/
│   ├── auth.js           # Authentication middleware
│   └── security.js       # Security middleware
├── models/
│   ├── User.js           # User model
│   └── Guide.js          # Guide model
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── payments.js       # Payment routes
│   ├── guides.js         # Guide management routes
│   └── upload.js         # File upload routes
├── services/
│   └── paymentService.js # Stripe payment service
├── server.js             # Main server file
└── package.json
```

## 🚨 Important Security Notes

1. **Never commit API keys to version control**
2. **Use environment variables for sensitive data**
3. **The Stripe live key is already configured but should be moved to environment variables**
4. **Change the JWT_SECRET to a strong, random string**
5. **Set up proper CORS origins for production**

## 🧪 Testing

### Test the API
```bash
# Health check
curl http://localhost:3001/health

# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Get subscription plans
curl http://localhost:3001/api/payments/plans
```

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper CORS origins
3. Set up SSL/TLS certificates
4. Configure database connection pooling
5. Set up monitoring and logging
6. Configure proper backup strategies

## 📞 Support

For issues or questions:
1. Check the logs for error messages
2. Verify all environment variables are set
3. Ensure database is running and accessible
4. Check Stripe dashboard for payment issues
