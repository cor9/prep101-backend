// Making sure an authenticated account has a public."Users" row.
//
// Everything that belongs to a user — guides, credits, subscriptions — is keyed
// on Users.id by a foreign key, so an account without a row cannot be given
// anything. It fails at the last step, after the work is done and paid for.
//
// This has now gone wrong twice for the same reason: two copies of the logic,
// one fixed and one not. 7fa6f46 repaired ensureGuideUser in the Bold Choices
// route and left ensureSupabaseUser in the monolith still omitting createdAt and
// updatedAt, both NOT NULL with no default — so Bold Choices could provision a
// new account and Prep101 could not, and Prep101 guides died on
// Guides_userId_fkey while Bold Choices saved happily beside them.
//
// One implementation, here.

const { randomUUID } = require("crypto");
const {
  supabaseAdmin,
  runAdminQuery,
  isSupabaseAdminConfigured,
  tables,
} = require("../lib/supabaseAdmin");

/**
 * Look up a Supabase Auth account by id.
 *
 * The worker and the cron only ever see a userId — there is no request and no
 * session — so this is the only way for them to learn the email a Users row
 * needs. Requires the service role key.
 */
async function resolveAuthUser(userId) {
  if (!isSupabaseAdminConfigured() || !userId) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw error;
    const authUser = data?.user;
    if (!authUser?.email) return null;
    return {
      id: authUser.id,
      email: authUser.email,
      name:
        authUser.user_metadata?.name ||
        authUser.user_metadata?.full_name ||
        undefined,
    };
  } catch (error) {
    console.warn(
      `[Provisioning] Could not resolve auth user ${userId}:`,
      error.message || error
    );
    return null;
  }
}

/**
 * Ensure `user` has a row in public."Users". Returns true if one exists after
 * this call.
 *
 * Never overwrites an existing row: an account that is already there is left
 * exactly as it is, because the defaults below would otherwise wipe a paying
 * customer's credits back to zero.
 */
async function ensureUserRow(user = {}) {
  if (!isSupabaseAdminConfigured()) return false;
  if (!user?.id) return false;

  const existing = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, null);

  if (existing?.id) return true;

  if (!user.email) {
    console.error(
      `[Provisioning] No email for ${user.id}; cannot create a Users row.`
    );
    return false;
  }

  // Accounts that predate Supabase Auth have a row keyed by a legacy UUID while
  // the JWT carries the auth.users id. Same person, two ids — and because email
  // is unique the insert below can never succeed for them, it collides with
  // their own old row. Adopt it instead. Guides.userId and the promo tables are
  // ON UPDATE CASCADE, so everything they own follows the id across.
  //
  // ILIKE treats % and _ as wildcards and both are legal in an email local
  // part, so the pattern is escaped and the match re-checked exactly before
  // anything is touched — adopting the wrong account would hand someone else's
  // guides over.
  const emailPattern = String(user.email).replace(/([\\%_])/g, "\\$1");
  const legacy = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .select("id, email")
      .ilike("email", emailPattern)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, null);

  const emailsMatch =
    legacy?.email &&
    String(legacy.email).toLowerCase() === String(user.email).toLowerCase();

  if (emailsMatch && legacy.id !== user.id) {
    console.log(
      `[Provisioning] Relinking legacy Users row ${legacy.id} to auth id ${user.id} for ${user.email}`
    );
    const relinked = await runAdminQuery(async (client) => {
      const { data, error } = await client
        .from(tables.users)
        .update({ id: user.id })
        .eq("id", legacy.id)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    }, null);

    if (relinked?.id) {
      console.log(`[Provisioning] Relinked ${user.email} to auth id ${user.id}`);
      return true;
    }
    console.error(`[Provisioning] Failed to relink legacy row for ${user.email}`);
    return false;
  }

  // password, name, createdAt and updatedAt are NOT NULL with no database
  // default. Omitting any one of them fails the insert, which is the bug this
  // module exists to stop repeating.
  //
  // The password is a hash of random bytes: these accounts authenticate through
  // Supabase Auth and never verify against this column, but the schema demands a
  // value and an unguessable one keeps it unusable.
  const bcrypt = require("bcryptjs");
  const now = new Date().toISOString();

  const row = {
    id: user.id,
    email: user.email,
    name: user.name || String(user.email).split("@")[0],
    password: bcrypt.hashSync(randomUUID() + randomUUID(), 10),
    createdAt: now,
    updatedAt: now,
    subscription: user.subscription || "free",
    guidesUsed: typeof user.guidesUsed === "number" ? user.guidesUsed : 0,
    guidesLimit: typeof user.guidesLimit === "number" ? user.guidesLimit : 0,
    prep101TopUpCredits:
      typeof user.prep101TopUpCredits === "number" ? user.prep101TopUpCredits : 0,
    prep101TopUpSessionIds: Array.isArray(user.prep101TopUpSessionIds)
      ? user.prep101TopUpSessionIds
      : [],
    reader101Credits:
      typeof user.reader101Credits === "number" ? user.reader101Credits : 0,
    reader101SessionIds: Array.isArray(user.reader101SessionIds)
      ? user.reader101SessionIds
      : [],
    boldChoicesCredits:
      typeof user.boldChoicesCredits === "number" ? user.boldChoicesCredits : 0,
    boldChoicesSessionIds: Array.isArray(user.boldChoicesSessionIds)
      ? user.boldChoicesSessionIds
      : [],
  };

  const inserted = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(tables.users)
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return data;
  }, null).catch((error) => {
    console.error(
      `[Provisioning] Could not create a Users row for ${user.email}:`,
      error.message || error
    );
    return null;
  });

  if (!inserted?.id) return false;

  console.log(`[Provisioning] Created Users row for ${user.email} (${user.id})`);
  return true;
}

/**
 * Ensure a Users row exists when all you have is an id — the worker and the
 * cron's situation. Falls back to the Supabase Auth record for the email.
 */
async function ensureUserRowById(userId) {
  if (!userId) return false;
  const authUser = await resolveAuthUser(userId);
  if (!authUser) return false;
  return ensureUserRow(authUser);
}

module.exports = {
  ensureUserRow,
  ensureUserRowById,
  resolveAuthUser,
};
