# Project Decisions Log

## 2025-11-17

**Issue:** PDF upload failing with "adobe extract is not a function" error
**Decision:** Added null check before calling extractWithAdobe to prevent TypeError when Adobe extractor is not available
**Technical Details:**

- When Adobe PDF extractor fails to load (line 69-72 in simple-backend-rag.js), extractWithAdobe is set to null
- Code at line 1638 was calling extractWithAdobe(req.file.buffer) directly without checking if it exists
- Calling null as a function throws "adobe extract is not a function" TypeError
- Fixed by checking if extractWithAdobe exists before calling it, gracefully falling back to basic extraction
  **Impact:** Fixes PDF upload failures when Adobe extractor is not available or fails to load
  **Status:** Success - Deployed to production (dpl_5CzUeSTgX5k6ZbBS8kVkhiH8h63a)

## 2025-10-08 (Part 3)

**Issue:** All API endpoints returning 503 errors with "ValidationError: X-Forwarded-For header" rate limiter crash
**Decision:** Added `app.set('trust proxy', true)` to Express configuration
**Technical Details:**

- Vercel acts as a proxy and sends X-Forwarded-For header
- Express rate limiter requires trust proxy to be enabled
- Without it, rate limiter validation fails → 503 errors
- Single line fix: `app.set('trust proxy', true)` before middleware
  **Impact:** Fixes ALL 503 errors on /api/auth/dashboard, /api/stripe/\*, etc.
  **Status:** Success - Deployed to production

## 2025-10-08 (Part 2)

**Issue:** PDF uploads rejected with "Limited content: please upload a script with actual dialogue" error
**Decision:** Relaxed content quality thresholds to reduce false rejections
**Technical Details:**

- Lowered minimum word count from 50 to 25 words
- Increased repetitive content threshold from 5% to 15%
- Increased word repetition threshold from 10% to 20%
- Lowered "minimal content" threshold from 200 to 150 words
  **Reasoning:** Quality checks were too strict, rejecting valid scripts with shorter scenes or formatting quirks. More lenient thresholds allow these through while still blocking truly corrupted content.
  **Status:** Success - Deployed to production

## 2025-10-08 (Part 1)

**Issue:** Login not working - Frontend using Supabase Auth but backend still validating old JWT tokens
**Decision:** Updated backend auth middleware to validate Supabase JWT tokens. Middleware now tries Supabase token validation first, falls back to legacy JWT for backward compatibility. Auto-creates user records in backend database for Supabase authenticated users.
**Technical Details:**

- Installed @supabase/supabase-js on backend
- Updated middleware/auth.js to validate Supabase tokens using supabase.auth.getUser()
- Added fallback to legacy JWT validation for backward compatibility
- Added auto-creation of User records when Supabase users first authenticate
- Updated env.template with SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_KEY
  **Status:** Success - Authentication now works with Supabase tokens

## 2025-09-09

**Issue:** Cursor previously used wrong date (Jan 27, 2025).
**Decision:** Enforce date confirmation before logging.
**Status:** Success.

## 2025-09-09

**Issue:** Vercel deployment configuration and serverless function setup
**Decision:** Successfully deployed prep101 backend to Vercel with robust error handling for missing modules and environment variables. Updated vercel.json to use simple-backend-rag.js as entry point, made app serverless-compatible, and added graceful fallbacks for database and middleware when not available.
**Status:** Success

## 2025-09-09

**Issue:** CORS errors and frontend-backend connectivity issues
**Decision:** Fixed CORS configuration to allow prep101.site origin, updated frontend API URL to point to current Vercel deployment, resolved Git rebase conflicts with Supabase utilities, and successfully rebuilt frontend with correct backend endpoint.
**Status:** Success

## 2025-11-21

**Issue:** While Prep101 guides were being generated (2–5 minutes), users did not consistently see a clear loading experience, despite a loading screen being designed.
**Decision:** Implemented a full-screen loading overlay on the `Dashboard` page that appears whenever a guide is being generated, using the existing `LoadingSpinner` component so users always see an obvious, blocking loading state during guide creation.
**Status:** Success

## 2025-11-21 (Part 2)

**Issue:** No admin dashboard existed to inspect user activity, guides created, or manually grant extra/free guides and adjust limits.
**Decision:** Added admin-only backend routes under `/api/admin` (secured by beta admin access) to list users and modify guide limits, and created a protected `/admin` React page that uses the Supabase access token to show user metrics and provide “+1 free guide” and “reset usage” controls per user.
**Status:** Success

## 2025-11-21 (Part 3)

**Issue:** Guides could not be emailed to users; the `/api/guides/:id/email` endpoint was stubbed out and MailerSend config was unused.
**Decision:** Integrated Resend as the transactional email provider via a new `emailService`, wired `/api/guides/:id/email` to send the stored HTML guide to the user’s account email, added `RESEND_API_KEY`/`EMAIL_FROM` env vars, and exposed an “Email This Guide” button on the `GuideView` page.
**Status:** Success

## 2025-11-21 (Part 4)

**Issue:** Claude model and token limits were hard-coded to `claude-sonnet-4-20250514` with mixed `max_tokens` values (4000–8000), limiting flexibility and context size.
**Decision:** Updated the default model to `claude-sonnet-4-5-20250929` via `DEFAULT_CLAUDE_MODEL` in `config/models.js` and centralized output length with `DEFAULT_CLAUDE_MAX_TOKENS` (default 9000, overridable via `CLAUDE_MAX_TOKENS`), wiring all Anthropic calls to use this shared limit and exposing it in `/api/health`.
**Status:** Success

## 2025-09-09

**Issue:** API routes returning 404 errors due to missing database connections
**Decision:** Added fallback routes for authentication, payment, and Stripe services that return proper 503 errors when database is unavailable, allowing frontend to handle service unavailability gracefully instead of getting 404s.
**Status:** Success

## 2025-12-02

**Issue:** Generated PREP101 guides were missing the new required structure, tone, and production-type logic outlined in the latest coaching framework, leading to inconsistent user-facing output.
**Decision:** Rebuilt the Anthropic system prompt in `simple-backend-rag.js` to enforce the 10-section blueprint, motivational “Actor Motivator” voice, evidence tagging, and production-type adjustments. Added curated RAG resources (`methodology/example_guides_gold_standard.md`, `methodology/character_archetype_comparables.md`, `methodology/guide_voice_examples.md`) so the model can mirror Corey’s gold-standard examples, archetype comparables, and voice notes.
**Status:** Success

## 2025-12-02 (Part 2)

**Issue:** Users authenticated via Supabase could generate guides, but the backend still expected legacy JWTs, so guides weren't being saved to dashboards, PDF endpoints rejected tokens, and new users never received DB records.
**Decision:** Updated `middleware/auth.js` to validate Supabase JWTs first (via the service role key), auto-create local `User` rows, and fall back to legacy JWT only when needed. Wrapped `/api/guides/generate` and `/api/guides/:id/pdf` with the auth middleware, removed manual token parsing, enforced guide-limit checks, and ensured guide-saving/increment logic uses the authenticated Sequelize user. On the frontend, `AuthContext` and `supabase.js` now surface the Supabase `access_token` (and derived `name`) so every API call carries a valid bearer token.
**Status:** Success

## 2025-12-02 (Part 3)

**Issue:** Guide generation still failed whenever the in-memory upload cache expired, forcing users to re-upload, and the guide viewer lacked built-in print/PDF controls despite user requests.
**Decision:** Cached the extracted scene text on the client (`FileUpload` → `Dashboard`) and send it back as `scenePayloads` so `/api/guides/generate` can rebuild uploads even if the backend map is cleared. Also added authenticated print/download/email actions inside `GuideView` and wired the Account page to the correct `/api/guides/:id/child` download route.
**Status:** Success

## 2025-12-02 (Part 4)

**Issue:** Admin/beta accounts with “unlimited” access were still blocked by the free-plan monthly guide cap.
**Decision:** Updated `/api/guides/generate` to detect unlimited/admin users (beta access level `admin`, non-free subscription, or `guidesLimit` null/≤0/≥999) so the limit check and `guidesUsed` increment are skipped for those accounts.
**Status:** Success

## 2025-12-02 (Part 5)

**Issue:** Users were seeing “Invalid token”/401 errors whenever the backend lacked a Supabase service-role key, because the auth middleware couldn’t validate Supabase access tokens.
**Decision:** Enhanced `middleware/auth.js` so it first tries Supabase admin validation when available, but automatically falls back to verifying JWTs locally using `SUPABASE_JWT_SECRET`/`SUPABASE_ANON_KEY`. This allows standard Supabase access tokens to work even when no service key is configured.
**Status:** Success

---

# Imported Decisions & Learnings (from user)

## Decisions

- 2025-08-27: Keep HTML email output only (no PDFs for v1); PDFs are an add-on.
- 2025-08-27: E2E tests use Playwright to simulate Airtable record creation.

## Recent Learnings & Decisions (2025-01-27)

- **Architecture Mismatch Discovery**: Current codebase uses React + Express.js + PostgreSQL, but project rules specify Next.js 14 + Airtable + Supabase. This suggests either legacy code or alternative implementation path.
- **Guide Persistence Issue**: Discovered that guides weren't being saved to user accounts due to authentication token mismatches and database save failures.
- **Authentication Flow**: FileUpload component was using placeholder tokens instead of real user authentication from AuthContext.
- **Database Integration**: Guide generation in simple-backend-rag.js was failing to save due to user validation issues and missing required fields.
- **Account Page Display**: Account page was showing mock data instead of fetching real guides from the API.

## Migration & Cost Optimization (2025-01-27)

- **Cost Reduction Goal**: Migrated from Render ($14/month) to Vercel + Supabase (free tier) to achieve $0/month hosting costs.
- **Backend Migration**: Successfully moved Express.js backend from Render to Vercel serverless functions.
- **Database Migration**: Migrated PostgreSQL database from Render to Supabase.
- **Auth System Overhaul**: Replaced custom backend authentication with direct Supabase Auth integration.
- **Frontend Updates**: Updated React frontend to use Supabase Auth directly instead of backend API calls.
- **Registration Bug Fix**: Fixed critical parameter order issue in Register.js - was passing (name, email, password) but AuthContext expected (email, password, name).
- **Environment Variables**: Configured VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify for frontend.
- **Build Configuration**: Fixed Netlify build settings and vercel.json configuration for proper deployment.

## Technical Decisions Made

- **Immediate Fix Approach**: Fixed the current implementation rather than migrating to the intended architecture, as the existing system was functional but had bugs.
- **Authentication Fix**: Updated FileUpload to use real user tokens from AuthContext instead of placeholder values.
- **Database Save Fix**: Enhanced guide creation to properly validate users before saving to database.
- **UI Enhancement**: Updated Account page to fetch and display real guides with proper loading states.

## Process Improvements (2025-01-27)

- **Debugging Process Failure**: Wasted 90 minutes debugging registration issue when solution was simple parameter order fix in Register.js.
- **Root Cause**: Should have immediately checked registration code when manual Supabase user creation worked but registration form didn't.
- **Workflow Violation**: Failed to follow Cursor rules - should read .cursor/rules.md, .cursor/context.md, and DECISIONS.md first.
- **Inefficient Debugging**: Kept asking for same information instead of debugging actual code files.
- **Lesson Learned**: When manual operations work but code doesn't, check the code immediately, not the symptoms.

## Future Considerations

- **Architecture Alignment**: Consider whether to migrate current implementation to match project rules (Next.js + Airtable) or update rules to reflect current tech stack.
- **Code Review Process**: Always read .cursor/rules.md, .cursor/context.md, and DECISIONS.md before proposing code changes.
- **Documentation**: Keep DECISIONS.md updated with learnings and architectural decisions for future reference.
- **Debugging Discipline**: Follow systematic debugging - check code when manual operations work but automated ones don't.
