/**
 * Admin User Subscription Routes
 * 
 * Endpoints for managing user subscriptions.
 * All routes require admin authentication and tenant context.
 * 
 * Requirements: 2.1, 2.2, 2.3
 * Multi-Tenant Isolation: REQ-2
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const TenantPlanService = require('../services/TenantPlanService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

let subscriptionService = null;
let auditService = null;

function getSubscriptionService() {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService(SupabaseService);
  }
  return subscriptionService;
}

function getAuditService() {
  if (!auditService) {
    auditService = new AdminAuditService(SupabaseService);
  }
  return auditService;
}

/**
 * Validate tenant context is present
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID or null if missing
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * Validate that a user belongs to the admin's tenant
 * @param {string} userId - User ID to validate
 * @param {string} tenantId - Admin's tenant ID
 * @returns {Promise<Object|null>} Account if valid, null otherwise
 */
async function validateUserTenant(userId, tenantId) {
  try {
    // Convert userId to UUID format if needed
    let uuidUserId = userId;
    if (userId && userId.length === 32 && !userId.includes('-')) {
      uuidUserId = `${userId.slice(0, 8)}-${userId.slice(8, 12)}-${userId.slice(12, 16)}-${userId.slice(16, 20)}-${userId.slice(20)}`;
    }

    // Find account by owner_user_id or wuzapi_token
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, tenant_id, owner_user_id, wuzapi_token')
      .or(`owner_user_id.eq.${uuidUserId},wuzapi_token.eq.${userId}`)
      .limit(1);

    if (error || !accounts || accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    
    // Validate tenant ownership
    if (account.tenant_id !== tenantId) {
      logger.warn('Cross-tenant user access attempt blocked', {
        tenantId,
        userTenantId: account.tenant_id,
        userId
      });
      return null;
    }

    return account;
  } catch (error) {
    logger.error('Error validating user tenant', { error: error.message, userId, tenantId });
    return null;
  }
}

/**
 * GET /api/admin/users/:userId/subscription
 * Get user subscription details (tenant-scoped)
 * Returns null data if user has no subscription (not 404)
 */
router.get('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const { userId } = req.params;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await service.getUserSubscription(userId);

    // Return success with null data if no subscription exists
    if (!subscription) {
      return res.json({ success: true, data: null });
    }

    logger.info('Subscription retrieved', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to get subscription', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/subscription
 * Update subscription status (tenant-scoped)
 */
router.put('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const audit = getAuditService();
    const { userId } = req.params;
    const { status, reason } = req.body;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = Object.values(SubscriptionService.SUBSCRIPTION_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const subscription = await service.updateSubscriptionStatus(userId, status, reason);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        status === 'suspended' ? AdminAuditService.ACTION_TYPES.USER_SUSPENDED : 'subscription_status_updated',
        userId,
        { status, reason, tenantId },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Subscription status updated', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      status,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to update subscription', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/subscription/assign-plan
 * Assign a plan to a user (tenant-scoped)
 */
router.post('/:userId/subscription/assign-plan', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const subService = getSubscriptionService();
    const audit = getAuditService();
    const { userId } = req.params;
    const { planId } = req.body;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify plan exists AND belongs to this tenant
    const plan = await TenantPlanService.getPlanById(planId, tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get current subscription for audit
    const currentSub = await subService.getUserSubscription(userId);

    const subscription = await subService.assignPlan(userId, planId, req.session.userId);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.USER_PLAN_ASSIGNED,
        userId,
        { 
          newPlanId: planId, 
          newPlanName: plan.name,
          previousPlanId: currentSub?.planId,
          previousPlanName: currentSub?.plan?.name,
          tenantId
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan assigned to user', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      planId,
      planName: plan.name,
      endpoint: `/api/admin/users/${userId}/subscription/assign-plan`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to assign plan', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/assign-plan`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/subscription/proration
 * Calculate proration for plan change (tenant-scoped)
 */
router.get('/:userId/subscription/proration', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const { userId } = req.params;
    const { newPlanId } = req.query;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId query parameter is required' });
    }

    // Verify plan exists AND belongs to this tenant
    const plan = await TenantPlanService.getPlanById(newPlanId, tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const proration = await service.calculateProration(userId, newPlanId);

    res.json({ success: true, data: proration });
  } catch (error) {
    logger.error('Failed to calculate proration', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/proration`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
