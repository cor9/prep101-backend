const { Queue, Worker, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
const { processPdfExtractionJob } = require("./pdfExtractionJobProcessor");

const QUEUE_NAME = "pdf-extraction-jobs";
const useRedisQueue = Boolean(process.env.REDIS_URL);
let queueSingleton = null;
let queueEventsSingleton = null;
let workerSingleton = null;
const inMemoryJobs = new Map();
let inMemoryJobCounter = 0;

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
  if (!useRedisQueue) return null;
  if (queueSingleton) return queueSingleton;
  const connection = getRedisConnection();
  queueSingleton = new Queue(QUEUE_NAME, { connection });
  return queueSingleton;
}

function getQueueEvents() {
  if (!useRedisQueue) return null;
  if (queueEventsSingleton) return queueEventsSingleton;
  const connection = getRedisConnection();
  queueEventsSingleton = new QueueEvents(QUEUE_NAME, { connection });
  return queueEventsSingleton;
}

function startExtractionWorker() {
  if (!useRedisQueue) return null;
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
  if (!useRedisQueue) {
    const id = String(++inMemoryJobCounter);
    const now = Date.now();
    const record = {
      id,
      state: "waiting",
      progress: 0,
      data: payload,
      result: null,
      failedReason: null,
      timestamp: now,
      processedOn: null,
      finishedOn: null,
    };
    inMemoryJobs.set(id, record);

    setImmediate(async () => {
      const active = inMemoryJobs.get(id);
      if (!active) return;
      active.state = "active";
      active.progress = 10;
      active.processedOn = Date.now();
      inMemoryJobs.set(id, active);
      try {
        const result = await processPdfExtractionJob(payload);
        inMemoryJobs.set(id, {
          ...active,
          state: "completed",
          progress: 100,
          result,
          finishedOn: Date.now(),
        });
      } catch (error) {
        inMemoryJobs.set(id, {
          ...active,
          state: "failed",
          progress: 100,
          failedReason: error.message,
          finishedOn: Date.now(),
        });
      }
    });

    return { id };
  }

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
  if (!useRedisQueue) {
    const job = inMemoryJobs.get(String(jobId));
    if (!job) return null;
    return {
      id: String(job.id),
      state: job.state,
      progress: job.progress || 0,
      data: job.data,
      result: job.state === "completed" ? job.result : null,
      failedReason: job.state === "failed" ? job.failedReason : null,
      timestamp: job.timestamp,
      processedOn: job.processedOn || null,
      finishedOn: job.finishedOn || null,
    };
  }

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
