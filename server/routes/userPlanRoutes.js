/**
 * User Plan Routes
 * 
 * Endpoints for users to view available plans for upgrade.
 * All routes require user authentication.
 * 
 * Requirements: 3.3, 3.4
 */

const express = require('express');
const { requireUser, getUserId } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const PlanService = require('../services/PlanService');
const SubscriptionService = require('../services/SubscriptionService');

const router = express.Router();

// Services initialized lazily
let planService = null;
let subscriptionService = null;

function getPlanService(req) {
  if (!planService) {
    const db = req.app.locals.db;
    if (db) {
      planService = new PlanService(db);
    }
  }
  return planService;
}

function getSubscriptionService(req) {
  if (!subscriptionService) {
    const db = req.app.locals.db;
    if (db) {
      subscriptionService = new SubscriptionService(db);
    }
  }
  return subscriptionService;
}

/**
 * GET /api/user/plans
 * List all active plans available for subscription/upgrade
 */
router.get('/', requireUser, async (req, res) => {
  const userId = getUserId(req);
  try {
    const service = getPlanService(req);
    const subService = getSubscriptionService(req);
    
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Get all active plans
    const plans = await service.listPlans({ status: 'active' });
    
    // Get current user subscription to mark current plan
    let currentPlanId = null;
    if (subService) {
      const subscription = await subService.getUserSubscription(userId);
      currentPlanId = subscription?.planId || null;
    }

    // Format plans for frontend (exclude internal fields)
    // Filter out credit packages - users should only see subscription plans
    const subscriptionPlans = plans.filter(plan => !plan.isCreditPackage);
    
    const formattedPlans = subscriptionPlans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      billingCycle: plan.billingCycle,
      trialDays: plan.trialDays,
      isDefault: plan.isDefault,
      isCurrent: plan.id === currentPlanId,
      quotas: plan.quotas || {},
      features: plan.features || [],
      stripePriceId: plan.stripePriceId ? true : false, // Only indicate if synced, don't expose ID
    }));

    // Sort by price (free first, then ascending)
    formattedPlans.sort((a, b) => a.priceCents - b.priceCents);

    logger.info('User plans listed', {
      userId,
      count: formattedPlans.length,
      endpoint: '/api/user/plans'
    });

    res.json({ success: true, data: formattedPlans });
  } catch (error) {
    logger.error('Failed to list user plans', {
      error: error.message,
      userId,
      endpoint: '/api/user/plans'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
