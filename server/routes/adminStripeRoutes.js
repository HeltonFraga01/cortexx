/**
 * Admin Stripe Routes
 * 
 * Endpoints for managing Stripe configuration, plan sync, and analytics.
 * All routes require admin authentication and use tenant context.
 * 
 * Requirements: REQ-12 (Multi-Tenant Isolation Audit)
 * Task 1.1, 1.2: Redis cache for settings and analytics
 */

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const StripeService = require('../services/StripeService');
const CacheService = require('../services/CacheService');
const { validateStripeSettings, validateWebhookSecret } = require('../validators/stripeValidator');

/**
 * Get tenant ID from request context
 * Supports both context (from impersonation) and session (from login)
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID
 */
function getTenantId(req) {
  return req.context?.tenantId || req.session?.tenantId || null;
}

/**
 * Get tenant's Stripe Connect ID
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<string|null>} Stripe Connect ID
 */
async function getTenantStripeConnectId(tenantId) {
  const SupabaseService = require('../services/SupabaseService');
  
  const { data: tenant, error } = await SupabaseService.adminClient
    .from('tenants')
    .select('stripe_connect_id')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    return null;
  }

  return tenant.stripe_connect_id;
}

/**
 * GET /api/admin/stripe/settings
 * Get Stripe settings (masked) for the tenant
 * Task 1.1: Cache with 5 min TTL
 */
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    // Log tenant context for debugging
    logger.debug('Stripe settings request', {
      tenantId,
      sessionTenantId: req.session?.tenantId,
      contextTenantId: req.context?.tenantId,
      userId: req.session?.userId || req.user?.id,
      endpoint: '/api/admin/stripe/settings',
    });
    
    if (!tenantId) {
      logger.warn('Stripe settings request without tenant context', {
        sessionKeys: req.session ? Object.keys(req.session) : [],
        hasContext: !!req.context,
        contextKeys: req.context ? Object.keys(req.context) : [],
        userId: req.session?.userId || req.user?.id,
      });
      return res.status(403).json({ 
        success: false,
        error: 'Tenant context required. Please log in again.' 
      });
    }

    // Fetch settings directly without cache to avoid potential cache issues
    let settings;
    let fromCache = false;
    
    try {
      const cacheKey = CacheService.CACHE_KEYS.STRIPE_SETTINGS(tenantId);
      const cacheResult = await CacheService.getOrSet(
        cacheKey,
        CacheService.TTL.STRIPE_SETTINGS,
        async () => {
          const stripeConnectId = await getTenantStripeConnectId(tenantId);
          const baseSettings = await StripeService.getSettings();
          
          return {
            ...baseSettings,
            stripeConnectId,
            tenantId,
          };
        }
      );
      settings = cacheResult.data;
      fromCache = cacheResult.fromCache;
    } catch (cacheError) {
      // If cache fails, fetch directly
      logger.warn('Cache failed, fetching directly', { 
        error: cacheError.message,
        tenantId 
      });
      const stripeConnectId = await getTenantStripeConnectId(tenantId);
      const baseSettings = await StripeService.getSettings();
      settings = {
        ...baseSettings,
        stripeConnectId,
        tenantId,
      };
    }

    res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');
    return res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get Stripe settings', {
      error: error.message,
      stack: error.stack,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/settings',
    });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/stripe/settings
 * Save Stripe API keys for the tenant
 * Task 1.7: Invalidate cache on mutation
 */
router.post('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const validated = validateStripeSettings(req.body);
    
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

    const SupabaseService = require('../services/SupabaseService');
    
    await SupabaseService.adminClient
      .from('tenants')
      .update({
        stripe_connect_id: validation.accountId,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    await StripeService.saveSettings({
      secretKey: validated.secretKey,
      publishableKey: validated.publishableKey,
      webhookSecret: validated.webhookSecret,
      connectEnabled: validated.connectEnabled || false,
    });

    // Task 1.7: Invalidate cache after mutation
    await CacheService.invalidateStripeSettingsCache(tenantId);
    await CacheService.invalidateStripeAnalyticsCache(tenantId);

    logger.info('Stripe settings saved', { 
      adminId: req.user?.id,
      tenantId,
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
      tenantId: getTenantId(req),
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
 * Test Stripe API connection
 */
router.post('/test-connection', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { secretKey, publishableKey, useSavedKeys } = req.body;

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
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/test-connection',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync a single plan with Stripe - creates product and price
 * @param {Object} plan - Plan object from TenantPlanService
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<{success: boolean, stripePriceId?: string, stripeProductId?: string, error?: string}>}
 */
async function syncPlanToStripe(plan, tenantId) {
  const SupabaseService = require('../services/SupabaseService');
  
  try {
    // Create product in Stripe
    const product = await StripeService.createProduct(
      plan.name,
      plan.description || `Plano ${plan.name}`,
      {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
      `plan_product_${plan.id}` // idempotency key
    );

    // Determine recurring interval based on billing cycle
    const recurringInterval = plan.billingCycle === 'yearly' ? 'year' : 'month';
    
    // Create price in Stripe
    const price = await StripeService.createPrice(
      product.id,
      plan.priceCents,
      'brl',
      { interval: recurringInterval },
      `plan_price_${plan.id}` // idempotency key
    );

    // Update plan in database with Stripe IDs
    const { error: updateError } = await SupabaseService.adminClient
      .from('tenant_plans')
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw updateError;
    }

    logger.info('Plan synced to Stripe', {
      planId: plan.id,
      planName: plan.name,
      stripeProductId: product.id,
      stripePriceId: price.id,
      tenantId,
    });

    return {
      success: true,
      stripeProductId: product.id,
      stripePriceId: price.id,
    };
  } catch (error) {
    logger.error('Failed to sync plan to Stripe', {
      error: error.message,
      planId: plan.id,
      planName: plan.name,
      tenantId,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * POST /api/admin/stripe/sync-plans
 * Sync tenant plans with Stripe - creates products and prices
 */
router.post('/sync-plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    // Verify Stripe is configured
    const stripeSettings = await StripeService.getSettings();
    if (!stripeSettings.isConfigured) {
      return res.status(400).json({ 
        error: 'Stripe não está configurado. Configure as chaves API primeiro.' 
      });
    }

    const TenantPlanService = require('../services/TenantPlanService');
    const { planId, forceResync } = req.body;

    const results = { synced: [], skipped: [], failed: [] };

    if (planId) {
      // Sync single plan
      const plan = await TenantPlanService.getPlanById(planId, tenantId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      if (!forceResync && plan.stripePriceId) {
        results.skipped.push({ id: plan.id, name: plan.name, reason: 'Already synced' });
      } else {
        const syncResult = await syncPlanToStripe(plan, tenantId);
        if (syncResult.success) {
          results.synced.push({ 
            id: plan.id, 
            name: plan.name, 
            stripePriceId: syncResult.stripePriceId,
            stripeProductId: syncResult.stripeProductId,
          });
        } else {
          results.failed.push({ 
            id: plan.id, 
            name: plan.name, 
            error: syncResult.error 
          });
        }
      }
    } else {
      // Sync all plans
      const plans = await TenantPlanService.listPlans(tenantId);

      for (const plan of plans) {
        if (plan.stripePriceId && !forceResync) {
          results.skipped.push({ id: plan.id, name: plan.name, reason: 'Already synced' });
        } else {
          const syncResult = await syncPlanToStripe(plan, tenantId);
          if (syncResult.success) {
            results.synced.push({ 
              id: plan.id, 
              name: plan.name, 
              stripePriceId: syncResult.stripePriceId,
              stripeProductId: syncResult.stripeProductId,
            });
          } else {
            results.failed.push({ 
              id: plan.id, 
              name: plan.name, 
              error: syncResult.error 
            });
          }
        }
      }
    }

    // Invalidate plans cache after sync
    await CacheService.invalidatePlansCache(tenantId);

    logger.info('Tenant plans synced with Stripe', { 
      adminId: req.user?.id,
      tenantId,
      synced: results.synced.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
      endpoint: '/api/admin/stripe/sync-plans',
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to sync plans with Stripe', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/sync-plans',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stripe/unsynced-plans
 * Get tenant plans not synced with Stripe
 */
router.get('/unsynced-plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const TenantPlanService = require('../services/TenantPlanService');
    const plans = await TenantPlanService.listPlans(tenantId);
    const unsyncedPlans = plans.filter(plan => !plan.stripePriceId);

    res.json({ 
      success: true, 
      data: unsyncedPlans,
      count: unsyncedPlans.length
    });
  } catch (error) {
    logger.error('Failed to get unsynced plans', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/unsynced-plans',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/archive-plan
 * Archive a tenant plan in Stripe
 */
router.post('/archive-plan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const TenantPlanService = require('../services/TenantPlanService');
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const plan = await TenantPlanService.getPlanById(planId, tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const archivedPlan = await TenantPlanService.updatePlan(planId, tenantId, {
      status: 'archived'
    });

    logger.info('Plan archived in Stripe', { 
      adminId: req.user?.id,
      tenantId,
      planId,
      endpoint: '/api/admin/stripe/archive-plan',
    });

    res.json({ success: true, data: archivedPlan });
  } catch (error) {
    logger.error('Failed to archive plan in Stripe', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/archive-plan',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stripe/analytics
 * Get payment analytics for the tenant
 * Task 1.2: Cache with 2 min TTL
 */
router.get('/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const cacheKey = CacheService.CACHE_KEYS.STRIPE_ANALYTICS(tenantId);
    const { data: analytics, fromCache } = await CacheService.getOrSet(
      cacheKey,
      CacheService.TTL.STRIPE_ANALYTICS,
      async () => {
        const SupabaseService = require('../services/SupabaseService');
        
        const { data: subscriptions } = await SupabaseService.adminClient
          .from('user_subscriptions')
          .select(`
            status, 
            plan_id, 
            tenant_plans!inner(price_cents, tenant_id)
          `)
          .eq('tenant_plans.tenant_id', tenantId)
          .not('status', 'is', null);

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
          if (sub.status === 'active' && sub.tenant_plans?.price_cents) {
            mrr += sub.tenant_plans.price_cents;
          }
        }

        const { data: tenantAccounts } = await SupabaseService.adminClient
          .from('accounts')
          .select('id')
          .eq('tenant_id', tenantId);

        const accountIds = (tenantAccounts || []).map(a => a.id);

        let creditPurchases = 0;
        let creditConsumption = 0;

        if (accountIds.length > 0) {
          const { data: creditStats } = await SupabaseService.adminClient
            .from('credit_transactions')
            .select('type, amount')
            .in('account_id', accountIds)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          for (const tx of creditStats || []) {
            if (tx.type === 'purchase') creditPurchases += tx.amount;
            if (tx.type === 'consumption') creditConsumption += Math.abs(tx.amount);
          }
        }

        const { data: affiliateStats } = await SupabaseService.adminClient
          .from('affiliate_referrals')
          .select('status, total_commission_earned')
          .eq('tenant_id', tenantId);

        let totalAffiliates = 0;
        let totalCommissions = 0;
        for (const ref of affiliateStats || []) {
          totalAffiliates++;
          totalCommissions += ref.total_commission_earned || 0;
        }

        return {
          mrr: mrr / 100,
          totalActiveSubscriptions: statusBreakdown.active,
          statusBreakdown,
          creditSales: creditPurchases,
          creditConsumption,
          affiliateMetrics: {
            totalAffiliates,
            totalCommissionsPaid: totalCommissions / 100,
          },
        };
      }
    );

    res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Failed to get payment analytics', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/analytics',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stripe/affiliate-config
 * Get affiliate program configuration for the tenant
 */
router.get('/affiliate-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const TenantSettingsService = require('../services/TenantSettingsService');
    
    const setting = await TenantSettingsService.getSetting(tenantId, 'affiliate_config');
    
    // Default config if not set
    const defaultConfig = {
      commissionRate: 0.10,
      payoutThreshold: 10000,
      enabled: false,
    };

    let config = defaultConfig;
    if (setting?.value) {
      try {
        const parsed = typeof setting.value === 'string' 
          ? JSON.parse(setting.value) 
          : setting.value;
        config = { ...defaultConfig, ...parsed };
      } catch (parseError) {
        logger.warn('Failed to parse affiliate config, using defaults', {
          tenantId,
          error: parseError.message,
        });
      }
    }

    logger.debug('Affiliate config loaded', { 
      tenantId,
      config,
      endpoint: '/api/admin/stripe/affiliate-config',
    });

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get affiliate config', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/affiliate-config',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stripe/affiliate-config
 * Configure affiliate program for the tenant
 */
router.post('/affiliate-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { commissionRate, payoutThreshold, enabled } = req.body;

    const config = {
      commissionRate: commissionRate || 0.10,
      payoutThreshold: payoutThreshold || 5000,
      enabled: enabled !== false,
    };

    const TenantSettingsService = require('../services/TenantSettingsService');
    
    await TenantSettingsService.updateSetting(
      tenantId,
      'affiliate_config',
      JSON.stringify(config),
      req.user?.id
    );

    logger.info('Affiliate config updated', { 
      adminId: req.user?.id,
      tenantId,
      config,
      endpoint: '/api/admin/stripe/affiliate-config',
    });

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update affiliate config', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/stripe/affiliate-config',
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
