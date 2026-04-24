const { Queue, Worker, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");

// Provide a placeholder so backend doesn't crash before processor is created
let processGuideJob = async () => { throw new Error("Processor not implemented yet"); };

try {
  const processor = require("./guideJobProcessor");
  processGuideJob = processor.processGuideJob;
} catch (error) {
  console.warn("⚠️ Guide processor not fully available yet:", error.message);
}

const QUEUE_NAME = "guide-generation-jobs";
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

function getGuideQueue() {
  if (!useRedisQueue) return null;
  if (queueSingleton) return queueSingleton;
  const connection = getRedisConnection();
  queueSingleton = new Queue(QUEUE_NAME, { connection });
  return queueSingleton;
}

function getGuideQueueEvents() {
  if (!useRedisQueue) return null;
  if (queueEventsSingleton) return queueEventsSingleton;
  const connection = getRedisConnection();
  queueEventsSingleton = new QueueEvents(QUEUE_NAME, { connection });
  return queueEventsSingleton;
}

function startGuideWorker() {
  if (!useRedisQueue) return null;
  if (workerSingleton) return workerSingleton;
  const connection = getRedisConnection();

  workerSingleton = new Worker(
    QUEUE_NAME,
    async (job) => {
      // Pass the job instance so the processor can update progress
      return processGuideJob(job.data || {}, job);
    },
    {
      connection,
      concurrency: Number(process.env.GUIDE_WORKER_CONCURRENCY || 5),
      // guides can take a while
      lockDuration: 600000, 
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    }
  );

  workerSingleton.on("failed", (job, err) => {
    console.error(`[GuideWorker] Job ${job?.id} failed:`, err.message);
  });

  return workerSingleton;
}

// Custom progress updater for in-memory jobs
async function updateJobProgress(jobId, progress, statusMessage) {
  if (!useRedisQueue) {
    const job = inMemoryJobs.get(String(jobId));
    if (job) {
      job.progress = progress;
      job.statusMessage = statusMessage;
      inMemoryJobs.set(String(jobId), job);
    }
    return;
  }
  
  // For BullMQ, the job processor itself should update progress using job.updateProgress()
}

async function enqueueGuideJob(payload = {}) {
  if (!useRedisQueue) {
    const id = String(++inMemoryJobCounter);
    const now = Date.now();
    const record = {
      id,
      state: "waiting",
      progress: 0,
      statusMessage: "Job queued...",
      data: payload,
      result: null,
      failedReason: null,
      timestamp: now,
      processedOn: null,
      finishedOn: null,
    };
    inMemoryJobs.set(id, record);

    // Run asynchronously
    setImmediate(async () => {
      const active = inMemoryJobs.get(id);
      if (!active) return;
      active.state = "active";
      active.progress = 5;
      active.statusMessage = "Starting generation...";
      active.processedOn = Date.now();
      inMemoryJobs.set(id, active);
      
      try {
        // Pass a mock job object for progress updates
        const mockJob = {
          id,
          data: payload,
          updateProgress: async (prog) => {
            let progressValue = prog;
            let statusStr = "";
            if (typeof prog === 'object') {
              progressValue = prog.percent;
              statusStr = prog.status;
            }
            active.progress = progressValue;
            active.statusMessage = statusStr || active.statusMessage;
            inMemoryJobs.set(id, active);
          }
        };
        
        const result = await processGuideJob(payload, mockJob);
        
        inMemoryJobs.set(id, {
          ...active,
          state: "completed",
          progress: 100,
          statusMessage: "Completed",
          result,
          finishedOn: Date.now(),
        });
      } catch (error) {
        console.error(`[Guide Queue] In-memory job ${id} failed:`, error);
        inMemoryJobs.set(id, {
          ...active,
          state: "failed",
          progress: 100,
          statusMessage: "Failed",
          failedReason: error.message,
          finishedOn: Date.now(),
        });
      }
    });

    return { id };
  }

  const queue = getGuideQueue();
  const job = await queue.add("generate-guide", payload, {
    attempts: 1, // Don't auto-retry long generations
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
  return job;
}

async function getGuideJob(jobId) {
  if (!useRedisQueue) {
    const job = inMemoryJobs.get(String(jobId));
    if (!job) return null;
    return {
      id: String(job.id),
      state: job.state,
      progress: job.progress || 0,
      statusMessage: job.statusMessage || "",
      data: job.data,
      result: job.state === "completed" ? job.result : null,
      failedReason: job.state === "failed" ? job.failedReason : null,
      timestamp: job.timestamp,
      processedOn: job.processedOn || null,
      finishedOn: job.finishedOn || null,
    };
  }

  const queue = getGuideQueue();
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  
  // BullMQ stores progress
  let progress = job.progress || 0;
  let statusMessage = "";
  
  if (typeof progress === 'object') {
    statusMessage = progress.status || "";
    progress = progress.percent || 0;
  }
  
  return {
    id: String(job.id),
    state,
    progress,
    statusMessage,
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
  enqueueGuideJob,
  getGuideJob,
  getGuideQueue,
  getGuideQueueEvents,
  startGuideWorker,
  updateJobProgress
};
