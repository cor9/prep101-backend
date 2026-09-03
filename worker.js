// Runs as a standalone process on Railway/Render.
// This is not a Vercel function. It connects to the same Redis and Supabase
// as the Vercel API and processes BullMQ guide generation jobs.

require("dotenv").config();

const guideQueue = require("./services/guideQueue");
const { startGuideWorker } = guideQueue;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const canFinalize = Boolean(process.env.SUPABASE_URL && supabaseKey);
const canEmail = Boolean(
  process.env.SES_SMTP_HOST &&
    process.env.SES_SMTP_USER &&
    process.env.SES_SMTP_PASS &&
    process.env.EMAIL_FROM
);

console.log("Prep101 Guide Worker starting...");
console.log(`   Redis: ${process.env.REDIS_URL ? "configured" : "MISSING"}`);
console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? "configured" : "MISSING"}`);
console.log(`   Supabase: ${canFinalize ? "configured" : "MISSING"}`);
console.log(`   Email (SES): ${canEmail ? "configured" : "MISSING"}`);
console.log(`   Concurrency: ${process.env.GUIDE_WORKER_CONCURRENCY || 2}`);

// The worker saves and emails the guide now, so these are no longer the API's
// business alone. Without them a guide still generates, but it goes back to
// being saved only if the actor's browser is still polling — the exact failure
// that lost every guide between May and September. Say so loudly rather than
// letting it look healthy.
if (!canFinalize) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set. This worker " +
      "cannot save generated guides; they will only persist if a browser is " +
      "still polling when the job finishes. Set them on the worker service."
  );
}
if (!canEmail) {
  console.warn(
    "SES SMTP is not configured on the worker (SES_SMTP_HOST, SES_SMTP_USER, " +
      "SES_SMTP_PASS, EMAIL_FROM). Guides will save but nobody will be emailed."
  );
}

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL is required. Exiting.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required. Exiting.");
  process.exit(1);
}

// A worker that cannot load the processor would accept jobs and fail every one
// of them. Refuse to start instead, so a broken deploy is obvious immediately.
if (guideQueue.processorLoadError) {
  console.error(
    "Guide processor failed to load; refusing to start the worker.",
    guideQueue.processorLoadError
  );
  process.exit(1);
}

const worker = startGuideWorker();

if (!worker) {
  console.error("Worker failed to start. Check REDIS_URL. Exiting.");
  process.exit(1);
}

console.log("Guide worker running. Waiting for jobs...");

async function shutdown(signal) {
  console.log(`${signal} received; closing worker gracefully...`);
  await worker.close();
  console.log("Worker closed.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in worker:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in worker:", reason);
});
