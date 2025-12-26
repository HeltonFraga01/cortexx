/**
 * Import Queue Module
 * 
 * Task 10.5: Queue for processing contact imports
 * Handles CSV/Excel file imports with validation and batch processing
 */

const { getQueue, addJob, QUEUE_NAMES } = require('./index');
const { logger } = require('../utils/logger');

/**
 * Import job types
 */
const IMPORT_JOB_TYPES = {
  PROCESS_FILE: 'process-file',
  VALIDATE_CONTACTS: 'validate-contacts',
  INSERT_BATCH: 'insert-batch',
  FINALIZE_IMPORT: 'finalize-import',
};

/**
 * Import job priorities
 */
const IMPORT_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
};

/**
 * Get the import queue instance
 * 
 * @returns {Queue|null} Import queue instance
 */
function getImportQueue() {
  return getQueue(QUEUE_NAMES.IMPORT, {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
      removeOnComplete: {
        count: 200,
        age: 6 * 3600, // 6 hours
      },
      removeOnFail: {
        count: 500,
        age: 24 * 3600, // 24 hours
      },
    },
  });
}

/**
 * Add a file import job to the queue
 * 
 * @param {Object} importData - Import data
 * @param {string} importData.importId - Import ID
 * @param {string} importData.userId - User ID
 * @param {string} importData.tenantId - Tenant ID
 * @param {string} importData.filePath - Path to uploaded file
 * @param {string} importData.fileType - File type (csv, xlsx)
 * @param {Object} importData.fieldMapping - Field mapping configuration
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addImportJob(importData, options = {}) {
  const { importId, userId, tenantId, fileType } = importData;
  
  logger.info('Adding import job to queue', {
    importId,
    userId,
    tenantId,
    fileType,
  });

  return addJob(
    QUEUE_NAMES.IMPORT,
    IMPORT_JOB_TYPES.PROCESS_FILE,
    importData,
    {
      priority: IMPORT_PRIORITIES.NORMAL,
      jobId: `import-${importId}`,
      ...options,
    }
  );
}

/**
 * Add a validation job for contacts
 * 
 * @param {Object} validationData - Validation data
 * @param {string} validationData.importId - Import ID
 * @param {Array} validationData.contacts - Contacts to validate
 * @param {number} validationData.batchIndex - Batch index
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addValidationJob(validationData, options = {}) {
  const { importId, batchIndex } = validationData;
  
  return addJob(
    QUEUE_NAMES.IMPORT,
    IMPORT_JOB_TYPES.VALIDATE_CONTACTS,
    validationData,
    {
      priority: IMPORT_PRIORITIES.NORMAL,
      jobId: `validate-${importId}-${batchIndex}`,
      ...options,
    }
  );
}

/**
 * Add a batch insert job
 * 
 * @param {Object} batchData - Batch data
 * @param {string} batchData.importId - Import ID
 * @param {Array} batchData.contacts - Validated contacts to insert
 * @param {number} batchData.batchIndex - Batch index
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addInsertBatchJob(batchData, options = {}) {
  const { importId, batchIndex } = batchData;
  
  return addJob(
    QUEUE_NAMES.IMPORT,
    IMPORT_JOB_TYPES.INSERT_BATCH,
    batchData,
    {
      priority: IMPORT_PRIORITIES.NORMAL,
      jobId: `insert-${importId}-${batchIndex}`,
      ...options,
    }
  );
}

/**
 * Add an import finalization job
 * 
 * @param {Object} finalizeData - Finalization data
 * @param {string} finalizeData.importId - Import ID
 * @param {number} finalizeData.totalProcessed - Total contacts processed
 * @param {number} finalizeData.totalSuccess - Total successful imports
 * @param {number} finalizeData.totalFailed - Total failed imports
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addFinalizeImportJob(finalizeData, options = {}) {
  const { importId } = finalizeData;
  
  return addJob(
    QUEUE_NAMES.IMPORT,
    IMPORT_JOB_TYPES.FINALIZE_IMPORT,
    finalizeData,
    {
      priority: IMPORT_PRIORITIES.LOW,
      jobId: `finalize-import-${importId}`,
      ...options,
    }
  );
}

/**
 * Get import job status
 * 
 * @param {string} importId - Import ID
 * @returns {Promise<Object|null>} Job status
 */
async function getImportJobStatus(importId) {
  const queue = getImportQueue();
  
  if (!queue) {
    return null;
  }

  try {
    const job = await queue.getJob(`import-${importId}`);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      state,
      progress,
      data: {
        importId: job.data.importId,
        fileType: job.data.fileType,
        totalContacts: job.data.totalContacts,
      },
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    logger.error('Failed to get import job status', { importId, error: error.message });
    return null;
  }
}

module.exports = {
  getImportQueue,
  addImportJob,
  addValidationJob,
  addInsertBatchJob,
  addFinalizeImportJob,
  getImportJobStatus,
  IMPORT_JOB_TYPES,
  IMPORT_PRIORITIES,
};
