/**
 * Superadmin Tenant Agent Management Routes
 * 
 * Handles agent CRUD operations within tenants for superadmins.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * GET /api/superadmin/tenants/:tenantId/agents
 * List all agents across all accounts in the tenant
 * Requirements: 3.1 - List agents with name, email, role, account name, status
 */
router.get('/tenants/:tenantId/agents', requireSuperadmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { page = 1, limit = 20, status, role, accountId, search } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (role) filters.role = role;
    if (accountId) filters.accountId = accountId;
    if (search) filters.search = search;

    const result = await superadminService.listTenantAgents(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    logger.info('Tenant agents listed by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      totalAgents: result.total,
      page,
      limit,
      filters
    });

    res.json({
      success: true,
      data: result.agents,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to list tenant agents', {
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
 * GET /api/superadmin/tenants/:tenantId/agents/:agentId
 * Get a specific agent details
 * Requirements: 3.1 - Get agent details
 */
router.get('/tenants/:tenantId/agents/:agentId', requireSuperadmin, async (req, res) => {
  try {
    const { tenantId, agentId } = req.params;

    const agent = await superadminService.getTenantAgentById(tenantId, agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    logger.info('Tenant agent details retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      agentId
    });

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Failed to get tenant agent details', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      agentId: req.params?.agentId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:tenantId/agents
 * Create a new agent in the tenant
 * Requirements: 3.2, 3.3 - Create agent with account selection, name, email, password, role
 */
router.post('/tenants/:tenantId/agents', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { accountId, name, email, password, role } = req.body;

    // Validate required fields
    if (!accountId || !name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Account ID, name, email, password, and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate role
    const validRoles = ['owner', 'administrator', 'agent', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const agent = await superadminService.createTenantAgent(tenantId, {
      accountId,
      name,
      email,
      password,
      role
    }, req.session.userId);

    logger.info('Tenant agent created by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      agentId: agent.id,
      agentEmail: agent.email,
      role
    });

    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Failed to create tenant agent', {
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
 * PUT /api/superadmin/tenants/:tenantId/agents/:agentId
 * Update an agent in the tenant
 * Requirements: 3.4 - Edit agent name, role, status
 */
router.put('/tenants/:tenantId/agents/:agentId', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId, agentId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.account_id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.updated_at;
    delete updates.password_hash;

    // Validate role if provided
    if (updates.role) {
      const validRoles = ['owner', 'administrator', 'agent', 'viewer'];
      if (!validRoles.includes(updates.role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    // Validate status if provided
    if (updates.status && !['active', 'inactive', 'pending'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "active", "inactive", or "pending"'
      });
    }

    const agent = await superadminService.updateTenantAgent(tenantId, agentId, updates, req.session.userId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    logger.info('Tenant agent updated by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      agentId,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Failed to update tenant agent', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      agentId: req.params?.agentId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/tenants/:tenantId/agents/:agentId/reset-password
 * Reset agent password and return temporary password
 * Requirements: 3.5 - Reset password and display to superadmin
 */
router.post('/tenants/:tenantId/agents/:agentId/reset-password', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId, agentId } = req.params;

    const result = await superadminService.resetAgentPassword(tenantId, agentId, req.session.userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    logger.warn('Agent password reset by superadmin', {
      superadminId: req.session.userId,
      tenantId,
      agentId
    });

    res.json({
      success: true,
      data: {
        temporaryPassword: result.temporaryPassword,
        message: 'Password has been reset. Please share this temporary password with the agent securely.'
      }
    });
  } catch (error) {
    logger.error('Failed to reset agent password', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId,
      agentId: req.params?.agentId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
