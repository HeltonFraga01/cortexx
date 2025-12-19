/**
 * Superadmin Tenant Account Management Routes
 * 
 * Handles account CRUD operations within tenants for superadmins.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * GET /api/superadmin/tenants/:tenantId/accounts
 * List all accounts for a specific tenant
 * Requirements: 2.1 - List tenant accounts with pagination
 */
router.get('/tenants/:tenantId/accounts', requireSuperadmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { page = 1, limit = 20, status, search } = req.query;

    logger.debug('Fetching tenant accounts', {
      tenantId,
      page,
      limit,
      status,
      search,
      superadminId: req.session?.userId
    });

    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    const result = await superadminService.listTenantAccounts(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    logger.info('Tenant accounts listed by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      totalAccounts: result.total,
      page,
      limit,
      filters
    });

    res.json({
      success: true,
      data: result.accounts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to list tenant accounts', {
      error: error.message,
      stack: error.stack,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/tenants/:tenantId/accounts/:accountId
 * Get a specific account details
 * Requirements: 2.1 - Get account details
 */
router.get('/tenants/:tenantId/accounts/:accountId', requireSuperadmin, async (req, res) => {
  try {
    const { tenantId, accountId } = req.params;

    const account = await superadminService.getTenantAccountById(tenantId, accountId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    logger.info('Tenant account details retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      accountId
    });

    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    logger.error('Failed to get tenant account details', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      accountId: req.params?.accountId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:tenantId/accounts
 * Create a new account in the tenant
 * Requirements: 2.2, 2.3 - Create account with name, owner email, WUZAPI token
 */
router.post('/tenants/:tenantId/accounts', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { name, ownerEmail, wuzapiToken } = req.body;

    // Validate required fields
    if (!name || !ownerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Name and owner email are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const account = await superadminService.createTenantAccount(tenantId, {
      name,
      ownerEmail,
      wuzapiToken: wuzapiToken || null
    }, req.session.userId);

    logger.info('Tenant account created by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      accountId: account.id,
      accountName: account.name
    });

    res.status(201).json({
      success: true,
      data: account
    });
  } catch (error) {
    logger.error('Failed to create tenant account', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/superadmin/tenants/:tenantId/accounts/:accountId
 * Update an account in the tenant
 * Requirements: 2.4 - Edit account name, status, settings
 */
router.put('/tenants/:tenantId/accounts/:accountId', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId, accountId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;
    delete updates.updated_at;

    // Validate status if provided
    if (updates.status && !['active', 'inactive', 'suspended'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "active", "inactive", or "suspended"'
      });
    }

    const account = await superadminService.updateTenantAccount(tenantId, accountId, updates, req.session.userId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    logger.info('Tenant account updated by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      accountId,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    logger.error('Failed to update tenant account', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      accountId: req.params?.accountId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/superadmin/tenants/:tenantId/accounts/:accountId
 * Delete an account and cascade delete all related data
 * Requirements: 2.5 - Delete account with confirmation and cascade
 */
router.delete('/tenants/:tenantId/accounts/:accountId', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId, accountId } = req.params;
    const { confirm } = req.body;

    // Require explicit confirmation for deletion
    if (!confirm || confirm !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Deletion must be confirmed with "confirm": "DELETE"'
      });
    }

    // Get account info before deletion for logging
    const account = await superadminService.getTenantAccountById(tenantId, accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    await superadminService.deleteTenantAccount(tenantId, accountId, req.session.userId);

    logger.warn('Tenant account deleted by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      accountId,
      accountName: account.name
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete tenant account', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      accountId: req.params?.accountId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
