/**
 * Job Status Routes
 * 
 * Task 10.12: Endpoint for checking job status
 * Provides status information for async jobs (campaigns, imports, reports)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { authenticate } = require('../middleware/authenticate');
const { getQueueStats, getAllQueuesStats, QUEUE_NAMES } = require('../queues/index');
const { getCampaignJobStatus } = require('../queues/campaignQueue');
const { getImportJobStatus } = require('../queues/importQueue');
const { getReportJobStatus } = require('../queues/reportQueue');
const { getWorkersStatus } = require('../workers/index');

/**
 * GET /api/jobs/:type/:id/status
 * Get status of a specific job
 * 
 * @param {string} type - Job type (campaign, import, report)
 * @param {string} id - Job ID
 */
router.get('/:type/:id/status', authenticate, async (req, res) => {
  try {
    const { type, id } = req.params;
    const userId = req.user?.id;

    logger.debug('Getting job status', { type, id, userId });

    let status = null;

    switch (type) {
      case 'campaign':
        status = await getCampaignJobStatus(id);
        break;
      case 'import':
        status = await getImportJobStatus(id);
        break;
      case 'report':
        status = await getReportJobStatus(id, 'report');
        break;
      case 'export':
        status = await getReportJobStatus(id, 'export');
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Invalid job type: ${type}. Valid types: campaign, import, report, export`,
        });
    }

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Security: Verify job belongs to user (if job has userId)
    if (status.data?.userId && status.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get job status', {
      type: req.params.type,
      id: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get job status',
    });
  }
});

/**
 * GET /api/jobs/queues/stats
 * Get statistics for all queues
 */
router.get('/queues/stats', authenticate, async (req, res) => {
  try {
    const stats = await getAllQueuesStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics',
    });
  }
});

/**
 * GET /api/jobs/queues/:name/stats
 * Get statistics for a specific queue
 */
router.get('/queues/:name/stats', authenticate, async (req, res) => {
  try {
    const { name } = req.params;

    // Validate queue name
    const validQueues = Object.values(QUEUE_NAMES);
    if (!validQueues.includes(name)) {
      return res.status(400).json({
        success: false,
        error: `Invalid queue name: ${name}. Valid queues: ${validQueues.join(', ')}`,
      });
    }

    const stats = await getQueueStats(name);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get queue stats', {
      queue: req.params.name,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics',
    });
  }
});

/**
 * GET /api/jobs/workers/status
 * Get status of all workers
 */
router.get('/workers/status', authenticate, async (req, res) => {
  try {
    const status = getWorkersStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get workers status', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to get workers status',
    });
  }
});

/**
 * GET /api/jobs/health
 * Health check for job processing system
 */
router.get('/health', async (req, res) => {
  try {
    const queueStats = await getAllQueuesStats();
    const workersStatus = getWorkersStatus();

    // Check if any queue is unavailable
    const queuesHealthy = Object.values(queueStats).every(
      (stats) => stats.available !== false
    );

    // Check if any worker is active
    const workersHealthy = Object.values(workersStatus).some(
      (status) => status.active
    );

    const healthy = queuesHealthy && workersHealthy;

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        healthy,
        queues: queueStats,
        workers: workersStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Job health check failed', { error: error.message });

    res.status(503).json({
      success: false,
      error: 'Job system health check failed',
    });
  }
});

module.exports = router;
