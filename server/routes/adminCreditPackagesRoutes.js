/**
 * Admin Credit Packages Routes
 * 
 * CRUD operations for tenant-scoped credit packages (one-time token purchases).
 * All routes require admin authentication and use tenant context.
 * 
 * Requirements: REQ-13 (Multi-Tenant Isolation Audit)
 */

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const TenantCreditPackageService = require('../services/TenantCreditPackageService');

/**
 * Get tenant ID from request context
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * GET /api/admin/credit-packages
 * List all credit packages for the tenant
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { status, activeOnly } = req.query;
    const filters = {};
    
    if (status) {
      filters.status = status;
    }
    if (activeOnly === 'true') {
      filters.activeOnly = true;
    }

    const packages = await TenantCreditPackageService.listPackages(tenantId, filters);

    logger.debug('Credit packages listed', {
      tenantId,
      count: packages.length,
      endpoint: '/api/admin/credit-packages'
    });

    res.json({ success: true, data: packages });
  } catch (error) {
    logger.error('Failed to list credit packages', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/credit-packages'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/credit-packages/:id
 * Get a specific credit package
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    const pkg = await TenantCreditPackageService.getPackageById(id, tenantId);

    if (!pkg) {
      return res.status(404).json({ error: 'Credit package not found' });
    }

    res.json({ success: true, data: pkg });
  } catch (error) {
    logger.error('Failed to get credit package', {
      error: error.message,
      packageId: req.params.id,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/credit-packages/${req.params.id}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/credit-packages
 * Create a new credit package
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { name, description, creditAmount, priceCents } = req.body;

    if (!name || !creditAmount || creditAmount <= 0) {
      return res.status(400).json({ error: 'Invalid package data: name and creditAmount are required' });
    }

    if (priceCents !== undefined && priceCents < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    const pkg = await TenantCreditPackageService.createPackage(tenantId, {
      name,
      description,
      creditAmount,
      priceCents: priceCents || 0
    });

    logger.info('Credit package created', {
      packageId: pkg.id,
      name,
      tenantId,
      adminId: req.session?.userId,
      endpoint: '/api/admin/credit-packages'
    });

    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    logger.error('Failed to create credit package', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/credit-packages'
    });
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/credit-packages/:id
 * Update a credit package
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    const { name, description, creditAmount, priceCents, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (creditAmount !== undefined) updates.creditAmount = creditAmount;
    if (priceCents !== undefined) updates.priceCents = priceCents;
    if (status !== undefined) updates.status = status;

    const pkg = await TenantCreditPackageService.updatePackage(id, tenantId, updates);

    logger.info('Credit package updated', {
      packageId: id,
      tenantId,
      adminId: req.session?.userId,
      endpoint: `/api/admin/credit-packages/${id}`
    });

    res.json({ success: true, data: pkg });
  } catch (error) {
    logger.error('Failed to update credit package', {
      error: error.message,
      packageId: req.params.id,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/credit-packages/${req.params.id}`
    });
    
    if (error.message === 'Credit package not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/credit-packages/:id
 * Delete a credit package (soft delete by setting status to inactive)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;

    await TenantCreditPackageService.deletePackage(id, tenantId);

    logger.info('Credit package deleted', {
      packageId: id,
      tenantId,
      adminId: req.session?.userId,
      endpoint: `/api/admin/credit-packages/${id}`
    });

    res.json({ success: true, message: 'Credit package deleted' });
  } catch (error) {
    logger.error('Failed to delete credit package', {
      error: error.message,
      packageId: req.params.id,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/credit-packages/${req.params.id}`
    });
    
    if (error.message === 'Credit package not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
