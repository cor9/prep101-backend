## Supabase DB Fallback – 2025-12-04

### What broke

- `/api/guides` and `/api/auth/dashboard` now return HTTP 500 in production (`prep101-api.vercel.app`).
- Logs show `TypeError: Cannot read properties of null (reading 'findAll' | 'findByPk')` inside `routes/guides.js` line 15 and `routes/auth.js` line 486.
- Cause: on Vercel the `sequelize` instance fails to initialize (no `DATABASE_URL`), so `models/Guide` and `models/User` export `null`. Any route that still calls Sequelize throws immediately.

### Impact

- Account page can’t list guides (`Your Guides` shows empty + toast error).
- Users can’t download/print/email saved guides because `/api/guides/:id`, `/api/guides/:id/pdf`, `/api/guides/:id/child`, and `/api/guides/:id/email` all depend on the broken models.
- Admin dashboard (`/api/auth/dashboard`) fails, so usage stats and plan limits can’t be surfaced.
- Even though the generate endpoint creates Supabase-only “stub users,” guides written after the recent async changes never persist when Sequelize is absent.

### Constraints & prior decisions

- Auth middleware already allows requests to proceed without a database by fabricating a Supabase-derived `req.user`.
- Guide generation moved child guides to an async queue (`queueChildGuideGeneration`), which also assumes Sequelize exists.
- We must keep the current Express file/folder layout (per guardrails) and avoid re-architecting to a new stack.

### Proposed remediation

1. **Shared Supabase Admin Helper**

   - Create `lib/supabaseAdmin.js` that instantiates a Supabase client with `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.
   - Expose helper methods for `getUserById`, `listGuidesByUser`, `insertGuide`, `updateGuide`, etc.
   - Ensure the helper no-ops (with warnings) when the service key is missing so local dev can still rely on Sequelize.

2. **Guide Persistence Fallback**

   - In `simple-backend-rag.js`, detect when `Guide` (Sequelize) is unavailable.
   - When missing, insert/update rows with the Supabase helper so parent guides + child guide queue still persist.
   - Extend `/api/guides/:id/pdf`, `/api/guides/:id/email`, and `/api/guides/:id/child` to fetch via Supabase when Sequelize is absent.

3. **Routes Failover**

   - `routes/guides.js`: wrap every Sequelize call with `if (!Guide) { ... }`, and serve data from Supabase (ordered list, single guide, favorites, deletion) instead of throwing.
   - `routes/auth.js` (`/dashboard`, `/verify`): if `User` is null, hydrate response from Supabase’s `auth.getUser` + guide helper data.

4. **Environment Verification**
   - Document required server env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL?` optional) so future deploys don’t silently lose DB access.

### Acceptance criteria

- Account page successfully lists existing guides, favorites toggle works, and child-guide badges show correctly in production.
- `/api/auth/dashboard` responds 200 with usage stats even when Sequelize is missing.
- Generating a new guide saves parent HTML, queues the child guide, and both records are retrievable.
- Logs no longer show `Guide.findAll`/`User.findByPk` null reference errors.

### Follow-up tasks

- Add health-check endpoint that reports whether Sequelize or Supabase fallback is active.
- Consider moving all write paths directly to Supabase to remove the dual persistence logic.
