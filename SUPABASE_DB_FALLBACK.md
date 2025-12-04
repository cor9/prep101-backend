# Supabase & Database Fallback Authentication System

**Version**: 1.0
**Last Updated**: December 4, 2025
**Status**: Production

---

## Overview

PREP101's backend implements a multi-layer authentication fallback system that ensures maximum compatibility across different deployment environments. This allows the app to function with or without full database connectivity.

---

## Authentication Chain

The auth middleware (`middleware/auth.js`) validates tokens in this priority order:

### 1. Supabase Admin Client (Primary)
```
Requires: SUPABASE_URL + SUPABASE_SERVICE_KEY
Method: supabase.auth.getUser(token)
```
- Full user validation through Supabase's service role
- Can create/update user metadata
- Highest trust level

### 2. Supabase Public Client (Fallback #1)
```
Requires: SUPABASE_URL + SUPABASE_ANON_KEY
Method: supabase.auth.getUser(token)
```
- Uses anon key for basic token validation
- Works when service key unavailable
- Read-only metadata access

### 3. JWT Secret Verification (Fallback #2)
```
Requires: SUPABASE_JWT_SECRET
Method: jwt.verify(token, secret, { algorithms: ['HS256'] })
```
- Local JWT signature verification
- Does not require network call to Supabase
- Extract: sub (user ID), email, user_metadata

### 4. Unsigned JWT Decode (Fallback #3)
```
Requires: None
Method: jwt.decode(token)
```
- Last resort fallback for legacy environments
- Extracts payload without signature verification
- Warning logged when used: "⚠️  Using unsigned Supabase JWT decode fallback"

---

## User Model Fallback

When the database/User model is unavailable (serverless deployments without DB connection):

```javascript
// Supabase-only user stub
{
  id: supabaseUser.id,
  email: email,
  name: derivedName,
  subscription: 'free',
  guidesLimit: null,
  guidesUsed: 0,
  betaAccessLevel: 'none'
}
```

This allows guide generation to work even without a PostgreSQL connection, though:
- Guides won't be saved to the database
- Usage won't be tracked persistently
- User preferences won't persist

---

## Environment Variables

### Required for Full Functionality
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # Preferred for full auth
SUPABASE_ANON_KEY=your-anon-key             # Fallback public client

# JWT Secrets
SUPABASE_JWT_SECRET=your-jwt-secret         # For local verification
JWT_SECRET=fallback_secret                   # Legacy JWT support

# Database
DATABASE_URL=postgresql://...               # For persistent storage
```

### Minimal Configuration (Degraded Mode)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

---

## Database Connection Handling

### Serverless-Safe Design
The database connection (`database/connection.js`) is designed to:
- **Never call `process.exit()`** in serverless environments
- Throw errors that can be caught gracefully
- Allow routes to load even if DB is unavailable

### Connection Fallback Flow
```
1. Check DATABASE_URL exists
   └─ Missing → Log warning, continue without DB

2. Attempt Sequelize connection
   └─ Failed → Log error, continue without DB

3. Models initialize
   └─ Guide model → null if no DB
   └─ User model → null if no DB

4. Routes load with fallback handlers
```

---

## Guide Generation Without Database

When no database connection exists:

1. **Authentication**: Uses Supabase-only user stub
2. **Guide Limit Check**: Skipped (treated as unlimited)
3. **Guide Save**: Skipped with warning
4. **Response**: Guide content returned but `savedToDatabase: false`

```javascript
// Example response when DB unavailable
{
  success: true,
  guideId: "corey_rag_...",
  guideContent: "...",
  savedToDatabase: false,
  saveError: "Guide model not available"
}
```

---

## Child Guide Queue

Child guides use an async queue that requires the Guide model:

```javascript
function queueChildGuideGeneration({ guideId, childData }) {
  const GuideModel = Guide || require("./models/Guide");
  if (!GuideModel) {
    console.warn("⚠️  Guide model unavailable - child guide queue will not run.");
    return;
  }
  // ... queue processing
}
```

Without DB: Child guides are not generated in the background.

---

## Troubleshooting

### "Invalid token" Errors

**Check in order:**
1. Is `SUPABASE_URL` set correctly?
2. Is `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY` valid?
3. Is the token expired? (Check `exp` claim)
4. Is the frontend sending the token correctly?

### Guides Not Saving

**Check:**
1. Is `DATABASE_URL` configured?
2. Run `/api/diagnostics` to check DB status
3. Check backend logs for "Guide model not available"
4. Verify user has `id` field (not just email)

### "User not found" After Login

**Cause**: User exists in Supabase but not in PostgreSQL.

**Solution**: The `findOrCreateUserFromSupabase()` function should auto-create users. If failing:
1. Check DB connection
2. Verify User model loaded
3. Check for unique constraint violations

---

## API Endpoints for Debugging

### Health Check
```bash
curl https://your-api/health
# Returns: { status: "ok" }
```

### Full Diagnostics
```bash
curl https://your-api/api/diagnostics
# Returns: Environment status, DB connection, available endpoints
```

### Methodology Status
```bash
curl https://your-api/api/methodology
# Returns: Loaded RAG files count and details
```

---

## Recent Decision Log

| Date | Issue | Decision | Status |
|------|-------|----------|--------|
| 2025-12-02 | Supabase tokens rejected without service key | Added public client fallback | ✅ |
| 2025-12-02 | JWT signature verification failing | Added unsigned decode fallback | ✅ |
| 2025-12-02 | User model missing in serverless | Added Supabase-only user stub | ✅ |
| 2025-12-02 | Child guides timing out | Moved to async queue | ✅ |
| 2025-10-08 | `process.exit()` killing Vercel functions | Replaced with error throws | ✅ |

---

## Security Considerations

### Unsigned JWT Fallback
- Used only as last resort
- Logs warning for monitoring
- Should upgrade to service key ASAP
- Token can still be validated for structure/expiry

### User Stub Limitations
- No persistent storage
- No guide history
- No subscription enforcement
- Should only be temporary

---

## Best Practices

1. **Always set `SUPABASE_SERVICE_KEY`** for production
2. **Monitor logs** for fallback warnings
3. **Test `/api/diagnostics`** after deployment
4. **Use environment-specific configs** for dev/staging/prod
5. **Don't expose service keys** in frontend code

---

## Migration Path

### From Legacy JWT to Supabase Auth

1. Keep `JWT_SECRET` for backward compatibility
2. Frontend migrates to Supabase Auth
3. Backend validates Supabase tokens first
4. Gradually phase out legacy JWT
5. Remove legacy fallback once all users migrated

---

**Document History**
- v1.0 - December 4, 2025 - Initial documentation
- Based on decisions from DECISIONS.md entries 2025-12-02

