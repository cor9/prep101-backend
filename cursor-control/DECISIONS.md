# Project Decisions Log

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

## 2025-09-09
**Issue:** API routes returning 404 errors due to missing database connections
**Decision:** Added fallback routes for authentication, payment, and Stripe services that return proper 503 errors when database is unavailable, allowing frontend to handle service unavailability gracefully instead of getting 404s.
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

