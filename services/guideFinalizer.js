// Finishing a guide: save it, charge for it, email it.
//
// Why this exists
// ---------------
// Generation used to be only half a pipeline. The worker produced the guide
// and handed it back as the BullMQ job's return value, and everything that
// made the guide *real* — the database row, the credit deduction, the
// notification — lived in the polling endpoint. That meant a guide only got
// saved if the actor's browser was still open and still polling when it
// finished. Close the laptop during a four-minute generation and the guide
// evaporated: no row, no email, nothing on the dashboard.
//
// So finalization lives here, in a module with no Express dependency, and the
// worker calls it the moment generation completes. The polling endpoint still
// calls its own copy of this logic as a safety net; both paths are idempotent,
// keyed on guideId, so whoever gets there first wins and the other no-ops.
//
// Deliberately depends only on standalone modules (supabaseAdmin,
// entitlements, quality, email) — the guide worker runs as its own process and
// cannot load the Express monolith.

const { randomUUID } = require("crypto");
const {
  runAdminQuery,
  isSupabaseAdminConfigured,
  tables: supabaseTables,
  normalizeGuideRow,
  normalizeUserRow,
} = require("../lib/supabaseAdmin");
const {
  getPrep101ConsumptionUpdate,
  getReader101ConsumptionUpdate,
} = require("./prep101EntitlementsService");
const { assessGuideQualityForType } = require("./guideQuality");
const emailService = require("./emailService");

function isDuplicateKeyError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");
  return code === "23505" || /duplicate key value|already exists/i.test(message);
}

async function findGuideByGuideId(guideId) {
  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(supabaseTables.guides)
      .select("*")
      .eq("guideId", guideId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
  return row ? normalizeGuideRow(row) : null;
}

async function loadUserById(userId) {
  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(supabaseTables.users)
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });
  return row ? normalizeUserRow(row) : null;
}

async function applyBillingUpdates(userId, updates) {
  if (!updates || !Object.keys(updates).length) return null;
  const row = await runAdminQuery(async (client) => {
    const { data, error } = await client
      .from(supabaseTables.users)
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });
  return row ? normalizeUserRow(row) : null;
}

/**
 * Save, charge for, and email a completed guide.
 *
 * Never throws: finalization runs inside the worker, and a guide that was
 * generated successfully must not be marked failed because the email server
 * hiccuped. Callers read the returned reason to decide whether the polling
 * endpoint still needs to do the work.
 *
 * @returns {Promise<{finalized: boolean, alreadyPersisted?: boolean, guide?: object, emailed?: boolean, reason?: string, missing?: string[]}>}
 */
async function finalizeGuideJob({ guidePayload, isReaderMode = false, source = "worker" } = {}) {
  const guideId = guidePayload?.guideId;
  const userId = guidePayload?.userId;

  if (!guideId || !userId) {
    return { finalized: false, reason: "invalid_payload" };
  }

  // Without Supabase the monolith persists through Sequelize, which this
  // module intentionally does not load. Leave it to the polling endpoint.
  if (!isSupabaseAdminConfigured()) {
    return { finalized: false, reason: "supabase_unavailable" };
  }

  try {
    const existing = await findGuideByGuideId(guideId);
    if (existing) {
      return { finalized: true, alreadyPersisted: true, guide: existing };
    }

    const guideType = isReaderMode ? "reader101" : guidePayload.guideType || "prep101";
    const quality = assessGuideQualityForType(guidePayload.generatedHtml, guideType);
    if (!quality.valid) {
      // Same contract as the polling endpoint: a guide that fails the gate is
      // not saved and no credit is spent.
      console.warn(
        `[Finalizer] ${guideId} failed the quality gate (${quality.missing.join(", ")}); not saving, no credit used.`
      );
      return { finalized: false, reason: "quality_gate", missing: quality.missing };
    }

    // The Guides.userId foreign key needs a Users row. If it is missing, the
    // request path can build one from the auth record; this process cannot.
    const user = await loadUserById(userId);
    if (!user) {
      console.warn(
        `[Finalizer] No Users row for ${userId}; deferring ${guideId} to the polling endpoint.`
      );
      return { finalized: false, reason: "user_row_missing" };
    }

    const now = new Date().toISOString();
    const row = {
      ...guidePayload,
      id: guidePayload.id || randomUUID(),
      createdAt: guidePayload.createdAt || now,
      updatedAt: now,
    };

    let persisted;
    try {
      persisted = await runAdminQuery(async (client) => {
        const { data, error } = await client
          .from(supabaseTables.guides)
          .insert(row)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      });
    } catch (error) {
      // A live poll may have finalized the same job between our lookup and
      // this insert. guideId is unique, so the loser just reads the winner's row.
      if (isDuplicateKeyError(error)) {
        const winner = await findGuideByGuideId(guideId);
        if (winner) {
          return { finalized: true, alreadyPersisted: true, guide: winner };
        }
      }
      throw error;
    }

    const guide = normalizeGuideRow(persisted);
    console.log(`[Finalizer] Saved ${guideType} guide ${guideId} for user ${userId} (via ${source}).`);

    // Credits after the save: if this fails the actor still has their guide,
    // which is the outcome worth protecting.
    try {
      const consumption = isReaderMode
        ? getReader101ConsumptionUpdate(user)
        : getPrep101ConsumptionUpdate(user);
      if (consumption.allowed && Object.keys(consumption.updates).length) {
        await applyBillingUpdates(userId, consumption.updates);
      }
    } catch (error) {
      console.error(`[Finalizer] Credit deduction failed for ${guideId}:`, error.message);
    }

    let emailed = false;
    try {
      if (emailService.isConfigured() && user.email) {
        await emailService.sendGuideReadyEmail({ to: user.email, guide });
        emailed = true;
      } else if (!emailService.isConfigured()) {
        console.warn(`[Finalizer] Email not configured; skipped notifying ${userId} about ${guideId}.`);
      }
    } catch (error) {
      console.error(`[Finalizer] Guide email failed for ${guideId}:`, error.message);
    }

    return { finalized: true, alreadyPersisted: false, guide, emailed };
  } catch (error) {
    console.error(`[Finalizer] Could not finalize ${guideId}:`, error.message);
    return { finalized: false, reason: "error", error: error.message };
  }
}

module.exports = {
  finalizeGuideJob,
  findGuideByGuideId,
};
