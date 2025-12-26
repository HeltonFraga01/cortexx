/**
 * Campaign Queue Module
 * 
 * Task 10.4: Queue for processing bulk message campaigns
 * Handles campaign message sending with rate limiting and retry logic
 */

const { getQueue, addJob, QUEUE_NAMES } = require('./index');
const { logger } = require('../utils/logger');

/**
 * Campaign job types
 */
const CAMPAIGN_JOB_TYPES = {
  SEND_CAMPAIGN: 'send-campaign',
  SEND_MESSAGE: 'send-message',
  PROCESS_BATCH: 'process-batch',
  FINALIZE_CAMPAIGN: 'finalize-campaign',
};

/**
 * Campaign job priorities
 */
const CAMPAIGN_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
};

/**
 * Get the campaign queue instance
 * 
 * @returns {Queue|null} Campaign queue instance
 */
function getCampaignQueue() {
  return getQueue(QUEUE_NAMES.CAMPAIGN, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2s delay for rate limiting
      },
      removeOnComplete: {
        count: 500,
        age: 12 * 3600, // 12 hours
      },
      removeOnFail: {
        count: 2000,
        age: 3 * 24 * 3600, // 3 days
      },
    },
  });
}

/**
 * Add a campaign to the queue
 * 
 * @param {Object} campaignData - Campaign data
 * @param {string} campaignData.campaignId - Campaign ID
 * @param {string} campaignData.userId - User ID
 * @param {string} campaignData.tenantId - Tenant ID
 * @param {string} campaignData.inboxId - Inbox ID
 * @param {Array} campaignData.contacts - List of contacts
 * @param {string} campaignData.messageTemplate - Message template
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addCampaignJob(campaignData, options = {}) {
  const { campaignId, userId, tenantId, contacts } = campaignData;
  
  logger.info('Adding campaign to queue', {
    campaignId,
    userId,
    tenantId,
    contactCount: contacts?.length || 0,
  });

  return addJob(
    QUEUE_NAMES.CAMPAIGN,
    CAMPAIGN_JOB_TYPES.SEND_CAMPAIGN,
    campaignData,
    {
      priority: CAMPAIGN_PRIORITIES.NORMAL,
      jobId: `campaign-${campaignId}`,
      ...options,
    }
  );
}

/**
 * Add a single message job to the queue
 * 
 * @param {Object} messageData - Message data
 * @param {string} messageData.campaignId - Campaign ID
 * @param {string} messageData.contactId - Contact ID
 * @param {string} messageData.phone - Phone number
 * @param {string} messageData.message - Message text
 * @param {string} messageData.inboxId - Inbox ID
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addMessageJob(messageData, options = {}) {
  const { campaignId, contactId, phone } = messageData;
  
  return addJob(
    QUEUE_NAMES.CAMPAIGN,
    CAMPAIGN_JOB_TYPES.SEND_MESSAGE,
    messageData,
    {
      priority: CAMPAIGN_PRIORITIES.NORMAL,
      jobId: `msg-${campaignId}-${contactId}`,
      delay: options.delay || 0, // Support delayed sending for rate limiting
      ...options,
    }
  );
}

/**
 * Add a batch processing job
 * 
 * @param {Object} batchData - Batch data
 * @param {string} batchData.campaignId - Campaign ID
 * @param {number} batchData.batchIndex - Batch index
 * @param {Array} batchData.contacts - Contacts in this batch
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addBatchJob(batchData, options = {}) {
  const { campaignId, batchIndex } = batchData;
  
  return addJob(
    QUEUE_NAMES.CAMPAIGN,
    CAMPAIGN_JOB_TYPES.PROCESS_BATCH,
    batchData,
    {
      priority: CAMPAIGN_PRIORITIES.NORMAL,
      jobId: `batch-${campaignId}-${batchIndex}`,
      ...options,
    }
  );
}

/**
 * Add a campaign finalization job
 * 
 * @param {Object} finalizeData - Finalization data
 * @param {string} finalizeData.campaignId - Campaign ID
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addFinalizeJob(finalizeData, options = {}) {
  const { campaignId } = finalizeData;
  
  return addJob(
    QUEUE_NAMES.CAMPAIGN,
    CAMPAIGN_JOB_TYPES.FINALIZE_CAMPAIGN,
    finalizeData,
    {
      priority: CAMPAIGN_PRIORITIES.LOW,
      jobId: `finalize-${campaignId}`,
      ...options,
    }
  );
}

/**
 * Get campaign job status
 * 
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object|null>} Job status
 */
async function getCampaignJobStatus(campaignId) {
  const queue = getCampaignQueue();
  
  if (!queue) {
    return null;
  }

  try {
    const job = await queue.getJob(`campaign-${campaignId}`);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    logger.error('Failed to get campaign job status', { campaignId, error: error.message });
    return null;
  }
}

module.exports = {
  getCampaignQueue,
  addCampaignJob,
  addMessageJob,
  addBatchJob,
  addFinalizeJob,
  getCampaignJobStatus,
  CAMPAIGN_JOB_TYPES,
  CAMPAIGN_PRIORITIES,
};
