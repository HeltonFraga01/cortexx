/**
 * Admin User Subscription Routes
 * 
 * Endpoints for managing user subscriptions.
 * All routes require admin authentication.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const PlanService = require('../services/PlanService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

let subscriptionService = null;
let planService = null;
let auditService = null;

function getSubscriptionService() {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService(SupabaseService);
  }
  return subscriptionService;
}

function getPlanService() {
  if (!planService) {
    planService = new PlanService(SupabaseService);
  }
  return planService;
}

function getAuditService() {
  if (!auditService) {
    auditService = new AdminAuditService(SupabaseService);
  }
  return auditService;
}

/**
 * GET /api/admin/users/:userId/subscription
 * Get user subscription details
 * Returns null data if user has no subscription (not 404)
 */
router.get('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const service = getSubscriptionService();
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const subscription = await service.getUserSubscription(userId);

    // Return success with null data if no subscription exists
    // This is more graceful than 404 for optional data
    if (!subscription) {
      return res.json({ success: true, data: null });
    }

    logger.info('Subscription retrieved', {
      adminId: req.session.userId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to get subscription', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/subscription
 * Update subscription status
 */
router.put('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const service = getSubscriptionService();
    const audit = getAuditService();
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { status, reason } = req.body;

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
        { status, reason },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Subscription status updated', {
      adminId: req.session.userId,
      targetUserId: userId,
      status,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to update subscription', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/subscription/assign-plan
 * Assign a plan to a user
 */
router.post('/:userId/subscription/assign-plan', requireAdmin, async (req, res) => {
  try {
    const subService = getSubscriptionService();
    const plnService = getPlanService();
    const audit = getAuditService();
    if (!subService || !plnService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify plan exists
    const plan = await plnService.getPlanById(planId);
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
          previousPlanName: currentSub?.plan?.name
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan assigned to user', {
      adminId: req.session.userId,
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
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/assign-plan`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/subscription/proration
 * Calculate proration for plan change
 */
router.get('/:userId/subscription/proration', requireAdmin, async (req, res) => {
  try {
    const service = getSubscriptionService();
    const plnService = getPlanService();
    if (!service || !plnService) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const { newPlanId } = req.query;

    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId query parameter is required' });
    }

    // Verify plan exists
    const plan = await plnService.getPlanById(newPlanId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const proration = await service.calculateProration(userId, newPlanId);

    res.json({ success: true, data: proration });
  } catch (error) {
    logger.error('Failed to calculate proration', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/proration`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
