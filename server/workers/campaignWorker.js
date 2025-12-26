/**
 * Campaign Worker Module
 * 
 * Task 10.8: Worker for processing campaign jobs
 * Handles message sending with rate limiting and progress tracking
 */

const { logger } = require('../utils/logger');
const { getRedisConfig, QUEUE_NAMES } = require('../queues/index');
const { CAMPAIGN_JOB_TYPES } = require('../queues/campaignQueue');

/**
 * Rate limiting configuration per plan
 */
const RATE_LIMITS = {
  free: { messagesPerMinute: 10, batchSize: 50 },
  pro: { messagesPerMinute: 30, batchSize: 200 },
  enterprise: { messagesPerMinute: 60, batchSize: 500 },
};

/**
 * Default rate limit for unknown plans
 */
const DEFAULT_RATE_LIMIT = RATE_LIMITS.free;

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
 * Process a campaign job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Processing result
 */
async function processCampaign(job) {
  const { campaignId, userId, tenantId, contacts, messageTemplate, inboxId } = job.data;
  
  logger.info('Processing campaign', { campaignId, userId, contactCount: contacts.length });
  
  const results = {
    total: contacts.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Get rate limit based on plan (would normally fetch from DB)
  const rateLimit = DEFAULT_RATE_LIMIT;
  const delayBetweenMessages = Math.ceil(60000 / rateLimit.messagesPerMinute);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    
    try {
      // Simulate message sending (replace with actual wuzapiClient call)
      await sendMessage(inboxId, contact, messageTemplate);
      results.sent++;
      
      // Update progress
      const progress = Math.round(((i + 1) / contacts.length) * 100);
      await job.updateProgress(progress);
      
      logger.debug('Message sent', { campaignId, contactId: contact.id, progress });
      
      // Rate limiting delay
      if (i < contacts.length - 1) {
        await sleep(delayBetweenMessages);
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        contactId: contact.id,
        phone: contact.phone,
        error: error.message,
      });
      
      logger.warn('Failed to send message', {
        campaignId,
        contactId: contact.id,
        error: error.message,
      });
    }
  }

  logger.info('Campaign completed', {
    campaignId,
    total: results.total,
    sent: results.sent,
    failed: results.failed,
  });

  return results;
}

/**
 * Process a single message job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Processing result
 */
async function processMessage(job) {
  const { campaignId, contactId, phone, message, inboxId } = job.data;
  
  logger.debug('Processing message', { campaignId, contactId, phone });
  
  try {
    await sendMessage(inboxId, { phone }, message);
    
    return { success: true, contactId, phone };
  } catch (error) {
    logger.error('Failed to process message', {
      campaignId,
      contactId,
      error: error.message,
    });
    
    throw error; // Let BullMQ handle retry
  }
}

/**
 * Process a batch of messages
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Processing result
 */
async function processBatch(job) {
  const { campaignId, batchIndex, contacts, messageTemplate, inboxId } = job.data;
  
  logger.info('Processing batch', { campaignId, batchIndex, contactCount: contacts.length });
  
  const results = {
    batchIndex,
    total: contacts.length,
    sent: 0,
    failed: 0,
  };

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    
    try {
      await sendMessage(inboxId, contact, messageTemplate);
      results.sent++;
      
      const progress = Math.round(((i + 1) / contacts.length) * 100);
      await job.updateProgress(progress);
    } catch (error) {
      results.failed++;
      logger.warn('Batch message failed', { campaignId, batchIndex, contactId: contact.id });
    }
  }

  return results;
}

/**
 * Finalize a campaign
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Finalization result
 */
async function finalizeCampaign(job) {
  const { campaignId, totalSent, totalFailed } = job.data;
  
  logger.info('Finalizing campaign', { campaignId, totalSent, totalFailed });
  
  // Update campaign status in database (would use SupabaseService)
  // await updateCampaignStatus(campaignId, 'completed', { totalSent, totalFailed });
  
  return {
    campaignId,
    status: 'completed',
    totalSent,
    totalFailed,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Send a message (placeholder - replace with actual implementation)
 * 
 * @param {string} inboxId - Inbox ID
 * @param {Object} contact - Contact object
 * @param {string} template - Message template
 */
async function sendMessage(inboxId, contact, template) {
  // Replace with actual wuzapiClient.sendMessage call
  // const wuzapiClient = require('../utils/wuzapiClient');
  // await wuzapiClient.sendMessage(inboxId, contact.phone, template);
  
  // Simulate network delay
  await sleep(100 + Math.random() * 200);
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error('Simulated send failure');
  }
}

/**
 * Sleep utility
 * 
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create and start the campaign worker
 * 
 * @param {Object} options - Worker options
 * @returns {Worker|null} Worker instance or null if BullMQ not available
 */
function createCampaignWorker(options = {}) {
  if (!isBullMQAvailable()) {
    logger.warn('BullMQ not available, campaign worker not started');
    return null;
  }

  try {
    const { Worker } = require('bullmq');
    
    const worker = new Worker(
      QUEUE_NAMES.CAMPAIGN,
      async (job) => {
        switch (job.name) {
          case CAMPAIGN_JOB_TYPES.SEND_CAMPAIGN:
            return processCampaign(job);
          case CAMPAIGN_JOB_TYPES.SEND_MESSAGE:
            return processMessage(job);
          case CAMPAIGN_JOB_TYPES.PROCESS_BATCH:
            return processBatch(job);
          case CAMPAIGN_JOB_TYPES.FINALIZE_CAMPAIGN:
            return finalizeCampaign(job);
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      },
      {
        connection: getRedisConfig(),
        concurrency: options.concurrency || 5,
        limiter: {
          max: options.maxJobsPerSecond || 10,
          duration: 1000,
        },
      }
    );

    worker.on('completed', (job, result) => {
      logger.info('Campaign job completed', { jobId: job.id, jobName: job.name });
    });

    worker.on('failed', (job, error) => {
      logger.error('Campaign job failed', {
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    worker.on('error', (error) => {
      logger.error('Campaign worker error', { error: error.message });
    });

    logger.info('Campaign worker started', { concurrency: options.concurrency || 5 });
    
    return worker;
  } catch (error) {
    logger.error('Failed to create campaign worker', { error: error.message });
    return null;
  }
}

module.exports = {
  createCampaignWorker,
  processCampaign,
  processMessage,
  processBatch,
  finalizeCampaign,
  RATE_LIMITS,
};
