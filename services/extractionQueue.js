const { Queue, Worker, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
const { processPdfExtractionJob } = require("./pdfExtractionJobProcessor");

const QUEUE_NAME = "pdf-extraction-jobs";
let queueSingleton = null;
let queueEventsSingleton = null;
let workerSingleton = null;

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured for BullMQ.");
  }
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

function getQueue() {
  if (queueSingleton) return queueSingleton;
  const connection = getRedisConnection();
  queueSingleton = new Queue(QUEUE_NAME, { connection });
  return queueSingleton;
}

function getQueueEvents() {
  if (queueEventsSingleton) return queueEventsSingleton;
  const connection = getRedisConnection();
  queueEventsSingleton = new QueueEvents(QUEUE_NAME, { connection });
  return queueEventsSingleton;
}

function startExtractionWorker() {
  if (workerSingleton) return workerSingleton;
  const connection = getRedisConnection();

  workerSingleton = new Worker(
    QUEUE_NAME,
    async (job) => {
      return processPdfExtractionJob(job.data || {});
    },
    {
      connection,
      concurrency: Number(process.env.EXTRACTION_WORKER_CONCURRENCY || 2),
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    }
  );

  workerSingleton.on("failed", (job, err) => {
    console.error(`[ExtractionWorker] Job ${job?.id} failed:`, err.message);
  });

  return workerSingleton;
}

async function enqueueExtractionJob(payload = {}) {
  const queue = getQueue();
  const job = await queue.add("extract-pdf", payload, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
  return job;
}

async function getExtractionJob(jobId) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: String(job.id),
    state,
    progress: job.progress || 0,
    data: job.data,
    result: state === "completed" ? job.returnvalue : null,
    failedReason: state === "failed" ? job.failedReason : null,
    timestamp: job.timestamp,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
  };
}

module.exports = {
  QUEUE_NAME,
  enqueueExtractionJob,
  getExtractionJob,
  getQueue,
  getQueueEvents,
  startExtractionWorker,
};
