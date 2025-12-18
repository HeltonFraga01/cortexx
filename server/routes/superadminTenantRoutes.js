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
 * Requirements: 2.3 - Update tenant
 */
router.put('/tenants/:id', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const tenant = await superadminService.updateTenant(id, updates);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant updated by superadmin', {
      superadminId: req.session.userId,
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

module.exports = router;