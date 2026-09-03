# Railway Deployment Checklist

## Required Environment Variables

Make sure these are set in your Railway project settings:

### 🔑 Authentication
```
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
```

### 🗄️ Database
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### 🤖 AI Services
```
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
```

### ⚙️ Server Configuration
```
NODE_ENV=production
PORT=3001 (or let Railway set this automatically)
```

## The guide worker service

`worker.js` (`npm run worker:guide`) runs as its own Railway service, separate
from the API. It is not optional plumbing: since the finalization fix, the
worker is what **saves the guide to the database, spends the credit, and emails
the actor**. The API's polling endpoint is only a fallback for the case where
someone is still watching the page.

That means the worker service needs credentials the API used to hold alone:

```
REDIS_URL=rediss://...                 # required, worker exits without it
ANTHROPIC_API_KEY=sk-ant-...           # required, worker exits without it
SUPABASE_URL=https://xxxx.supabase.co  # required to SAVE guides
SUPABASE_SERVICE_ROLE_KEY=...          # required to SAVE guides
SES_SMTP_HOST=email-smtp.<region>.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=...
SES_SMTP_PASS=...
EMAIL_FROM=noreply@prep101.site
FRONTEND_URL=https://prep101.childactor101.com   # used for the link in the email
```

The worker prints a status banner on boot. Check the deploy logs read:

```
   Redis: configured
   Anthropic: configured
   Supabase: configured
   Email (SES): configured
```

`Supabase: MISSING` means guides generate but are only saved if the actor's
browser happens to still be polling — the failure mode that lost every Prep101
guide between May and September. `Email (SES): MISSING` means guides save but
nobody is told.

## Deployment Steps

1. **Connect your GitHub repository to Railway**
2. **Set all environment variables in Railway dashboard**
3. **Deploy the project**
4. **Check the deployment logs for any errors**
5. **Test the health endpoint**: `https://your-app.railway.app/health`

## Common Issues

### ❌ Database Connection Failed
- Check DATABASE_URL format
- Ensure database is accessible from Railway
- Verify credentials are correct

### ❌ JWT Secret Missing
- Set JWT_SECRET environment variable
- Make sure it's a strong, random string

### ❌ Anthropic API Key Invalid
- Verify ANTHROPIC_API_KEY is correct
- Check API key permissions and quota

### ❌ Port Issues
- Railway sets PORT automatically
- Don't override unless necessary

## Health Check

After deployment, test with:
```bash
curl https://your-app.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "environment": "production",
  "features": {
    "rag": true,
    "authentication": true,
    "payments": true,
    "guides": true,
    "uploads": true
  },
  "server": "PREP101 Enhanced Backend"
}
```

