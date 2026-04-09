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

### Database migrations added this round
- `supabase/migrations/20260408_prep101_top_up_credits.sql`
- `supabase/migrations/20260408_prep101_top_up_sessions.sql`
- `supabase/migrations/20260409_reader_bold_entitlements.sql`
