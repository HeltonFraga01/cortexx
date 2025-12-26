/**
 * Workers Index Module
 * 
 * Central module for managing all queue workers
 * Provides initialization and graceful shutdown
 */

const { logger } = require('../utils/logger');
const { createCampaignWorker } = require('./campaignWorker');
const { createImportWorker } = require('./importWorker');
const { createReportWorker } = require('./reportWorker');

/**
 * Active worker instances
 */
const workers = {
  campaign: null,
  import: null,
  report: null,
};

/**
 * Initialize all workers
 * 
 * @param {Object} options - Worker options
 * @param {boolean} options.campaign - Enable campaign worker
 * @param {boolean} options.import - Enable import worker
 * @param {boolean} options.report - Enable report worker
 * @param {number} options.campaignConcurrency - Campaign worker concurrency
 * @param {number} options.importConcurrency - Import worker concurrency
 * @param {number} options.reportConcurrency - Report worker concurrency
 * @returns {Object} Worker instances
 */
function initializeWorkers(options = {}) {
  const {
    campaign = true,
    import: enableImport = true,
    report = true,
    campaignConcurrency = 5,
    importConcurrency = 2,
    reportConcurrency = 3,
  } = options;

  logger.info('Initializing workers', { campaign, import: enableImport, report });

  if (campaign && !workers.campaign) {
    workers.campaign = createCampaignWorker({ concurrency: campaignConcurrency });
  }

  if (enableImport && !workers.import) {
    workers.import = createImportWorker({ concurrency: importConcurrency });
  }

  if (report && !workers.report) {
    workers.report = createReportWorker({ concurrency: reportConcurrency });
  }

  const activeWorkers = Object.entries(workers)
    .filter(([, worker]) => worker !== null)
    .map(([name]) => name);

  logger.info('Workers initialized', { activeWorkers });

  return workers;
}

/**
 * Gracefully shutdown all workers
 * 
 * @param {number} timeout - Shutdown timeout in ms
 * @returns {Promise<void>}
 */
async function shutdownWorkers(timeout = 30000) {
  logger.info('Shutting down workers', { timeout });

  const shutdownPromises = [];

  for (const [name, worker] of Object.entries(workers)) {
    if (worker) {
      shutdownPromises.push(
        worker.close()
          .then(() => {
            logger.info('Worker shutdown complete', { worker: name });
            workers[name] = null;
          })
          .catch((error) => {
            logger.error('Worker shutdown failed', { worker: name, error: error.message });
          })
      );
    }
  }

  // Wait for all workers to shutdown with timeout
  await Promise.race([
    Promise.all(shutdownPromises),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);

  logger.info('All workers shutdown');
}

/**
 * Get worker status
 * 
 * @returns {Object} Worker status
 */
function getWorkersStatus() {
  const status = {};

  for (const [name, worker] of Object.entries(workers)) {
    status[name] = {
      active: worker !== null,
      running: worker?.isRunning?.() ?? false,
    };
  }

  return status;
}

/**
 * Pause all workers
 * 
 * @returns {Promise<void>}
 */
async function pauseWorkers() {
  logger.info('Pausing all workers');

  for (const [name, worker] of Object.entries(workers)) {
    if (worker) {
      try {
        await worker.pause();
        logger.info('Worker paused', { worker: name });
      } catch (error) {
        logger.error('Failed to pause worker', { worker: name, error: error.message });
      }
    }
  }
}

/**
 * Resume all workers
 * 
 * @returns {Promise<void>}
 */
async function resumeWorkers() {
  logger.info('Resuming all workers');

  for (const [name, worker] of Object.entries(workers)) {
    if (worker) {
      try {
        await worker.resume();
        logger.info('Worker resumed', { worker: name });
      } catch (error) {
        logger.error('Failed to resume worker', { worker: name, error: error.message });
      }
    }
  }
}

module.exports = {
  initializeWorkers,
  shutdownWorkers,
  getWorkersStatus,
  pauseWorkers,
  resumeWorkers,
  workers,
};
