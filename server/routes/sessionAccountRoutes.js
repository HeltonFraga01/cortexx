/**
 * Session-Based Account Management Routes
 * 
 * These routes bridge session-based authentication (admin/user dashboards)
 * with the multi-user system services (agents, teams, inboxes).
 * 
 * Uses req.session.userId to identify the account owner.
 */

const router = require('express').Router();
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const AgentService = require('../services/AgentService');
const TeamService = require('../services/TeamService');
const InboxService = require('../services/InboxService');
const AccountService = require('../services/AccountService');
const CustomRoleService = require('../services/CustomRoleService');
const MultiUserAuditService = require('../services/MultiUserAuditService');

// Services will be initialized with db
let agentService = null;
let teamService = null;
let inboxService = null;
let accountService = null;
let customRoleService = null;
let auditService = null;

function initServices(db) {
  if (!agentService) {
    agentService = new AgentService(db);
    teamService = new TeamService(db);
    inboxService = new InboxService(db);
    accountService = new AccountService(db);
    customRoleService = new CustomRoleService(db);
    auditService = new MultiUserAuditService(db);
  }
}

/**
 * Get or create account for the current session user
 */
async function getOrCreateAccount(db, userId, userToken) {
  initServices(db);
  
  logger.debug('getOrCreateAccount called', { userId, hasToken: !!userToken });
  
  let account = await accountService.getAccountByOwnerUserId(userId);
  
  if (!account) {
    logger.info('No account found for user, creating new account', { userId });
    // Create account for this user
    account = await accountService.createAccount({
      name: `Account for User ${userId}`,
      ownerUserId: userId,
      wuzapiToken: userToken || ''
    });
    logger.info('Account created', { accountId: account.id, userId });
  } else {
    logger.debug('Account found for user', { accountId: account.id, userId });
  }
  
  return account;
}

module.exports = router;
module.exports.initServices = initServices;
module.exports.getOrCreateAccount = getOrCreateAccount;


// ==================== AGENT ROUTES ====================

/**
 * GET /api/session/agents
 * List all agents in the account (for admin or account owner)
 */
router.get('/agents', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { status, role, availability, limit, offset } = req.query;
    
    const agents = await agentService.listAgents(account.id, {
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
    logger.error('List agents failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/agents/:id
 * Get agent by ID
 */
router.get('/agents/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
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
 * POST /api/session/agents
 * Create agent directly with credentials
 */
router.post('/agents', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
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
    
    const agent = await agentService.createAgentDirect(account.id, {
      email,
      password,
      name,
      role: role || 'agent',
      avatarUrl,
      customRoleId
    });
    
    logger.info('Agent created via session', { agentId: agent.id, accountId: account.id, userId: req.session.userId });
    
    res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Create agent failed', { error: error.message, userId: req.session?.userId });
    
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
 * POST /api/session/agents/invite
 * Create invitation link
 */
router.post('/agents/invite', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    // Get the owner agent of the account to use as createdBy
    const agents = await agentService.listAgents(account.id, { role: 'owner' });
    let createdByAgentId = null;
    
    if (agents.length > 0) {
      createdByAgentId = agents[0].id;
    } else {
      // If no owner agent exists, get any agent from the account
      const allAgents = await agentService.listAgents(account.id);
      if (allAgents.length > 0) {
        createdByAgentId = allAgents[0].id;
      } else {
        // Create a system agent for this account if none exists
        const systemAgent = await agentService.createAgent(account.id, {
          email: `system-${account.id}@internal`,
          password: crypto.randomUUID(),
          name: 'Sistema',
          role: 'owner'
        });
        createdByAgentId = systemAgent.id;
      }
    }
    
    const { email, role, customRoleId } = req.body;
    
    const invitation = await agentService.createInvitation(
      account.id,
      { email, role: role || 'agent', customRoleId },
      createdByAgentId
    );
    
    // Build full invitation URL
    const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const invitationUrl = `${baseUrl}/register/${invitation.token}`;
    
    logger.info('Invitation created via session', { invitationId: invitation.id, accountId: account.id });
    
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
    logger.error('Create invitation failed', { error: error.message, stack: error.stack, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/agents/invitations/list
 * List invitations
 */
router.get('/agents/invitations/list', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { status } = req.query;
    const invitations = await agentService.listInvitations(account.id, { status });
    
    res.json({
      success: true,
      data: invitations
    });
  } catch (error) {
    logger.error('List invitations failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/agents/invitations/:id
 * Delete invitation
 */
router.delete('/agents/invitations/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
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
 * PUT /api/session/agents/:id
 * Update agent
 */
router.put('/agents/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
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
 * PUT /api/session/agents/:id/role
 * Update agent role
 */
router.put('/agents/:id/role', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    if (agent.role === 'owner') {
      return res.status(403).json({
        error: 'Não é possível alterar o papel do proprietário',
        code: 'FORBIDDEN'
      });
    }
    
    const { role, customRoleId } = req.body;
    const updated = await agentService.updateAgentRole(req.params.id, role, customRoleId);
    
    logger.info('Agent role updated via session', { agentId: req.params.id, newRole: role });
    
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
 * DELETE /api/session/agents/:id
 * Deactivate agent
 */
router.delete('/agents/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    if (agent.role === 'owner') {
      return res.status(403).json({
        error: 'Não é possível desativar o proprietário',
        code: 'FORBIDDEN'
      });
    }
    
    await agentService.deactivateAgent(req.params.id);
    
    logger.info('Agent deactivated via session', { agentId: req.params.id });
    
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
 * POST /api/session/agents/:id/activate
 * Reactivate agent
 */
router.post('/agents/:id/activate', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    await agentService.activateAgent(req.params.id);
    
    logger.info('Agent activated via session', { agentId: req.params.id });
    
    res.json({
      success: true,
      message: 'Agente ativado com sucesso'
    });
  } catch (error) {
    logger.error('Activate agent failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== TEAM ROUTES ====================

/**
 * GET /api/session/teams
 * List all teams in the account
 */
router.get('/teams', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const teams = await teamService.listTeamsWithStats(account.id);
    
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    logger.error('List teams failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/teams/:id
 * Get team by ID
 */
router.get('/teams/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    logger.error('Get team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/teams
 * Create a new team
 */
router.post('/teams', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { name, description, allowAutoAssign } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Nome é obrigatório',
        code: 'MISSING_FIELDS'
      });
    }
    
    const team = await teamService.createTeam(account.id, {
      name,
      description,
      allowAutoAssign,
      createdBy: req.session.userId
    });
    
    logger.info('Team created via session', { teamId: team.id, accountId: account.id });
    
    res.status(201).json({
      success: true,
      data: team
    });
  } catch (error) {
    logger.error('Create team failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/teams/:id
 * Update a team
 */
router.put('/teams/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    const { name, description, allowAutoAssign } = req.body;
    
    const updated = await teamService.updateTeam(req.params.id, {
      name,
      description,
      allowAutoAssign
    });
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/teams/:id
 * Delete a team
 */
router.delete('/teams/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    await teamService.deleteTeam(req.params.id, req.session.userId);
    
    logger.info('Team deleted via session', { teamId: req.params.id });
    
    res.json({
      success: true,
      message: 'Equipe excluída com sucesso'
    });
  } catch (error) {
    logger.error('Delete team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/teams/:id/members
 * Get team members
 */
router.get('/teams/:id/members', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    const members = await teamService.getTeamMembers(req.params.id);
    
    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    logger.error('Get team members failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/teams/:id/members
 * Add member to team
 */
router.post('/teams/:id/members', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({
        error: 'agentId é obrigatório',
        code: 'MISSING_FIELDS'
      });
    }
    
    const membership = await teamService.addMember(req.params.id, agentId);
    
    res.status(201).json({
      success: true,
      data: membership
    });
  } catch (error) {
    if (error.message === 'AGENT_ALREADY_IN_TEAM') {
      return res.status(409).json({
        error: 'Agente já está na equipe',
        code: 'AGENT_ALREADY_IN_TEAM'
      });
    }
    logger.error('Add team member failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/teams/:id/members/:agentId
 * Remove member from team
 */
router.delete('/teams/:id/members/:agentId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== account.id) {
      return res.status(404).json({
        error: 'Equipe não encontrada',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    await teamService.removeMember(req.params.id, req.params.agentId);
    
    res.json({
      success: true,
      message: 'Membro removido com sucesso'
    });
  } catch (error) {
    logger.error('Remove team member failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== INBOX ROUTES ====================

/**
 * GET /api/session/inboxes
 * List all inboxes in the account
 */
router.get('/inboxes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    logger.debug('Listing inboxes for account', { 
      accountId: account.id, 
      userId: req.session.userId 
    });
    
    const inboxes = await inboxService.listInboxesWithStats(account.id);
    
    logger.debug('Inboxes found', { 
      count: inboxes.length, 
      accountId: account.id 
    });
    
    res.json({
      success: true,
      data: inboxes
    });
  } catch (error) {
    logger.error('List inboxes failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/inboxes/:id
 * Get inbox by ID with members
 */
router.get('/inboxes/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    // Get inbox members
    const members = await inboxService.getInboxMembers(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...inbox,
        members
      }
    });
  } catch (error) {
    logger.error('Get inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/inboxes
 * Create a new inbox
 * For WhatsApp inboxes, also creates a WUZAPI user instance automatically
 */
router.post('/inboxes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { name, description, channelType, phoneNumber, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage, wuzapiConfig } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Nome é obrigatório',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Get user subscription to check quota
    const SubscriptionService = require('../services/SubscriptionService');
    const subscriptionService = new SubscriptionService(db);
    const subscription = await subscriptionService.getUserSubscription(req.session.userId);
    
    // Get max inboxes from plan (default to 1 if no plan)
    const maxInboxes = subscription?.plan?.quotas?.maxInboxes ?? 1;
    
    // InboxService.createInbox will automatically create WUZAPI user for WhatsApp channels
    const inbox = await inboxService.createInbox(account.id, {
      name,
      description,
      channelType: channelType || 'whatsapp',
      phoneNumber,
      enableAutoAssignment,
      autoAssignmentConfig,
      greetingEnabled,
      greetingMessage,
      wuzapiConfig,
      maxInboxes,
      createdBy: req.session.userId
    });
    
    logger.info('Inbox created via session', { 
      inboxId: inbox.id, 
      accountId: account.id, 
      channelType: channelType || 'whatsapp',
      hasWuzapiToken: !!inbox.wuzapiToken
    });
    
    res.status(201).json({
      success: true,
      data: inbox
    });
  } catch (error) {
    // Handle quota exceeded error
    if (error.code === 'QUOTA_EXCEEDED') {
      return res.status(403).json({
        error: 'Limite de caixas de entrada atingido. Faça upgrade do seu plano.',
        code: 'QUOTA_EXCEEDED',
        details: error.details
      });
    }
    
    // Handle WUZAPI errors
    if (error.message?.includes('WUZAPI') || error.message?.includes('WhatsApp')) {
      return res.status(500).json({
        error: error.message,
        code: 'WUZAPI_ERROR'
      });
    }
    
    logger.error('Create inbox failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/inboxes/:id
 * Update an inbox
 */
router.put('/inboxes/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    const { name, description, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage } = req.body;
    
    const updated = await inboxService.updateInbox(req.params.id, {
      name,
      description,
      enableAutoAssignment,
      autoAssignmentConfig,
      greetingEnabled,
      greetingMessage
    });
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/inboxes/:id
 * Delete an inbox
 */
router.delete('/inboxes/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    await inboxService.deleteInbox(req.params.id, req.session.userId);
    
    logger.info('Inbox deleted via session', { inboxId: req.params.id });
    
    res.json({
      success: true,
      message: 'Caixa de entrada excluída com sucesso'
    });
  } catch (error) {
    logger.error('Delete inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/inboxes/:id/members
 * Get inbox members
 */
router.get('/inboxes/:id/members', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    const members = await inboxService.getInboxMembers(req.params.id);
    
    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    logger.error('Get inbox members failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/inboxes/:id/members
 * Assign agent to inbox
 */
router.post('/inboxes/:id/members', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({
        error: 'agentId é obrigatório',
        code: 'MISSING_FIELDS'
      });
    }
    
    const membership = await inboxService.assignAgent(req.params.id, agentId);
    
    res.status(201).json({
      success: true,
      data: membership
    });
  } catch (error) {
    if (error.message === 'AGENT_ALREADY_IN_INBOX') {
      return res.status(409).json({
        error: 'Agente já está na caixa de entrada',
        code: 'AGENT_ALREADY_IN_INBOX'
      });
    }
    logger.error('Assign agent to inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/inboxes/:id/members/:agentId
 * Remove agent from inbox
 */
router.delete('/inboxes/:id/members/:agentId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    await inboxService.removeAgent(req.params.id, req.params.agentId);
    
    res.json({
      success: true,
      message: 'Agente removido com sucesso'
    });
  } catch (error) {
    logger.error('Remove agent from inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/inboxes/:id/qrcode
 * Get QR code for WhatsApp inbox connection
 */
router.get('/inboxes/:id/qrcode', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    if (inbox.channelType !== 'whatsapp') {
      return res.status(400).json({
        error: 'QR Code disponível apenas para caixas WhatsApp',
        code: 'INVALID_CHANNEL_TYPE'
      });
    }
    
    // Use inbox.wuzapiToken if available, otherwise fallback to user's session token
    const tokenToUse = inbox.wuzapiToken || req.session.userToken;
    
    if (!tokenToUse) {
      return res.status(400).json({
        error: 'Caixa de entrada não possui token WUZAPI configurado',
        code: 'NO_WUZAPI_TOKEN'
      });
    }
    
    const wuzapiClient = require('../utils/wuzapiClient');
    
    // First, connect the session if not connected
    const connectResult = await wuzapiClient.post('/session/connect', {}, {
      headers: { 'token': tokenToUse }
    });
    
    if (!connectResult.success) {
      logger.warn('Failed to connect WUZAPI session for inbox', { 
        inboxId: req.params.id, 
        error: connectResult.error,
        tokenSource: inbox.wuzapiToken ? 'inbox' : 'session'
      });
    }
    
    // Get QR code
    const qrResult = await wuzapiClient.get('/session/qr', {
      headers: { 'token': tokenToUse }
    });
    
    if (!qrResult.success) {
      return res.status(500).json({
        error: 'Falha ao obter QR Code',
        code: 'QR_CODE_ERROR',
        details: qrResult.error
      });
    }
    
    res.json({
      success: true,
      data: {
        qrCode: qrResult.data?.QRCode || qrResult.data?.qr_code || null,
        connected: inbox.wuzapiConnected
      }
    });
  } catch (error) {
    logger.error('Get inbox QR code failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/inboxes/:id/status
 * Get WhatsApp connection status for inbox
 */
router.get('/inboxes/:id/status', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    if (inbox.channelType !== 'whatsapp') {
      return res.status(400).json({
        error: 'Status disponível apenas para caixas WhatsApp',
        code: 'INVALID_CHANNEL_TYPE'
      });
    }
    
    // Use inbox.wuzapiToken if available, otherwise fallback to user's session token
    // This handles the case where the inbox is the user's default inbox
    const tokenToUse = inbox.wuzapiToken || req.session.userToken;
    
    if (!tokenToUse) {
      return res.json({
        success: true,
        data: {
          connected: false,
          loggedIn: false,
          status: 'not_configured'
        }
      });
    }
    
    const wuzapiClient = require('../utils/wuzapiClient');
    
    // Get session status using the appropriate token
    const statusResult = await wuzapiClient.get('/session/status', {
      headers: { 'token': tokenToUse }
    });
    
    // Handle nested data structure from WUZAPI: { success, data: { connected, loggedIn } }
    // or { success, data: { data: { connected, loggedIn } } }
    const responseData = statusResult.data || {};
    const innerData = responseData.data || responseData;
    const connected = statusResult.success && (innerData.Connected || innerData.connected || false);
    const loggedIn = statusResult.success && (innerData.LoggedIn || innerData.loggedIn || false);
    
    logger.debug('Inbox status fetched', { 
      inboxId: req.params.id, 
      tokenSource: inbox.wuzapiToken ? 'inbox' : 'session',
      connected, 
      loggedIn,
      rawData: responseData
    });
    
    // Update inbox connection status if changed
    if (inbox.wuzapiConnected !== loggedIn) {
      await db.query(
        'UPDATE inboxes SET wuzapi_connected = ?, updated_at = ? WHERE id = ?',
        [loggedIn ? 1 : 0, new Date().toISOString(), inbox.id]
      );
    }
    
    res.json({
      success: true,
      data: {
        connected,
        loggedIn,
        status: loggedIn ? 'connected' : (connected ? 'connecting' : 'disconnected'),
        details: statusResult.data || null
      }
    });
  } catch (error) {
    logger.error('Get inbox status failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== ROLE ROUTES ====================

/**
 * GET /api/session/roles
 * List all roles (default + custom)
 */
router.get('/roles', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    // Default roles with permissions
    const defaultRoles = [
      { 
        id: 'owner', 
        name: 'owner', 
        description: 'Acesso total ao sistema', 
        isDefault: true,
        permissions: ['*']
      },
      { 
        id: 'administrator', 
        name: 'administrator', 
        description: 'Gerenciamento de agentes e configurações', 
        isDefault: true,
        permissions: [
          'conversations:view', 'conversations:create', 'conversations:assign', 'conversations:delete',
          'messages:send', 'messages:delete',
          'contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete',
          'agents:view', 'agents:create', 'agents:edit', 'agents:delete',
          'teams:view', 'teams:manage',
          'inboxes:view', 'inboxes:manage',
          'settings:view', 'settings:edit',
          'reports:view'
        ]
      },
      { 
        id: 'agent', 
        name: 'agent', 
        description: 'Atendimento e conversas', 
        isDefault: true,
        permissions: [
          'conversations:view', 'conversations:create', 'conversations:assign',
          'messages:send',
          'contacts:view', 'contacts:create', 'contacts:edit'
        ]
      },
      { 
        id: 'viewer', 
        name: 'viewer', 
        description: 'Apenas visualização', 
        isDefault: true,
        permissions: [
          'conversations:view',
          'contacts:view',
          'reports:view'
        ]
      }
    ];
    
    // Custom roles
    let customRoles = [];
    try {
      customRoles = await customRoleService.listCustomRoles(account.id);
    } catch (e) {
      // CustomRoleService may not exist yet
      logger.debug('CustomRoleService not available', { error: e.message });
    }
    
    // All available permissions
    const availablePermissions = [
      'conversations:view', 'conversations:create', 'conversations:assign', 'conversations:delete',
      'messages:send', 'messages:delete',
      'contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete',
      'agents:view', 'agents:create', 'agents:edit', 'agents:delete',
      'teams:view', 'teams:manage',
      'inboxes:view', 'inboxes:manage',
      'settings:view', 'settings:edit', 'webhooks:manage', 'integrations:manage',
      'reports:view'
    ];
    
    res.json({
      success: true,
      data: {
        defaultRoles,
        customRoles,
        availablePermissions
      }
    });
  } catch (error) {
    logger.error('List roles failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/roles
 * Create a custom role
 */
router.post('/roles', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { name, description, permissions } = req.body;
    
    if (!name || !permissions) {
      return res.status(400).json({
        error: 'Nome e permissões são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    const role = await customRoleService.createCustomRole(account.id, {
      name,
      description,
      permissions,
      createdBy: req.session.userId
    });
    
    logger.info('Custom role created via session', { roleId: role.id, accountId: account.id });
    
    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    logger.error('Create custom role failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/roles/:id
 * Update a custom role
 */
router.put('/roles/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { name, description, permissions } = req.body;
    
    const updated = await customRoleService.updateCustomRole(req.params.id, account.id, {
      name,
      description,
      permissions
    });
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Update custom role failed', { error: error.message, roleId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/session/roles/:id
 * Delete a custom role
 */
router.delete('/roles/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    await customRoleService.deleteCustomRole(req.params.id, account.id);
    
    logger.info('Custom role deleted via session', { roleId: req.params.id });
    
    res.json({
      success: true,
      message: 'Papel excluído com sucesso'
    });
  } catch (error) {
    logger.error('Delete custom role failed', { error: error.message, roleId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== AUDIT ROUTES ====================

/**
 * GET /api/session/audit
 * List audit logs for the account
 */
router.get('/audit', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { agentId, action, resourceType, startDate, endDate, limit, offset } = req.query;
    
    const logs = await auditService.queryLogs(account.id, {
      agentId,
      action,
      resourceType,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('List audit logs failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/audit/export
 * Export audit logs as CSV
 */
router.get('/audit/export', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { startDate, endDate } = req.query;
    
    const result = await auditService.queryLogs(account.id, {
      startDate,
      endDate,
      limit: 10000
    });
    
    // Convert to CSV
    const headers = ['Data', 'Agente', 'Ação', 'Recurso', 'Detalhes'];
    const rows = result.logs.map(log => [
      log.createdAt,
      log.agentName || log.agentId || 'Sistema',
      log.action,
      `${log.resourceType}:${log.resourceId}`,
      JSON.stringify(log.details || {})
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error('Export audit logs failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== DEBUG ROUTE ====================

/**
 * GET /api/session/account-debug
 * Debug route to check account and inbox data
 */
router.get('/account-debug', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const userId = req.session.userId;
    const userToken = req.session.userToken;
    
    // Check if tables exist
    const tablesResult = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('accounts', 'inboxes', 'inbox_members')
    `);
    const existingTables = tablesResult.rows.map(r => r.name);
    
    // Get account by owner_user_id
    let accountResult = { rows: [] };
    if (existingTables.includes('accounts')) {
      accountResult = await db.query(
        'SELECT * FROM accounts WHERE owner_user_id = ?',
        [userId]
      );
    }
    
    // Get all accounts (for debugging)
    let allAccountsResult = { rows: [] };
    if (existingTables.includes('accounts')) {
      allAccountsResult = await db.query('SELECT id, name, owner_user_id, wuzapi_token FROM accounts LIMIT 10');
    }
    
    // Get all inboxes (for debugging)
    let allInboxesResult = { rows: [] };
    if (existingTables.includes('inboxes')) {
      allInboxesResult = await db.query('SELECT id, account_id, name, channel_type, wuzapi_token FROM inboxes LIMIT 10');
    }
    
    // If account exists, get its inboxes
    let accountInboxes = [];
    if (accountResult.rows.length > 0 && existingTables.includes('inboxes')) {
      const account = accountResult.rows[0];
      const inboxesResult = await db.query(
        'SELECT * FROM inboxes WHERE account_id = ?',
        [account.id]
      );
      accountInboxes = inboxesResult.rows;
    }
    
    // Check if there's an account with wuzapi_token matching userToken
    let accountByTokenResult = { rows: [] };
    if (existingTables.includes('accounts')) {
      accountByTokenResult = await db.query(
        'SELECT * FROM accounts WHERE wuzapi_token = ?',
        [userToken]
      );
    }
    
    // Check for orphan inboxes (inboxes without valid account)
    let orphanInboxesResult = { rows: [] };
    if (existingTables.includes('inboxes') && existingTables.includes('accounts')) {
      orphanInboxesResult = await db.query(`
        SELECT i.* FROM inboxes i 
        LEFT JOIN accounts a ON i.account_id = a.id 
        WHERE a.id IS NULL
      `);
    }
    
    // Check migrations table
    let migrationsResult = { rows: [] };
    try {
      migrationsResult = await db.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 20');
    } catch (e) {
      // migrations table may not exist
    }
    
    res.json({
      success: true,
      debug: {
        sessionUserId: userId,
        sessionUserToken: userToken ? userToken.substring(0, 10) + '...' : null,
        sessionRole: req.session.role,
        existingTables,
        account: accountResult.rows[0] || null,
        accountByToken: accountByTokenResult.rows[0] || null,
        accountInboxes,
        allAccounts: allAccountsResult.rows,
        allInboxes: allInboxesResult.rows,
        orphanInboxes: orphanInboxesResult.rows,
        recentMigrations: migrationsResult.rows.map(r => r.name)
      }
    });
  } catch (error) {
    logger.error('Debug route failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * POST /api/session/account-debug/migrate-inboxes
 * Migrate orphan inboxes to current user's account
 */
router.post('/account-debug/migrate-inboxes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    // Find orphan inboxes (inboxes without valid account)
    const orphanInboxesResult = await db.query(`
      SELECT i.* FROM inboxes i 
      LEFT JOIN accounts a ON i.account_id = a.id 
      WHERE a.id IS NULL
    `);
    
    if (orphanInboxesResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma caixa de entrada órfã encontrada',
        migrated: 0
      });
    }
    
    // Migrate orphan inboxes to current account
    const migratedIds = [];
    for (const inbox of orphanInboxesResult.rows) {
      await db.query(
        'UPDATE inboxes SET account_id = ?, updated_at = ? WHERE id = ?',
        [account.id, new Date().toISOString(), inbox.id]
      );
      migratedIds.push(inbox.id);
      logger.info('Migrated orphan inbox to account', { inboxId: inbox.id, accountId: account.id });
    }
    
    res.json({
      success: true,
      message: `${migratedIds.length} caixa(s) de entrada migrada(s) com sucesso`,
      migrated: migratedIds.length,
      migratedIds
    });
  } catch (error) {
    logger.error('Migrate inboxes failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACCOUNT INFO ROUTE ====================

/**
 * POST /api/session/inboxes/default
 * Create or get the default inbox using user's WUZAPI token
 * This inbox represents the user's main WhatsApp connection
 */
router.post('/inboxes/default', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const userToken = req.session.userToken;
    const userName = req.session.userName || 'Principal';
    
    if (!userToken) {
      return res.status(400).json({
        error: 'Token de usuário não encontrado na sessão',
        code: 'NO_USER_TOKEN'
      });
    }
    
    // Check if default inbox already exists (inbox with user's token)
    const existingResult = await db.query(
      'SELECT * FROM inboxes WHERE account_id = ? AND wuzapi_token = ?',
      [account.id, userToken]
    );
    
    if (existingResult.rows.length > 0) {
      const inbox = inboxService.formatInbox(existingResult.rows[0]);
      return res.json({
        success: true,
        data: inbox,
        isNew: false
      });
    }
    
    // Create default inbox with user's token
    const id = require('crypto').randomUUID();
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO inboxes (
        id, account_id, name, description, channel_type, 
        enable_auto_assignment, auto_assignment_config,
        greeting_enabled, greeting_message, 
        wuzapi_token, wuzapi_user_id, wuzapi_connected,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.query(sql, [
      id,
      account.id,
      `WhatsApp ${userName}`,
      'Caixa de entrada principal - conexão WhatsApp do usuário',
      'whatsapp',
      1, // enable_auto_assignment
      JSON.stringify({}),
      0, // greeting_enabled
      null,
      userToken, // Use user's existing token
      req.session.userId, // wuzapi_user_id
      0, // wuzapi_connected - will be updated when checking status
      now,
      now
    ]);
    
    logger.info('Default inbox created for user', { 
      inboxId: id, 
      accountId: account.id, 
      userId: req.session.userId 
    });
    
    const inbox = await inboxService.getInboxById(id);
    
    res.status(201).json({
      success: true,
      data: inbox,
      isNew: true
    });
  } catch (error) {
    logger.error('Create default inbox failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/inboxes/:id/connect
 * Connect WhatsApp session for inbox
 */
router.post('/inboxes/:id/connect', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    if (inbox.channelType !== 'whatsapp') {
      return res.status(400).json({
        error: 'Conexão disponível apenas para caixas WhatsApp',
        code: 'INVALID_CHANNEL_TYPE'
      });
    }
    
    // Use inbox.wuzapiToken if available, otherwise fallback to user's session token
    const tokenToUse = inbox.wuzapiToken || req.session.userToken;
    
    if (!tokenToUse) {
      return res.status(400).json({
        error: 'Caixa de entrada não possui token WUZAPI configurado',
        code: 'NO_WUZAPI_TOKEN'
      });
    }
    
    const wuzapiClient = require('../utils/wuzapiClient');
    
    const { Subscribe = ['Message', 'ReadReceipt'], Immediate = false } = req.body;
    
    const result = await wuzapiClient.post('/session/connect', { Subscribe, Immediate }, {
      headers: { 'token': tokenToUse }
    });
    
    if (!result.success) {
      return res.status(500).json({
        error: 'Falha ao conectar sessão WhatsApp',
        code: 'CONNECT_ERROR',
        details: result.error
      });
    }
    
    logger.info('Inbox WhatsApp session connected', { 
      inboxId: req.params.id,
      tokenSource: inbox.wuzapiToken ? 'inbox' : 'session'
    });
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Connect inbox session failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/inboxes/:id/disconnect
 * Disconnect WhatsApp session for inbox
 */
router.post('/inboxes/:id/disconnect', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    // Use inbox.wuzapiToken if available, otherwise fallback to user's session token
    const tokenToUse = inbox.wuzapiToken || req.session.userToken;
    
    if (!tokenToUse) {
      return res.status(400).json({
        error: 'Caixa de entrada não possui token WUZAPI configurado',
        code: 'NO_WUZAPI_TOKEN'
      });
    }
    
    const wuzapiClient = require('../utils/wuzapiClient');
    
    const result = await wuzapiClient.post('/session/disconnect', {}, {
      headers: { 'token': tokenToUse }
    });
    
    // Update connection status
    await db.query(
      'UPDATE inboxes SET wuzapi_connected = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), inbox.id]
    );
    
    logger.info('Inbox WhatsApp session disconnected', { 
      inboxId: req.params.id,
      tokenSource: inbox.wuzapiToken ? 'inbox' : 'session'
    });
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Disconnect inbox session failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/session/inboxes/:id/logout
 * Logout WhatsApp session for inbox (removes device pairing)
 */
router.post('/inboxes/:id/logout', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== account.id) {
      return res.status(404).json({
        error: 'Caixa de entrada não encontrada',
        code: 'INBOX_NOT_FOUND'
      });
    }
    
    // Use inbox.wuzapiToken if available, otherwise fallback to user's session token
    const tokenToUse = inbox.wuzapiToken || req.session.userToken;
    
    if (!tokenToUse) {
      return res.status(400).json({
        error: 'Caixa de entrada não possui token WUZAPI configurado',
        code: 'NO_WUZAPI_TOKEN'
      });
    }
    
    const wuzapiClient = require('../utils/wuzapiClient');
    
    const result = await wuzapiClient.post('/session/logout', {}, {
      headers: { 'token': tokenToUse }
    });
    
    // Update connection status
    await db.query(
      'UPDATE inboxes SET wuzapi_connected = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), inbox.id]
    );
    
    logger.info('Inbox WhatsApp session logged out', { 
      inboxId: req.params.id,
      tokenSource: inbox.wuzapiToken ? 'inbox' : 'session'
    });
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Logout inbox session failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/account
 * Get current account info and stats
 */
router.get('/account', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const stats = await accountService.getAccountStats(account.id);
    
    res.json({
      success: true,
      data: {
        ...account,
        stats
      }
    });
  } catch (error) {
    logger.error('Get account info failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/session/subscription
 * Get current user subscription and quotas
 */
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const SubscriptionService = require('../services/SubscriptionService');
    const subscriptionService = new SubscriptionService(db);
    
    const subscription = await subscriptionService.getUserSubscription(req.session.userId);
    
    // Get current usage
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const inboxCount = await inboxService.countInboxes(account.id);
    const agentCount = await agentService.countAgents(account.id);
    const teamCount = await teamService.countTeams(account.id);
    
    res.json({
      success: true,
      data: {
        subscription,
        usage: {
          inboxes: inboxCount,
          agents: agentCount,
          teams: teamCount
        },
        quotas: subscription?.plan?.quotas || {
          maxInboxes: 1,
          maxAgents: 1,
          maxTeams: 1,
          maxConnections: 1
        }
      }
    });
  } catch (error) {
    logger.error('Get subscription failed', { error: error.message, userId: req.session?.userId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== AGENT DETAILS & ASSIGNMENTS ====================

const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');

let agentDatabaseAccessService = null;

function initAgentDatabaseAccessService(db) {
  if (!agentDatabaseAccessService) {
    agentDatabaseAccessService = new AgentDatabaseAccessService(db);
  }
}

/**
 * GET /api/session/agents/:id/details
 * Get agent with full details including teams, inboxes, database access, and permissions
 */
router.get('/agents/:id/details', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    initAgentDatabaseAccessService(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    // Get agent's teams
    const teams = await teamService.getAgentTeams(req.params.id);
    
    // Get agent's inboxes
    const inboxes = await inboxService.listAgentInboxes(req.params.id);
    
    // Get agent's database access
    const databaseAccess = await agentDatabaseAccessService.getAgentDatabaseAccess(req.params.id);
    
    // Get agent's permissions
    const permissions = await agentService.getAgentPermissions(req.params.id);
    
    res.json({
      success: true,
      data: {
        agent,
        teams,
        inboxes,
        databaseAccess,
        permissions
      }
    });
  } catch (error) {
    logger.error('Get agent details failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/agents/:id/teams
 * Update agent team memberships in bulk
 */
router.put('/agents/:id/teams', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    const { teamIds } = req.body;
    
    if (!Array.isArray(teamIds)) {
      return res.status(400).json({
        error: 'teamIds deve ser um array',
        code: 'INVALID_INPUT'
      });
    }
    
    // Validate all team IDs belong to this account
    for (const teamId of teamIds) {
      const team = await teamService.getTeamById(teamId);
      if (!team || team.accountId !== account.id) {
        return res.status(400).json({
          error: `Equipe ${teamId} não encontrada`,
          code: 'TEAM_NOT_FOUND'
        });
      }
    }
    
    // Get current teams
    const currentTeams = await teamService.getAgentTeams(req.params.id);
    const currentTeamIds = currentTeams.map(t => t.id);
    
    // Remove from teams not in new list
    for (const teamId of currentTeamIds) {
      if (!teamIds.includes(teamId)) {
        await teamService.removeMember(teamId, req.params.id);
      }
    }
    
    // Add to teams in new list
    for (const teamId of teamIds) {
      if (!currentTeamIds.includes(teamId)) {
        try {
          await teamService.addMember(teamId, req.params.id);
        } catch (err) {
          if (err.message !== 'AGENT_ALREADY_IN_TEAM') {
            throw err;
          }
        }
      }
    }
    
    // Get updated teams
    const updatedTeams = await teamService.getAgentTeams(req.params.id);
    
    logger.info('Agent teams updated', { agentId: req.params.id, teamIds });
    
    res.json({
      success: true,
      data: updatedTeams
    });
  } catch (error) {
    logger.error('Update agent teams failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/agents/:id/inboxes
 * Update agent inbox assignments in bulk
 */
router.put('/agents/:id/inboxes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    const { inboxIds } = req.body;
    
    if (!Array.isArray(inboxIds)) {
      return res.status(400).json({
        error: 'inboxIds deve ser um array',
        code: 'INVALID_INPUT'
      });
    }
    
    // Validate all inbox IDs belong to this account
    for (const inboxId of inboxIds) {
      const inbox = await inboxService.getInboxById(inboxId);
      if (!inbox || inbox.accountId !== account.id) {
        return res.status(400).json({
          error: `Caixa de entrada ${inboxId} não encontrada`,
          code: 'INBOX_NOT_FOUND'
        });
      }
    }
    
    // Get current inboxes
    const currentInboxes = await inboxService.listAgentInboxes(req.params.id);
    const currentInboxIds = currentInboxes.map(i => i.id);
    
    // Remove from inboxes not in new list
    for (const inboxId of currentInboxIds) {
      if (!inboxIds.includes(inboxId)) {
        await inboxService.removeAgent(inboxId, req.params.id);
      }
    }
    
    // Add to inboxes in new list
    for (const inboxId of inboxIds) {
      if (!currentInboxIds.includes(inboxId)) {
        try {
          await inboxService.assignAgent(inboxId, req.params.id);
        } catch (err) {
          if (err.message !== 'AGENT_ALREADY_IN_INBOX') {
            throw err;
          }
        }
      }
    }
    
    // Get updated inboxes
    const updatedInboxes = await inboxService.listAgentInboxes(req.params.id);
    
    logger.info('Agent inboxes updated', { agentId: req.params.id, inboxIds });
    
    res.json({
      success: true,
      data: updatedInboxes
    });
  } catch (error) {
    logger.error('Update agent inboxes failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/agents/:id/database-access
 * Update agent database access configurations
 */
router.put('/agents/:id/database-access', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    initAgentDatabaseAccessService(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    const { access } = req.body;
    
    if (!Array.isArray(access)) {
      return res.status(400).json({
        error: 'access deve ser um array de {connectionId, accessLevel}',
        code: 'INVALID_INPUT'
      });
    }
    
    // Validate access levels
    const validLevels = ['none', 'view', 'full'];
    for (const config of access) {
      if (!config.connectionId || !config.accessLevel) {
        return res.status(400).json({
          error: 'Cada item deve ter connectionId e accessLevel',
          code: 'INVALID_INPUT'
        });
      }
      if (!validLevels.includes(config.accessLevel)) {
        return res.status(400).json({
          error: `accessLevel inválido: ${config.accessLevel}. Use: none, view, full`,
          code: 'INVALID_ACCESS_LEVEL'
        });
      }
    }
    
    const updatedAccess = await agentDatabaseAccessService.setAgentDatabaseAccess(req.params.id, access);
    
    logger.info('Agent database access updated', { agentId: req.params.id, accessCount: access.length });
    
    res.json({
      success: true,
      data: updatedAccess
    });
  } catch (error) {
    logger.error('Update agent database access failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/session/agents/:id/permissions
 * Update agent role and custom permissions
 */
router.put('/agents/:id/permissions', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    // Prevent changing owner role
    if (agent.role === 'owner') {
      return res.status(403).json({
        error: 'Não é possível alterar permissões do proprietário',
        code: 'CANNOT_MODIFY_OWNER'
      });
    }
    
    const { role, customRoleId, permissions } = req.body;
    
    // Validate role
    const validRoles = ['administrator', 'agent', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        error: `Role inválido: ${role}. Use: administrator, agent, viewer`,
        code: 'INVALID_ROLE'
      });
    }
    
    // If customRoleId provided, validate it exists
    if (customRoleId) {
      const customRole = await customRoleService.getRoleById(customRoleId);
      if (!customRole || customRole.accountId !== account.id) {
        return res.status(400).json({
          error: 'Role personalizado não encontrado',
          code: 'CUSTOM_ROLE_NOT_FOUND'
        });
      }
    }
    
    // Update role
    const updatedAgent = await agentService.updateAgentRole(
      req.params.id, 
      role || agent.role, 
      customRoleId !== undefined ? customRoleId : agent.customRoleId
    );
    
    // Get updated permissions
    const updatedPermissions = await agentService.getAgentPermissions(req.params.id);
    
    logger.info('Agent permissions updated', { 
      agentId: req.params.id, 
      role: role || agent.role,
      customRoleId 
    });
    
    res.json({
      success: true,
      data: {
        agent: updatedAgent,
        permissions: updatedPermissions
      }
    });
  } catch (error) {
    logger.error('Update agent permissions failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== BULK OPERATIONS ====================

/**
 * POST /api/session/agents/bulk
 * Apply bulk actions to multiple agents
 */
router.post('/agents/bulk', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    initAgentDatabaseAccessService(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    
    const { agentIds, action, data } = req.body;
    
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({
        error: 'agentIds deve ser um array não vazio',
        code: 'INVALID_INPUT'
      });
    }
    
    const validActions = ['addTeams', 'removeTeams', 'addInboxes', 'removeInboxes', 'setRole', 'setDatabaseAccess'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Ação inválida: ${action}. Use: ${validActions.join(', ')}`,
        code: 'INVALID_ACTION'
      });
    }
    
    // Validate all agents belong to this account
    for (const agentId of agentIds) {
      const agent = await agentService.getAgentById(agentId);
      if (!agent || agent.accountId !== account.id) {
        return res.status(400).json({
          error: `Agente ${agentId} não encontrado`,
          code: 'AGENT_NOT_FOUND'
        });
      }
      // Prevent bulk operations on owner
      if (agent.role === 'owner') {
        return res.status(403).json({
          error: 'Não é possível aplicar ações em massa no proprietário',
          code: 'CANNOT_MODIFY_OWNER'
        });
      }
    }
    
    let updatedCount = 0;
    const errors = [];
    
    // Process each agent
    for (const agentId of agentIds) {
      try {
        switch (action) {
          case 'addTeams':
            if (data.teamIds && Array.isArray(data.teamIds)) {
              for (const teamId of data.teamIds) {
                try {
                  await teamService.addMember(teamId, agentId);
                } catch (err) {
                  if (err.message !== 'AGENT_ALREADY_IN_TEAM') {
                    throw err;
                  }
                }
              }
            }
            break;
            
          case 'removeTeams':
            if (data.teamIds && Array.isArray(data.teamIds)) {
              for (const teamId of data.teamIds) {
                await teamService.removeMember(teamId, agentId);
              }
            }
            break;
            
          case 'addInboxes':
            if (data.inboxIds && Array.isArray(data.inboxIds)) {
              for (const inboxId of data.inboxIds) {
                try {
                  await inboxService.assignAgent(inboxId, agentId);
                } catch (err) {
                  if (err.message !== 'AGENT_ALREADY_IN_INBOX') {
                    throw err;
                  }
                }
              }
            }
            break;
            
          case 'removeInboxes':
            if (data.inboxIds && Array.isArray(data.inboxIds)) {
              for (const inboxId of data.inboxIds) {
                await inboxService.removeAgent(inboxId, agentId);
              }
            }
            break;
            
          case 'setRole':
            if (data.role) {
              await agentService.updateAgentRole(agentId, data.role, data.customRoleId || null);
            }
            break;
            
          case 'setDatabaseAccess':
            if (data.databaseAccess && Array.isArray(data.databaseAccess)) {
              await agentDatabaseAccessService.setAgentDatabaseAccess(agentId, data.databaseAccess);
            }
            break;
        }
        updatedCount++;
      } catch (err) {
        errors.push(`Agente ${agentId}: ${err.message}`);
      }
    }
    
    logger.info('Bulk action completed', { 
      action, 
      agentCount: agentIds.length, 
      updatedCount,
      errorCount: errors.length 
    });
    
    res.json({
      success: errors.length === 0,
      data: {
        updatedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('Bulk action failed', { error: error.message });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ==================== SESSION IMPACT ====================

const PermissionService = require('../services/PermissionService');

let permissionService = null;

function initPermissionService(db) {
  if (!permissionService) {
    permissionService = new PermissionService(db);
  }
}

/**
 * GET /api/session/agents/:id/active-sessions
 * Check if agent has active sessions that would be affected by permission changes
 */
router.get('/agents/:id/active-sessions', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    initServices(db);
    initPermissionService(db);
    
    const account = await getOrCreateAccount(db, req.session.userId, req.session.userToken);
    const agent = await agentService.getAgentById(req.params.id);
    
    if (!agent || agent.accountId !== account.id) {
      return res.status(404).json({
        error: 'Agente não encontrado',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    const impact = await permissionService.checkActiveSessionsImpact(req.params.id);
    
    res.json({
      success: true,
      data: impact
    });
  } catch (error) {
    logger.error('Check active sessions failed', { error: error.message, agentId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
