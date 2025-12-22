/**
 * Contacts Permission Middleware
 * 
 * Middleware for validating agent permissions on contacts operations.
 * Checks if the authenticated agent has the required permission level
 * (read, write, delete) for contacts.
 * 
 * Requirements: 5.4, 11.2, 11.3, 11.4, 11.5
 */

const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');

/**
 * Permission levels for contacts operations
 */
const CONTACT_PERMISSIONS = {
  READ: 'contacts:read',
  WRITE: 'contacts:write',
  DELETE: 'contacts:delete'
};

/**
 * Check if agent has a specific contacts permission
 * 
 * @param {string[]} permissions - Agent's permissions array
 * @param {string} requiredPermission - Required permission
 * @returns {boolean} True if has permission
 */
function hasContactsPermission(permissions, requiredPermission) {
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }
  
  // Owner/admin has all permissions
  if (permissions.includes('*') || permissions.includes('contacts:*')) {
    return true;
  }
  
  // Check specific permission
  if (permissions.includes(requiredPermission)) {
    return true;
  }
  
  // Write permission implies read
  if (requiredPermission === CONTACT_PERMISSIONS.READ && 
      (permissions.includes(CONTACT_PERMISSIONS.WRITE) || 
       permissions.includes(CONTACT_PERMISSIONS.DELETE))) {
    return true;
  }
  
  // Delete permission implies write and read
  if (requiredPermission === CONTACT_PERMISSIONS.WRITE && 
      permissions.includes(CONTACT_PERMISSIONS.DELETE)) {
    return true;
  }
  
  return false;
}

/**
 * Middleware factory that requires specific contacts permission
 * 
 * Must be used after authentication middleware (requireUser, requireAgentAuth, etc.)
 * Works with both user sessions and agent sessions.
 * 
 * For users (account owners): Always grants full access
 * For agents: Checks permissions from req.agentPermissions
 * 
 * @param {string} permission - Required permission ('read', 'write', 'delete')
 * @returns {Function} Express middleware
 * 
 * Requirements: 5.4, 11.2, 11.3, 11.4, 11.5
 */
function requireContactsPermission(permission) {
  const permissionKey = `contacts:${permission}`;
  
  return (req, res, next) => {
    try {
      // Check if this is an agent request
      const isAgent = !!req.agent;
      
      // Check if this is a user request (account owner)
      const isUser = !!req.user && !req.agent;
      const isSession = !!req.session?.userId && !req.agent;
      
      // If neither agent nor user, require authentication
      if (!isAgent && !isUser && !isSession) {
        logger.warn('Contacts permission check failed - No authentication', {
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
      
      // Account owners (users) have full access to their contacts
      if (isUser || isSession) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Contacts permission granted - Account owner', {
            userId: req.user?.id || req.session?.userId,
            permission: permissionKey,
            path: req.path
          });
        }
        return next();
      }
      
      // For agents, check permissions
      const agentPermissions = req.agentPermissions || [];
      
      if (!hasContactsPermission(agentPermissions, permissionKey)) {
        logger.warn('Contacts permission denied', {
          agentId: req.agent.id,
          accountId: req.account?.id,
          requiredPermission: permissionKey,
          agentPermissions: agentPermissions,
          path: req.path,
          method: req.method
        });
        
        securityLogger.logUnauthorizedAccess({
          agentId: req.agent.id,
          ip: req.ip,
          path: req.path,
          reason: `Missing contacts permission: ${permissionKey}`
        });
        
        return res.status(403).json({
          success: false,
          error: 'Permissão insuficiente para esta operação',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermission: permissionKey,
          timestamp: new Date().toISOString()
        });
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Contacts permission granted', {
          agentId: req.agent.id,
          permission: permissionKey,
          path: req.path
        });
      }
      
      next();
    } catch (error) {
      logger.error('Contacts permission check error', {
        error: error.message,
        path: req.path,
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões',
        code: 'PERMISSION_CHECK_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Middleware that requires read permission for contacts
 * 
 * Requirements: 11.2
 */
const requireContactsRead = requireContactsPermission('read');

/**
 * Middleware that requires write permission for contacts
 * Allows create and update operations
 * 
 * Requirements: 11.3
 */
const requireContactsWrite = requireContactsPermission('write');

/**
 * Middleware that requires delete permission for contacts
 * Allows delete operations
 * 
 * Requirements: 11.4
 */
const requireContactsDelete = requireContactsPermission('delete');

/**
 * Helper to get the actor info for audit logging
 * Returns either user or agent info based on request context
 * 
 * @param {Object} req - Express request
 * @returns {Object} Actor info with id and type
 */
function getContactsActor(req) {
  if (req.agent) {
    return {
      id: req.agent.id,
      type: 'agent',
      accountId: req.account?.id
    };
  }
  
  if (req.user) {
    return {
      id: req.user.id,
      type: 'account',
      accountId: req.user.accountId || req.user.id
    };
  }
  
  if (req.session?.userId) {
    return {
      id: req.session.userId,
      type: 'account',
      accountId: req.session.accountId || req.session.userId
    };
  }
  
  return null;
}

/**
 * Helper to get account ID from request context
 * Works with both user and agent authentication
 * 
 * @param {Object} req - Express request
 * @returns {string|null} Account ID
 */
function getAccountIdFromRequest(req) {
  // Agent request
  if (req.agent && req.account) {
    return req.account.id;
  }
  
  // User request with account info
  if (req.user?.accountId) {
    return req.user.accountId;
  }
  
  // Session with account info
  if (req.session?.accountId) {
    return req.session.accountId;
  }
  
  // Fallback to user ID (for account owners)
  if (req.user?.id) {
    return req.user.id;
  }
  
  if (req.session?.userId) {
    return req.session.userId;
  }
  
  return null;
}

/**
 * Helper to get tenant ID from request context
 * 
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID
 */
function getTenantIdFromRequest(req) {
  // From RLS context
  if (req.rlsContext?.tenantId) {
    return req.rlsContext.tenantId;
  }
  
  // From account
  if (req.account?.tenantId) {
    return req.account.tenantId;
  }
  
  // From user
  if (req.user?.tenantId) {
    return req.user.tenantId;
  }
  
  // From session
  if (req.session?.tenantId) {
    return req.session.tenantId;
  }
  
  // From context
  if (req.context?.tenantId) {
    return req.context.tenantId;
  }
  
  return null;
}

module.exports = {
  CONTACT_PERMISSIONS,
  hasContactsPermission,
  requireContactsPermission,
  requireContactsRead,
  requireContactsWrite,
  requireContactsDelete,
  getContactsActor,
  getAccountIdFromRequest,
  getTenantIdFromRequest
};
