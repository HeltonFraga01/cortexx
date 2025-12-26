/**
 * Report Queue Module
 * 
 * Task 10.6: Queue for generating reports
 * Handles async report generation for campaigns, analytics, and exports
 */

const { getQueue, addJob, QUEUE_NAMES } = require('./index');
const { logger } = require('../utils/logger');

/**
 * Report job types
 */
const REPORT_JOB_TYPES = {
  CAMPAIGN_REPORT: 'campaign-report',
  ANALYTICS_REPORT: 'analytics-report',
  EXPORT_CONTACTS: 'export-contacts',
  EXPORT_MESSAGES: 'export-messages',
  USAGE_REPORT: 'usage-report',
};

/**
 * Report job priorities
 */
const REPORT_PRIORITIES = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
};

/**
 * Get the report queue instance
 * 
 * @returns {Queue|null} Report queue instance
 */
function getReportQueue() {
  return getQueue(QUEUE_NAMES.REPORT, {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 10000,
      },
      removeOnComplete: {
        count: 100,
        age: 2 * 3600, // 2 hours
      },
      removeOnFail: {
        count: 200,
        age: 12 * 3600, // 12 hours
      },
    },
  });
}

/**
 * Add a campaign report job
 * 
 * @param {Object} reportData - Report data
 * @param {string} reportData.reportId - Report ID
 * @param {string} reportData.userId - User ID
 * @param {string} reportData.tenantId - Tenant ID
 * @param {string} reportData.campaignId - Campaign ID
 * @param {string} reportData.format - Report format (pdf, csv, xlsx)
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addCampaignReportJob(reportData, options = {}) {
  const { reportId, userId, campaignId, format } = reportData;
  
  logger.info('Adding campaign report job', {
    reportId,
    userId,
    campaignId,
    format,
  });

  return addJob(
    QUEUE_NAMES.REPORT,
    REPORT_JOB_TYPES.CAMPAIGN_REPORT,
    reportData,
    {
      priority: REPORT_PRIORITIES.NORMAL,
      jobId: `report-campaign-${reportId}`,
      ...options,
    }
  );
}

/**
 * Add an analytics report job
 * 
 * @param {Object} reportData - Report data
 * @param {string} reportData.reportId - Report ID
 * @param {string} reportData.userId - User ID
 * @param {string} reportData.tenantId - Tenant ID
 * @param {string} reportData.dateFrom - Start date
 * @param {string} reportData.dateTo - End date
 * @param {string} reportData.format - Report format
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addAnalyticsReportJob(reportData, options = {}) {
  const { reportId, userId, dateFrom, dateTo } = reportData;
  
  logger.info('Adding analytics report job', {
    reportId,
    userId,
    dateFrom,
    dateTo,
  });

  return addJob(
    QUEUE_NAMES.REPORT,
    REPORT_JOB_TYPES.ANALYTICS_REPORT,
    reportData,
    {
      priority: REPORT_PRIORITIES.NORMAL,
      jobId: `report-analytics-${reportId}`,
      ...options,
    }
  );
}

/**
 * Add a contacts export job
 * 
 * @param {Object} exportData - Export data
 * @param {string} exportData.exportId - Export ID
 * @param {string} exportData.userId - User ID
 * @param {string} exportData.tenantId - Tenant ID
 * @param {Object} exportData.filters - Export filters
 * @param {string} exportData.format - Export format (csv, xlsx)
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addContactsExportJob(exportData, options = {}) {
  const { exportId, userId, format } = exportData;
  
  logger.info('Adding contacts export job', {
    exportId,
    userId,
    format,
  });

  return addJob(
    QUEUE_NAMES.REPORT,
    REPORT_JOB_TYPES.EXPORT_CONTACTS,
    exportData,
    {
      priority: REPORT_PRIORITIES.NORMAL,
      jobId: `export-contacts-${exportId}`,
      ...options,
    }
  );
}

/**
 * Add a messages export job
 * 
 * @param {Object} exportData - Export data
 * @param {string} exportData.exportId - Export ID
 * @param {string} exportData.userId - User ID
 * @param {string} exportData.tenantId - Tenant ID
 * @param {Object} exportData.filters - Export filters
 * @param {string} exportData.format - Export format
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addMessagesExportJob(exportData, options = {}) {
  const { exportId, userId, format } = exportData;
  
  logger.info('Adding messages export job', {
    exportId,
    userId,
    format,
  });

  return addJob(
    QUEUE_NAMES.REPORT,
    REPORT_JOB_TYPES.EXPORT_MESSAGES,
    exportData,
    {
      priority: REPORT_PRIORITIES.NORMAL,
      jobId: `export-messages-${exportId}`,
      ...options,
    }
  );
}

/**
 * Add a usage report job
 * 
 * @param {Object} reportData - Report data
 * @param {string} reportData.reportId - Report ID
 * @param {string} reportData.tenantId - Tenant ID
 * @param {string} reportData.period - Report period (daily, weekly, monthly)
 * @param {Object} options - Job options
 * @returns {Promise<Job|null>} Job instance
 */
async function addUsageReportJob(reportData, options = {}) {
  const { reportId, tenantId, period } = reportData;
  
  logger.info('Adding usage report job', {
    reportId,
    tenantId,
    period,
  });

  return addJob(
    QUEUE_NAMES.REPORT,
    REPORT_JOB_TYPES.USAGE_REPORT,
    reportData,
    {
      priority: REPORT_PRIORITIES.LOW,
      jobId: `report-usage-${reportId}`,
      ...options,
    }
  );
}

/**
 * Get report job status
 * 
 * @param {string} reportId - Report ID
 * @param {string} type - Report type prefix
 * @returns {Promise<Object|null>} Job status
 */
async function getReportJobStatus(reportId, type = 'report') {
  const queue = getReportQueue();
  
  if (!queue) {
    return null;
  }

  try {
    const job = await queue.getJob(`${type}-${reportId}`);
    
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
        reportId: job.data.reportId || job.data.exportId,
        format: job.data.format,
        type: job.name,
      },
      result: job.returnvalue,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    logger.error('Failed to get report job status', { reportId, type, error: error.message });
    return null;
  }
}

module.exports = {
  getReportQueue,
  addCampaignReportJob,
  addAnalyticsReportJob,
  addContactsExportJob,
  addMessagesExportJob,
  addUsageReportJob,
  getReportJobStatus,
  REPORT_JOB_TYPES,
  REPORT_PRIORITIES,
};
