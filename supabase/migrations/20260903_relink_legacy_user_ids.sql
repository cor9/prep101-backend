-- Relink legacy Users rows to their Supabase Auth ids.
--
-- Accounts created before the Supabase Auth migration have a public."Users"
-- row keyed by a legacy UUID, while their JWT carries the auth.users id. The
-- backend looks the user up by the auth id, finds nothing, and tries to insert
-- a fresh row -- which collides with the legacy row's unique email. Provisioning
-- then fails and the guide insert dies on Guides_userId_fkey, so these accounts
-- cannot save a guide at all. Their existing guides are invisible too, since
-- the dashboard queries by the auth id.
--
-- Re-pointing the Users row fixes both, but only if every foreign key that
-- references Users.id carries the update along. Two of the three already do:
--
--   Guides_userId_fkey            ON UPDATE CASCADE
--   PromoCodes_createdBy_fkey     ON UPDATE CASCADE
--   PromoCodeRedemptions_userId_fkey   (no rule -- NO ACTION)
--
-- That last one is the odd one out and it blocks the relink outright, so it is
-- brought in line with its siblings first. Nothing is deleted anywhere: an
-- id changes and its children follow.
--
-- Idempotent: rows already keyed by their auth id are untouched, the NOT EXISTS
-- guard skips any auth id that somehow already has its own row, and the
-- constraint swap is a no-op on a database where it has already run.

BEGIN;

-- 1. Let promo redemptions follow their user, as guides already do.
ALTER TABLE public."PromoCodeRedemptions"
  DROP CONSTRAINT IF EXISTS "PromoCodeRedemptions_userId_fkey";

ALTER TABLE public."PromoCodeRedemptions"
  ADD CONSTRAINT "PromoCodeRedemptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."Users"(id)
  ON UPDATE CASCADE;

-- 2. Report what is about to move.
DO $$
DECLARE
  affected integer;
BEGIN
  SELECT count(*) INTO affected
  FROM auth.users au
  JOIN public."Users" pu ON lower(pu.email) = lower(au.email)
  WHERE pu.id <> au.id
    AND NOT EXISTS (SELECT 1 FROM public."Users" x WHERE x.id = au.id);

  RAISE NOTICE 'Relinking % legacy Users row(s) to their auth ids', affected;
END $$;

-- 3. Point each legacy row at its auth id; guides, promo codes and
--    redemptions cascade across with it.
UPDATE public."Users" pu
SET id = au.id
FROM auth.users au
WHERE lower(pu.email) = lower(au.email)
  AND pu.id <> au.id
  AND NOT EXISTS (SELECT 1 FROM public."Users" x WHERE x.id = au.id);

COMMIT;
