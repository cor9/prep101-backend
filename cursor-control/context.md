# Project Context

Project: Prep101 (Child Actor 101)  
Goal: Convert PDF sides + metadata (role, genre, type, etc.) into a styled HTML audition prep guide email.

## Pipelines
- Airtable → (record with PDF + fields) → n8n worker → OpenAI Assistant → HTML guide → Gmail/Airtable Automations.

## Constraints
- HTML-only emails, inlined styles; no external CSS.
- Guides must include Uta Hagen 9Q + genre-aware sections (comedy beats, etc.).
- Depth must match "Henry" example.

## Open Issues (update daily)
- [ ] Retry policy for Assistant timeouts
- [ ] HTML template unit tests (schema & critical sections)

---

# Current Implementation Context (2025-01-27)
**Note: Current codebase differs from intended architecture**

## What's Actually Built
- React frontend (not Next.js 14)
- Express.js backend with PostgreSQL (not Airtable + Supabase)
- Direct PDF processing with OCR (not n8n worker pipeline)
- Web-based guide generation and viewing (not email-only output)
- User authentication and account management system
- Guide storage and retrieval from database

## Key Components Working
- PDF upload and text extraction
- Guide generation with RAG methodology
- User authentication and authorization
- Guide persistence in PostgreSQL
- Account management interface

## Recent Fixes Applied
- Fixed authentication token passing in FileUpload
- Resolved guide database saving issues
- Updated Account page to show real guides
- Enhanced error handling and user feedback
- Wired OCR into PDF upload rescue flow for sparse/image-heavy files
- Stopped short-but-readable sides from auto-triggering fallback mode
- Added extraction attempt tracking to `/api/health` diagnostics

## Extraction Status (2026-04-08)
- `pdf-parse` remains the primary extractor
- Adobe extraction is now treated as an upgrade path when enabled and basic extraction is sparse
- OCR is now invoked when cleaned extraction is still sparse, empty, or repetitive
- Short readable sides under 100 words are allowed through without forcing archetype fallback
- Remaining risk: OCR depends on image conversion support in the deploy environment, so production monitoring still matters

## Reader101 Status (2026-04-08)
- Reader101 now has a dedicated intimacy mode trigger based on script and metadata content
- Intimacy mode injects a required handling section, disables comedic framing, and locks the reader to emotional grounding rather than simulated physicality
- Minor/parent context now adds a professionalism note for intimate material
- Partial intimate text now pivots to an intimacy protocol guide instead of generic fallback
- Reader101 now elevates any high-risk scene involving sexual content, moral contradiction, shame transitions, or power imbalance
- High-risk mode forces the scene-risk warning, playability framing, explicit emotional arc mapping, and consequence-heavy directives
- Foster-style scenes now require a Scene 3 critical adjustment block centered on shame and neutrality
- Upload-to-generate is now hardened for serverless cold starts by returning `sceneText` in upload responses and restoring missing uploads from client `scenePayloads`
- Dashboard now caches the latest upload payload in `sessionStorage` so a refresh does not immediately strand users with a stale `uploadId`
- Watermark-heavy or repetitive PDFs now hard-fail extraction instead of quietly dropping into fallback coaching, and the generic "we'll build it from tone" upload toast was removed
- Upload now detects watermark interference heuristically, escalates to OCR earlier, and shows an "image-based reading" recovery message when OCR rescues the sides
- PDF ingest now runs as a staged pipeline: text extraction first, local OCR next when available, then per-page vision fallback, and it returns `text/source/confidence/warnings` instead of hard-failing the upload
- Guide generation no longer aborts on corrupted sides tokens; limited-text uploads stay in fallback guide mode all the way through generation
- Reader101 generation is now split into a fixed-template system under `reader101/templates` and `reader101/system` instead of asking the model to author full HTML directly
- Claude now generates structured JSON content only, while template selection, normalization, and HTML rendering happen deterministically in code
- High-risk scene handling still survives the refactor because the builder injects the required intimacy blocks, reader-role lock lines, and emotional-arc sections after normalization

## Child Actor 101 Account Status (2026-04-08)
- Phase 1 bridge is live: Prep101 can hand auth across to Bold Choices and Reader101, and the shared dashboard now presents as one Child Actor 101 account
- Phase 2 has started in code: backend now has a new account-context service plus auth endpoints for `verify`, `dashboard`, `context`, `onboarding`, and `select-actor`
- A new Supabase migration exists under `supabase/migrations/20260408_child_actor_101_identity.sql` for `profiles` and `actor_profiles`
- Prep101 now has an initial `/onboarding` flow that captures role (`actor`, `parent`, `both`) and creates the first active actor context
- Bold Choices now reads the shared `account` payload from `/api/auth/verify`, redirects unfinished accounts into the central Prep101 onboarding flow, and shows the current active actor in-product
- Reader101's static site now verifies `ca101_token` against the backend before trusting it, shows the active actor when available, and changes its account CTA to "Finish Account Setup" when onboarding is still required
- Prep101 onboarding now supports a `next` return target so other products can send users into one central setup flow and bring them back afterward
- The Supabase profile migration has now been applied; next work should assume `profiles` and `actor_profiles` exist unless production proves otherwise

## Guide Library + Deploy Status (2026-04-08)
- Generated `.netlify` link metadata was being tracked in the repo and was causing CLI deploys to target the wrong site/base; the fix now ignores `.netlify/` directories and removes tracked link files from git
- The real Netlify production site IDs are now confirmed from CLI:
  - `prep101.site` → `3a29b147-338a-4764-918f-a2e809f81f3e`
  - `boldchoices.site` → `b96522d2-39bb-4020-9f52-3f26e583647b`
  - `reader101.site` → `702352dd-18a3-4e28-bfa4-480c4499ab39`
- `/api/guides` is no longer just a stub path; it now supports real list/get/html/pdf export behavior backed by Sequelize or Supabase fallback
- The dashboard guide library now exposes open, HTML, and PDF actions instead of a mislabeled single download button
- Bold Choices now persists full generated guides into the shared guide library so they can appear in the same account-facing guide list as Prep101 and Reader101
- Auth now accepts query-string tokens for export/download routes, which unblocks saved-guide actions launched from the dashboard UI
- Stripe success now refreshes the logged-in user after sync, and webhook reconciliation now inspects checkout session line items plus metadata/client-reference ids before linking the purchase

## Architecture Decision Needed
- Migrate to intended Next.js + Airtable architecture?
- Or update project rules to reflect current working implementation?
- Current system is functional but doesn't match documented architecture
