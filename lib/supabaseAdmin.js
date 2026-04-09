const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_GUIDES_TABLE =
  process.env.SUPABASE_GUIDES_TABLE || "Guides";
const SUPABASE_USERS_TABLE = process.env.SUPABASE_USERS_TABLE || "Users";

let supabaseAdmin = null;

// Log what's configured for debugging
console.log("🔧 Supabase config check:", {
  hasUrl: !!SUPABASE_URL,
  hasServiceKey: !!SUPABASE_SERVICE_KEY,
  guidesTable: SUPABASE_GUIDES_TABLE,
  usersTable: SUPABASE_USERS_TABLE,
});

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("✅ Supabase admin client ready for DB fallback");
  } catch (error) {
    console.error("❌ Failed to init Supabase admin client:", error.message);
    supabaseAdmin = null;
  }
} else {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_KEY");
  console.warn(
    `⚠️  Supabase admin credentials missing (${missing.join(", ")}) - DB fallback routes will be limited. ` +
    `Guide saving will FAIL without database configuration.`
  );
}

async function runAdminQuery(callback, fallbackValue = null) {
  if (!supabaseAdmin) {
    console.warn(
      "⚠️  Supabase admin client unavailable - skipping admin query fallback"
    );
    return fallbackValue;
  }

  try {
    return await callback(supabaseAdmin);
  } catch (error) {
    console.error("❌ Supabase admin query failed:", error);
    throw error;
  }
}

function normalizeGuideRow(row) {
  if (!row) return null;
  return {
    ...row,
    childGuideRequested: Boolean(row.childGuideRequested),
    childGuideCompleted: Boolean(row.childGuideCompleted),
    isFavorite: Boolean(row.isFavorite),
    isPublic: Boolean(row.isPublic),
  };
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    ...row,
    guidesUsed:
      typeof row.guidesUsed === "number" ? row.guidesUsed : row.guidesUsed || 0,
    guidesLimit:
      typeof row.guidesLimit === "number" ? row.guidesLimit : row.guidesLimit,
    prep101TopUpCredits:
      typeof row.prep101TopUpCredits === "number"
        ? row.prep101TopUpCredits
        : row.prep101TopUpCredits || 0,
    prep101TopUpSessionIds: Array.isArray(row.prep101TopUpSessionIds)
      ? row.prep101TopUpSessionIds
      : [],
    reader101Credits:
      typeof row.reader101Credits === "number"
        ? row.reader101Credits
        : row.reader101Credits || 0,
    reader101SessionIds: Array.isArray(row.reader101SessionIds)
      ? row.reader101SessionIds
      : [],
    boldChoicesCredits:
      typeof row.boldChoicesCredits === "number"
        ? row.boldChoicesCredits
        : row.boldChoicesCredits || 0,
    boldChoicesSessionIds: Array.isArray(row.boldChoicesSessionIds)
      ? row.boldChoicesSessionIds
      : [],
  };
}

module.exports = {
  supabaseAdmin,
  isSupabaseAdminConfigured: () => !!supabaseAdmin,
  runAdminQuery,
  tables: {
    guides: SUPABASE_GUIDES_TABLE,
    users: SUPABASE_USERS_TABLE,
  },
  normalizeGuideRow,
  normalizeUserRow,
};
