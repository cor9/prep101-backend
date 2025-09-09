# PREP101 Supabase Migration Guide

This guide will help you migrate from Render ($14/month) to Supabase + Vercel ($0/month), saving you $168/year!

## 🎯 What You'll Get

- **Database**: Supabase PostgreSQL (Free tier: 500MB, 50k users)
- **Backend**: Vercel serverless functions (Free tier: 100GB bandwidth)
- **Total Cost**: $0/month (was $14/month)
- **Savings**: $168/year

## 📋 Prerequisites

- Node.js installed
- Git repository
- Supabase account (free)
- Vercel account (free)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the interactive setup script
npm run setup-supabase
```

### Option 2: Manual Setup

Follow the steps below if you prefer manual control.

## 📝 Step-by-Step Migration

### 1. Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project name: `prep101-backend`
5. Enter a strong database password (save this!)
6. Choose a region close to your users
7. Click "Create new project"

### 2. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `supabase-migration.sql`
4. Paste it into the SQL editor
5. Click **"Run"** to execute the migration

This will create:
- Users table with all your existing fields
- Guides table with all your existing fields
- Proper indexes for performance
- Row Level Security (RLS) policies
- Triggers for updated_at timestamps

### 3. Get Database Connection String

1. In Supabase dashboard, go to **Settings > Database**
2. Scroll down to **"Connection string"**
3. Copy the **"URI"** connection string
4. It should look like: `postgresql://postgres:[password]@[host]:5432/postgres`

### 4. Update Environment Variables

Update your `.env` file with the new Supabase URL:

```bash
# Replace your existing DATABASE_URL
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Optional: Add Supabase project URL
SUPABASE_URL=https://[project-ref].supabase.co
```

### 5. Test Database Connection

```bash
# Test the connection
npm start
```

You should see: `✅ Connected to PostgreSQL database`

### 6. Deploy to Vercel

#### Install Vercel CLI
```bash
npm i -g vercel
```

#### Deploy
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Set Environment Variables in Vercel
1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings > Environment Variables**
4. Add all your environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `FRONTEND_URL`

### 7. Update Frontend Configuration

Update your frontend to use the new Vercel backend URL:

```javascript
// In your frontend config
const API_BASE_URL = 'https://your-app.vercel.app';
```

## 🔧 Configuration Details

### Database Schema

The migration creates these tables:

**Users Table:**
- All existing user fields
- Stripe integration fields
- Beta tester fields
- Proper indexes and constraints

**Guides Table:**
- All existing guide fields
- Child guide support
- Sharing and public access
- Proper foreign key relationships

### Row Level Security (RLS)

Supabase automatically enables RLS for security:
- Users can only access their own data
- Guides are private by default
- Proper authentication required

### Performance Optimizations

- Database indexes on frequently queried fields
- Connection pooling for better performance
- Optimized queries for large datasets

## 🧪 Testing Your Migration

### 1. Test Database Connection
```bash
npm start
# Should show: ✅ Connected to PostgreSQL database
```

### 2. Test API Endpoints
```bash
# Health check
curl https://your-app.vercel.app/health

# Should return: {"status":"healthy",...}
```

### 3. Test User Registration
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### 4. Test Guide Generation
1. Register a user
2. Login to get JWT token
3. Upload a PDF
4. Generate a guide
5. Verify it's saved to database

## 🚨 Troubleshooting

### Database Connection Issues

**Error**: `ECONNREFUSED` or `timeout`
- Check your DATABASE_URL format
- Verify Supabase project is active
- Check if password is correct

**Error**: `relation "Users" does not exist`
- Run the migration script again
- Check if migration completed successfully

### Vercel Deployment Issues

**Error**: `Function timeout`
- Increase timeout in `vercel.json`
- Optimize your code for serverless

**Error**: `Module not found`
- Check if all dependencies are in `package.json`
- Run `npm install` before deploying

### Environment Variables

**Error**: `Missing required environment variables`
- Check Vercel dashboard for missing variables
- Ensure all variables are set for production

## 📊 Monitoring

### Supabase Dashboard
- Monitor database usage
- Check query performance
- View user activity

### Vercel Dashboard
- Monitor function invocations
- Check response times
- View error logs

## 💰 Cost Comparison

| Service | Before | After | Savings |
|---------|--------|-------|---------|
| Backend Hosting | $7/month | $0/month | $7/month |
| Database | $7/month | $0/month | $7/month |
| **Total** | **$14/month** | **$0/month** | **$14/month** |
| **Annual** | **$168/year** | **$0/year** | **$168/year** |

## 🎉 Next Steps

1. **Test thoroughly** - Make sure everything works
2. **Update DNS** - Point your domain to Vercel
3. **Cancel Render** - Stop paying $14/month
4. **Monitor usage** - Keep an eye on free tier limits
5. **Scale up** - Upgrade when you hit limits

## 📞 Support

If you run into issues:

1. Check the troubleshooting section above
2. Review Supabase and Vercel documentation
3. Check the logs in both dashboards
4. Test locally first before deploying

## 🔄 Rollback Plan

If you need to rollback:

1. Keep your Render deployment running during migration
2. Update frontend to point back to Render
3. Restore from database backup if needed
4. Cancel Vercel deployment

---

**Congratulations!** You've successfully migrated to a free hosting solution and are now saving $168/year! 🎉
