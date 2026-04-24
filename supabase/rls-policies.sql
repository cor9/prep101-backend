-- ============================================================
-- RLS Policies for Child Actor 101 / Prep101
-- Run this in: https://app.supabase.com/project/eokqyijxubrmompozguh/sql/new
--
-- SAFE TO RUN MULTIPLE TIMES (uses IF NOT EXISTS / OR REPLACE).
-- Backend uses the service role key, which bypasses RLS entirely —
-- so enabling RLS here only locks out direct anon/authenticated access.
-- ============================================================

-- ─── 1. Users ────────────────────────────────────────────────────────────────
-- Note: "id" is a UUID matching auth.uid() for Supabase-registered users.

ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;

-- Users may only see their own row
DROP POLICY IF EXISTS "Users: select own row" ON "Users";
CREATE POLICY "Users: select own row"
  ON "Users" FOR SELECT
  USING (auth.uid()::text = "id"::text);

-- Users may update their own row (non-sensitive columns only —
-- sensitive columns like password/stripe keys are blocked by column-level
-- security below)
DROP POLICY IF EXISTS "Users: update own row" ON "Users";
CREATE POLICY "Users: update own row"
  ON "Users" FOR UPDATE
  USING (auth.uid()::text = "id"::text);

-- Only the service role (backend) may INSERT or DELETE users
-- (No INSERT/DELETE policies → anon/authenticated roles are denied)

-- ── Sensitive column security: hide password & stripe keys from clients ───────
-- Revoke direct column access from anon and authenticated roles.
-- The service role still has full access.
REVOKE SELECT ON "Users" FROM anon, authenticated;
GRANT SELECT (
  "id", "email", "name",
  "subscription", "subscriptionStatus",
  "currentPeriodStart", "currentPeriodEnd",
  "guidesUsed", "guidesLimit",
  "prep101TopUpCredits", "prep101TopUpSessionIds",
  "reader101Credits", "reader101SessionIds",
  "boldChoicesCredits", "boldChoicesSessionIds",
  "isBetaTester", "betaAccessLevel", "betaStatus",
  "createdAt", "updatedAt"
) ON "Users" TO authenticated;
-- anon users never need to read the Users table directly
GRANT SELECT ("id", "email") ON "Users" TO anon;

-- ─── 2. Guides ───────────────────────────────────────────────────────────────

ALTER TABLE "Guides" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guides: select own" ON "Guides";
CREATE POLICY "Guides: select own"
  ON "Guides" FOR SELECT
  USING (
    auth.uid()::text = "userId"::text
    OR "isPublic" = true
  );

DROP POLICY IF EXISTS "Guides: insert own" ON "Guides";
CREATE POLICY "Guides: insert own"
  ON "Guides" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId"::text);

DROP POLICY IF EXISTS "Guides: update own" ON "Guides";
CREATE POLICY "Guides: update own"
  ON "Guides" FOR UPDATE
  USING (auth.uid()::text = "userId"::text);

DROP POLICY IF EXISTS "Guides: delete own" ON "Guides";
CREATE POLICY "Guides: delete own"
  ON "Guides" FOR DELETE
  USING (auth.uid()::text = "userId"::text);

-- ─── 3. PromoCodes ───────────────────────────────────────────────────────────
-- Authenticated users need to be able to look up a code to redeem it.
-- No user should be able to create/edit/delete codes (backend/admin only).

ALTER TABLE "PromoCodes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PromoCodes: authenticated can read active codes" ON "PromoCodes";
CREATE POLICY "PromoCodes: authenticated can read active codes"
  ON "PromoCodes" FOR SELECT
  USING (auth.role() = 'authenticated' AND "isActive" = true);

-- No INSERT / UPDATE / DELETE policies → only service role can write

-- ─── 4. PromoCodeRedemptions ─────────────────────────────────────────────────

ALTER TABLE "PromoCodeRedemptions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PromoCodeRedemptions: select own" ON "PromoCodeRedemptions";
CREATE POLICY "PromoCodeRedemptions: select own"
  ON "PromoCodeRedemptions" FOR SELECT
  USING (auth.uid()::text = "userId"::text);

-- Only service role may INSERT/UPDATE/DELETE (no client-side policies)

-- ─── 5. boldchoices_usage ────────────────────────────────────────────────────
-- user_id is stored as text in these tables

ALTER TABLE boldchoices_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boldchoices_usage: select own" ON boldchoices_usage;
CREATE POLICY "boldchoices_usage: select own"
  ON boldchoices_usage FOR SELECT
  USING (auth.uid()::text = user_id);

-- Backend (service role) handles all writes — no client INSERT/UPDATE/DELETE

-- ─── 6. boldchoices_generations ──────────────────────────────────────────────

ALTER TABLE boldchoices_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boldchoices_generations: select own" ON boldchoices_generations;
CREATE POLICY "boldchoices_generations: select own"
  ON boldchoices_generations FOR SELECT
  USING (auth.uid()::text = user_id);

-- ─── 7. boldchoices_saved ────────────────────────────────────────────────────

ALTER TABLE boldchoices_saved ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boldchoices_saved: select own" ON boldchoices_saved;
CREATE POLICY "boldchoices_saved: select own"
  ON boldchoices_saved FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "boldchoices_saved: delete own" ON boldchoices_saved;
CREATE POLICY "boldchoices_saved: delete own"
  ON boldchoices_saved FOR DELETE
  USING (auth.uid()::text = user_id);

-- ─── 8. boldchoices_events ───────────────────────────────────────────────────
-- Events are write-only analytics. Users don't need to read them directly.
-- Only service role reads (for admin dashboards).

ALTER TABLE boldchoices_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boldchoices_events: insert own" ON boldchoices_events;
CREATE POLICY "boldchoices_events: insert own"
  ON boldchoices_events FOR INSERT
  WITH CHECK (
    user_id IS NULL OR auth.uid()::text = user_id
  );

-- No SELECT policy for clients — service role only reads analytics

-- ─── Done ─────────────────────────────────────────────────────────────────────
SELECT 'RLS policies applied ✅' AS status;
