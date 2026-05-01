// Runs as a standalone process on Railway/Render.
// This is not a Vercel function. It connects to the same Redis and Supabase
// as the Vercel API and processes BullMQ guide generation jobs.

require("dotenv").config();

const { startGuideWorker } = require("./services/guideQueue");

console.log("Prep101 Guide Worker starting...");
console.log(`   Redis: ${process.env.REDIS_URL ? "configured" : "MISSING"}`);
console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? "configured" : "MISSING"}`);
console.log(`   Supabase: ${process.env.SUPABASE_URL ? "configured" : "MISSING"}`);
console.log(`   Concurrency: ${process.env.GUIDE_WORKER_CONCURRENCY || 2}`);

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL is required. Exiting.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required. Exiting.");
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
