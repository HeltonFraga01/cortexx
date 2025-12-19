/**
 * Superadmin Tenant Management Routes
 * 
 * Handles tenant CRUD operations for superadmins.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');
const { skipCsrf } = require('../middleware/csrf');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * GET /api/superadmin/tenants
 * List all tenants with pagination and filtering
 * Requirements: 2.1 - List tenants
 */
router.get('/tenants', requireSuperadmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    const result = await superadminService.listTenants({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    logger.info('Tenants listed by superadmin', {
      superadminId: req.session.userId,
      totalTenants: result.total,
      page,
      limit,
      filters
    });

    res.json({
      success: true,
      data: result.tenants,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to list tenants', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/validate-subdomain
 * Validate subdomain availability
 * Requirements: 2.2 - Validate subdomain before tenant creation
 * Note: skipCsrf is used because this is a read-only validation endpoint
 */
router.post('/tenants/validate-subdomain', skipCsrf, requireSuperadmin, async (req, res) => {
  try {
    const { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({
        success: true,
        data: { valid: false, error: 'Subdomain is required' }
      });
    }

    // Basic format validation
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (subdomain.length < 3 || subdomain.length > 63) {
      return res.json({
        success: true,
        data: { valid: false, error: 'Subdomain must be 3-63 characters long' }
      });
    }

    if (!subdomainRegex.test(subdomain) || subdomain.includes('--')) {
      return res.json({
        success: true,
        data: { valid: false, error: 'Invalid format. Use lowercase letters, numbers, and hyphens only' }
      });
    }

    // Reserved subdomains
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev', 'prod'];
    if (reserved.includes(subdomain)) {
      return res.json({
        success: true,
        data: { valid: false, error: 'This subdomain is reserved' }
      });
    }

    // Check if subdomain already exists
    const isAvailable = await superadminService.isSubdomainAvailable(subdomain);

    logger.info('Subdomain validation', {
      superadminId: req.session.userId,
      subdomain,
      isAvailable
    });

    res.json({
      success: true,
      data: { valid: isAvailable, error: isAvailable ? null : 'Subdomain is already taken' }
    });
  } catch (error) {
    logger.error('Failed to validate subdomain', {
      error: error.message,
      superadminId: req.session?.userId,
      subdomain: req.body?.subdomain
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants
 * Create a new tenant
 * Requirements: 2.2 - Create tenant with default branding and plans
 */
router.post('/tenants', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { subdomain, name, ownerEmail, settings = {} } = req.body;

    // Validate required fields
    if (!subdomain || !name || !ownerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Subdomain, name, and owner email are required'
      });
    }

    // Create tenant
    const tenant = await superadminService.createTenant({
      subdomain,
      name,
      ownerEmail,
      settings,
      createdBy: req.session.userId
    });

    logger.info('Tenant created by superadmin', {
      superadminId: req.session.userId,
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      name: tenant.name
    });

    res.status(201).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    logger.error('Failed to create tenant', {
      error: error.message,
      superadminId: req.session?.userId,
      subdomain: req.body?.subdomain
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/tenants/:id
 * Get tenant details by ID
 * Requirements: 2.1 - Get tenant details
 */
router.get('/tenants/:id', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { includeMetrics = false } = req.query;

    const tenant = await superadminService.getTenantById(id, {
      includeMetrics: includeMetrics === 'true'
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant details retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      includeMetrics
    });

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    logger.error('Failed to get tenant details', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/superadmin/tenants/:id
 * Update tenant information
 * Requirements: 2.3, 3.3 - Update tenant
 */
router.put('/tenants/:id', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const superadminId = req.session.userId;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.subdomain; // Subdomain cannot be changed
    delete updates.created_at;
    delete updates.updated_at;
    delete updates.owner_superadmin_id;

    // Validate status if provided
    if (updates.status && !['active', 'inactive', 'suspended'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "active", "inactive", or "suspended"'
      });
    }

    const tenant = await superadminService.updateTenant(id, updates, superadminId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant updated by superadmin', {
      superadminId,
      tenantId: id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    logger.error('Failed to update tenant', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/superadmin/tenants/:id
 * Delete tenant and all associated data
 * Requirements: 2.4 - Delete tenant with cascade
 */
router.delete('/tenants/:id', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;

    // Require explicit confirmation for deletion
    if (!confirm || confirm !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Deletion must be confirmed with "confirm": "DELETE"'
      });
    }

    // Get tenant info before deletion for logging
    const tenant = await superadminService.getTenantById(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Delete tenant (cascade delete handled in service)
    await superadminService.deleteTenant(id);

    logger.warn('Tenant deleted by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      tenantSubdomain: tenant.subdomain,
      tenantName: tenant.name
    });

    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete tenant', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:id/deactivate
 * Deactivate a tenant (soft delete)
 * Requirements: 2.5 - Deactivate tenant
 */
router.post('/tenants/:id/deactivate', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const tenant = await superadminService.deactivateTenant(id, {
      reason,
      deactivatedBy: req.session.userId
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.warn('Tenant deactivated by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      reason
    });

    res.json({
      success: true,
      data: tenant,
      message: 'Tenant deactivated successfully'
    });
  } catch (error) {
    logger.error('Failed to deactivate tenant', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:id/activate
 * Activate a previously deactivated tenant
 * Requirements: 2.5 - Activate tenant
 */
router.post('/tenants/:id/activate', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await superadminService.activateTenant(id, {
      activatedBy: req.session.userId
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant activated by superadmin', {
      superadminId: req.session.userId,
      tenantId: id
    });

    res.json({
      success: true,
      data: tenant,
      message: 'Tenant activated successfully'
    });
  } catch (error) {
    logger.error('Failed to activate tenant', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// BRANDING MANAGEMENT ROUTES
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
// ========================================

/**
 * GET /api/superadmin/tenants/:id/branding
 * Get tenant branding settings
 * Requirements: 4.1 - Display current branding settings
 */
router.get('/tenants/:id/branding', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    const branding = await superadminService.getTenantBranding(id);

    if (!branding) {
      return res.status(404).json({
        success: false,
        error: 'Tenant branding not found'
      });
    }

    logger.info('Tenant branding retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId: id
    });

    res.json({
      success: true,
      data: branding
    });
  } catch (error) {
    logger.error('Failed to get tenant branding', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/superadmin/tenants/:id/branding
 * Update tenant branding settings
 * Requirements: 4.2, 4.3, 4.4, 4.5 - Edit branding with validation
 */
router.put('/tenants/:id/branding', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate color formats if provided
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    
    if (updates.primary_color && !colorRegex.test(updates.primary_color)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid primary color format. Use hex format (#RRGGBB or #RGB)'
      });
    }

    if (updates.secondary_color && !colorRegex.test(updates.secondary_color)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid secondary color format. Use hex format (#RRGGBB or #RGB)'
      });
    }

    if (updates.primary_foreground && !colorRegex.test(updates.primary_foreground)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid primary foreground color format. Use hex format (#RRGGBB or #RGB)'
      });
    }

    if (updates.secondary_foreground && !colorRegex.test(updates.secondary_foreground)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid secondary foreground color format. Use hex format (#RRGGBB or #RGB)'
      });
    }

    // Validate URL formats if provided
    const urlRegex = /^https?:\/\/.+/;
    
    if (updates.logo_url && updates.logo_url !== '' && !urlRegex.test(updates.logo_url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid logo URL format. Must start with http:// or https://'
      });
    }

    if (updates.og_image_url && updates.og_image_url !== '' && !urlRegex.test(updates.og_image_url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OG image URL format. Must start with http:// or https://'
      });
    }

    const branding = await superadminService.updateTenantBranding(id, updates, req.session.userId);

    if (!branding) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant branding updated by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: branding,
      message: 'Branding updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update tenant branding', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// PLAN MANAGEMENT ROUTES
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
// ========================================

/**
 * GET /api/superadmin/tenants/:id/plans
 * List all plans for a tenant
 * Requirements: 5.1 - List plans with name, price, status, subscriber count
 */
router.get('/tenants/:id/plans', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, billing_cycle } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (billing_cycle) filters.billing_cycle = billing_cycle;

    const plans = await superadminService.listTenantPlans(id, filters);

    logger.info('Tenant plans listed by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
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
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:id/plans
 * Create a new plan for the tenant
 * Requirements: 5.2 - Create plan with all fields
 */
router.post('/tenants/:id/plans', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const planData = req.body;

    // Validate required fields
    if (!planData.name) {
      return res.status(400).json({
        success: false,
        error: 'Plan name is required'
      });
    }

    // Validate price
    if (planData.price_cents !== undefined && planData.price_cents < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price cannot be negative'
      });
    }

    // Validate billing cycle
    const validCycles = ['monthly', 'yearly', 'quarterly', 'weekly', 'lifetime'];
    if (planData.billing_cycle && !validCycles.includes(planData.billing_cycle)) {
      return res.status(400).json({
        success: false,
        error: `Invalid billing cycle. Must be one of: ${validCycles.join(', ')}`
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'archived'];
    if (planData.status && !validStatuses.includes(planData.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const plan = await superadminService.createTenantPlan(id, planData, req.session.userId);

    logger.info('Tenant plan created by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      planId: plan.id,
      planName: plan.name
    });

    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error) {
    logger.error('Failed to create tenant plan', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/superadmin/tenants/:id/plans/:planId
 * Update a plan
 * Requirements: 5.3 - Edit plan (ID immutable)
 */
router.put('/tenants/:id/plans/:planId', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id, planId } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    // Validate price if provided
    if (updates.price_cents !== undefined && updates.price_cents < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price cannot be negative'
      });
    }

    // Validate billing cycle if provided
    const validCycles = ['monthly', 'yearly', 'quarterly', 'weekly', 'lifetime'];
    if (updates.billing_cycle && !validCycles.includes(updates.billing_cycle)) {
      return res.status(400).json({
        success: false,
        error: `Invalid billing cycle. Must be one of: ${validCycles.join(', ')}`
      });
    }

    // Validate status if provided
    const validStatuses = ['active', 'inactive', 'archived'];
    if (updates.status && !validStatuses.includes(updates.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const plan = await superadminService.updateTenantPlan(id, planId, updates, req.session.userId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    logger.info('Tenant plan updated by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      planId,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    logger.error('Failed to update tenant plan', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id,
      planId: req.params?.planId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:id/plans/:planId/set-default
 * Set a plan as the default for the tenant
 * Requirements: 5.4 - Set default plan (unset previous)
 */
router.post('/tenants/:id/plans/:planId/set-default', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id, planId } = req.params;

    const plan = await superadminService.setDefaultTenantPlan(id, planId, req.session.userId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    logger.info('Tenant default plan set by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      planId
    });

    res.json({
      success: true,
      data: plan,
      message: 'Default plan set successfully'
    });
  } catch (error) {
    logger.error('Failed to set default tenant plan', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id,
      planId: req.params?.planId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// METRICS AND EXPORT ROUTES
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
// ========================================

/**
 * GET /api/superadmin/tenants/:id/metrics
 * Get tenant metrics
 * Requirements: 6.1 - Display metrics (accounts, agents, inboxes, MRR)
 */
router.get('/tenants/:id/metrics', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    const metrics = await superadminService.getTenantMetrics(id);

    logger.info('Tenant metrics retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId: id
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get tenant metrics', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/tenants/:id/audit-log
 * Get tenant audit log entries
 * Requirements: 6.2 - Display recent audit log entries
 */
router.get('/tenants/:id/audit-log', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await superadminService.getTenantAuditLog(id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    logger.info('Tenant audit log retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      totalEntries: result.total
    });

    res.json({
      success: true,
      data: result.entries,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to get tenant audit log', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/tenants/:id/export
 * Export tenant data as CSV
 * Requirements: 6.3 - Generate CSV with accounts, agents, usage data
 */
router.get('/tenants/:id/export', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    const csvData = await superadminService.exportTenantData(id);

    logger.info('Tenant data exported by superadmin', {
      superadminId: req.session.userId,
      tenantId: id
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tenant-${id}-export.csv"`);
    res.send(csvData);
  } catch (error) {
    logger.error('Failed to export tenant data', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;