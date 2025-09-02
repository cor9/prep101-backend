# PREP101 - Custom Scene Analysis & Performance Coaching Guides

## 🎭 Overview

PREP101 is a comprehensive acting coaching platform that combines AI-powered guide generation with Corey Ralston's proven methodology. The system provides personalized scene analysis, character development guidance, and performance coaching through an intelligent RAG (Retrieval Augmented Generation) system.

## 🚀 Features

### **Core Functionality**
- **RAG-Enhanced Guide Generation**: Uses Corey Ralston's methodology files for authentic acting guidance
- **Intelligent Scene Analysis**: AI-powered analysis of scripts and scenes
- **Character Development**: Comprehensive character breakdown and development guidance
- **Performance Coaching**: Personalized coaching based on acting methodology

### **User Management**
- **User Authentication**: Secure JWT-based authentication system
- **User Dashboard**: Comprehensive dashboard with guides, usage stats, and account info
- **Profile Management**: Update user information and preferences
- **Password Management**: Secure password reset and change functionality

### **Payment & Subscriptions**
- **Stripe Integration**: Professional payment processing
- **Subscription Tiers**: Free (1 guide/month), Basic (10 guides/month), Premium (25 guides/month)
- **Usage Tracking**: Monitor guide generation usage and subscription limits
- **Billing History**: Complete invoice and payment history

### **Guide Management**
- **Guide Creation**: Generate guides from uploaded scripts
- **Guide Storage**: Save and organize all generated guides
- **Guide Sharing**: Make guides public or private
- **Advanced Search**: Search and filter guides by various criteria
- **Guide Analytics**: Track guide performance and usage

### **File Management**
- **Multi-Format Support**: PDF, TXT, DOC, and DOCX script uploads
- **File Validation**: Secure file type and size validation
- **File Organization**: User-specific file management
- **Legacy Support**: Maintains existing PDF upload functionality

### **Beta Tester System**
- **Controlled Rollout**: Test features with select users before public launch
- **Access Levels**: Early (25 guides/month), Premium (100 guides/month), Admin (unlimited)
- **Feature Gates**: Control access to beta features
- **Feedback Collection**: Gather insights and suggestions from beta testers
- **Admin Management**: Comprehensive beta tester management tools

## 🛠️ Quick Start

### ⚠️ IMPORTANT: Environment Security
This project uses sensitive API keys and database credentials. **Never commit your `.env` file to git!**

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup (SAFE METHOD)
Use our setup script to configure environment variables safely:
```bash
./setup-env.sh
```

Or manually:
```bash
cp env.template .env
# Edit .env with your actual values
```

### 3. Required Environment Variables
You must configure these in your `.env` file:

**Essential:**
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Your Anthropic API key (starts with `sk-ant-api03-`)
- `JWT_SECRET` - A long, random string for JWT signing

**Optional:**
- `ADOBE_CLIENT_ID` & `ADOBE_CLIENT_SECRET` - For PDF processing
- `STRIPE_SECRET_KEY` - For payment processing
- `MAILERSEND_API_KEY` - For email functionality

### 4. Database Setup
```bash
npm run migrate
```

### 5. Start Development Server
```bash
npm start
```

### 6. Setup Beta Tester System (Optional)
```bash
./setup-beta-admin.sh
```

## 🔒 Security Features

- **Pre-commit Hook**: Automatically prevents committing sensitive files
- **Comprehensive .gitignore**: Protects all sensitive files
- **Environment Template**: Safe template with no real credentials
- **Setup Script**: Validates environment configuration

## 🚨 Troubleshooting

**Git push blocked due to secrets?**
```bash
git reset --soft HEAD~1
git reset HEAD .env
git add .gitignore
git commit --amend --no-edit
git push
```

**Missing environment variables?**
```bash
./setup-env.sh
```

## 🌐 API Endpoints

### **Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/dashboard` - User dashboard
- `GET /api/auth/profile` - User profile

### **Guides**
- `GET /api/guides` - User's guides
- `POST /api/guides` - Create new guide
- `GET /api/guides/search` - Search guides
- `GET /api/guides/public` - Public guides

### **Payments**
- `GET /api/payments/plans` - Subscription plans
- `POST /api/payments/create-subscription` - Create subscription
- `GET /api/payments/subscription-status` - Current subscription

### **Beta Testing**
- `GET /api/beta/features` - Available beta features
- `POST /api/beta/invite` - Invite beta tester (admin)
- `GET /api/beta/dashboard` - Beta tester dashboard

## 📊 Dashboard Features

### **User Dashboard**
- Account overview and subscription status
- Guide usage statistics and limits
- Recent guide activity
- Subscription plan comparison

### **Beta Tester Dashboard**
- Beta access level and features
- Extended guide limits
- Beta feature access control
- Feedback submission

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API rate limiting and request throttling
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection

## 🚀 Deployment

### **Development**
```bash
npm run dev          # Start with nodemon
npm start           # Start production server
```

### **Production**
- Configure environment variables
- Set up PostgreSQL database
- Configure Stripe webhooks
- Deploy to Railway/Heroku/AWS

## 📚 Documentation

- **`DASHBOARD_API.md`** - Complete dashboard API documentation
- **`BETA_TESTER_SYSTEM.md`** - Beta tester system guide
- **`SETUP.md`** - Detailed setup instructions
- **`env.template`** - Environment variable template

## 🎯 Next Steps

1. **Test Core Features**: Upload scripts and generate guides
2. **Setup Beta Testing**: Use `setup-beta-admin.sh` to create admin beta tester
3. **Frontend Development**: Build React components for user interface
4. **Production Deployment**: Deploy to Railway with your existing setup
5. **Beta Launch**: Invite select users for testing and feedback

## 🌟 Key Benefits

- **Professional Grade**: Enterprise-level authentication and payment systems
- **Scalable Architecture**: Built for growth and production use
- **Beta Testing Ready**: Professional beta tester management system
- **Corey Ralston Methodology**: Authentic acting coaching methodology
- **Modern Tech Stack**: Latest Node.js, Express, and PostgreSQL technologies

Visit: http://localhost:5001 (Backend) | http://localhost:3000 (Frontend - when created)

---

**Built with ❤️ for the acting community**
