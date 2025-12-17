/**
 * Admin Stripe Routes
 * 
 * Endpoints for managing Stripe configuration, plan sync, and analytics.
 * All routes require admin authentication.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 12.1, 13.1
 */

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const StripeService = require('../services/StripeService');
const { validateStripeSettings } = require('../validators/stripeValidator');

/**
 * GET /api/admin/stripe/settings
 * Get Stripe settings (masked)
 */
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await StripeService.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get Stripe settings', {
      error: error.message,
      endpoint: '/api/admin/stripe/settings',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/settings
 * Save Stripe API keys
 */
router.post('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validated = validateStripeSettings(req.body);
    
    // Validate keys before saving
    const validation = await StripeService.validateApiKeys(
      validated.secretKey,
      validated.publishableKey
    );

    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid Stripe credentials', 
        details: validation.error 
      });
    }

    await StripeService.saveSettings({
      secretKey: validated.secretKey,
      publishableKey: validated.publishableKey,
      webhookSecret: validated.webhookSecret,
      connectEnabled: validated.connectEnabled || false,
    });

    logger.info('Stripe settings saved', { 
      adminId: req.user?.id,
      endpoint: '/api/admin/stripe/settings',
    });

    res.json({ 
      success: true, 
      message: 'Stripe settings saved successfully',
      accountId: validation.accountId,
    });
  } catch (error) {
    logger.error('Failed to save Stripe settings', {
      error: error.message,
      endpoint: '/api/admin/stripe/settings',
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/test-connection
 * Test Stripe API connection (with new keys or saved keys)
 */
router.post('/test-connection', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { secretKey, publishableKey, useSavedKeys } = req.body;

    // If useSavedKeys is true, test with the already saved keys
    if (useSavedKeys) {
      const accountInfo = await StripeService.getAccountInfo();
      if (!accountInfo) {
        return res.status(400).json({ 
          success: false, 
          error: 'Stripe não está configurado ou as chaves são inválidas' 
        });
      }

      return res.json({ 
        success: true, 
        message: 'Connection successful',
        accountId: accountInfo.id,
        accountInfo,
      });
    }

    // Otherwise, test with provided keys
    if (!secretKey || !publishableKey) {
      return res.status(400).json({ error: 'Secret key and publishable key are required' });
    }

    const validation = await StripeService.validateApiKeys(secretKey, publishableKey);

    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    res.json({ 
      success: true, 
      message: 'Connection successful',
      accountId: validation.accountId,
    });
  } catch (error) {
    logger.error('Stripe connection test failed', {
      error: error.message,
      endpoint: '/api/admin/stripe/test-connection',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/sync-plans
 * Sync local plans with Stripe products/prices
 * Requirements: 2.1, 2.4
 */
router.post('/sync-plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const PlanService = require('../services/PlanService');
    const planService = new PlanService();
    const { planId, forceResync } = req.body;

    let results;

    if (planId) {
      // Sync single plan
      const plan = await planService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      // If forceResync, sync even if already synced
      if (!forceResync && plan.stripePriceId) {
        return res.json({
          success: true,
          data: {
            synced: [],
            skipped: [{ id: plan.id, name: plan.name, reason: 'Already synced' }],
            failed: []
          }
        });
      }

      const syncedPlan = await planService.syncPlanToStripe(planId);
      results = {
        synced: [{ id: syncedPlan.id, name: syncedPlan.name, stripePriceId: syncedPlan.stripePriceId }],
        skipped: [],
        failed: []
      };
    } else {
      // Sync all plans
      results = await planService.syncAllPlansToStripe();
    }

    logger.info('Plans synced with Stripe', { 
      adminId: req.user?.id,
      synced: results.synced.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
      endpoint: '/api/admin/stripe/sync-plans',
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to sync plans with Stripe', {
      error: error.message,
      endpoint: '/api/admin/stripe/sync-plans',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stripe/unsynced-plans
 * Get plans that are not synced with Stripe
 * Requirements: 2.5
 */
router.get('/unsynced-plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const PlanService = require('../services/PlanService');
    const planService = new PlanService();
    
    const unsyncedPlans = await planService.getUnsyncedPlans();

    res.json({ 
      success: true, 
      data: unsyncedPlans,
      count: unsyncedPlans.length
    });
  } catch (error) {
    logger.error('Failed to get unsynced plans', {
      error: error.message,
      endpoint: '/api/admin/stripe/unsynced-plans',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/archive-plan
 * Archive a plan in Stripe
 * Requirements: 2.3
 */
router.post('/archive-plan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const PlanService = require('../services/PlanService');
    const planService = new PlanService();
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const archivedPlan = await planService.archivePlanInStripe(planId);

    logger.info('Plan archived in Stripe', { 
      adminId: req.user?.id,
      planId,
      endpoint: '/api/admin/stripe/archive-plan',
    });

    res.json({ success: true, data: archivedPlan });
  } catch (error) {
    logger.error('Failed to archive plan in Stripe', {
      error: error.message,
      endpoint: '/api/admin/stripe/archive-plan',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stripe/analytics
 * Get payment analytics
 */
router.get('/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const SupabaseService = require('../services/SupabaseService');
    
    // Get subscription stats
    const { data: subscriptions } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('status, plan_id, plans(price_cents)')
      .not('status', 'is', null);

    // Calculate MRR and status breakdown
    const statusBreakdown = {
      active: 0,
      trial: 0,
      past_due: 0,
      canceled: 0,
      expired: 0,
    };

    let mrr = 0;
    for (const sub of subscriptions || []) {
      if (statusBreakdown[sub.status] !== undefined) {
        statusBreakdown[sub.status]++;
      }
      if (sub.status === 'active' && sub.plans?.price_cents) {
        mrr += sub.plans.price_cents;
      }
    }

    // Get credit transaction stats
    const { data: creditStats } = await SupabaseService.adminClient
      .from('credit_transactions')
      .select('type, amount')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let creditPurchases = 0;
    let creditConsumption = 0;
    for (const tx of creditStats || []) {
      if (tx.type === 'purchase') creditPurchases += tx.amount;
      if (tx.type === 'consumption') creditConsumption += Math.abs(tx.amount);
    }

    // Get affiliate stats
    const { data: affiliateStats } = await SupabaseService.adminClient
      .from('affiliate_referrals')
      .select('status, total_commission_earned');

    let totalAffiliates = 0;
    let totalCommissions = 0;
    for (const ref of affiliateStats || []) {
      totalAffiliates++;
      totalCommissions += ref.total_commission_earned || 0;
    }

    res.json({
      success: true,
      data: {
        mrr: mrr / 100, // Convert to currency
        totalActiveSubscriptions: statusBreakdown.active,
        statusBreakdown,
        creditSales: creditPurchases,
        creditConsumption,
        affiliateMetrics: {
          totalAffiliates,
          totalCommissionsPaid: totalCommissions / 100,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get payment analytics', {
      error: error.message,
      endpoint: '/api/admin/stripe/analytics',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/affiliate-config
 * Configure affiliate program
 */
router.post('/affiliate-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { commissionRate, payoutThreshold, enabled } = req.body;
    const SupabaseService = require('../services/SupabaseService');

    const config = {
      commissionRate: commissionRate || 0.10,
      payoutThreshold: payoutThreshold || 5000, // R$50.00 in cents
      enabled: enabled !== false,
    };

    // Save to global_settings
    const { data: existing } = await SupabaseService.adminClient
      .from('global_settings')
      .select('id')
      .eq('key', 'affiliate_config')
      .single();

    if (existing) {
      await SupabaseService.adminClient
        .from('global_settings')
        .update({ value: config, updated_at: new Date().toISOString() })
        .eq('key', 'affiliate_config');
    } else {
      await SupabaseService.adminClient
        .from('global_settings')
        .insert({ key: 'affiliate_config', value: config });
    }

    logger.info('Affiliate config updated', { 
      adminId: req.user?.id,
      config,
      endpoint: '/api/admin/stripe/affiliate-config',
    });

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update affiliate config', {
      error: error.message,
      endpoint: '/api/admin/stripe/affiliate-config',
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
