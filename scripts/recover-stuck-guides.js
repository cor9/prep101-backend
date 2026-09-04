#!/usr/bin/env node
//
// Rescue guides that generated successfully but were never saved.
//
// The worker finalizes a guide as soon as it finishes, and the polling endpoint
// finalizes as a fallback while someone is watching the page. When both miss —
// a worker on stale code, a worker that is down, a browser closed mid-generation
// — the guide is not lost, it is unclaimed: BullMQ still holds it as the job's
// return value. This finds those and finishes the job properly.
//
// The same sweep runs on a schedule at GET /api/cron/finalize-guides. Reach for
// this when you want to see it happen, or to catch up faster than the cron will.
//
//   node scripts/recover-stuck-guides.js            # report only
//   node scripts/recover-stuck-guides.js --apply    # save, credit and email
//
// Env: GUIDE_RECOVERY_SCAN (how many completed jobs to inspect, default 20)
//      GUIDE_RECOVERY_MAX  (how many to finalize per run, default 10)
//
require("dotenv").config();

const { getGuideQueue } = require("../services/guideQueue");
const { recoverStrandedGuides, DEFAULT_SCAN } = require("../services/guideRecovery");

const APPLY = process.argv.includes("--apply");
const SCAN = Number(process.env.GUIDE_RECOVERY_SCAN || process.env.RECOVER_LIMIT || DEFAULT_SCAN);

function describe(item) {
  const when = item.finishedOn ? new Date(item.finishedOn).toISOString() : "unknown";
  return (
    `job ${item.jobId}  ${item.guideType}  ` +
    `${item.characterName} — ${item.productionTitle}  ` +
    `(user ${item.userId}, finished ${when})`
  );
}

async function main() {
  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is required to read completed jobs.");
    process.exit(1);
  }

  console.log(
    `Scanning the ${SCAN} most recent completed job(s)${APPLY ? "" : " (dry run)"}...\n`
  );

  const summary = await recoverStrandedGuides({
    scan: SCAN,
    // A dry run reports every stranded guide; an apply run is capped per pass.
    max: APPLY ? Number(process.env.GUIDE_RECOVERY_MAX || SCAN) : 0,
    dryRun: !APPLY,
    source: "recovery-script",
  });

  if (!summary.found) {
    console.log(
      `No stranded guides among ${summary.scanned} completed job(s). ` +
        "Everything that finished is saved."
    );
    return;
  }

  if (!APPLY) {
    console.log(`Found ${summary.found} generated-but-unsaved guide(s):\n`);
    for (const item of summary.stranded) console.log(`  ${describe(item)}`);
    console.log("\nRe-run with --apply to save and email these.");
    return;
  }

  console.log(`Found ${summary.found}; finalizing ${summary.results.length}...\n`);
  for (const r of summary.results) {
    const { outcome } = r;
    if (outcome.finalized && !outcome.alreadyPersisted) {
      console.log(
        `  ✅ job ${r.jobId} saved${outcome.emailed ? " and emailed" : " (no email sent)"}`
      );
    } else if (outcome.alreadyPersisted) {
      console.log(`  ↷  job ${r.jobId} already saved by someone else`);
    } else {
      const detail = outcome.missing ? ` (${outcome.missing.join(", ")})` : "";
      console.log(`  ⚠️  job ${r.jobId} skipped: ${outcome.reason}${detail}`);
    }
  }

  console.log(`\nDone. ${summary.recovered} recovered, ${summary.skipped} skipped.`);
  if (summary.deferred) {
    console.log(`${summary.deferred} left for the next run (per-run cap).`);
  }
}

main()
  .catch((error) => {
    console.error("Recovery failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // BullMQ holds the Redis connection open; close it so the script exits.
    try {
      const queue = getGuideQueue();
      if (queue) await queue.close();
    } catch (_) {}
    process.exit(process.exitCode || 0);
  });
