# Session Updates

## 2026-04-14

### Incident log: Prep101 auth + upload + generation reliability failures
- **User impact:** repeated login failures, guide-generation CORS failures, empty/invalid upload responses, and unfinished/empty guide outputs.
- **Business impact:** excessive Netlify deploy churn during triage and paid credit overrun on the Pro account.

### Primary issues observed
- `Blocked form submission ... sandboxed ... allow-forms` on login and builder submits.
- `Access to fetch ... /api/guides/generate-from-pdf ... blocked by CORS` from `prep101.site`.
- `No token, authorization denied` on protected two-call endpoint.
- `Unexpected token '<'` / `<!DOCTYPE ... is not valid JSON` from auth/upload requests receiving HTML instead of JSON.
- `Failed to execute 'json' on 'Response': Unexpected end of JSON input` on upload parsing.
- `Empty guide response` after successful submit path.
- UI contradictions: stale `PDF uploaded successfully` state shown during/after failed extraction.
- Reader101 showed Prep101/Bold-Choices style loading text, causing product confusion.

### Root causes identified
- `client/public/_redirects` did not include `/api/*` proxy rule, so `prep101.site/api/...` could resolve to SPA/404 HTML.
- Frontend briefly switched between same-origin and cross-origin API routing while proxy behavior was inconsistent.
- Auth token not always rehydrated after verify/refresh, causing bearer-less protected calls.
- Upload and generation response parsing assumed valid JSON/non-empty content.
- Dashboard state machine retained stale upload success state across new upload attempts.
- Guide prompt lacked strict completion enforcement for final sections under long outputs.

### Fixes shipped
- Removed native form submit reliance in login and guide builder flows (JS submit only).
- Hardened upload state flow:
  - clear stale upload state at new upload start,
  - only show ready/success when extraction is usable,
  - show explicit low-confidence/failure states.
- Updated Prep101/Reader101 generation UX:
  - mode-specific loading copy,
  - no cross-product messaging bleed,
  - clearer low-confidence messaging.
- Added two-call guardrails for low-confidence extraction:
  - allow Prep101 direct-PDF generation path even when extraction quality flags low.
- Added token persistence + rehydration in auth context (`ca101_token`) so protected calls keep bearer auth.
- Added auth API fallback chain:
  - primary host + direct API fallback,
  - HTML-response detection and defensive JSON parsing.
- Added upload parser hardening:
  - safe text-first parse,
  - empty/non-JSON handling,
  - direct API retry on malformed response.
- Added generation response recovery:
  - retry once against direct API when primary response is empty.
- Added strict guide completion controls in two-call pipeline:
  - expanded system prompt requirements,
  - mandatory archetype-trap block/subtext table/two-take/checklist/final coach note,
  - automatic repair pass when output is truncated or missing required sections.
- Backend CORS stabilization:
  - reflect request `Origin`,
  - set `Vary: Origin`,
  - preserve credentials headers for cross-site requests.
- Netlify proxy correction:
  - added `/api/* https://prep101-api.vercel.app/api/:splat 200` to `client/public/_redirects`.

### Key commits in this incident chain
- `730bb00a` login submit sandbox fix
- `6f864cfa` stale upload state gating fix
- `de7bf13d` allow direct-PDF path on low-confidence extraction
- `01ad3e3b` remove native GuideForm submit
- `7b587538` completion-enforced prompt + reader/prep UX cleanup
- `51d4c508` guide generation fetch retry profile
- `c4519e18` auth token persistence/rehydration
- `440b32e9` API routing change (later superseded)
- `e9b4f903` auth fallback chain
- `0c948a7a` HTML-response parse hardening
- `90efa348` route API direct to prep101-api (later superseded)
- `6f4c1004` backend CORS reflection fix
- `9064fdbd` Netlify `_redirects` API proxy fix + same-origin restore
- `af57d6b2` upload parse + retry hardening
- `0ee1b15b` empty guide response recovery retry

### Current state at log time
- `prep101.site/api/auth/login` verified returning JSON (not HTML fallback).
- `prep101.site/api/guides/generate-from-pdf` preflight verified with correct CORS headers.
- Frontend and backend both redeployed with above fixes.

## 2026-04-09

### Launch architecture and product flow
- Unified the account model around one logged-in user plus one selected actor across Prep101, Reader101, and Bold Choices.
- Added actor-aware gating so users now flow through login, onboarding, actor selection, and then product entry in a consistent order.
- Added shared actor switching and actor creation entry points in the account shell and Bold Choices navbar.
- Enforced Bold Choices as actor-facing only, even when the selected actor is a child.

### Shared account and product UX
- Shifted the shared hub toward `Child Actor 101 Account` instead of a Prep101-only framing.
- Made dashboard product context respond to `?product=prep101|reader101|bold_choices`.
- Added clearer per-product access badges and entitlement summaries for Prep101, Reader101, and Bold Choices.
- Added Reader101 shared-account status UI and smarter CTA/account-link behavior.

### Pricing and offer changes
- Removed the old customer-facing Prep101 premium option.
- Added the Prep101 single a la carte and 3-pack upgrade path after Starter users use their monthly 5 guides.
- Wired live Stripe price IDs for:
  - Prep101 Starter
  - Prep101 Single A La Carte
  - Prep101 3-Pack
  - Reader101 add-on
  - Reader101 single
  - Reader101 monthly
  - Bold Choices single
  - Bold Choices monthly
  - Bundle

### Entitlements and gating
- Added Prep101 top-up credits so Starter users can continue with one-time credits after their monthly guides are exhausted.
- Added idempotent Stripe session tracking so manual syncs and webhook replays do not double-grant Prep101 top-up credits.
- Extended product-specific entitlements for Reader101 and Bold Choices, including one-time credits and monthly/unlimited states.
- Updated generation gates so each product now checks its own entitlement state instead of generic `basic/premium` assumptions.
- Updated admin and billing surfaces to show normalized product-aware access instead of collapsing everything into a generic subscription label.

### Payments and Stripe
- Fixed one-time Prep101 checkout handling so Single A La Carte and 3-Pack are treated as one-time purchases instead of subscriptions.
- Added Stripe sync backfill so completed one-time Checkout sessions can restore missing credits if a webhook is delayed.
- Normalized Stripe and payment service plan labels for Bundle, Reader101 monthly, and Bold Choices monthly states.

### Auth and session cleanup
- Began migrating ecosystem auth away from `prep101_token`, `prep101_user`, `bc_user`, and `ca101_token` localStorage persistence.
- Added an API-domain session cookie flow with `ca101_session`, cookie-aware auth middleware, and `/api/auth/session` plus `/api/auth/logout`.
- Updated CORS defaults to allow credentialed requests from `prep101.site`, `boldchoices.site`, and `reader101.site`.
- Switched Prep101 and Bold Choices API calls to use `credentials: include` against `https://prep101-api.vercel.app`.
- Removed remaining localStorage auth use from Prep101 callback handling, Bold Choices save/generate/admin flows, and Reader101 account detection.
- Switched active product navigation to direct shared-session URLs instead of tokenized bridge links for normal use.
- Kept callback/bridge routes as compatibility shims so older tokenized links can still exchange a token and land correctly during rollout.
- Cleaned the remaining frontend warning set by fixing stale React hook dependencies and removing unused state/helpers in the shared client, leaving only the older `import.meta` build warning.
- Restored bridge-based cross-product handoff for Reader101 and Bold Choices after the Reader101 login flow exposed a cross-domain session loop, and added Reader-aware login/register copy plus Reader token fallback so static Reader101 pages can hold account state after sign-in.
- Fixed the remaining Reader101 login bounce by having Prep101 login/register use the freshly returned auth token to resolve `/auth-bridge` redirects immediately, instead of redirecting back into the bridge and forcing another session check.
- Fixed a Reader101 fallback bug where the page was deleting its saved token whenever verification failed, which caused the CTA to flicker from “open account” back to “sign in”; also added `reader101.site` to the live API CORS allowlist in [simple-backend-rag.js](/Users/coreyralston/prep101-backend/simple-backend-rag.js).
- Clarified Reader101 account hub copy so the shared account page says “Return to Reader101” instead of making the handoff feel circular.
- Added a cross-domain logout hop through `reader101/logout.html` so Reader101 clears its saved fallback token when users log out from Prep101 or Bold Choices.
- Simplified the dashboard work path by replacing the unlabeled stack of cards with Start Here, Your Access, Prep101 Builder, and Saved Work sections.
- Removed the Redeem Promo Code card from the customer dashboard so launch coupons can stay in Stripe checkout instead of distracting from the main product flow.
- Removed misleading “Unlimited Prep101” and “Free monthly access only” customer copy from the dashboard and Reader101 page.
- Reframed the shared account hero as `Your Child Actor 101 Account` with a `Currently viewing` context badge instead of product-inside-account headlines.
- Added consistent product card language, a one-line ecosystem explanation, prominent `Working as` actor context, and a Prep101 overage prompt linking to the 3-pack add-on.
- Normalized the dashboard access summary so Prep101 always displays as 5 guides/month plus add-on credits instead of surfacing legacy unlimited/999-guide values.
- Replaced Reader101's ornate Playfair headline typography with cleaner Sora display type and softened the hero eyebrow pill so long sentence copy reads naturally.
- Made Reader101 guide creation explicit: Reader101 CTAs now jump to the account guide builder, the dashboard Reader101 card says `Create a Reader101 Guide`, and the form defaults to Reader101 mode when opened from Reader101 context.
- Replaced the hidden `Guide Mode (Test Access)` selector with a customer-facing `What are you creating?` choice between Prep101 Actor Guide and Reader101 Reader Guide.
- Tightened Reader101 high-risk/intimacy classification so parent-child comfort scenes like hugs or kissing a child on the head no longer trigger the intimacy warning, and narrowed the trigger lists so generic words like `watching`, `bed`, or `shame` do not misclassify normal dramatic material.
- Made the warning header defensive in the template layer so non-intimacy high-risk scenes can render under `Handling High-Risk Material` instead of always saying `When the Scene Crosses Into Intimacy`.
- Fixed Reader101 role targeting so the guide now infers and coaches the counterpart reader role from the sides, instead of coaching the audition character. Reader101 generation now receives extracted scene character names, resolves the likely reader role, and tells the model to coach that role explicitly.
- Expanded Reader101 counterpart-role targeting from a single inferred role to all non-audition roles found in the scene, so multi-role reader pages can coach `SHERIFF / DEPUTY MORALES` style coverage instead of only the first counterpart.
- Fixed Reader101 role extraction so page headers like `ERICKA SIDES 1.` and continuation labels like `ERICKA (CONT’D)` no longer get treated as separate reader roles or produce bogus `scattered roles` guidance.
- Rewrote the Reader101 generation prompt around the actual product standard: Reader101 as an actor-protection system, not generic reader advice.
- Added stronger structured validation so Reader101 now requires scene-specific quoted references, exactly 10 Reader Fundamentals bullets, at least 6 Key Beats, and tighter `Do This / Avoid This` and `Quick Reset` counts before accepting model output.
- Updated the normalized Reader101 output so the guide footer now ends with `If any of these happen, the audition doesn't land. Full stop.` and the rendered guide preserves all 10 Reader Fundamentals rules instead of silently trimming them down.
- Fixed Bold Choices and Reader101 unlimited entitlement checks so stored paid plans like `bundle`, `reader101_monthly`, and `boldchoices_monthly` still count as active access even when `stripePriceId` or `subscriptionStatus` is blank on the user row.
- Fixed a Bold Choices auth-callback hang where the page could sit on `Signing you in...` forever if the initial session restore stalled; the callback now processes URL tokens immediately and the Bold Choices auth context now times out stalled session/verify requests instead of hanging indefinitely.
- Fixed Stripe reconciliation for multi-product accounts by letting the backend track multiple active recurring Stripe price IDs in `stripePriceId`, deriving Reader101 and Bold Choices unlimited access from that full set instead of a single “best” subscription, and storing a legacy-safe `subscription` summary so sync no longer crashes against the old enum when plans like `reader101_monthly` are encountered.
- Hardened Bold Choices billing lookup so generation now compares both the legacy Sequelize `Users` row and the Supabase `Users` row and prefers the richer paid-product record, which protects users from stale single-plan rows still showing only one Stripe price ID.
- Fixed a production-wide model outage for guide generation by replacing the deprecated Anthropic model ID (`claude-3-5-sonnet-20241022`) with a live default (`claude-sonnet-4-20250514`) in the shared model config and in remaining hardcoded generation call sites (Bold Choices, Reader101 pipeline dependencies, PDF ingest vision path, and legacy guide routes).
- Switched the shared default model to Claude 3.7 using the explicit snapshot ID (`claude-3-7-sonnet-20250219`) after verifying that the alias (`claude-3-7-sonnet-latest`) returned a 404 in production; updated both the shared model config and Bold Choices health fallback to keep diagnostics aligned.
- Added a model-aware output-token clamp so Claude 3.7 requests are automatically capped at 8192 tokens even if `CLAUDE_MAX_TOKENS` is set higher, preventing Anthropic request failures during guide generation.
- Updated the dashboard generation error handling to surface backend `reason/detail/message` fields (instead of only a generic error string), so failures now show the real server cause directly in the UI.
- Added a shared Anthropic message client with automatic model fallback across known Sonnet/Haiku IDs; Prep101, Reader101, Bold Choices, and child-guide generation now retry on `model not found` instead of hard-failing.
- Switched the primary model target to Sonnet 4.6 (`claude-sonnet-4-6`) and aligned the Bold Choices health fallback label to match.
- Added a provider-level fallback for Prep101 guide generation: if Anthropic model attempts fail, Prep101 now falls back to OpenAI `gpt-5.2` automatically when `OPENAI_API_KEY` is configured.
- Fixed Reader101 render validation drift where high-risk guides were rejected unless the header text was exactly `When the Scene Crosses Into Intimacy`; validation now accepts both that heading and `Handling High-Risk Material`.
- Tightened Reader101 role extraction and risk classification for comedic child sides: dropped pagination/noise cues like `MORE` and `SCENE`, ignore one-off wrapped uppercase fragments like `CAKE.`, and stopped treating generic non-sexual `naked` mentions as automatic intimacy/high-risk.
- Added explicit Reader101 comedy-mode enforcement for multi-cam/sitcom scripts (including audience-laughter cues): prompts now prioritize reversals/contrast/timing, ban invented character roles, and require extraction-first script grounding before coaching.
- Applied a strict drop-in multicam correction block in Reader101 generation prompts (comedy engine, timing law, no joke signaling, anti-hallucination, and mandatory consequence language), and strengthened normalized comedy consequence wording (e.g., `scene dies`, `joke disappears`, `casting checks out`).
- Added a Reader101 role firewall + mode architecture in prompt generation:
  - explicit `Reader101 vs Prep101` role lock
  - mandatory priority stack (`script reality -> genre mode -> reader function -> tone/style`)
  - genre-mode system (`drama`, `multicam`, `singlecam_comedy`, `thriller_horror`, `teen_drama`) plus child-focused guardrails.
- Imported `/Users/coreyralston/Library/Mobile Documents/com~apple~CloudDocs/methodology.md` into repo RAG memory at `methodology/methodology.md` and boosted retrieval ranking by classifying it as `core-methodology` in Prep101 search scoring.

### Database migrations added this round
- `supabase/migrations/20260408_prep101_top_up_credits.sql`
- `supabase/migrations/20260408_prep101_top_up_sessions.sql`
- `supabase/migrations/20260409_reader_bold_entitlements.sql`

## 2026-04-12

### RAG scoring architecture upgrade (blood-and-math schema)
- Added a new chunk-based retrieval engine at [services/methodologyRetrieval.js](/Users/coreyralston/prep101-backend/services/methodologyRetrieval.js) using the weighted production formula:
  - Script relevance (0.25)
  - Behavioral specificity (0.25)
  - Objective clarity (0.15)
  - Tactic strength (0.15)
  - Archetype alignment (0.10)
  - Genre alignment (0.05)
  - Role priority (0.05)
- Added production boosts and penalties aligned to methodology:
  - boosts for action-language, Hagen WANT/OBSTACLE/HOW match, archetype tag match, and physicality
  - penalties for emotion-only phrasing, generic acting language, low-tactic chunks, and cross-role contamination.
- Added automatic Hagen context extraction before retrieval:
  - `who`, `where`, `when`, `relationships`, `circumstances`, `want`, `obstacle`, `tactics`
  - retrieval now prioritizes pursuit-under-resistance signals over generic coaching text.
- Added archetype detection (primary + secondary) and archetype-weighted chunk ranking.
- Added role-specific filter behavior in retrieval:
  - Reader101 bias toward timing/contrast/restraint chunks, penalty for actor-psychology drift.
  - Bold Choices bias toward camera-readable physical behavior, penalty for essay-style analysis chunks.

### Live integration across products
- Replaced Prep101’s old file-level `searchMethodology` scorer with the new weighted chunk retrieval engine while keeping a compatibility wrapper in [simple-backend-rag.js](/Users/coreyralston/prep101-backend/simple-backend-rag.js).
- Prep101 guide prompts now inject:
  - top-ranked methodology chunks
  - extracted Hagen context block
  - retrieval logs showing selected chunks and archetype signals.
- Child guide generation now uses the same chunk-scored retrieval context instead of legacy file-level matching.
- Reader101 guide build now retrieves ranked methodology chunks and passes:
  - filtered retrieval memory text
  - archetype + Hagen signals
  into prompt construction for stronger script-grounded reader coaching.
- Bold Choices prompt generation now injects ranked methodology memory + Hagen/archetype retrieval signals before generation.

### Verification
- Ran syntax checks successfully for all changed files:
  - [services/methodologyRetrieval.js](/Users/coreyralston/prep101-backend/services/methodologyRetrieval.js)
  - [simple-backend-rag.js](/Users/coreyralston/prep101-backend/simple-backend-rag.js)
  - [reader101/system/buildGuide.js](/Users/coreyralston/prep101-backend/reader101/system/buildGuide.js)
  - [reader101/system/generateContent.js](/Users/coreyralston/prep101-backend/reader101/system/generateContent.js)
  - [services/boldChoicesService.js](/Users/coreyralston/prep101-backend/services/boldChoicesService.js)

### Reader101 role/risk hotfix (Alice/Spies false-positive case)
- Hardened reader-role extraction in [services/readerGuideService.js](/Users/coreyralston/prep101-backend/services/readerGuideService.js) so technical/script labels are never treated as reader characters (e.g. `SHOT`, `SECURITY CAM FOOTAGE`, `SURVEILLANCE FOOTAGE`, `MONTAGE`, `INSERT`, `POV`).
- Added technical-cue filtering for both extractor-supplied character names and uppercase cue-line inference.
- Fixed false high-risk routing for benign family context references like `walk in on them making out`:
  - introduced a benign-family-romance guard
  - excluded mild intimacy terms from automatic high-risk when clearly family-context only
  - kept severe sexual/boundary terms as high-risk.
- Tightened compounded boundary-risk logic so ambiguous cues alone no longer escalate without romantic context.
- Stopped `Child-Focused` mode from being triggered by incidental scene-text words (`kid/child`) by using metadata-only signals (plus age <=13).
- Reproduced against `/Users/coreyralston/Desktop/pdfss/ALICE (1).pdf` and verified corrected mode result:
  - `displayReaderCharacterName: Scene Partner` (no invented `SHOT / SECURITY CAM FOOTAGE`)
  - `mode: STANDARD`
  - `highRiskScene: false`
  - `genreMode: singlecam_comedy`
  - `childFocused: false`
