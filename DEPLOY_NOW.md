# 🚀 Deploy Login Fix to Production

## What Was Fixed
- ✅ Backend now validates Supabase JWT tokens
- ✅ Auto-creates user records for Supabase authenticated users
- ✅ Backward compatible with legacy JWT tokens
- ✅ Supabase connection tested and working

## Quick Deploy Steps

### Step 1: Get Supabase Service Key (2 minutes)

1. Go to: https://supabase.com/dashboard/project/eokqyijxubrmompozguh/settings/api
2. Scroll to **"Project API keys"**
3. Copy the **`service_role`** key (the long secret one, NOT anon)
4. Keep it handy for the next step

### Step 2: Configure Vercel Environment Variables (3 minutes)

Run this command to open Vercel dashboard:
```bash
# Option 1: Using Vercel CLI
vercel env add SUPABASE_URL
# When prompted, paste: https://eokqyijxubrmompozguh.supabase.co
# Select: Production, Preview, Development

vercel env add SUPABASE_ANON_KEY
# When prompted, paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0
# Select: Production, Preview, Development

vercel env add SUPABASE_SERVICE_KEY
# When prompted, paste: <your_service_role_key_from_step_1>
# Select: Production, Preview, Development
```

**Option 2: Use Vercel Dashboard**
1. Go to: https://vercel.com/dashboard
2. Select your project (prep101-api)
3. Go to **Settings** > **Environment Variables**
4. Add these three variables:

```
Name: SUPABASE_URL
Value: https://eokqyijxubrmompozguh.supabase.co
Environments: Production, Preview, Development

Name: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0
Environments: Production, Preview, Development

Name: SUPABASE_SERVICE_KEY
Value: <paste your service role key here>
Environments: Production, Preview, Development
```

### Step 3: Deploy to Vercel (2 minutes)

```bash
# Deploy the updated backend
vercel --prod
```

The deployment will:
- Install the new @supabase/supabase-js package
- Use the updated auth middleware
- Pick up the new environment variables
- Be live in ~60 seconds

### Step 4: Test Login (1 minute)

1. Go to: https://prep101.site/login
2. Try logging in with your credentials
3. Should work! ✅

Check browser console for:
- `✅ User logged in via Supabase`
- `✅ Authenticated: <your-email>`

## Verification

After deployment, test these:

- [ ] Login works on https://prep101.site/login
- [ ] After login, redirects to /account
- [ ] Account page shows user data
- [ ] Can generate guides (if you have credits)
- [ ] No 401 errors in browser console

## Troubleshooting

### If login still doesn't work:

1. **Check Vercel environment variables are set:**
   ```bash
   vercel env ls
   ```
   Should show SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

2. **Check Vercel deployment logs:**
   - Go to Vercel dashboard
   - Click on your latest deployment
   - Check "Functions" tab for errors

3. **Verify Supabase is active:**
   - Go to: https://supabase.com/dashboard/project/eokqyijxubrmompozguh
   - Should show "Project is active" (not paused)

4. **Test API directly:**
   ```bash
   curl https://prep101-api.vercel.app/health
   # Should return: {"status":"healthy",...}
   ```

### If deployment fails:

1. Check package.json has @supabase/supabase-js
2. Verify you're in the correct directory
3. Try: `vercel --force` to force a new deployment

## What Happens After Deploy

1. **Existing users**: Can continue logging in (backward compatible)
2. **New Supabase users**: Will work immediately
3. **User records**: Auto-created on first login
4. **No data loss**: All existing data preserved

## Rollback Plan (if needed)

If something goes wrong:
```bash
# Revert to previous deployment in Vercel dashboard
# Or redeploy the previous git commit
git log --oneline -5
git checkout <previous_commit_hash>
vercel --prod
```

---

**Estimated Total Time**: ~10 minutes  
**Status**: Ready to deploy  
**Risk Level**: Low (backward compatible)

