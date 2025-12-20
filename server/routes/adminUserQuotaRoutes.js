/**
 * Admin User Quota Routes
 * 
 * Endpoints for managing user quotas.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All operations validate that the target user
 * belongs to the admin's tenant before executing.
 * 
 * Requirements: 3.4, 3.5, 3.6
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const QuotaService = require('../services/QuotaService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

let quotaService = null;
let auditService = null;

function getQuotaService(req) {
  if (!quotaService) {
    const db = req.app.locals.db;
    if (db) quotaService = new QuotaService(db);
  }
  return quotaService;
}

function getAuditService(req) {
  if (!auditService) {
    const db = req.app.locals.db;
    if (db) auditService = new AdminAuditService(db);
  }
  return auditService;
}

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
 * GET /api/admin/users/:userId/quotas
 * Get all quotas for a user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/:userId/quotas', requireAdmin, async (req, res) => {
  try {
    const service = getQuotaService(req);
    if (!service) {
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
      logger.warn('Cross-tenant quota access blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/quotas`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    const quotas = await service.getUserQuotas(userId);

    logger.info('User quotas retrieved', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      endpoint: `/api/admin/users/${userId}/quotas`
    });

    res.json({ success: true, data: quotas });
  } catch (error) {
    logger.error('Failed to get user quotas', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/quotas`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/quotas/:quotaType
 * Set a quota override for a user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.put('/:userId/quotas/:quotaType', requireAdmin, async (req, res) => {
  try {
    const service = getQuotaService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, quotaType } = req.params;
    const { limit, reason } = req.body;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant quota override blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        quotaType,
        endpoint: `/api/admin/users/${userId}/quotas/${quotaType}`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // Validate quota type
    const validTypes = Object.values(QuotaService.QUOTA_TYPES);
    if (!validTypes.includes(quotaType)) {
      return res.status(400).json({ 
        error: `Invalid quota type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // Validate limit
    if (limit === undefined || limit === null || typeof limit !== 'number' || limit < 0) {
      return res.status(400).json({ error: 'limit must be a non-negative number' });
    }

    // Get current value for audit
    const currentLimit = await service.getEffectiveLimit(userId, quotaType);

    const override = await service.setQuotaOverride(
      userId, 
      quotaType, 
      limit, 
      req.session.userId, 
      reason
    );

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.QUOTA_OVERRIDE_SET,
        userId,
        { 
          quotaType, 
          newLimit: limit, 
          previousLimit: currentLimit,
          reason,
          tenantId,
          accountId: account.id
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Quota override set', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      quotaType,
      limit,
      endpoint: `/api/admin/users/${userId}/quotas/${quotaType}`
    });

    res.json({ success: true, data: override });
  } catch (error) {
    logger.error('Failed to set quota override', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      quotaType: req.params.quotaType,
      endpoint: `/api/admin/users/${req.params.userId}/quotas/${req.params.quotaType}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId/quotas/:quotaType/override
 * Remove a quota override
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.delete('/:userId/quotas/:quotaType/override', requireAdmin, async (req, res) => {
  try {
    const service = getQuotaService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, quotaType } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant quota override removal blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        quotaType,
        endpoint: `/api/admin/users/${userId}/quotas/${quotaType}/override`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // Validate quota type
    const validTypes = Object.values(QuotaService.QUOTA_TYPES);
    if (!validTypes.includes(quotaType)) {
      return res.status(400).json({ 
        error: `Invalid quota type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    await service.removeQuotaOverride(userId, quotaType, req.session.userId);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.QUOTA_OVERRIDE_REMOVED,
        userId,
        { quotaType, tenantId, accountId: account.id },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Quota override removed', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      quotaType,
      endpoint: `/api/admin/users/${userId}/quotas/${quotaType}/override`
    });

    res.json({ success: true, message: 'Quota override removed' });
  } catch (error) {
    logger.error('Failed to remove quota override', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      quotaType: req.params.quotaType,
      endpoint: `/api/admin/users/${req.params.userId}/quotas/${req.params.quotaType}/override`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/quotas/reset
 * Reset cycle-based quota counters
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.post('/:userId/quotas/reset', requireAdmin, async (req, res) => {
  try {
    const service = getQuotaService(req);
    const audit = getAuditService(req);
    if (!service) {
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
      logger.warn('Cross-tenant quota reset blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/quotas/reset`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    await service.resetCycleCounters(userId);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        'quota_counters_reset',
        userId,
        { quotaTypes: QuotaService.CYCLE_QUOTAS, tenantId, accountId: account.id },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Quota counters reset', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      endpoint: `/api/admin/users/${userId}/quotas/reset`
    });

    res.json({ success: true, message: 'Quota counters reset successfully' });
  } catch (error) {
    logger.error('Failed to reset quota counters', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/quotas/reset`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/quotas/:quotaType/usage
 * Get current usage for a specific quota
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/:userId/quotas/:quotaType/usage', requireAdmin, async (req, res) => {
  try {
    const service = getQuotaService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, quotaType } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant quota usage access blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        quotaType,
        endpoint: `/api/admin/users/${userId}/quotas/${quotaType}/usage`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // Validate quota type
    const validTypes = Object.values(QuotaService.QUOTA_TYPES);
    if (!validTypes.includes(quotaType)) {
      return res.status(400).json({ 
        error: `Invalid quota type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    const result = await service.checkQuota(userId, quotaType);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get quota usage', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      quotaType: req.params.quotaType,
      endpoint: `/api/admin/users/${req.params.userId}/quotas/${req.params.quotaType}/usage`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
