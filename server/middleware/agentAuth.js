/**
 * Agent Authentication Middleware
 * 
 * Middleware for authenticating agents in the multi-user system.
 * Validates session tokens and loads agent/account data into request.
 * 
 * Requirements: 6.1, 6.3
 */

const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const AgentSessionService = require('../services/AgentSessionService');
const AgentService = require('../services/AgentService');
const AccountService = require('../services/AccountService');

// Lazy initialization of services (will be set on first use)
let sessionService = null;
let agentService = null;
let accountService = null;

/**
 * Initialize services with database instance
 * @param {Object} db - Database instance
 */
function initServices(db) {
  if (!sessionService) {
    sessionService = new AgentSessionService(db);
    agentService = new AgentService(db);
    accountService = new AccountService(db);
  }
}

/**
 * Extract session token from request
 * @param {Object} req - Express request
 * @returns {string|null} Session token or null
 */
function extractToken(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check X-Agent-Token header
  const agentToken = req.headers['x-agent-token'];
  if (agentToken) {
    return agentToken;
  }
  
  // Check cookie
  if (req.cookies && req.cookies.agent_session) {
    return req.cookies.agent_session;
  }
  
  return null;
}

/**
 * Middleware that requires agent authentication
 * 
 * Validates session token and loads agent/account data into request.
 * Sets req.agent, req.account, and req.agentSession.
 * 
 * @param {Object|null} db - Database instance (optional, will use req.app.locals.db if not provided)
 */
function requireAgentAuth(db) {
  return async (req, res, next) => {
    // Get db from parameter or from app.locals
    const database = db || req.app.locals.db;
    initServices(database);
    try {
      const token = extractToken(req);
      
      if (!token) {
        logger.warn('Agent auth failed - No token provided', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        securityLogger.logUnauthorizedAccess({
          ip: req.ip,
          path: req.path,
          reason: 'No agent session token'
        });
        
        return res.status(401).json({
          error: 'Autenticação necessária',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate session
      const validation = await sessionService.validateSession(token);
      
      if (!validation.valid) {
        logger.warn('Agent auth failed - Invalid session', {
          error: validation.error,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        securityLogger.logUnauthorizedAccess({
          ip: req.ip,
          path: req.path,
          reason: validation.error
        });
        
        const statusCode = validation.error === 'SESSION_EXPIRED' ? 401 : 401;
        return res.status(statusCode).json({
          error: validation.error === 'SESSION_EXPIRED' ? 'Sessão expirada' : 'Sessão inválida',
          code: validation.error,
          timestamp: new Date().toISOString()
        });
      }
      
      const { session } = validation;
      
      // Load agent data
      const agent = await agentService.getAgentById(session.agentId);
      
      if (!agent) {
        logger.error('Agent auth failed - Agent not found', {
          agentId: session.agentId,
          path: req.path
        });
        
        return res.status(401).json({
          error: 'Agente não encontrado',
          code: 'AGENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check agent status
      if (agent.status !== 'active') {
        logger.warn('Agent auth failed - Agent inactive', {
          agentId: agent.id,
          status: agent.status,
          path: req.path
        });
        
        securityLogger.logUnauthorizedAccess({
          agentId: agent.id,
          ip: req.ip,
          path: req.path,
          reason: 'Agent inactive'
        });
        
        return res.status(403).json({
          error: 'Conta de agente desativada',
          code: 'AGENT_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }
      
      // Load account data
      const account = await accountService.getAccountById(session.accountId);
      
      if (!account) {
        logger.error('Agent auth failed - Account not found', {
          accountId: session.accountId,
          path: req.path
        });
        
        return res.status(401).json({
          error: 'Conta não encontrada',
          code: 'ACCOUNT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check account status
      if (account.status !== 'active') {
        logger.warn('Agent auth failed - Account inactive', {
          accountId: account.id,
          status: account.status,
          path: req.path
        });
        
        securityLogger.logUnauthorizedAccess({
          accountId: account.id,
          agentId: agent.id,
          ip: req.ip,
          path: req.path,
          reason: 'Account inactive'
        });
        
        return res.status(403).json({
          error: 'Conta desativada',
          code: 'ACCOUNT_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }
      
      // Load agent permissions
      const permissions = await agentService.getAgentPermissions(agent.id);
      
      // Attach data to request
      req.agent = agent;
      req.account = account;
      req.agentSession = session;
      req.agentPermissions = permissions;
      
      // Log successful auth in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Agent auth successful', {
          agentId: agent.id,
          accountId: account.id,
          role: agent.role,
          path: req.path
        });
      }
      
      next();
    } catch (error) {
      logger.error('Agent auth error', {
        error: error.message,
        path: req.path,
        ip: req.ip
      });
      
      return res.status(500).json({
        error: 'Erro interno de autenticação',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware that requires specific agent role
 * Must be used after requireAgentAuth
 * 
 * @param {...string} allowedRoles - Allowed roles
 */
function requireAgentRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!allowedRoles.includes(req.agent.role)) {
      logger.warn('Agent role check failed', {
        agentId: req.agent.id,
        role: req.agent.role,
        requiredRoles: allowedRoles,
        path: req.path
      });
      
      securityLogger.logUnauthorizedAccess({
        agentId: req.agent.id,
        ip: req.ip,
        path: req.path,
        reason: `Role ${req.agent.role} not in allowed roles: ${allowedRoles.join(', ')}`
      });
      
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

/**
 * Middleware that requires specific permission
 * Must be used after requireAgentAuth
 * 
 * @param {string} permission - Required permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    const permissions = req.agentPermissions || [];
    
    // Owner has all permissions
    if (permissions.includes('*')) {
      return next();
    }
    
    if (!permissions.includes(permission)) {
      logger.warn('Permission check failed', {
        agentId: req.agent.id,
        requiredPermission: permission,
        path: req.path
      });
      
      securityLogger.logUnauthorizedAccess({
        agentId: req.agent.id,
        ip: req.ip,
        path: req.path,
        reason: `Missing permission: ${permission}`
      });
      
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'FORBIDDEN',
        requiredPermission: permission,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

/**
 * Optional agent auth - loads agent data if token present, but doesn't require it
 * 
 * @param {Object|null} db - Database instance (optional, will use req.app.locals.db if not provided)
 */
function optionalAgentAuth(db) {
  return async (req, res, next) => {
    // Get db from parameter or from app.locals
    const database = db || req.app.locals.db;
    initServices(database);
    try {
      const token = extractToken(req);
      
      if (!token) {
        return next();
      }
      
      const validation = await sessionService.validateSession(token);
      
      if (!validation.valid) {
        return next();
      }
      
      const { session } = validation;
      const agent = await agentService.getAgentById(session.agentId);
      const account = await accountService.getAccountById(session.accountId);
      
      if (agent && agent.status === 'active' && account && account.status === 'active') {
        const permissions = await agentService.getAgentPermissions(agent.id);
        req.agent = agent;
        req.account = account;
        req.agentSession = session;
        req.agentPermissions = permissions;
      }
      
      next();
    } catch (error) {
      // Don't fail on optional auth errors
      logger.debug('Optional agent auth error', { error: error.message });
      next();
    }
  };
}

module.exports = {
  requireAgentAuth,
  requireAgentRole,
  requirePermission,
  optionalAgentAuth,
  extractToken,
  initServices
};
