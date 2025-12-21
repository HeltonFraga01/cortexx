/**
 * Admin User Management Routes
 * 
 * CRUD operations for independent users (not agents).
 * Admin can create, update, delete users and manage inbox linking.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 3.2, 3.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const UserService = require('../services/UserService');
const UserSessionService = require('../services/UserSessionService');
const { authenticate, requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

/**
 * Helper to get tenant ID from request context
 */
function getTenantId(req) {
  return req.context?.tenantId || req.session?.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
}

/**
 * GET /api/admin/independent-users
 * List all independent users for the tenant
 * Requirements: 7.1
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { page = 1, limit = 20, status, search } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;
    
    const result = await UserService.listUsers(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters
    });
    
    logger.info('Listed independent users', {
      tenantId,
      adminId: req.session?.userId,
      count: result.users.length,
      endpoint: '/api/admin/independent-users'
    });
    
    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('List users failed', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/independent-users'
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/independent-users/:userId
 * Get a specific user by ID
 * Requirements: 7.1
 */
router.get('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    
    const user = await UserService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Validate tenant
    if (user.tenantId !== tenantId) {
      logger.warn('Cross-tenant access blocked', {
        type: 'security_violation',
        tenantId,
        targetUserId: userId,
        adminId: req.session?.userId,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Get user inboxes
    const inboxes = await UserService.getUserInboxes(userId);
    
    res.json({
      success: true,
      data: {
        ...user,
        inboxes
      }
    });
  } catch (error) {
    logger.error('Get user failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/independent-users
 * Create a new independent user
 * Requirements: 7.2
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { email, password, name, avatarUrl, permissions } = req.body;
    
    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, senha e nome são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido',
        code: 'INVALID_EMAIL'
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'A senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    const user = await UserService.createUser({
      tenantId,
      email,
      password,
      name,
      avatarUrl,
      permissions: permissions || ['messages:read', 'messages:send']
    });
    
    logger.info('Independent user created', {
      userId: user.id,
      email: user.email,
      tenantId,
      adminId: req.session?.userId,
      endpoint: '/api/admin/independent-users'
    });
    
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Create user failed', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/independent-users'
    });
    
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        error: 'Este email já está cadastrado',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/independent-users/:userId
 * Update an existing user
 * Requirements: 7.3
 */
router.put('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    const { name, avatarUrl, status, permissions } = req.body;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      logger.warn('Cross-tenant update blocked', {
        type: 'security_violation',
        tenantId,
        targetUserId: userId,
        adminId: req.session?.userId,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (status !== undefined) updates.status = status;
    
    const user = await UserService.updateUser(userId, updates);
    
    // Update permissions separately if provided
    if (permissions !== undefined) {
      await UserService.updatePermissions(userId, permissions);
      user.permissions = permissions;
    }
    
    logger.info('Independent user updated', {
      userId,
      tenantId,
      adminId: req.session?.userId,
      updates: Object.keys(updates),
      endpoint: req.path
    });
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Update user failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * DELETE /api/admin/independent-users/:userId
 * Deactivate a user (soft delete)
 * Requirements: 7.4, 7.6
 */
router.delete('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      logger.warn('Cross-tenant delete blocked', {
        type: 'security_violation',
        tenantId,
        targetUserId: userId,
        adminId: req.session?.userId,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Deactivate user (this also invalidates all sessions)
    await UserService.deactivateUser(userId);
    
    logger.info('Independent user deactivated', {
      userId,
      tenantId,
      adminId: req.session?.userId,
      endpoint: req.path
    });
    
    res.json({
      success: true,
      message: 'Usuário desativado com sucesso'
    });
  } catch (error) {
    logger.error('Deactivate user failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/independent-users/:userId/activate
 * Reactivate a deactivated user
 */
router.post('/:userId/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    await UserService.activateUser(userId);
    
    logger.info('Independent user activated', {
      userId,
      tenantId,
      adminId: req.session?.userId,
      endpoint: req.path
    });
    
    res.json({
      success: true,
      message: 'Usuário ativado com sucesso'
    });
  } catch (error) {
    logger.error('Activate user failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/independent-users/:userId/reset-password
 * Reset user password (generates new password or sends reset link)
 * Requirements: 7.5
 */
router.post('/:userId/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Generate random password if not provided
    const password = newPassword || crypto.randomBytes(8).toString('hex');
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'A senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Update password and invalidate all sessions
    await UserService.updatePassword(userId, password, true);
    
    logger.info('User password reset', {
      userId,
      tenantId,
      adminId: req.session?.userId,
      generatedPassword: !newPassword,
      endpoint: req.path
    });
    
    res.json({
      success: true,
      message: 'Senha redefinida com sucesso',
      data: {
        // Only return generated password if it was auto-generated
        temporaryPassword: !newPassword ? password : undefined
      }
    });
  } catch (error) {
    logger.error('Reset password failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/independent-users/:userId/link-inbox
 * Link an inbox to a user
 * Requirements: 3.2
 */
router.post('/:userId/link-inbox', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    const { inboxId, isPrimary = false } = req.body;
    
    if (!inboxId) {
      return res.status(400).json({
        success: false,
        error: 'inboxId é obrigatório',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    const userInbox = await UserService.linkInbox(userId, inboxId, isPrimary);
    
    logger.info('Inbox linked to user', {
      userId,
      inboxId,
      isPrimary,
      tenantId,
      adminId: req.session?.userId,
      endpoint: req.path
    });
    
    res.status(201).json({
      success: true,
      data: userInbox
    });
  } catch (error) {
    logger.error('Link inbox failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    
    if (error.message === 'INBOX_ALREADY_LINKED') {
      return res.status(409).json({
        success: false,
        error: 'Esta inbox já está vinculada ao usuário',
        code: 'INBOX_ALREADY_LINKED'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/independent-users/:userId/unlink-inbox/:inboxId
 * Unlink an inbox from a user
 * Requirements: 3.5
 */
router.delete('/:userId/unlink-inbox/:inboxId', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId, inboxId } = req.params;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    await UserService.unlinkInbox(userId, inboxId);
    
    logger.info('Inbox unlinked from user', {
      userId,
      inboxId,
      tenantId,
      adminId: req.session?.userId,
      endpoint: req.path
    });
    
    res.json({
      success: true,
      message: 'Inbox desvinculada com sucesso'
    });
  } catch (error) {
    logger.error('Unlink inbox failed', {
      error: error.message,
      userId: req.params.userId,
      inboxId: req.params.inboxId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/independent-users/:userId/inboxes
 * Get all inboxes linked to a user
 * Requirements: 3.1
 */
router.get('/:userId/inboxes', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    const inboxes = await UserService.getUserInboxes(userId);
    
    res.json({
      success: true,
      data: inboxes
    });
  } catch (error) {
    logger.error('Get user inboxes failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/independent-users/:userId/permissions
 * Update user permissions
 * Requirements: 4.3
 */
router.put('/:userId/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { userId } = req.params;
    const { permissions } = req.body;
    
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'permissions deve ser um array',
        code: 'INVALID_PERMISSIONS'
      });
    }
    
    // Validate user exists and belongs to tenant
    const existingUser = await UserService.getUserById(userId);
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (existingUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        code: 'ACCESS_DENIED'
      });
    }
    
    await UserService.updatePermissions(userId, permissions);
    
    logger.info('User permissions updated', {
      userId,
      permissions,
      tenantId,
      adminId: req.session?.userId,
      endpoint: req.path
    });
    
    res.json({
      success: true,
      data: { permissions }
    });
  } catch (error) {
    logger.error('Update permissions failed', {
      error: error.message,
      userId: req.params.userId,
      endpoint: req.path
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
