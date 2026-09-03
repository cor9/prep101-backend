-- Relink legacy Users rows to their Supabase Auth ids.
--
-- Accounts created before the Supabase Auth migration have a public."Users"
-- row keyed by a legacy UUID, while their JWT carries the auth.users id. The
-- backend looks the user up by the auth id, finds nothing, and tries to insert
-- a fresh row -- which collides with the legacy row's unique email. Provisioning
-- then fails and the guide insert dies on Guides_userId_fkey, so these accounts
-- cannot save a guide at all.
--
-- "Guides"."userId" is declared ON UPDATE CASCADE, so re-pointing the Users row
-- carries the account's existing guides across with it. Nothing is orphaned and
-- nothing is deleted.
--
-- Idempotent: rows already keyed by their auth id are untouched, and the
-- NOT EXISTS guard skips any auth id that somehow already has its own row.

BEGIN;

-- Report what is about to move.
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

UPDATE public."Users" pu
SET id = au.id
FROM auth.users au
WHERE lower(pu.email) = lower(au.email)
  AND pu.id <> au.id
  AND NOT EXISTS (SELECT 1 FROM public."Users" x WHERE x.id = au.id);

COMMIT;
