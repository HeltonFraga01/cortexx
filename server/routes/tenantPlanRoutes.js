/**
 * Tenant Plan Routes
 * 
 * Handles tenant plan management for tenant admins.
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const TenantService = require('../services/TenantService');
const { requireTenantAdmin } = require('../middleware/tenantAuth');

// Initialize service
const tenantService = new TenantService();

/**
 * GET /api/tenant/plans
 * List all plans for the current tenant
 * Requirements: 6.1 - List tenant plans
 */
router.get('/plans', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;
    const { status, billing_cycle } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (billing_cycle) filters.billing_cycle = billing_cycle;

    const plans = await tenantService.listPlans(tenantId, filters);

    logger.info('Tenant plans listed', {
      tenantId,
      userId: req.session.userId,
      planCount: plans.length,
      filters
    });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Failed to list tenant plans', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tenant/plans
 * Create a new plan for the current tenant
 * Requirements: 6.2 - Create plan with quota validation
 */
router.post('/plans', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;
    const {
      name,
      description,
      price_cents = 0,
      billing_cycle = 'monthly',
      status = 'active',
      is_default = false,
      trial_days = 0,
      quotas = {},
      features = {},
      stripe_product_id,
      stripe_price_id
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Plan name is required and must be a non-empty string'
      });
    }

    if (price_cents < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price cannot be negative'
      });
    }

    if (!['monthly', 'yearly', 'one_time'].includes(billing_cycle)) {
      return res.status(400).json({
        success: false,
        error: 'Billing cycle must be monthly, yearly, or one_time'
      });
    }

    if (!['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be active, inactive, or archived'
      });
    }

    if (trial_days < 0) {
      return res.status(400).json({
        success: false,
        error: 'Trial days cannot be negative'
      });
    }

    // Validate quotas structure
    if (quotas && typeof quotas !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Quotas must be an object'
      });
    }

    // Validate features structure
    if (features && typeof features !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Features must be an object'
      });
    }

    const planData = {
      name: name.trim(),
      description: description?.trim() || null,
      price_cents,
      billing_cycle,
      status,
      is_default,
      trial_days,
      quotas,
      features,
      stripe_product_id: stripe_product_id || null,
      stripe_price_id: stripe_price_id || null
    };

    const plan = await tenantService.createPlan(tenantId, planData);

    logger.info('Tenant plan created', {
      tenantId,
      userId: req.session.userId,
      planId: plan.id,
      planName: plan.name,
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.status(201).json({
      success: true,
      data: plan,
      message: 'Plan created successfully'
    });
  } catch (error) {
    logger.error('Failed to create tenant plan', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      planName: req.body?.name
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/tenant/plans/:id
 * Update an existing plan
 * Requirements: 6.3 - Update plan with quota validation
 */
router.put('/plans/:id', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;
    const updates = req.body;

    // Validate plan belongs to tenant
    const existingPlans = await tenantService.listPlans(tenantId);
    const planExists = existingPlans.some(plan => plan.id === id);
    
    if (!planExists) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found or does not belong to this tenant'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;
    delete updates.updated_at;

    // Validate updates
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Plan name must be a non-empty string'
        });
      }
      updates.name = updates.name.trim();
    }

    if (updates.price_cents !== undefined && updates.price_cents < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price cannot be negative'
      });
    }

    if (updates.billing_cycle !== undefined && !['monthly', 'yearly', 'one_time'].includes(updates.billing_cycle)) {
      return res.status(400).json({
        success: false,
        error: 'Billing cycle must be monthly, yearly, or one_time'
      });
    }

    if (updates.status !== undefined && !['active', 'inactive', 'archived'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be active, inactive, or archived'
      });
    }

    if (updates.trial_days !== undefined && updates.trial_days < 0) {
      return res.status(400).json({
        success: false,
        error: 'Trial days cannot be negative'
      });
    }

    if (updates.quotas !== undefined && typeof updates.quotas !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Quotas must be an object'
      });
    }

    if (updates.features !== undefined && typeof updates.features !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Features must be an object'
      });
    }

    const updatedPlan = await tenantService.updatePlan(id, updates);

    logger.info('Tenant plan updated', {
      tenantId,
      userId: req.session.userId,
      planId: id,
      updatedFields: Object.keys(updates),
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      data: updatedPlan,
      message: 'Plan updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update tenant plan', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      planId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/tenant/plans/:id
 * Delete a plan (with optional subscription migration)
 * Requirements: 6.4 - Delete plan with subscription handling
 */
router.delete('/plans/:id', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;
    const { migrate_to_plan_id } = req.body;

    // Validate plan belongs to tenant
    const existingPlans = await tenantService.listPlans(tenantId);
    const planExists = existingPlans.some(plan => plan.id === id);
    
    if (!planExists) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found or does not belong to this tenant'
      });
    }

    // If migration plan is specified, validate it exists and belongs to tenant
    if (migrate_to_plan_id) {
      const migrationPlanExists = existingPlans.some(plan => plan.id === migrate_to_plan_id);
      if (!migrationPlanExists) {
        return res.status(400).json({
          success: false,
          error: 'Migration plan not found or does not belong to this tenant'
        });
      }
    }

    await tenantService.deletePlan(id, migrate_to_plan_id);

    logger.warn('Tenant plan deleted', {
      tenantId,
      userId: req.session.userId,
      planId: id,
      migrateToPlanId: migrate_to_plan_id,
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete tenant plan', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      planId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tenant/plans/:id/sync-stripe
 * Sync plan with Stripe (create/update product and price)
 * Requirements: 6.4 - Stripe integration
 */
router.post('/plans/:id/sync-stripe', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;

    // Validate plan belongs to tenant
    const existingPlans = await tenantService.listPlans(tenantId);
    const plan = existingPlans.find(p => p.id === id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found or does not belong to this tenant'
      });
    }

    // TODO: Implement Stripe sync logic
    // This would involve:
    // 1. Create/update Stripe product
    // 2. Create/update Stripe price
    // 3. Update plan with Stripe IDs
    
    logger.info('Stripe sync requested for tenant plan', {
      tenantId,
      userId: req.session.userId,
      planId: id,
      planName: plan.name
    });

    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Stripe sync functionality will be implemented',
      data: {
        planId: id,
        stripeProductId: plan.stripe_product_id,
        stripePriceId: plan.stripe_price_id
      }
    });
  } catch (error) {
    logger.error('Failed to sync plan with Stripe', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      planId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;