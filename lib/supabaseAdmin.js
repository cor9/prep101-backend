const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_GUIDES_TABLE =
  process.env.SUPABASE_GUIDES_TABLE || "Guides";
const SUPABASE_USERS_TABLE = process.env.SUPABASE_USERS_TABLE || "Users";

let supabaseAdmin = null;
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
  console.warn(
    "⚠️  Supabase admin credentials missing - DB fallback routes will be limited"
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

>>>>>>> 5d8790a5 (Add Supabase persistence fallback and fix guide UI)
