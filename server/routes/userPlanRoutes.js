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

// Services initialized at module level (use SupabaseService internally)
const planService = new PlanService();
const subscriptionService = new SubscriptionService();

/**
 * GET /api/user/plans
 * List all active plans available for subscription/upgrade
 */
router.get('/', requireUser, async (req, res) => {
  const userId = getUserId(req);
  try {
    // Get all active plans
    const plans = await planService.listPlans({ status: 'active' });
    
    // Get current user subscription to mark current plan
    let currentPlanId = null;
    const subscription = await subscriptionService.getUserSubscription(userId);
    currentPlanId = subscription?.planId || null;

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
