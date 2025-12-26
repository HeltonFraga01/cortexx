/**
 * Import Worker Module
 * 
 * Task 10.9: Worker for processing contact imports
 * Handles file parsing, validation, and batch insertion
 */

const { logger } = require('../utils/logger');
const { getRedisConfig, QUEUE_NAMES } = require('../queues/index');
const { IMPORT_JOB_TYPES } = require('../queues/importQueue');

/**
 * Batch size for processing
 */
const BATCH_SIZE = 100;

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
 * Process a file import job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Processing result
 */
async function processFileImport(job) {
  const { importId, userId, tenantId, filePath, fileType, fieldMapping } = job.data;
  
  logger.info('Processing file import', { importId, userId, fileType });
  
  try {
    // Parse file based on type
    const contacts = await parseFile(filePath, fileType);
    
    logger.info('File parsed', { importId, contactCount: contacts.length });
    
    // Update job with total contacts
    await job.updateProgress(10);
    
    // Validate contacts
    const validationResults = await validateContacts(contacts, fieldMapping);
    
    await job.updateProgress(30);
    
    // Insert valid contacts in batches
    const insertResults = await insertContactsBatched(
      validationResults.valid,
      tenantId,
      userId,
      job
    );
    
    const result = {
      importId,
      totalParsed: contacts.length,
      totalValid: validationResults.valid.length,
      totalInvalid: validationResults.invalid.length,
      totalInserted: insertResults.inserted,
      totalFailed: insertResults.failed,
      errors: [
        ...validationResults.errors.slice(0, 10), // Limit errors
        ...insertResults.errors.slice(0, 10),
      ],
    };
    
    logger.info('Import completed', result);
    
    return result;
  } catch (error) {
    logger.error('Import failed', { importId, error: error.message });
    throw error;
  }
}

/**
 * Parse file based on type
 * 
 * @param {string} filePath - Path to file
 * @param {string} fileType - File type (csv, xlsx)
 * @returns {Promise<Array>} Parsed contacts
 */
async function parseFile(filePath, fileType) {
  // Placeholder - replace with actual file parsing
  // For CSV: use csv-parse
  // For XLSX: use xlsx or exceljs
  
  logger.debug('Parsing file', { filePath, fileType });
  
  // Simulate parsing
  await sleep(500);
  
  // Return mock data for now
  return [
    { name: 'Contact 1', phone: '5511999999999', email: 'contact1@example.com' },
    { name: 'Contact 2', phone: '5511888888888', email: 'contact2@example.com' },
  ];
}

/**
 * Validate contacts against field mapping
 * 
 * @param {Array} contacts - Contacts to validate
 * @param {Object} fieldMapping - Field mapping configuration
 * @returns {Promise<Object>} Validation results
 */
async function validateContacts(contacts, fieldMapping) {
  const valid = [];
  const invalid = [];
  const errors = [];
  
  for (const contact of contacts) {
    const validationResult = validateContact(contact, fieldMapping);
    
    if (validationResult.isValid) {
      valid.push(validationResult.contact);
    } else {
      invalid.push(contact);
      errors.push({
        contact: contact.name || contact.phone,
        errors: validationResult.errors,
      });
    }
  }
  
  return { valid, invalid, errors };
}

/**
 * Validate a single contact
 * 
 * @param {Object} contact - Contact to validate
 * @param {Object} fieldMapping - Field mapping
 * @returns {Object} Validation result
 */
function validateContact(contact, fieldMapping) {
  const errors = [];
  
  // Validate phone number
  if (!contact.phone) {
    errors.push('Phone number is required');
  } else if (!isValidPhone(contact.phone)) {
    errors.push('Invalid phone number format');
  }
  
  // Validate email if present
  if (contact.email && !isValidEmail(contact.email)) {
    errors.push('Invalid email format');
  }
  
  return {
    isValid: errors.length === 0,
    contact: errors.length === 0 ? normalizeContact(contact) : null,
    errors,
  };
}

/**
 * Validate phone number format
 * 
 * @param {string} phone - Phone number
 * @returns {boolean} Is valid
 */
function isValidPhone(phone) {
  // Brazilian phone format: 55 + DDD (2 digits) + number (8-9 digits)
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 13;
}

/**
 * Validate email format
 * 
 * @param {string} email - Email address
 * @returns {boolean} Is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize contact data
 * 
 * @param {Object} contact - Contact to normalize
 * @returns {Object} Normalized contact
 */
function normalizeContact(contact) {
  return {
    name: contact.name?.trim() || '',
    phone: contact.phone.replace(/\D/g, ''),
    email: contact.email?.toLowerCase().trim() || null,
    tags: contact.tags || [],
    metadata: contact.metadata || {},
  };
}

/**
 * Insert contacts in batches
 * 
 * @param {Array} contacts - Contacts to insert
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @param {Job} job - BullMQ job for progress updates
 * @returns {Promise<Object>} Insert results
 */
async function insertContactsBatched(contacts, tenantId, userId, job) {
  let inserted = 0;
  let failed = 0;
  const errors = [];
  
  const batches = chunkArray(contacts, BATCH_SIZE);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    try {
      // Insert batch (replace with actual SupabaseService call)
      const result = await insertBatch(batch, tenantId, userId);
      inserted += result.inserted;
      failed += result.failed;
      
      if (result.errors) {
        errors.push(...result.errors);
      }
      
      // Update progress (30% to 90% for insertion)
      const progress = 30 + Math.round(((i + 1) / batches.length) * 60);
      await job.updateProgress(progress);
      
      logger.debug('Batch inserted', {
        batchIndex: i,
        inserted: result.inserted,
        failed: result.failed,
      });
    } catch (error) {
      failed += batch.length;
      errors.push({ batch: i, error: error.message });
      
      logger.error('Batch insert failed', { batchIndex: i, error: error.message });
    }
  }
  
  return { inserted, failed, errors };
}

/**
 * Insert a batch of contacts
 * 
 * @param {Array} contacts - Contacts to insert
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Insert result
 */
async function insertBatch(contacts, tenantId, userId) {
  // Placeholder - replace with actual SupabaseService call
  // const SupabaseService = require('../services/SupabaseService');
  // return SupabaseService.insertContacts(contacts, tenantId, userId);
  
  // Simulate insertion
  await sleep(200);
  
  // Simulate occasional failures
  const failCount = Math.floor(Math.random() * 2);
  
  return {
    inserted: contacts.length - failCount,
    failed: failCount,
    errors: failCount > 0 ? [{ error: 'Simulated insert failure' }] : [],
  };
}

/**
 * Split array into chunks
 * 
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
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
 * Create and start the import worker
 * 
 * @param {Object} options - Worker options
 * @returns {Worker|null} Worker instance or null if BullMQ not available
 */
function createImportWorker(options = {}) {
  if (!isBullMQAvailable()) {
    logger.warn('BullMQ not available, import worker not started');
    return null;
  }

  try {
    const { Worker } = require('bullmq');
    
    const worker = new Worker(
      QUEUE_NAMES.IMPORT,
      async (job) => {
        switch (job.name) {
          case IMPORT_JOB_TYPES.PROCESS_FILE:
            return processFileImport(job);
          case IMPORT_JOB_TYPES.VALIDATE_CONTACTS:
            return validateContacts(job.data.contacts, job.data.fieldMapping);
          case IMPORT_JOB_TYPES.INSERT_BATCH:
            return insertBatch(job.data.contacts, job.data.tenantId, job.data.userId);
          case IMPORT_JOB_TYPES.FINALIZE_IMPORT:
            return { status: 'completed', ...job.data };
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      },
      {
        connection: getRedisConfig(),
        concurrency: options.concurrency || 2, // Lower concurrency for imports
      }
    );

    worker.on('completed', (job, result) => {
      logger.info('Import job completed', { jobId: job.id, jobName: job.name });
    });

    worker.on('failed', (job, error) => {
      logger.error('Import job failed', {
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    worker.on('error', (error) => {
      logger.error('Import worker error', { error: error.message });
    });

    logger.info('Import worker started', { concurrency: options.concurrency || 2 });
    
    return worker;
  } catch (error) {
    logger.error('Failed to create import worker', { error: error.message });
    return null;
  }
}

module.exports = {
  createImportWorker,
  processFileImport,
  validateContacts,
  validateContact,
  insertContactsBatched,
  BATCH_SIZE,
};
