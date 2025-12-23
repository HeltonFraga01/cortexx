/**
 * Admin Plan Routes
 * 
 * Endpoints for managing tenant-specific subscription plans.
 * All routes require admin authentication and tenant context.
 * 
 * Requirements: 1.1, 1.4, 1.5, 1.6
 * Multi-Tenant Isolation: REQ-1
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const TenantPlanService = require('../services/TenantPlanService');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

// Services initialized lazily
const auditService = new AdminAuditService();

/**
 * Validate tenant context is present
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID or null if missing
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * GET /api/admin/plans
 * List all plans for the current tenant with subscriber counts
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const plans = await TenantPlanService.listPlans(tenantId, filters);

    logger.info('Tenant plans listed', {
      userId: req.session.userId,
      tenantId,
      count: plans.length,
      endpoint: '/api/admin/plans'
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Failed to list tenant plans', {
      error: error.message,
      userId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/plans'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/plans
 * Create a new plan for the current tenant
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const audit = auditService;

    const { name, description, priceCents, billingCycle, status, isDefault, trialDays, quotas, features } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    // Check for duplicate name within tenant
    const existing = await TenantPlanService.getPlanByName(name.trim(), tenantId);
    if (existing) {
      return res.status(409).json({ error: 'A plan with this name already exists' });
    }

    const plan = await TenantPlanService.createPlan(tenantId, {
      name: name.trim(),
      description,
      priceCents: priceCents || 0,
      billingCycle: billingCycle || 'monthly',
      status: status || 'active',
      isDefault: isDefault || false,
      trialDays: trialDays || 0,
      quotas,
      features
    });

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.PLAN_CREATED,
        null,
        { planId: plan.id, planName: plan.name, tenantId },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant plan created', {
      userId: req.session.userId,
      tenantId,
      planId: plan.id,
      planName: plan.name,
      endpoint: '/api/admin/plans'
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error('Failed to create tenant plan', {
      error: error.message,
      userId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/plans'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/plans/:id
 * Get a specific plan by ID (tenant-scoped)
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const plan = await TenantPlanService.getPlanById(req.params.id, tenantId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    logger.info('Tenant plan retrieved', {
      userId: req.session.userId,
      tenantId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error('Failed to get tenant plan', {
      error: error.message,
      userId: req.session.userId,
      tenantId: req.context?.tenantId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Update a plan (tenant-scoped)
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const audit = auditService;
    const planId = req.params.id;
    
    const existingPlan = await TenantPlanService.getPlanById(planId, tenantId);

    if (!existingPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { name, description, priceCents, billingCycle, status, isDefault, trialDays, quotas, features, effectiveDate } = req.body;

    // Check for duplicate name if changing
    if (name && name !== existingPlan.name) {
      const duplicate = await TenantPlanService.getPlanByName(name.trim(), tenantId);
      if (duplicate) {
        return res.status(409).json({ error: 'A plan with this name already exists' });
      }
    }

    const updatedPlan = await TenantPlanService.updatePlan(planId, tenantId, {
      name: name?.trim(),
      description,
      priceCents,
      billingCycle,
      status,
      isDefault,
      trialDays,
      quotas,
      features
    });

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.PLAN_UPDATED,
        null,
        { 
          planId, 
          planName: updatedPlan.name,
          tenantId,
          changes: req.body
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant plan updated', {
      userId: req.session.userId,
      tenantId,
      planId,
      endpoint: `/api/admin/plans/${planId}`
    });

    res.json({ success: true, data: updatedPlan });
  } catch (error) {
    logger.error('Failed to update tenant plan', {
      error: error.message,
      userId: req.session.userId,
      tenantId: req.context?.tenantId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/plans/:id
 * Delete a plan (requires migration of users if any) - tenant-scoped
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const audit = auditService;
    const planId = req.params.id;
    const { migrateToPlanId } = req.body;

    const existingPlan = await TenantPlanService.getPlanById(planId, tenantId);
    if (!existingPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if plan has subscribers
    if (existingPlan.subscriberCount > 0 && !migrateToPlanId) {
      return res.status(409).json({
        error: `Cannot delete plan with ${existingPlan.subscriberCount} active subscribers. Provide migrateToPlanId.`,
        subscriberCount: existingPlan.subscriberCount
      });
    }

    // Validate migration target if provided (must belong to same tenant)
    if (migrateToPlanId) {
      const targetPlan = await TenantPlanService.getPlanById(migrateToPlanId, tenantId);
      if (!targetPlan) {
        return res.status(400).json({ error: 'Migration target plan not found' });
      }
    }

    await TenantPlanService.deletePlan(planId, tenantId, migrateToPlanId);

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.PLAN_DELETED,
        null,
        { 
          planId, 
          planName: existingPlan.name,
          tenantId,
          migrateToPlanId,
          subscribersMigrated: existingPlan.subscriberCount
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant plan deleted', {
      userId: req.session.userId,
      tenantId,
      planId,
      migrateToPlanId,
      endpoint: `/api/admin/plans/${planId}`
    });

    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete tenant plan', {
      error: error.message,
      userId: req.session.userId,
      tenantId: req.context?.tenantId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
