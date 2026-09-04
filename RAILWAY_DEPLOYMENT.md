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

