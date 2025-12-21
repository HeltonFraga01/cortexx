/**
 * User Authentication Middleware
 * 
 * Middleware for authenticating independent users (not agents).
 * Validates session tokens and loads user data into request.
 * 
 * Requirements: 6.1, 6.5, 3.3, 3.4
 */

const { logger } = require('../utils/logger');
const UserSessionService = require('../services/UserSessionService');
const UserService = require('../services/UserService');

/**
 * Extract session token from request
 * @param {Object} req - Express request
 * @returns {string|null} Session token or null
 */
function extractUserToken(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check X-User-Token header
  const userToken = req.headers['x-user-token'];
  if (userToken) {
    return userToken;
  }
  
  // Check cookie
  if (req.cookies && req.cookies.user_session) {
    return req.cookies.user_session;
  }
  
  return null;
}

/**
 * Middleware that requires user authentication
 * 
 * Validates session token and loads user data into request.
 * Sets req.user and req.userSession.
 * 
 * Requirements: 6.1, 6.5
 */
async function requireUserAuth(req, res, next) {
  try {
    const token = extractUserToken(req);
    
    if (!token) {
      logger.warn('User auth failed - No token provided', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate session
    const validation = await UserSessionService.validateSession(token);
    
    if (!validation.valid) {
      logger.warn('User auth failed - Invalid session', {
        error: validation.error,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: validation.error === 'SESSION_EXPIRED' ? 'Sessão expirada' : 'Sessão inválida',
        code: validation.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const { session } = validation;
    
    // Load user data
    const user = await UserService.getUserById(session.userId);
    
    if (!user) {
      logger.error('User auth failed - User not found', {
        userId: session.userId,
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check user status
    if (user.status !== 'active') {
      logger.warn('User auth failed - User inactive', {
        userId: user.id,
        status: user.status,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'Conta desativada',
        code: 'ACCOUNT_INACTIVE',
        timestamp: new Date().toISOString()
      });
    }
    
    // Attach data to request
    req.user = user;
    req.userSession = session;
    req.userRole = 'user'; // Requirements: 6.2 - Set role as 'user'
    
    // Log successful auth in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('User auth successful', {
        userId: user.id,
        tenantId: user.tenantId,
        path: req.path
      });
    }
    
    next();
  } catch (error) {
    logger.error('User auth error', {
      error: error.message,
      path: req.path,
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno de autenticação',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Middleware that requires user to have a linked inbox
 * Must be used after requireUserAuth
 * 
 * Requirements: 3.3, 3.4
 */
async function requireInbox(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if user has any linked inbox
    const hasInbox = await UserService.hasLinkedInbox(req.user.id);
    
    if (!hasInbox) {
      logger.warn('Inbox required but not linked', {
        userId: req.user.id,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'Nenhuma inbox vinculada. Entre em contato com o administrador.',
        code: 'NO_INBOX_LINKED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get primary inbox and attach to request
    const primaryInbox = await UserService.getPrimaryInbox(req.user.id);
    req.userInbox = primaryInbox;
    
    next();
  } catch (error) {
    logger.error('Inbox check error', {
      error: error.message,
      userId: req.user?.id,
      path: req.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar inbox',
      code: 'INBOX_CHECK_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Middleware that requires specific permission
 * Must be used after requireUserAuth
 * 
 * @param {string} permission - Required permission
 */
function requireUserPermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    const hasPermission = await UserService.hasPermission(req.user.id, permission);
    
    if (!hasPermission) {
      logger.warn('Permission check failed', {
        userId: req.user.id,
        requiredPermission: permission,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
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
 * Optional user auth - loads user data if token present, but doesn't require it
 */
async function optionalUserAuth(req, res, next) {
  try {
    const token = extractUserToken(req);
    
    if (!token) {
      return next();
    }
    
    const validation = await UserSessionService.validateSession(token);
    
    if (!validation.valid) {
      return next();
    }
    
    const { session } = validation;
    const user = await UserService.getUserById(session.userId);
    
    if (user && user.status === 'active') {
      req.user = user;
      req.userSession = session;
      req.userRole = 'user';
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    logger.debug('Optional user auth error', { error: error.message });
    next();
  }
}

module.exports = {
  requireUserAuth,
  requireInbox,
  requireUserPermission,
  optionalUserAuth,
  extractUserToken
};
