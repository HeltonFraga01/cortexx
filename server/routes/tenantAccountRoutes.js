/**
 * Tenant Account Routes
 * 
 * Handles account management for tenant admins.
 * Requirements: 7.4, 7.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const TenantService = require('../services/TenantService');
const AccountService = require('../services/AccountService');
const { requireTenantAdmin } = require('../middleware/tenantAuth');

// Initialize services
const tenantService = new TenantService();
const accountService = new AccountService();

/**
 * GET /api/tenant/accounts
 * List all accounts for the current tenant
 * Requirements: 7.4 - List tenant accounts
 */
router.get('/accounts', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;
    const { 
      status, 
      search, 
      page = 1, 
      limit = 20,
      include_stats = false 
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    // Get accounts list
    const accounts = await tenantService.listAccounts(tenantId, filters);

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedAccounts = accounts.slice(startIndex, endIndex);

    // Get stats if requested
    let stats = null;
    if (include_stats === 'true') {
      stats = await tenantService.getAccountStats(tenantId);
    }

    logger.info('Tenant accounts listed', {
      tenantId,
      userId: req.session.userId,
      accountCount: accounts.length,
      page,
      limit,
      filters,
      includeStats: include_stats === 'true'
    });

    res.json({
      success: true,
      data: paginatedAccounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: accounts.length,
        totalPages: Math.ceil(accounts.length / parseInt(limit))
      },
      ...(stats && { stats })
    });
  } catch (error) {
    logger.error('Failed to list tenant accounts', {
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
 * GET /api/tenant/accounts/:id
 * Get detailed information about a specific account
 * Requirements: 7.4 - Get account details
 */
router.get('/accounts/:id', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;

    // Get account details with tenant validation
    const account = await accountService.getAccountById(id, tenantId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or does not belong to this tenant'
      });
    }

    logger.info('Tenant account details retrieved', {
      tenantId,
      userId: req.session.userId,
      accountId: id,
      accountName: account.name
    });

    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    logger.error('Failed to get tenant account details', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      accountId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tenant/accounts/:id/deactivate
 * Deactivate an account within the tenant
 * Requirements: 7.5 - Deactivate account
 */
router.post('/accounts/:id/deactivate', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;
    const { reason, notify_user = true } = req.body;

    // Validate account belongs to tenant
    const account = await accountService.getAccountById(id, tenantId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or does not belong to this tenant'
      });
    }

    if (account.status === 'inactive') {
      return res.status(400).json({
        success: false,
        error: 'Account is already inactive'
      });
    }

    // Deactivate account
    const deactivatedAccount = await accountService.deactivateAccount(id, {
      reason: reason || 'Deactivated by tenant admin',
      deactivatedBy: req.session.userId,
      notifyUser: notify_user
    });

    logger.warn('Account deactivated by tenant admin', {
      tenantId,
      userId: req.session.userId,
      accountId: id,
      accountName: account.name,
      reason,
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      data: deactivatedAccount,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    logger.error('Failed to deactivate tenant account', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      accountId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/tenant/accounts/:id/activate
 * Reactivate a previously deactivated account
 * Requirements: 7.5 - Activate account
 */
router.post('/accounts/:id/activate', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;
    const { notify_user = true } = req.body;

    // Validate account belongs to tenant
    const account = await accountService.getAccountById(id, tenantId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or does not belong to this tenant'
      });
    }

    if (account.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Account is already active'
      });
    }

    // Activate account
    const activatedAccount = await accountService.activateAccount(id, {
      activatedBy: req.session.userId,
      notifyUser: notify_user
    });

    logger.info('Account activated by tenant admin', {
      tenantId,
      userId: req.session.userId,
      accountId: id,
      accountName: account.name,
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      data: activatedAccount,
      message: 'Account activated successfully'
    });
  } catch (error) {
    logger.error('Failed to activate tenant account', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      accountId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tenant/accounts/stats
 * Get account statistics for the tenant
 * Requirements: 7.4 - Account statistics
 */
router.get('/accounts/stats', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;

    const stats = await tenantService.getAccountStats(tenantId);

    logger.info('Tenant account stats retrieved', {
      tenantId,
      userId: req.session.userId,
      totalAccounts: stats.totalAccounts
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get tenant account stats', {
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
 * PUT /api/tenant/accounts/:id
 * Update account information (limited fields for tenant admin)
 * Requirements: 7.4 - Update account
 */
router.put('/accounts/:id', requireTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.context.tenantId;
    const updates = req.body;

    // Validate account belongs to tenant
    const account = await accountService.getAccountById(id, tenantId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or does not belong to this tenant'
      });
    }

    // Remove fields that tenant admins shouldn't be able to update
    delete updates.id;
    delete updates.tenant_id;
    delete updates.owner_user_id;
    delete updates.wuzapi_token;
    delete updates.created_at;
    delete updates.updated_at;

    // Validate allowed updates
    const allowedFields = ['name', 'status', 'timezone', 'locale'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }

    // Validate status if being updated
    if (filteredUpdates.status && !['active', 'inactive', 'suspended'].includes(filteredUpdates.status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be active, inactive, or suspended'
      });
    }

    const updatedAccount = await accountService.updateAccount(id, filteredUpdates);

    logger.info('Account updated by tenant admin', {
      tenantId,
      userId: req.session.userId,
      accountId: id,
      updatedFields: Object.keys(filteredUpdates),
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      data: updatedAccount,
      message: 'Account updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update tenant account', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      accountId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;