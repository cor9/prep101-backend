# Session Updates

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

### Database migrations added this round
- `supabase/migrations/20260408_prep101_top_up_credits.sql`
- `supabase/migrations/20260408_prep101_top_up_sessions.sql`
- `supabase/migrations/20260409_reader_bold_entitlements.sql`
