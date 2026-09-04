// Finding guides that generated but never got saved.
//
// The worker finalizes a guide the moment it finishes, and the polling endpoint
// finalizes as a fallback while someone is watching. Both can miss: a worker
// running stale code, a worker that is down or unreachable, a browser closed
// before the poll, a Supabase blip at exactly the wrong second. In every one of
// those cases the guide itself is fine — it is sitting in Redis as the BullMQ
// job's return value, and nobody has claimed it.
//
// This sweeps for exactly that: completed jobs with no Guides row. It is the
// same work whether a person runs it from a terminal or a cron hits it on a
// schedule, so both go through here.

const { getGuideQueue } = require("./guideQueue");
const { finalizeGuideJob, findGuideByGuideId } = require("./guideFinalizer");
const { isSupabaseAdminConfigured } = require("../lib/supabaseAdmin");

// Scanning costs a Redis round trip per job inspected, and this runs on a
// schedule against a metered Upstash plan, so the window is deliberately
// narrow: guides take minutes, BullMQ keeps the last 100 completions, and
// anything older than a couple of sweeps has already been caught or is gone.
const DEFAULT_SCAN = Number(process.env.GUIDE_RECOVERY_SCAN || 20);
// Cap the work per run so a backlog cannot run into the function timeout.
// Whatever is left over is picked up by the next sweep.
const DEFAULT_MAX_FINALIZE = Number(process.env.GUIDE_RECOVERY_MAX || 10);

/**
 * Find completed guide jobs that were never persisted.
 *
 * @returns {Promise<{scanned: number, stranded: Array<{jobId: string, guidePayload: object, isReaderMode: boolean, finishedOn: number|null}>}>}
 */
async function findStrandedGuides({ scan = DEFAULT_SCAN } = {}) {
  const queue = getGuideQueue();
  if (!queue) {
    throw new Error("Guide queue unavailable (REDIS_URL not configured).");
  }

  const jobs = await queue.getJobs(["completed"], 0, Math.max(0, scan - 1));
  const stranded = [];

  for (const job of jobs) {
    const result = job?.returnvalue;
    const guidePayload = result?.guidePayload;
    // Bold Choices returns a different shape and persists through its own
    // route; malformed results have nothing to recover.
    if (!guidePayload?.guideId) continue;

    // The worker records what it did. Trust it to skip the common case
    // without spending a database round trip on every healthy job.
    if (result.finalization?.finalized) continue;

    const existing = await findGuideByGuideId(guidePayload.guideId);
    if (existing) continue;

    stranded.push({
      jobId: String(job.id),
      guidePayload,
      isReaderMode: Boolean(result.isReaderMode),
      finishedOn: job.finishedOn || null,
    });
  }

  return { scanned: jobs.length, stranded };
}

/**
 * Find stranded guides and finalize them: saved, credited, emailed.
 *
 * Never throws for a single guide's failure — one bad payload must not stop
 * the rest of the sweep from rescuing everything else.
 *
 * @returns {Promise<{scanned: number, found: number, recovered: number, skipped: number, results: Array<object>}>}
 */
async function recoverStrandedGuides({
  scan = DEFAULT_SCAN,
  max = DEFAULT_MAX_FINALIZE,
  dryRun = false,
  source = "recovery",
} = {}) {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase admin credentials are required to save recovered guides.");
  }

  const { scanned, stranded } = await findStrandedGuides({ scan });
  const results = [];
  let recovered = 0;
  let skipped = 0;

  const batch = dryRun ? [] : stranded.slice(0, max);

  for (const item of batch) {
    const outcome = await finalizeGuideJob({
      guidePayload: item.guidePayload,
      isReaderMode: item.isReaderMode,
      source,
    });

    if (outcome.finalized && !outcome.alreadyPersisted) {
      recovered += 1;
    } else if (!outcome.finalized) {
      skipped += 1;
    }

    results.push({
      jobId: item.jobId,
      guideId: item.guidePayload.guideId,
      guideType: item.guidePayload.guideType || "prep101",
      characterName: item.guidePayload.characterName,
      productionTitle: item.guidePayload.productionTitle,
      userId: item.guidePayload.userId,
      finishedOn: item.finishedOn,
      outcome,
    });
  }

  return {
    scanned,
    found: stranded.length,
    recovered,
    skipped,
    // Anything beyond `max` is left for the next sweep rather than dropped.
    deferred: dryRun ? stranded.length : Math.max(0, stranded.length - batch.length),
    results,
    stranded: dryRun ? stranded.map(summarize) : undefined,
  };
}

function summarize(item) {
  return {
    jobId: item.jobId,
    guideId: item.guidePayload.guideId,
    guideType: item.guidePayload.guideType || "prep101",
    characterName: item.guidePayload.characterName,
    productionTitle: item.guidePayload.productionTitle,
    userId: item.guidePayload.userId,
    finishedOn: item.finishedOn,
  };
}

module.exports = {
  findStrandedGuides,
  recoverStrandedGuides,
  DEFAULT_SCAN,
  DEFAULT_MAX_FINALIZE,
};
