/**
 * Account Agent Management Routes
 * 
 * Handles agent CRUD operations for account owners/administrators.
 * 
 * Requirements: 2.1, 2.5, 2.6, 2.7, 2.8
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const AgentService = require('../services/AgentService');
const { requireAgentAuth, requireAgentRole, requirePermission } = require('../middleware/agentAuth');
const { quotaMiddleware } = require('../middleware/quotaEnforcement');

// Service initialized at module level (uses SupabaseService internally)
const agentService = new AgentService();

/**
 * GET /api/account/agents
 * List all agents in the account
 */
router.get('/', requireAgentAuth(null), requirePermission('agents:view'), async (req, res) => {
  try {
    const { status, role, availability, limit, offset } = req.query;
    
    const agents = await agentService.listAgents(req.account.id, {
      status,
      role,
      availability,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    
    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    logger.error('List agents failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/agents/:id
 * Get agent by ID
 */
router.get('/:id', requireAgentAuth(null), requirePermission('agents:view'), async (req, res) => {
  try {
    
    
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== req.account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Get agent failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/agents
 * Create agent directly with credentials
 */
router.post('/', requireAgentAuth(null), requirePermission('agents:create'), quotaMiddleware.agents, async (req, res) => {
  try {
    
    
    const { email, password, name, role, avatarUrl, customRoleId } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'email, password e name são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        error: 'A senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Only owner can create owner/administrator
    if (['owner', 'administrator'].includes(role) && req.agent.role !== 'owner') {
      return res.status(403).json({
        error: 'Apenas o proprietário pode criar administradores',
        code: 'FORBIDDEN'
      });
    }
    
    const agent = await agentService.createAgentDirect(req.account.id, {
      email,
      password,
      name,
      role: role || 'agent',
      avatarUrl,
      customRoleId
    });
    
    logger.info('Agent created directly', { agentId: agent.id, accountId: req.account.id, createdBy: req.agent.id });
    
    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Create agent failed', { error: error.message, accountId: req.account?.id });
    
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Este email já está cadastrado nesta conta',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/agents/invite
 * Create invitation link
 */
router.post('/invite', requireAgentAuth(null), requirePermission('agents:create'), quotaMiddleware.agents, async (req, res) => {
  try {
    
    
    const { email, role, customRoleId } = req.body;
    
    // Only owner can invite owner/administrator
    if (['owner', 'administrator'].includes(role) && req.agent.role !== 'owner') {
      return res.status(403).json({
        error: 'Apenas o proprietário pode convidar administradores',
        code: 'FORBIDDEN'
      });
    }
    
    const invitation = await agentService.createInvitation(
      req.account.id,
      { email, role: role || 'agent', customRoleId },
      req.agent.id
    );
    
    // Generate invitation URL (frontend will handle this)
    const invitationUrl = `/register/${invitation.token}`;
    
    logger.info('Invitation created', { invitationId: invitation.id, accountId: req.account.id, createdBy: req.agent.id });
    
    res.status(201).json({
      success: true,
      data: {
        id: invitation.id,
        token: invitation.token,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        invitationUrl
      }
    });
  } catch (error) {
    logger.error('Create invitation failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/agents/invitations
 * List invitations
 */
router.get('/invitations/list', requireAgentAuth(null), requirePermission('agents:view'), async (req, res) => {
  try {
    
    
    const { status } = req.query;
    
    const invitations = await agentService.listInvitations(req.account.id, { status });
    
    res.json({
      success: true,
      data: invitations
    });
  } catch (error) {
    logger.error('List invitations failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/agents/invitations/:id
 * Delete invitation
 */
router.delete('/invitations/:id', requireAgentAuth(null), requirePermission('agents:create'), async (req, res) => {
  try {
    
    
    await agentService.deleteInvitation(req.params.id);
    
    res.json({
      success: true,
      message: 'Convite excluído com sucesso'
    });
  } catch (error) {
    logger.error('Delete invitation failed', { error: error.message, invitationId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/account/agents/:id
 * Update agent
 */
router.put('/:id', requireAgentAuth(null), requirePermission('agents:edit'), async (req, res) => {
  try {
    
    
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== req.account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    // Cannot edit owner unless you are owner
    if (agent.role === 'owner' && req.agent.role !== 'owner') {
      return res.status(403).json({
        error: 'Não é possível editar o proprietário',
        code: 'FORBIDDEN'
      });
    }
    
    const { name, avatarUrl, availability } = req.body;
    
    const updated = await agentService.updateAgent(req.params.id, {
      name,
      avatarUrl,
      availability
    });
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update agent failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/account/agents/:id/role
 * Update agent role
 */
router.put('/:id/role', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    
    
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== req.account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    // Cannot change owner role
    if (agent.role === 'owner') {
      return res.status(403).json({
        error: 'Não é possível alterar o papel do proprietário',
        code: 'FORBIDDEN'
      });
    }
    
    // Only owner can assign owner/administrator
    const { role, customRoleId } = req.body;
    if (['owner', 'administrator'].includes(role) && req.agent.role !== 'owner') {
      return res.status(403).json({
        error: 'Apenas o proprietário pode atribuir este papel',
        code: 'FORBIDDEN'
      });
    }
    
    const updated = await agentService.updateAgentRole(req.params.id, role, customRoleId);
    
    logger.info('Agent role updated', { agentId: req.params.id, newRole: role, updatedBy: req.agent.id });
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update agent role failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/agents/:id
 * Deactivate agent
 */
router.delete('/:id', requireAgentAuth(null), requirePermission('agents:delete'), async (req, res) => {
  try {
    
    
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== req.account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    // Cannot deactivate owner
    if (agent.role === 'owner') {
      return res.status(403).json({
        error: 'Não é possível desativar o proprietário',
        code: 'FORBIDDEN'
      });
    }
    
    // Cannot deactivate yourself
    if (agent.id === req.agent.id) {
      return res.status(403).json({
        error: 'Não é possível desativar sua própria conta',
        code: 'FORBIDDEN'
      });
    }
    
    await agentService.deactivateAgent(req.params.id);
    
    logger.info('Agent deactivated', { agentId: req.params.id, deactivatedBy: req.agent.id });
    
    res.json({
      success: true,
      message: 'Agente desativado com sucesso'
    });
  } catch (error) {
    logger.error('Deactivate agent failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/agents/:id/activate
 * Reactivate agent
 */
router.post('/:id/activate', requireAgentAuth(null), requirePermission('agents:edit'), async (req, res) => {
  try {
    
    
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== req.account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    await agentService.activateAgent(req.params.id);
    
    logger.info('Agent activated', { agentId: req.params.id, activatedBy: req.agent.id });
    
    res.json({
      success: true,
      message: 'Agente ativado com sucesso'
    });
  } catch (error) {
    logger.error('Activate agent failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
