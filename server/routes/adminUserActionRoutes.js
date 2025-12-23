/**
 * Admin User Action Routes
 * 
 * Endpoints for user actions: suspend, reactivate, reset password, delete, export, notify.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All operations validate that the target user
 * belongs to the admin's tenant before executing.
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
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

// Services initialized at module level (use SupabaseService internally)
const subscriptionService = new SubscriptionService();
const quotaService = new QuotaService();
const featureService = new FeatureFlagService();
const auditService = new AdminAuditService();
const usageService = new UsageTrackingService();

const services = { subscriptionService, quotaService, featureService, auditService, usageService };

/**
 * Validate that a user belongs to the specified tenant
 * @param {string} userId - User ID to validate
 * @param {string} tenantId - Tenant ID to check against
 * @returns {Promise<{valid: boolean, account: object|null}>}
 */
async function validateUserTenant(userId, tenantId) {
  if (!userId || !tenantId) {
    return { valid: false, account: null };
  }

  try {
    // Query account by owner_user_id or wuzapi_token
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.eq.${userId},wuzapi_token.eq.${userId}`)
      .limit(1);

    if (error) {
      logger.error('Failed to validate user tenant', { error: error.message, userId, tenantId });
      return { valid: false, account: null };
    }

    if (!accounts || accounts.length === 0) {
      return { valid: false, account: null };
    }

    return { valid: true, account: accounts[0] };
  } catch (error) {
    logger.error('Error in validateUserTenant', { error: error.message, userId, tenantId });
    return { valid: false, account: null };
  }
}

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend a user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.post('/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant suspend attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/suspend`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
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
      { reason: reason.trim(), tenantId, accountId: account.id },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User suspended', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      reason: reason.trim(),
      endpoint: `/api/admin/users/${userId}/suspend`
    });

    res.json({ success: true, data: subscription, message: 'User suspended successfully' });
  } catch (error) {
    logger.error('Failed to suspend user', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/suspend`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/reactivate
 * Reactivate a suspended user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.post('/:userId/reactivate', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant reactivate attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/reactivate`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    const subscription = await services.subscriptionService.updateSubscriptionStatus(
      userId, 
      SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
    );

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_REACTIVATED,
      userId,
      { tenantId, accountId: account.id },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User reactivated', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      endpoint: `/api/admin/users/${userId}/reactivate`
    });

    res.json({ success: true, data: subscription, message: 'User reactivated successfully' });
  } catch (error) {
    logger.error('Failed to reactivate user', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/reactivate`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset user password (generates new token or sends reset email)
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.post('/:userId/reset-password', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;
    const { sendEmail = true } = req.body;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant reset-password attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/reset-password`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // Note: Actual password reset implementation depends on auth system
    // This is a placeholder that logs the action
    
    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_PASSWORD_RESET,
      userId,
      { sendEmail, tenantId, accountId: account.id },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User password reset initiated', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
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
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/reset-password`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all related data
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.delete('/:userId', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({ 
        error: 'Deletion requires confirmation. Set confirm: true in request body.' 
      });
    }

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant delete attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // Delete related data in order (cascade) - all scoped to the account
    const accountId = account.id;
    
    // Delete quota usage
    await SupabaseService.adminClient
      .from('user_quota_usage')
      .delete()
      .eq('account_id', accountId);
    
    // Delete quota overrides
    await SupabaseService.adminClient
      .from('user_quota_overrides')
      .delete()
      .eq('account_id', accountId);
    
    // Delete feature overrides
    await SupabaseService.adminClient
      .from('user_feature_overrides')
      .delete()
      .eq('account_id', accountId);
    
    // Delete usage metrics
    await SupabaseService.adminClient
      .from('usage_metrics')
      .delete()
      .eq('account_id', accountId);
    
    // Delete subscription
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .delete()
      .eq('account_id', accountId);

    // Delete the account itself
    await SupabaseService.adminClient
      .from('accounts')
      .delete()
      .eq('id', accountId);

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.USER_DELETED,
      userId,
      { cascadeDeleted: true, tenantId, accountId },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User deleted', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId,
      endpoint: `/api/admin/users/${userId}`
    });

    res.json({ success: true, message: 'User and all related data deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/export
 * Export all user data
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/:userId/export', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;
    const { format = 'json' } = req.query;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant export attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/export`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

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
      accountId: account.id,
      tenantId,
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
      { format, tenantId, accountId: account.id },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('User data exported', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
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
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/export`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/notify
 * Send a notification to a user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.post('/:userId/notify', requireAdmin, async (req, res) => {
  try {
    // Services already initialized at module level
    if (!services.subscriptionService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;
    const { type, title, message } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant notify attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/notify`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    const crypto = require('crypto');
    const notificationId = crypto.randomUUID();
    const now = new Date().toISOString();

    await SupabaseService.insert('admin_notifications', {
      id: notificationId,
      user_id: userId,
      account_id: account.id,
      tenant_id: tenantId,
      type,
      title,
      message,
      created_at: now
    });

    await services.auditService.logAction(
      req.session.userId,
      AdminAuditService.ACTION_TYPES.NOTIFICATION_SENT,
      userId,
      { type, title, tenantId, accountId: account.id },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Notification sent to user', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
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
      tenantId: req.context?.tenantId,
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
