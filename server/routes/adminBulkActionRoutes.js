/**
 * Admin Bulk Action Routes
 * 
 * Endpoints for bulk operations on users.
 * All routes require admin authentication.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const PlanService = require('../services/PlanService');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

let subscriptionService = null;
let planService = null;
let auditService = null;

function getServices(req) {
  const db = req.app.locals.db;
  if (!db) return null;
  
  if (!subscriptionService) subscriptionService = new SubscriptionService(db);
  if (!planService) planService = new PlanService(db);
  if (!auditService) auditService = new AdminAuditService(db);
  
  return { subscriptionService, planService, auditService };
}

/**
 * POST /api/admin/users/bulk/assign-plan
 * Assign a plan to multiple users
 */
router.post('/assign-plan', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userIds, planId } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify plan exists
    const plan = await services.planService.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each user
    for (const userId of userIds) {
      try {
        await services.subscriptionService.assignPlan(userId, planId, req.session.userId);
        results.successful.push({ userId, planId });
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    // Log bulk action
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.BULK_ACTION_EXECUTED,
      null,
      {
        action: 'assign_plan',
        planId,
        planName: plan.name,
        totalUsers: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk plan assignment completed', {
      adminId: req.session.userId,
      planId,
      totalUsers: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/assign-plan'
    });

    // Return 207 Multi-Status if partial failure
    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Plan assigned to ${results.successful.length} of ${userIds.length} users`
    });
  } catch (error) {
    logger.error('Failed to bulk assign plan', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/users/bulk/assign-plan'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/suspend
 * Suspend multiple users
 */
router.post('/suspend', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userIds, reason } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each user
    for (const userId of userIds) {
      try {
        await services.subscriptionService.updateSubscriptionStatus(
          userId,
          SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
          reason.trim()
        );
        results.successful.push({ userId });
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    // Log bulk action
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.BULK_ACTION_EXECUTED,
      null,
      {
        action: 'suspend',
        reason: reason.trim(),
        totalUsers: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk suspension completed', {
      adminId: req.session.userId,
      reason: reason.trim(),
      totalUsers: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/suspend'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Suspended ${results.successful.length} of ${userIds.length} users`
    });
  } catch (error) {
    logger.error('Failed to bulk suspend', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/users/bulk/suspend'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/reactivate
 * Reactivate multiple users
 */
router.post('/reactivate', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userIds } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each user
    for (const userId of userIds) {
      try {
        await services.subscriptionService.updateSubscriptionStatus(
          userId,
          SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
        );
        results.successful.push({ userId });
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    // Log bulk action
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.BULK_ACTION_EXECUTED,
      null,
      {
        action: 'reactivate',
        totalUsers: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk reactivation completed', {
      adminId: req.session.userId,
      totalUsers: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/reactivate'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Reactivated ${results.successful.length} of ${userIds.length} users`
    });
  } catch (error) {
    logger.error('Failed to bulk reactivate', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/users/bulk/reactivate'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/notify
 * Send notification to multiple users
 */
router.post('/notify', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    const db = req.app.locals.db;
    if (!services || !db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userIds, type, title, message } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    const crypto = require('crypto');
    const now = new Date().toISOString();
    const results = {
      successful: [],
      failed: []
    };

    // Process each user
    for (const userId of userIds) {
      try {
        const notificationId = crypto.randomUUID();
        await db.query(
          `INSERT INTO admin_notifications (id, user_id, type, title, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [notificationId, userId, type, title, message, now]
        );
        results.successful.push({ userId, notificationId });
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    // Log bulk action
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.BULK_ACTION_EXECUTED,
      null,
      {
        action: 'notify',
        type,
        title,
        totalUsers: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk notification completed', {
      adminId: req.session.userId,
      notificationType: type,
      totalUsers: userIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/notify'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Notification sent to ${results.successful.length} of ${userIds.length} users`
    });
  } catch (error) {
    logger.error('Failed to bulk notify', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/users/bulk/notify'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
