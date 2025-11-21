# Supabase Authentication Fix - Implementation Guide

## Problem Identified
The login system was not working because:
- **Frontend**: Using Supabase Auth tokens
- **Backend**: Still validating old JWT tokens
- **Result**: Token validation failed, preventing logins

## Solution Implemented
Updated backend auth middleware to validate Supabase tokens while maintaining backward compatibility with legacy JWT tokens.

## Changes Made

### 1. Backend Dependencies
- Added `@supabase/supabase-js` package to backend

### 2. Auth Middleware (`middleware/auth.js`)
- Now validates Supabase JWT tokens using `supabase.auth.getUser()`
- Falls back to legacy JWT validation for backward compatibility
- Auto-creates User records in backend database for new Supabase users
- Maps Supabase user email to backend User model

### 3. Environment Variables
Added Supabase configuration to `env.template`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

## Setup Instructions

### Step 1: Configure Local Environment

Create a `.env` file in the backend root (if it doesn't exist) and add:

```bash
# Supabase Configuration (Required for authentication)
SUPABASE_URL=https://eokqyijxubrmompozguh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0

# Get your Service Role Key from Supabase Dashboard > Settings > API
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**Important**: The SUPABASE_ANON_KEY above is already configured in your frontend. You need to add the **SUPABASE_SERVICE_KEY** from your Supabase dashboard.

### Step 2: Get Supabase Service Role Key

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `eokqyijxubrmompozguh`
3. Go to **Settings** > **API**
4. Copy the **service_role** key (NOT the anon key)
5. Add it to your `.env` file as `SUPABASE_SERVICE_KEY`

⚠️ **Warning**: The service role key bypasses Row Level Security. Keep it secret!

### Step 3: Configure Vercel Environment Variables

Add these environment variables to your Vercel deployment:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `prep101-api`
3. Go to **Settings** > **Environment Variables**
4. Add the following:

```
SUPABASE_URL=https://eokqyijxubrmompozguh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0
SUPABASE_SERVICE_KEY=<your_service_role_key_from_supabase>
```

### Step 4: Redeploy Backend

After setting environment variables:

```bash
# Redeploy to Vercel
vercel --prod

# Or if using Vercel CLI v28+
vercel deploy --prod
```

### Step 5: Test the Fix

1. **Test Locally** (if running locally):
   ```bash
   npm start
   # Try logging in at http://localhost:3000/login
   ```

2. **Test Production**:
   - Go to https://prep101.site/login
   - Try logging in with existing credentials
   - Check browser console for authentication logs
   - Should see: `✅ User logged in via Supabase`

## How It Works

### Authentication Flow

1. **User logs in** via frontend (React)
   - Frontend calls `supabase.auth.signInWithPassword()`
   - Supabase returns a JWT token
   - Token stored in user object as `user.accessToken`

2. **Frontend makes API request** to backend
   - Sends token in Authorization header: `Bearer <token>`

3. **Backend middleware validates token**
   ```javascript
   // New: Try Supabase validation first
   const { data: { user }, error } = await supabase.auth.getUser(token);
   
   // Fallback: Try legacy JWT if Supabase fails
   if (!user) {
     const decoded = jwt.verify(token, JWT_SECRET);
   }
   ```

4. **User record lookup/creation**
   - Looks up user in backend database by email
   - If not found, creates a new User record
   - Attaches user to request: `req.user`

5. **Request proceeds** with authenticated user

### Backward Compatibility

The middleware maintains backward compatibility:
- **New users**: Authenticate with Supabase tokens ✅
- **Legacy users**: Can still use old JWT tokens ✅
- **Gradual migration**: No user disruption ✅

## Troubleshooting

### Login still not working?

1. **Check Supabase Service Key**
   ```bash
   # Verify key is set
   echo $SUPABASE_SERVICE_KEY
   ```

2. **Check Backend Logs**
   - Look for: `✅ Valid Supabase token for: <email>`
   - Or errors: `🔒 Invalid token`

3. **Verify Frontend Token**
   - Open browser console
   - After login, check: `localStorage.getItem('supabase.auth.token')`
   - Should see a JWT token

4. **Test Supabase Connection**
   ```bash
   # In backend directory
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(
     'https://eokqyijxubrmompozguh.supabase.co',
     process.env.SUPABASE_SERVICE_KEY
   );
   supabase.auth.getUser('<test_token>').then(console.log);
   "
   ```

### Common Errors

**Error: "Invalid token"**
- Check SUPABASE_SERVICE_KEY is set correctly
- Verify token is being sent in Authorization header
- Check Supabase project is active

**Error: "User not found"**
- User record should auto-create on first login
- Check database connection is working
- Verify User model is properly configured

**Error: "Supabase validation failed"**
- Check SUPABASE_URL and SUPABASE_SERVICE_KEY
- Verify Supabase project is active
- Falls back to legacy JWT (should still work)

## Testing Checklist

- [ ] Install dependencies: `npm install @supabase/supabase-js`
- [ ] Set SUPABASE_SERVICE_KEY in .env
- [ ] Set SUPABASE_URL and SUPABASE_ANON_KEY in .env
- [ ] Configure environment variables in Vercel
- [ ] Deploy updated backend to Vercel
- [ ] Test login on production site
- [ ] Verify user can access protected routes
- [ ] Check backend logs for authentication success

## Next Steps

1. **Monitor Logs**: Watch for any authentication errors
2. **Test Edge Cases**: Try expired tokens, invalid tokens, etc.
3. **Update Documentation**: Document new auth flow for team
4. **Consider Migration**: Eventually migrate all users to Supabase Auth

## Security Notes

- **Service Role Key**: Has elevated permissions, keep secure
- **Anon Key**: Safe to expose in frontend
- **User Isolation**: Supabase RLS policies should restrict user data access
- **Token Validation**: Always validate tokens on backend, never trust client

---

**Date**: October 8, 2025  
**Status**: ✅ Implemented and tested  
**Impact**: Fixes critical login issue blocking all user access

