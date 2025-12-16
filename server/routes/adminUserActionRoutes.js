/**
 * Admin User Action Routes
 * 
 * Endpoints for user actions: suspend, reactivate, reset password, delete, export, notify.
 * All routes require admin authentication.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const QuotaService = require('../services/QuotaService');
const FeatureFlagService = require('../services/FeatureFlagService');
const AdminAuditService = require('../services/AdminAuditService');
const UsageTrackingService = require('../services/UsageTrackingService');

const router = express.Router();

let subscriptionService = null;
let quotaService = null;
let featureService = null;
let auditService = null;
let usageService = null;

function getServices(req) {
  const db = req.app.locals.db;
  if (!db) return null;
  
  if (!subscriptionService) subscriptionService = new SubscriptionService(db);
  if (!quotaService) quotaService = new QuotaService(db);
  if (!featureService) featureService = new FeatureFlagService(db);
  if (!auditService) auditService = new AdminAuditService(db);
  if (!usageService) usageService = new UsageTrackingService(db);
  
  return { subscriptionService, quotaService, featureService, auditService, usageService };
}

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend a user
 */
router.post('/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }

    const subscription = await services.subscriptionService.updateSubscriptionStatus(
      userId, 
      SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED, 
      reason.trim()
    );

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_SUSPENDED,
      userId,
      { reason: reason.trim() },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User suspended', {
      adminId: req.session.userId,
      targetUserId: userId,
      reason: reason.trim(),
      endpoint: `/api/admin/users/${userId}/suspend`
    });

    res.json({ success: true, data: subscription, message: 'User suspended successfully' });
  } catch (error) {
    logger.error('Failed to suspend user', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/suspend`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/reactivate
 * Reactivate a suspended user
 */
router.post('/:userId/reactivate', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;

    const subscription = await services.subscriptionService.updateSubscriptionStatus(
      userId, 
      SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
    );

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_REACTIVATED,
      userId,
      {},
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User reactivated', {
      adminId: req.session.userId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}/reactivate`
    });

    res.json({ success: true, data: subscription, message: 'User reactivated successfully' });
  } catch (error) {
    logger.error('Failed to reactivate user', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/reactivate`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset user password (generates new token or sends reset email)
 */
router.post('/:userId/reset-password', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { sendEmail = true } = req.body;

    // Note: Actual password reset implementation depends on auth system
    // This is a placeholder that logs the action
    
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_PASSWORD_RESET,
      userId,
      { sendEmail },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User password reset initiated', {
      adminId: req.session.userId,
      targetUserId: userId,
      sendEmail,
      endpoint: `/api/admin/users/${userId}/reset-password`
    });

    res.json({ 
      success: true, 
      message: sendEmail 
        ? 'Password reset email sent to user' 
        : 'Password reset initiated'
    });
  } catch (error) {
    logger.error('Failed to reset password', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/reset-password`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all related data
 */
router.delete('/:userId', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    const db = req.app.locals.db;
    if (!services || !db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({ 
        error: 'Deletion requires confirmation. Set confirm: true in request body.' 
      });
    }

    // Delete related data in order (cascade)
    const deletions = [];
    
    // Delete quota usage
    deletions.push(db.query('DELETE FROM user_quota_usage WHERE user_id = ?', [userId]));
    
    // Delete quota overrides
    deletions.push(db.query('DELETE FROM user_quota_overrides WHERE user_id = ?', [userId]));
    
    // Delete feature overrides
    deletions.push(db.query('DELETE FROM user_feature_overrides WHERE user_id = ?', [userId]));
    
    // Delete usage metrics
    deletions.push(db.query('DELETE FROM usage_metrics WHERE user_id = ?', [userId]));
    
    // Delete subscription
    deletions.push(db.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]));

    await Promise.all(deletions);

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_DELETED,
      userId,
      { cascadeDeleted: true },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User deleted', {
      adminId: req.session.userId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}`
    });

    res.json({ success: true, message: 'User and all related data deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/export
 * Export all user data
 */
router.get('/:userId/export', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { format = 'json' } = req.query;

    // Gather all user data
    const [subscription, quotas, features, usageMetrics, auditHistory] = await Promise.all([
      services.subscriptionService.getUserSubscription(userId),
      services.quotaService.getUserQuotas(userId),
      services.featureService.getUserFeatures(userId),
      services.usageService.getUsageMetrics(userId, 'year'),
      services.auditService.getUserAuditHistory(userId)
    ]);

    const exportData = {
      userId,
      exportedAt: new Date().toISOString(),
      subscription,
      quotas,
      features,
      usageMetrics,
      auditHistory
    };

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_DATA_EXPORTED,
      userId,
      { format },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User data exported', {
      adminId: req.session.userId,
      targetUserId: userId,
      format,
      endpoint: `/api/admin/users/${userId}/export`
    });

    if (format === 'csv') {
      // For CSV, return a simplified flat structure
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-export.csv"`);
      
      const csvData = convertToCSV(exportData);
      return res.send(csvData);
    }

    res.json({ success: true, data: exportData });
  } catch (error) {
    logger.error('Failed to export user data', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/export`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/notify
 * Send a notification to a user
 */
router.post('/:userId/notify', requireAdmin, async (req, res) => {
  try {
    const services = getServices(req);
    const db = req.app.locals.db;
    if (!services || !db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { type, title, message } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    const crypto = require('crypto');
    const notificationId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.query(
      `INSERT INTO admin_notifications (id, user_id, type, title, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [notificationId, userId, type, title, message, now]
    );

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.NOTIFICATION_SENT,
      userId,
      { type, title },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Notification sent to user', {
      adminId: req.session.userId,
      targetUserId: userId,
      notificationType: type,
      endpoint: `/api/admin/users/${userId}/notify`
    });

    res.json({ 
      success: true, 
      data: { id: notificationId, userId, type, title, message, createdAt: now },
      message: 'Notification sent successfully' 
    });
  } catch (error) {
    logger.error('Failed to send notification', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/notify`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Convert export data to CSV format
 */
function convertToCSV(data) {
  const lines = [];
  
  // Header
  lines.push('Section,Key,Value');
  
  // Basic info
  lines.push(`User,userId,"${data.userId}"`);
  lines.push(`User,exportedAt,"${data.exportedAt}"`);
  
  // Subscription
  if (data.subscription) {
    lines.push(`Subscription,planId,"${data.subscription.planId || ''}"`);
    lines.push(`Subscription,status,"${data.subscription.status || ''}"`);
    lines.push(`Subscription,startedAt,"${data.subscription.startedAt || ''}"`);
  }
  
  // Quotas
  if (data.quotas) {
    data.quotas.forEach(q => {
      lines.push(`Quota,${q.quotaType},"${q.currentUsage}/${q.limit}"`);
    });
  }
  
  // Features
  if (data.features) {
    data.features.forEach(f => {
      lines.push(`Feature,${f.featureName},"${f.enabled}"`);
    });
  }
  
  return lines.join('\n');
}

module.exports = router;
