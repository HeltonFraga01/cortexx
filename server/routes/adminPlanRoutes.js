/**
 * Admin Plan Routes
 * 
 * Endpoints for managing subscription plans.
 * All routes require admin authentication.
 * 
 * Requirements: 1.1, 1.4, 1.5, 1.6
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const PlanService = require('../services/PlanService');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

// Services initialized lazily
let planService = null;
let auditService = null;

function getPlanService(req) {
  if (!planService) {
    const db = req.app.locals.db;
    if (db) {
      planService = new PlanService(db);
    }
  }
  return planService;
}

function getAuditService(req) {
  if (!auditService) {
    const db = req.app.locals.db;
    if (db) {
      auditService = new AdminAuditService(db);
    }
  }
  return auditService;
}

/**
 * GET /api/admin/plans
 * List all plans with subscriber counts
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const service = getPlanService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const plans = await service.listPlans(filters);

    logger.info('Plans listed', {
      userId: req.session.userId,
      count: plans.length,
      endpoint: '/api/admin/plans'
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Failed to list plans', {
      error: error.message,
      userId: req.session.userId,
      endpoint: '/api/admin/plans'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/plans
 * Create a new plan
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const service = getPlanService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { name, description, priceCents, billingCycle, status, isDefault, trialDays, quotas, features } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    // Check for duplicate name
    const existing = await service.getPlanByName(name.trim());
    if (existing) {
      return res.status(409).json({ error: 'A plan with this name already exists' });
    }

    const plan = await service.createPlan({
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
        { planId: plan.id, planName: plan.name },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan created', {
      userId: req.session.userId,
      planId: plan.id,
      planName: plan.name,
      endpoint: '/api/admin/plans'
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error('Failed to create plan', {
      error: error.message,
      userId: req.session.userId,
      endpoint: '/api/admin/plans'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/plans/:id
 * Get a specific plan by ID
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const service = getPlanService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const plan = await service.getPlanById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    logger.info('Plan retrieved', {
      userId: req.session.userId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error('Failed to get plan', {
      error: error.message,
      userId: req.session.userId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Update a plan
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const service = getPlanService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const planId = req.params.id;
    const existingPlan = await service.getPlanById(planId);

    if (!existingPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { name, description, priceCents, billingCycle, status, isDefault, trialDays, quotas, features, effectiveDate } = req.body;

    // Check for duplicate name if changing
    if (name && name !== existingPlan.name) {
      const duplicate = await service.getPlanByName(name.trim());
      if (duplicate) {
        return res.status(409).json({ error: 'A plan with this name already exists' });
      }
    }

    const updatedPlan = await service.updatePlan(planId, {
      name: name?.trim(),
      description,
      priceCents,
      billingCycle,
      status,
      isDefault,
      trialDays,
      quotas,
      features
    }, effectiveDate ? new Date(effectiveDate) : null);

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.PLAN_UPDATED,
        null,
        { 
          planId, 
          planName: updatedPlan.name,
          changes: req.body
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan updated', {
      userId: req.session.userId,
      planId,
      endpoint: `/api/admin/plans/${planId}`
    });

    res.json({ success: true, data: updatedPlan });
  } catch (error) {
    logger.error('Failed to update plan', {
      error: error.message,
      userId: req.session.userId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/plans/:id
 * Delete a plan (requires migration of users if any)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const service = getPlanService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const planId = req.params.id;
    const { migrateToPlanId } = req.body;

    const existingPlan = await service.getPlanById(planId);
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

    // Validate migration target if provided
    if (migrateToPlanId) {
      const targetPlan = await service.getPlanById(migrateToPlanId);
      if (!targetPlan) {
        return res.status(400).json({ error: 'Migration target plan not found' });
      }
    }

    await service.deletePlan(planId, migrateToPlanId);

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.PLAN_DELETED,
        null,
        { 
          planId, 
          planName: existingPlan.name,
          migrateToPlanId,
          subscribersMigrated: existingPlan.subscriberCount
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan deleted', {
      userId: req.session.userId,
      planId,
      migrateToPlanId,
      endpoint: `/api/admin/plans/${planId}`
    });

    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete plan', {
      error: error.message,
      userId: req.session.userId,
      planId: req.params.id,
      endpoint: `/api/admin/plans/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
