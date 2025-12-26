/**
 * Queue Configuration Module
 * 
 * Task 10.3: Central queue configuration using BullMQ
 * Provides queue instances and common configuration
 */

const { logger } = require('../utils/logger');

/**
 * Redis connection configuration for queues
 */
function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB) || 1, // Use separate DB for queues
    maxRetriesPerRequest: null, // Required for BullMQ
  };
}

/**
 * Default queue options
 */
const DEFAULT_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
};

/**
 * Queue names
 */
const QUEUE_NAMES = {
  CAMPAIGN: 'campaign',
  IMPORT: 'import',
  REPORT: 'report',
  NOTIFICATION: 'notification',
  WEBHOOK: 'webhook',
};

/**
 * Queue instances cache
 */
const queues = new Map();

/**
 * Check if BullMQ is available
 */
function isBullMQAvailable() {
  try {
    require('bullmq');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create a queue instance
 * 
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @returns {Queue|null} Queue instance or null if BullMQ not available
 */
function getQueue(name, options = {}) {
  if (!isBullMQAvailable()) {
    logger.warn('BullMQ not available, queue operations will be synchronous', { queue: name });
    return null;
  }

  if (queues.has(name)) {
    return queues.get(name);
  }

  try {
    const { Queue } = require('bullmq');
    
    const queue = new Queue(name, {
      connection: getRedisConfig(),
      ...DEFAULT_QUEUE_OPTIONS,
      ...options,
    });

    queue.on('error', (error) => {
      logger.error('Queue error', { queue: name, error: error.message });
    });

    queues.set(name, queue);
    logger.info('Queue created', { queue: name });
    
    return queue;
  } catch (error) {
    logger.error('Failed to create queue', { queue: name, error: error.message });
    return null;
  }
}

/**
 * Add a job to a queue
 * 
 * @param {string} queueName - Queue name
 * @param {string} jobName - Job name
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance or null
 */
async function addJob(queueName, jobName, data, options = {}) {
  const queue = getQueue(queueName);
  
  if (!queue) {
    // Fallback: execute synchronously
    logger.warn('Queue not available, executing job synchronously', { queue: queueName, job: jobName });
    return null;
  }

  try {
    const job = await queue.add(jobName, data, options);
    logger.debug('Job added to queue', { queue: queueName, job: jobName, jobId: job.id });
    return job;
  } catch (error) {
    logger.error('Failed to add job to queue', { queue: queueName, job: jobName, error: error.message });
    return null;
  }
}

/**
 * Get queue statistics
 * 
 * @param {string} queueName - Queue name
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats(queueName) {
  const queue = getQueue(queueName);
  
  if (!queue) {
    return { available: false };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      available: true,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { queue: queueName, error: error.message });
    return { available: false, error: error.message };
  }
}

/**
 * Get all queues statistics
 * 
 * @returns {Promise<Object>} All queues statistics
 */
async function getAllQueuesStats() {
  const stats = {};
  
  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }
  
  return stats;
}

/**
 * Close all queue connections
 */
async function closeAllQueues() {
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info('Queue closed', { queue: name });
    } catch (error) {
      logger.error('Failed to close queue', { queue: name, error: error.message });
    }
  }
  queues.clear();
}

module.exports = {
  getQueue,
  addJob,
  getQueueStats,
  getAllQueuesStats,
  closeAllQueues,
  getRedisConfig,
  QUEUE_NAMES,
  DEFAULT_QUEUE_OPTIONS,
  isBullMQAvailable,
};
