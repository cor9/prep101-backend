# Decisions
- 2025-08-27: Keep HTML email output only (no PDFs for v1); PDFs are an add-on.
- 2025-08-27: E2E tests use Playwright to simulate Airtable record creation.

# Recent Learnings & Decisions (2025-01-27)
- **Architecture Mismatch Discovery**: Current codebase uses React + Express.js + PostgreSQL, but project rules specify Next.js 14 + Airtable + Supabase. This suggests either legacy code or alternative implementation path.
- **Guide Persistence Issue**: Discovered that guides weren't being saved to user accounts due to authentication token mismatches and database save failures.
- **Authentication Flow**: FileUpload component was using placeholder tokens instead of real user authentication from AuthContext.
- **Database Integration**: Guide generation in simple-backend-rag.js was failing to save due to user validation issues and missing required fields.
- **Account Page Display**: Account page was showing mock data instead of fetching real guides from the API.

# Technical Decisions Made
- **Immediate Fix Approach**: Fixed the current implementation rather than migrating to the intended architecture, as the existing system was functional but had bugs.
- **Authentication Fix**: Updated FileUpload to use real user tokens from AuthContext instead of placeholder values.
- **Database Save Fix**: Enhanced guide creation to properly validate users before saving to database.
- **UI Enhancement**: Updated Account page to fetch and display real guides with proper loading states.

# Future Considerations
- **Architecture Alignment**: Consider whether to migrate current implementation to match project rules (Next.js + Airtable) or update rules to reflect current tech stack.
- **Code Review Process**: Always read .cursor/rules.md, .cursor/context.md, and DECISIONS.md before proposing code changes.
- **Documentation**: Keep DECISIONS.md updated with learnings and architectural decisions for future reference.
