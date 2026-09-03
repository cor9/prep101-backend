#!/usr/bin/env node
//
// Rescue guides that generated successfully but were never saved.
//
// Before finalization moved into the worker, a guide was only written to the
// database when the actor's browser polled for the finished job. Anyone who
// closed the tab mid-generation lost the guide even though the worker had
// produced it — it stayed in Redis as the job's return value and nothing ever
// picked it up.
//
// BullMQ keeps the last 100 completed jobs (removeOnComplete), so recently
// stranded guides are still recoverable. This walks them, finds the ones with
// no matching Guides row, and finalizes them properly: saved, credited, and
// emailed to the actor.
//
//   node scripts/recover-stuck-guides.js            # report only
//   node scripts/recover-stuck-guides.js --apply    # actually finalize
//
require("dotenv").config();

const { getGuideQueue } = require("../services/guideQueue");
const { finalizeGuideJob, findGuideByGuideId } = require("../services/guideFinalizer");
const { isSupabaseAdminConfigured } = require("../lib/supabaseAdmin");

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.env.RECOVER_LIMIT || 200);

async function main() {
  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is required to read completed jobs.");
    process.exit(1);
  }
  if (!isSupabaseAdminConfigured()) {
    console.error("Supabase admin credentials are required to save recovered guides.");
    process.exit(1);
  }

  const queue = getGuideQueue();
  if (!queue) {
    console.error("Guide queue unavailable.");
    process.exit(1);
  }

  const jobs = await queue.getJobs(["completed"], 0, LIMIT - 1);
  console.log(`Scanning ${jobs.length} completed job(s)${APPLY ? "" : " (dry run)"}...\n`);

  const stranded = [];

  for (const job of jobs) {
    const result = job.returnvalue;
    const guidePayload = result?.guidePayload;
    if (!guidePayload?.guideId) continue; // bold_choices and malformed results

    const existing = await findGuideByGuideId(guidePayload.guideId);
    if (existing) continue;

    stranded.push({ job, guidePayload, isReaderMode: Boolean(result.isReaderMode) });
  }

  if (!stranded.length) {
    console.log("No stranded guides found. Everything that finished is saved.");
    return;
  }

  console.log(`Found ${stranded.length} generated-but-unsaved guide(s):\n`);
  for (const { job, guidePayload } of stranded) {
    const when = job.finishedOn ? new Date(job.finishedOn).toISOString() : "unknown";
    console.log(
      `  job ${job.id}  ${guidePayload.guideType || "prep101"}  ` +
        `${guidePayload.characterName} — ${guidePayload.productionTitle}  ` +
        `(user ${guidePayload.userId}, finished ${when})`
    );
  }

  if (!APPLY) {
    console.log("\nRe-run with --apply to save and email these.");
    return;
  }

  console.log("\nFinalizing...\n");
  let saved = 0;
  let skipped = 0;

  for (const { job, guidePayload, isReaderMode } of stranded) {
    const outcome = await finalizeGuideJob({
      guidePayload,
      isReaderMode,
      source: "recovery-script",
    });

    if (outcome.finalized && !outcome.alreadyPersisted) {
      saved += 1;
      console.log(`  ✅ job ${job.id} saved${outcome.emailed ? " and emailed" : " (no email sent)"}`);
    } else if (outcome.alreadyPersisted) {
      console.log(`  ↷  job ${job.id} already saved by someone else`);
    } else {
      skipped += 1;
      console.log(`  ⚠️  job ${job.id} skipped: ${outcome.reason}${outcome.missing ? ` (${outcome.missing.join(", ")})` : ""}`);
    }
  }

  console.log(`\nDone. ${saved} recovered, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error("Recovery failed:", error);
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
