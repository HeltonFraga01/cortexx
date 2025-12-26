/**
 * Report Worker Module
 * 
 * Task 10.10: Worker for generating reports and exports
 * Handles async report generation with progress tracking
 */

const { logger } = require('../utils/logger');
const { getRedisConfig, QUEUE_NAMES } = require('../queues/index');
const { REPORT_JOB_TYPES } = require('../queues/reportQueue');

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
 * Process a campaign report job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Report result
 */
async function processCampaignReport(job) {
  const { reportId, userId, tenantId, campaignId, format } = job.data;
  
  logger.info('Generating campaign report', { reportId, campaignId, format });
  
  try {
    await job.updateProgress(10);
    
    // Fetch campaign data (replace with actual SupabaseService call)
    const campaignData = await fetchCampaignData(campaignId, tenantId);
    
    await job.updateProgress(40);
    
    // Generate report based on format
    const reportPath = await generateReport(campaignData, format, reportId);
    
    await job.updateProgress(90);
    
    const result = {
      reportId,
      campaignId,
      format,
      path: reportPath,
      generatedAt: new Date().toISOString(),
      stats: {
        totalMessages: campaignData.totalMessages,
        delivered: campaignData.delivered,
        failed: campaignData.failed,
        deliveryRate: campaignData.totalMessages > 0 
          ? ((campaignData.delivered / campaignData.totalMessages) * 100).toFixed(2)
          : 0,
      },
    };
    
    logger.info('Campaign report generated', result);
    
    return result;
  } catch (error) {
    logger.error('Campaign report generation failed', { reportId, error: error.message });
    throw error;
  }
}

/**
 * Process an analytics report job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Report result
 */
async function processAnalyticsReport(job) {
  const { reportId, userId, tenantId, dateFrom, dateTo, format } = job.data;
  
  logger.info('Generating analytics report', { reportId, dateFrom, dateTo, format });
  
  try {
    await job.updateProgress(10);
    
    // Fetch analytics data
    const analyticsData = await fetchAnalyticsData(tenantId, dateFrom, dateTo);
    
    await job.updateProgress(50);
    
    // Generate report
    const reportPath = await generateReport(analyticsData, format, reportId);
    
    await job.updateProgress(90);
    
    const result = {
      reportId,
      format,
      path: reportPath,
      period: { from: dateFrom, to: dateTo },
      generatedAt: new Date().toISOString(),
      summary: analyticsData.summary,
    };
    
    logger.info('Analytics report generated', result);
    
    return result;
  } catch (error) {
    logger.error('Analytics report generation failed', { reportId, error: error.message });
    throw error;
  }
}

/**
 * Process a contacts export job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Export result
 */
async function processContactsExport(job) {
  const { exportId, userId, tenantId, filters, format } = job.data;
  
  logger.info('Exporting contacts', { exportId, format });
  
  try {
    await job.updateProgress(10);
    
    // Fetch contacts with filters
    const contacts = await fetchContacts(tenantId, userId, filters);
    
    await job.updateProgress(40);
    
    // Generate export file
    const exportPath = await generateExport(contacts, format, exportId, 'contacts');
    
    await job.updateProgress(90);
    
    const result = {
      exportId,
      format,
      path: exportPath,
      totalRecords: contacts.length,
      generatedAt: new Date().toISOString(),
    };
    
    logger.info('Contacts export completed', result);
    
    return result;
  } catch (error) {
    logger.error('Contacts export failed', { exportId, error: error.message });
    throw error;
  }
}

/**
 * Process a messages export job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Export result
 */
async function processMessagesExport(job) {
  const { exportId, userId, tenantId, filters, format } = job.data;
  
  logger.info('Exporting messages', { exportId, format });
  
  try {
    await job.updateProgress(10);
    
    // Fetch messages with filters
    const messages = await fetchMessages(tenantId, userId, filters);
    
    await job.updateProgress(40);
    
    // Generate export file
    const exportPath = await generateExport(messages, format, exportId, 'messages');
    
    await job.updateProgress(90);
    
    const result = {
      exportId,
      format,
      path: exportPath,
      totalRecords: messages.length,
      generatedAt: new Date().toISOString(),
    };
    
    logger.info('Messages export completed', result);
    
    return result;
  } catch (error) {
    logger.error('Messages export failed', { exportId, error: error.message });
    throw error;
  }
}

/**
 * Process a usage report job
 * 
 * @param {Job} job - BullMQ job
 * @returns {Promise<Object>} Report result
 */
async function processUsageReport(job) {
  const { reportId, tenantId, period } = job.data;
  
  logger.info('Generating usage report', { reportId, tenantId, period });
  
  try {
    await job.updateProgress(20);
    
    // Fetch usage data
    const usageData = await fetchUsageData(tenantId, period);
    
    await job.updateProgress(60);
    
    const result = {
      reportId,
      tenantId,
      period,
      generatedAt: new Date().toISOString(),
      usage: usageData,
    };
    
    logger.info('Usage report generated', result);
    
    return result;
  } catch (error) {
    logger.error('Usage report generation failed', { reportId, error: error.message });
    throw error;
  }
}

// ============ Helper Functions (Placeholders) ============

/**
 * Fetch campaign data
 */
async function fetchCampaignData(campaignId, tenantId) {
  // Replace with actual SupabaseService call
  await sleep(300);
  return {
    id: campaignId,
    name: 'Sample Campaign',
    totalMessages: 1000,
    delivered: 950,
    failed: 50,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fetch analytics data
 */
async function fetchAnalyticsData(tenantId, dateFrom, dateTo) {
  // Replace with actual SupabaseService call
  await sleep(500);
  return {
    summary: {
      totalMessages: 5000,
      totalCampaigns: 10,
      avgDeliveryRate: 95.5,
      activeContacts: 2500,
    },
    daily: [],
  };
}

/**
 * Fetch contacts
 */
async function fetchContacts(tenantId, userId, filters) {
  // Replace with actual SupabaseService call
  await sleep(400);
  return [
    { id: '1', name: 'Contact 1', phone: '5511999999999' },
    { id: '2', name: 'Contact 2', phone: '5511888888888' },
  ];
}

/**
 * Fetch messages
 */
async function fetchMessages(tenantId, userId, filters) {
  // Replace with actual SupabaseService call
  await sleep(400);
  return [
    { id: '1', phone: '5511999999999', text: 'Hello', status: 'delivered' },
    { id: '2', phone: '5511888888888', text: 'Hi', status: 'delivered' },
  ];
}

/**
 * Fetch usage data
 */
async function fetchUsageData(tenantId, period) {
  // Replace with actual SupabaseService call
  await sleep(200);
  return {
    messages: { sent: 1000, limit: 5000 },
    campaigns: { created: 5, limit: 20 },
    contacts: { total: 500, limit: 2000 },
  };
}

/**
 * Generate report file
 */
async function generateReport(data, format, reportId) {
  // Replace with actual report generation (PDF, CSV, XLSX)
  await sleep(500);
  return `/reports/${reportId}.${format}`;
}

/**
 * Generate export file
 */
async function generateExport(data, format, exportId, type) {
  // Replace with actual export generation
  await sleep(400);
  return `/exports/${type}-${exportId}.${format}`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create and start the report worker
 * 
 * @param {Object} options - Worker options
 * @returns {Worker|null} Worker instance or null if BullMQ not available
 */
function createReportWorker(options = {}) {
  if (!isBullMQAvailable()) {
    logger.warn('BullMQ not available, report worker not started');
    return null;
  }

  try {
    const { Worker } = require('bullmq');
    
    const worker = new Worker(
      QUEUE_NAMES.REPORT,
      async (job) => {
        switch (job.name) {
          case REPORT_JOB_TYPES.CAMPAIGN_REPORT:
            return processCampaignReport(job);
          case REPORT_JOB_TYPES.ANALYTICS_REPORT:
            return processAnalyticsReport(job);
          case REPORT_JOB_TYPES.EXPORT_CONTACTS:
            return processContactsExport(job);
          case REPORT_JOB_TYPES.EXPORT_MESSAGES:
            return processMessagesExport(job);
          case REPORT_JOB_TYPES.USAGE_REPORT:
            return processUsageReport(job);
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      },
      {
        connection: getRedisConfig(),
        concurrency: options.concurrency || 3,
      }
    );

    worker.on('completed', (job, result) => {
      logger.info('Report job completed', { 
        jobId: job.id, 
        jobName: job.name,
        path: result?.path,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Report job failed', {
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    worker.on('error', (error) => {
      logger.error('Report worker error', { error: error.message });
    });

    logger.info('Report worker started', { concurrency: options.concurrency || 3 });
    
    return worker;
  } catch (error) {
    logger.error('Failed to create report worker', { error: error.message });
    return null;
  }
}

module.exports = {
  createReportWorker,
  processCampaignReport,
  processAnalyticsReport,
  processContactsExport,
  processMessagesExport,
  processUsageReport,
};
