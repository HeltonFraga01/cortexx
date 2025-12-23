/**
 * Admin Bulk Action Routes
 * 
 * Endpoints for bulk operations on users.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All bulk operations filter userIds by tenant
 * to prevent cross-tenant data access.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const PlanService = require('../services/PlanService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

// Services initialized at module level (use SupabaseService internally)
const subscriptionService = new SubscriptionService();
const planService = new PlanService();
const auditService = new AdminAuditService();

/**
 * Filter userIds to only include users belonging to the specified tenant
 * CRITICAL: This prevents cross-tenant bulk operations
 * @param {string[]} userIds - Array of user IDs to filter
 * @param {string} tenantId - Tenant ID to filter by
 * @returns {Promise<{validUserIds: string[], invalidUserIds: string[]}>}
 */
async function filterUsersByTenant(userIds, tenantId) {
  if (!userIds || userIds.length === 0) {
    return { validUserIds: [], invalidUserIds: [] };
  }

  if (!tenantId) {
    logger.warn('filterUsersByTenant called without tenantId');
    return { validUserIds: [], invalidUserIds: userIds };
  }

  try {
    // Query accounts that belong to this tenant and match the provided userIds
    const { data: validAccounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('owner_user_id, wuzapi_token')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.in.(${userIds.join(',')}),wuzapi_token.in.(${userIds.join(',')})`);

    if (error) {
      logger.error('Failed to filter users by tenant', { error: error.message, tenantId });
      return { validUserIds: [], invalidUserIds: userIds };
    }

    // Build set of valid user IDs (both owner_user_id and wuzapi_token)
    const validUserIdSet = new Set();
    (validAccounts || []).forEach(account => {
      if (account.owner_user_id) validUserIdSet.add(account.owner_user_id);
      if (account.wuzapi_token) validUserIdSet.add(account.wuzapi_token);
    });

    const validUserIds = userIds.filter(id => validUserIdSet.has(id));
    const invalidUserIds = userIds.filter(id => !validUserIdSet.has(id));

    return { validUserIds, invalidUserIds };
  } catch (error) {
    logger.error('Error in filterUsersByTenant', { error: error.message, tenantId });
    return { validUserIds: [], invalidUserIds: userIds };
  }
}

/**
 * POST /api/admin/users/bulk/assign-plan
 * Assign a plan to multiple users
 * MULTI-TENANT: Filters userIds to only include users from admin's tenant
 */
router.post('/assign-plan', requireAdmin, async (req, res) => {
  try {
    const services = { subscriptionService, planService, auditService };
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userIds, planId } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify plan exists AND belongs to this tenant
    const { data: plan, error: planError } = await SupabaseService.adminClient
      .from('tenant_plans')
      .select('*')
      .eq('id', planId)
      .eq('tenant_id', tenantId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found or does not belong to your tenant' });
    }

    // CRITICAL: Filter userIds to only include users from this tenant
    const { validUserIds, invalidUserIds } = await filterUsersByTenant(userIds, tenantId);

    // Log cross-tenant attempt if any invalid IDs
    if (invalidUserIds.length > 0) {
      logger.warn('Bulk assign-plan cross-tenant attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        invalidUserIds,
        validUserIds: validUserIds.length,
        endpoint: '/api/admin/users/bulk/assign-plan'
      });
    }

    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        error: 'No valid users found for this tenant',
        invalidCount: invalidUserIds.length
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: invalidUserIds.map(id => ({ userId: id, reason: 'User not in tenant' }))
    };

    // Process each valid user
    for (const userId of validUserIds) {
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
        tenantId,
        totalRequested: userIds.length,
        totalValid: validUserIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk plan assignment completed', {
      adminId: req.session.userId,
      tenantId,
      planId,
      totalRequested: userIds.length,
      totalValid: validUserIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/assign-plan'
    });

    // Return 207 Multi-Status if partial failure
    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Plan assigned to ${results.successful.length} of ${validUserIds.length} valid users`
    });
  } catch (error) {
    logger.error('Failed to bulk assign plan', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/users/bulk/assign-plan'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/suspend
 * Suspend multiple users
 * MULTI-TENANT: Filters userIds to only include users from admin's tenant
 */
router.post('/suspend', requireAdmin, async (req, res) => {
  try {
    const services = { subscriptionService, planService, auditService };
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userIds, reason } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required' });
    }

    // CRITICAL: Filter userIds to only include users from this tenant
    const { validUserIds, invalidUserIds } = await filterUsersByTenant(userIds, tenantId);

    // Log cross-tenant attempt if any invalid IDs
    if (invalidUserIds.length > 0) {
      logger.warn('Bulk suspend cross-tenant attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        invalidUserIds,
        validUserIds: validUserIds.length,
        endpoint: '/api/admin/users/bulk/suspend'
      });
    }

    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        error: 'No valid users found for this tenant',
        invalidCount: invalidUserIds.length
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: invalidUserIds.map(id => ({ userId: id, reason: 'User not in tenant' }))
    };

    // Process each valid user
    for (const userId of validUserIds) {
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
        tenantId,
        totalRequested: userIds.length,
        totalValid: validUserIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk suspension completed', {
      adminId: req.session.userId,
      tenantId,
      reason: reason.trim(),
      totalRequested: userIds.length,
      totalValid: validUserIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/suspend'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Suspended ${results.successful.length} of ${validUserIds.length} valid users`
    });
  } catch (error) {
    logger.error('Failed to bulk suspend', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/users/bulk/suspend'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/reactivate
 * Reactivate multiple users
 * MULTI-TENANT: Filters userIds to only include users from admin's tenant
 */
router.post('/reactivate', requireAdmin, async (req, res) => {
  try {
    const services = { subscriptionService, planService, auditService };
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userIds } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    // CRITICAL: Filter userIds to only include users from this tenant
    const { validUserIds, invalidUserIds } = await filterUsersByTenant(userIds, tenantId);

    // Log cross-tenant attempt if any invalid IDs
    if (invalidUserIds.length > 0) {
      logger.warn('Bulk reactivate cross-tenant attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        invalidUserIds,
        validUserIds: validUserIds.length,
        endpoint: '/api/admin/users/bulk/reactivate'
      });
    }

    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        error: 'No valid users found for this tenant',
        invalidCount: invalidUserIds.length
      });
    }

    const results = {
      successful: [],
      failed: [],
      skipped: invalidUserIds.map(id => ({ userId: id, reason: 'User not in tenant' }))
    };

    // Process each valid user
    for (const userId of validUserIds) {
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
        tenantId,
        totalRequested: userIds.length,
        totalValid: validUserIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk reactivation completed', {
      adminId: req.session.userId,
      tenantId,
      totalRequested: userIds.length,
      totalValid: validUserIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/reactivate'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Reactivated ${results.successful.length} of ${validUserIds.length} valid users`
    });
  } catch (error) {
    logger.error('Failed to bulk reactivate', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/users/bulk/reactivate'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk/notify
 * Send notification to multiple users
 * MULTI-TENANT: Filters userIds to only include users from admin's tenant
 */
router.post('/notify', requireAdmin, async (req, res) => {
  try {
    const services = { subscriptionService, planService, auditService };
    if (!services) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userIds, type, title, message } = req.body;

    // Validation
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' });
    }

    // CRITICAL: Filter userIds to only include users from this tenant
    const { validUserIds, invalidUserIds } = await filterUsersByTenant(userIds, tenantId);

    // Log cross-tenant attempt if any invalid IDs
    if (invalidUserIds.length > 0) {
      logger.warn('Bulk notify cross-tenant attempt blocked', {
        tenantId,
        adminId: req.session.userId,
        invalidUserIds,
        validUserIds: validUserIds.length,
        endpoint: '/api/admin/users/bulk/notify'
      });
    }

    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        error: 'No valid users found for this tenant',
        invalidCount: invalidUserIds.length
      });
    }

    const crypto = require('crypto');
    const now = new Date().toISOString();
    const results = {
      successful: [],
      failed: [],
      skipped: invalidUserIds.map(id => ({ userId: id, reason: 'User not in tenant' }))
    };

    // Process each valid user
    for (const userId of validUserIds) {
      try {
        const notificationId = crypto.randomUUID();
        await SupabaseService.insert('admin_notifications', {
          id: notificationId,
          user_id: userId,
          tenant_id: tenantId,
          type,
          title,
          message,
          created_at: now
        });
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
        tenantId,
        totalRequested: userIds.length,
        totalValid: validUserIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      req.ip,
      req.get('User-Agent')
    );

    logger.info('Bulk notification completed', {
      adminId: req.session.userId,
      tenantId,
      notificationType: type,
      totalRequested: userIds.length,
      totalValid: validUserIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      endpoint: '/api/admin/users/bulk/notify'
    });

    const statusCode = results.failed.length > 0 && results.successful.length > 0 ? 207 : 200;

    res.status(statusCode).json({
      success: results.failed.length === 0,
      data: results,
      message: `Notification sent to ${results.successful.length} of ${validUserIds.length} valid users`
    });
  } catch (error) {
    logger.error('Failed to bulk notify', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/users/bulk/notify'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
