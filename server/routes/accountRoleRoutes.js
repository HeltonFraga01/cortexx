/**
 * Account Role Management Routes
 * 
 * Handles custom role CRUD operations.
 * 
 * Requirements: 3.1, 3.2, 3.6
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const PermissionService = require('../services/PermissionService');
const { requireAgentAuth, requireAgentRole } = require('../middleware/agentAuth');

let permissionService = null;

function initServices(db) {
  if (!permissionService) {
    permissionService = new PermissionService(db);
  }
}

/**
 * GET /api/account/roles
 * List all roles (default + custom)
 */
router.get('/', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.get('db'));
    
    const defaultRoles = permissionService.getDefaultRoles();
    const customRoles = await permissionService.listCustomRoles(req.account.id);
    const allPermissions = permissionService.getAllPermissions();
    
    res.json({
      success: true,
      data: {
        defaultRoles: Object.entries(defaultRoles).map(([name, permissions]) => ({
          name,
          permissions,
          isDefault: true
        })),
        customRoles,
        availablePermissions: allPermissions
      }
    });
  } catch (error) {
    logger.error('List roles failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/roles/:id
 * Get custom role by ID
 */
router.get('/:id', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.get('db'));
    
    const role = await permissionService.getCustomRoleById(req.params.id);
    
    if (!role || role.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Papel não encontrado', code: 'ROLE_NOT_FOUND' });
    }
    
    const usageCount = await permissionService.getCustomRoleUsageCount(req.params.id);
    
    res.json({ success: true, data: { ...role, usageCount } });
  } catch (error) {
    logger.error('Get role failed', { error: error.message, roleId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/roles
 * Create custom role
 */
router.post('/', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    initServices(req.app.get('db'));
    
    const { name, description, permissions } = req.body;
    
    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'name e permissions são obrigatórios', code: 'MISSING_FIELDS' });
    }
    
    const role = await permissionService.createCustomRole(req.account.id, { name, description, permissions });
    
    logger.info('Custom role created', { roleId: role.id, accountId: req.account.id });
    
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    if (error.message.includes('Invalid permissions')) {
      return res.status(400).json({ error: error.message, code: 'INVALID_PERMISSIONS' });
    }
    logger.error('Create role failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/account/roles/:id
 * Update custom role
 */
router.put('/:id', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    initServices(req.app.get('db'));
    
    const role = await permissionService.getCustomRoleById(req.params.id);
    if (!role || role.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Papel não encontrado', code: 'ROLE_NOT_FOUND' });
    }
    
    const { name, description, permissions } = req.body;
    const updated = await permissionService.updateCustomRole(req.params.id, { name, description, permissions });
    
    logger.info('Custom role updated', { roleId: req.params.id });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message.includes('Invalid permissions')) {
      return res.status(400).json({ error: error.message, code: 'INVALID_PERMISSIONS' });
    }
    logger.error('Update role failed', { error: error.message, roleId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/roles/:id
 * Delete custom role
 */
router.delete('/:id', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    initServices(req.app.get('db'));
    
    const role = await permissionService.getCustomRoleById(req.params.id);
    if (!role || role.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Papel não encontrado', code: 'ROLE_NOT_FOUND' });
    }
    
    await permissionService.deleteCustomRole(req.params.id);
    
    logger.info('Custom role deleted', { roleId: req.params.id });
    
    res.json({ success: true, message: 'Papel excluído com sucesso' });
  } catch (error) {
    logger.error('Delete role failed', { error: error.message, roleId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
