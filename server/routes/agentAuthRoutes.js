/**
 * Agent Authentication Routes
 * 
 * Handles agent login, logout, registration, and session management.
 * 
 * Requirements: 2.3, 2.4, 6.1
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const AgentService = require('../services/AgentService');
const AgentSessionService = require('../services/AgentSessionService');
const AccountService = require('../services/AccountService');
const MultiUserAuditService = require('../services/MultiUserAuditService');
const { requireAgentAuth } = require('../middleware/agentAuth');
const { skipCsrf } = require('../middleware/csrf');

// Services will be initialized with db
let agentService = null;
let sessionService = null;
let accountService = null;
let auditService = null;

/**
 * Initialize services with database
 * @param {Object} db - Database instance
 */
function initServices(db) {
  if (!agentService) {
    agentService = new AgentService(db);
    sessionService = new AgentSessionService(db);
    accountService = new AccountService(db);
    auditService = new MultiUserAuditService(db);
  }
}

/**
 * POST /api/agent/login
 * Agent login - supports both simplified (email only) and full (accountId + email) login
 * Note: skipCsrf is used because this is a public login endpoint
 */
router.post('/login', skipCsrf, async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { accountId, email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'email e password são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    let agent;
    let account;

    if (accountId) {
      // Full login with accountId
      account = await accountService.getAccountById(accountId);
      if (!account) {
        return res.status(401).json({
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      if (account.status !== 'active') {
        return res.status(403).json({
          error: 'Conta desativada',
          code: 'ACCOUNT_INACTIVE'
        });
      }
      
      agent = await agentService.getAgentForAuth(accountId, email);
    } else {
      // Simplified login - search by email only
      agent = await agentService.getAgentByEmailOnly(email);
      
      if (agent) {
        account = await accountService.getAccountById(agent.accountId);
      }
    }
    
    if (!agent) {
      await auditService.logLogin(accountId || 'unknown', null, req.ip, req.get('User-Agent'), false);
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if agent is locked
    if (await agentService.isAgentLocked(agent.id)) {
      return res.status(423).json({
        error: 'Conta bloqueada temporariamente. Tente novamente em 15 minutos.',
        code: 'ACCOUNT_LOCKED'
      });
    }
    
    // Check agent status
    if (agent.status !== 'active') {
      return res.status(403).json({
        error: 'Conta de agente desativada',
        code: 'AGENT_INACTIVE'
      });
    }
    
    // Verify password
    const isValidPassword = await agentService.verifyPassword(password, agent.passwordHash);
    
    if (!isValidPassword) {
      await agentService.recordFailedLogin(agent.id);
      await auditService.logLogin(agent.accountId, agent.id, req.ip, req.get('User-Agent'), false);
      
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Reset failed login attempts
    await agentService.resetFailedLogins(agent.id);
    
    // Create session
    const session = await sessionService.createSession({
      agentId: agent.id,
      accountId: agent.accountId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Log successful login
    await auditService.logLogin(agent.accountId, agent.id, req.ip, req.get('User-Agent'), true);
    
    // Get agent permissions
    const permissions = await agentService.getAgentPermissions(agent.id);
    
    logger.info('Agent logged in', { agentId: agent.id, accountId: agent.accountId });
    
    res.json({
      success: true,
      data: {
        token: session.token,
        expiresAt: session.expiresAt,
        agent: {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          avatarUrl: agent.avatarUrl,
          role: agent.role,
          availability: agent.availability
        },
        account: {
          id: account.id,
          name: account.name
        },
        permissions
      }
    });
  } catch (error) {
    logger.error('Login failed', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/agent/logout
 * Agent logout
 * Requirements: 4.5 - Set availability to offline on logout
 */
router.post('/logout', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    // Set agent availability to offline - Requirements: 4.5
    await agentService.updateAvailability(req.agent.id, 'offline');
    
    // Delete current session
    await sessionService.deleteSession(req.agentSession.id);
    
    // Log logout
    await auditService.logLogout(req.account.id, req.agent.id, req.ip);
    
    logger.info('Agent logged out', { agentId: req.agent.id });
    
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  } catch (error) {
    logger.error('Logout failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/agent/me
 * Get current agent info
 */
router.get('/me', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const permissions = await agentService.getAgentPermissions(req.agent.id);
    
    res.json({
      success: true,
      data: {
        agent: {
          id: req.agent.id,
          email: req.agent.email,
          name: req.agent.name,
          avatarUrl: req.agent.avatarUrl,
          role: req.agent.role,
          availability: req.agent.availability,
          status: req.agent.status,
          lastActivityAt: req.agent.lastActivityAt
        },
        account: {
          id: req.account.id,
          name: req.account.name,
          timezone: req.account.timezone,
          locale: req.account.locale
        },
        permissions,
        session: {
          id: req.agentSession.id,
          expiresAt: req.agentSession.expiresAt
        }
      }
    });
  } catch (error) {
    logger.error('Get current agent failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/agent/invitation/:token
 * Validate invitation token
 * Note: skipCsrf is used because this is a public endpoint
 */
router.get('/invitation/:token', skipCsrf, async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { token } = req.params;
    
    const validation = await agentService.validateInvitation(token);
    
    if (!validation.valid) {
      const errorMessages = {
        INVITATION_NOT_FOUND: 'Convite não encontrado',
        INVITATION_ALREADY_USED: 'Este convite já foi utilizado',
        INVITATION_EXPIRED: 'Este convite expirou'
      };
      
      return res.status(400).json({
        error: errorMessages[validation.error] || 'Convite inválido',
        code: validation.error
      });
    }
    
    // Get account info
    const account = await accountService.getAccountById(validation.invitation.accountId);
    
    res.json({
      success: true,
      data: {
        valid: true,
        invitation: {
          role: validation.invitation.role,
          email: validation.invitation.email,
          expiresAt: validation.invitation.expiresAt
        },
        account: account ? {
          id: account.id,
          name: account.name
        } : null
      }
    });
  } catch (error) {
    logger.error('Validate invitation failed', { error: error.message });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/agent/register/:token
 * Complete registration via invitation
 * Note: skipCsrf is used because this is a public registration endpoint
 */
router.post('/register/:token', skipCsrf, async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { token } = req.params;
    const { email, password, name, avatarUrl } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'email, password e name são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'A senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Complete registration
    const agent = await agentService.completeRegistration(token, {
      email,
      password,
      name,
      avatarUrl
    });
    
    // Create session for the new agent
    const session = await sessionService.createSession({
      agentId: agent.id,
      accountId: agent.accountId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Get account info
    const account = await accountService.getAccountById(agent.accountId);
    
    // Get permissions
    const permissions = await agentService.getAgentPermissions(agent.id);
    
    logger.info('Agent registered via invitation', { agentId: agent.id, accountId: agent.accountId });
    
    res.status(201).json({
      success: true,
      data: {
        token: session.token,
        expiresAt: session.expiresAt,
        agent: {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          avatarUrl: agent.avatarUrl,
          role: agent.role,
          availability: agent.availability
        },
        account: {
          id: account.id,
          name: account.name
        },
        permissions
      }
    });
  } catch (error) {
    logger.error('Registration failed', { error: error.message });
    
    const errorMessages = {
      INVITATION_NOT_FOUND: 'Convite não encontrado',
      INVITATION_ALREADY_USED: 'Este convite já foi utilizado',
      INVITATION_EXPIRED: 'Este convite expirou',
      EMAIL_ALREADY_EXISTS: 'Este email já está cadastrado nesta conta'
    };
    
    if (errorMessages[error.message]) {
      return res.status(400).json({
        error: errorMessages[error.message],
        code: error.message
      });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/agent/availability
 * Update agent availability
 */
router.put('/availability', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { availability } = req.body;
    
    if (!['online', 'busy', 'offline'].includes(availability)) {
      return res.status(400).json({
        error: 'availability deve ser online, busy ou offline',
        code: 'INVALID_AVAILABILITY'
      });
    }
    
    const agent = await agentService.updateAvailability(req.agent.id, availability);
    
    res.json({
      success: true,
      data: {
        availability: agent.availability,
        lastActivityAt: agent.lastActivityAt
      }
    });
  } catch (error) {
    logger.error('Update availability failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/agent/profile
 * Update agent profile (name and avatar)
 */
router.put('/profile', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { name, avatarUrl } = req.body;
    
    if (!name && avatarUrl === undefined) {
      return res.status(400).json({
        error: 'Pelo menos name ou avatarUrl deve ser fornecido',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({
        error: 'Nome deve ter pelo menos 2 caracteres',
        code: 'INVALID_NAME'
      });
    }
    
    // Validate avatarUrl if provided
    if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
      try {
        new URL(avatarUrl);
      } catch {
        return res.status(400).json({
          error: 'URL do avatar inválida',
          code: 'INVALID_AVATAR_URL'
        });
      }
    }
    
    const agent = await agentService.updateProfile(req.agent.id, {
      name: name?.trim(),
      avatarUrl: avatarUrl || null
    });
    
    logger.info('Agent profile updated', { agentId: req.agent.id });
    
    res.json({
      success: true,
      data: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
        role: agent.role,
        availability: agent.availability
      }
    });
  } catch (error) {
    logger.error('Update profile failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/agent/password
 * Change agent password
 */
router.put('/password', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'currentPassword e newPassword são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'A nova senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Verify current password
    const agent = await agentService.getAgentForAuth(req.account.id, req.agent.email);
    const isValid = await agentService.verifyPassword(currentPassword, agent.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({
        error: 'Senha atual incorreta',
        code: 'INVALID_PASSWORD'
      });
    }
    
    // Update password (invalidates other sessions)
    await agentService.updatePassword(req.agent.id, newPassword, true, req.agentSession.id);
    
    logger.info('Agent password changed', { agentId: req.agent.id });
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    logger.error('Change password failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
module.exports.initServices = initServices;
