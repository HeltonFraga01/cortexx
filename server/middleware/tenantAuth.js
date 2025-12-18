const logger = require('../utils/logger');

/**
 * Tenant Authentication Middleware
 * Validates tenant admin access and prevents cross-tenant access
 * Requirements: 5.1, 9.2
 */

/**
 * Middleware to require tenant admin authentication
 * Validates that the user is authenticated as a tenant admin for the current tenant
 */
function requireTenantAdmin(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      logger.warn('Unauthenticated tenant admin access attempt', {
        path: req.path,
        method: req.method,
        tenantId: req.context?.tenantId
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Tenant admin authentication is required to access this resource.'
      });
    }

    // Check if user has tenant admin role
    if (req.session.role !== 'tenant_admin' && req.session.role !== 'tenant_admin_impersonated') {
      logger.warn('Non-tenant-admin access attempt', {
        userId: req.session.userId,
        userRole: req.session.role,
        path: req.path,
        tenantId: req.context?.tenantId
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Tenant admin privileges are required to access this resource.'
      });
    }

    // Validate tenant context exists
    if (!req.context || !req.context.tenantId) {
      logger.error('Missing tenant context in tenant admin request', {
        userId: req.session.userId,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Tenant context is required for this operation.'
      });
    }

    // Prevent cross-tenant access
    if (req.session.tenantId && req.session.tenantId !== req.context.tenantId) {
      logger.warn('Cross-tenant access attempt detected', {
        userId: req.session.userId,
        sessionTenantId: req.session.tenantId,
        requestTenantId: req.context.tenantId,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(403).json({
        error: 'Cross-tenant access denied',
        message: 'You do not have permission to access resources from this tenant.'
      });
    }

    // For impersonated sessions, validate the impersonation is still valid
    if (req.session.role === 'tenant_admin_impersonated') {
      if (!req.session.impersonatedBy || !req.session.impersonationToken) {
        logger.warn('Invalid impersonation session', {
          userId: req.session.userId,
          tenantId: req.context.tenantId,
          path: req.path
        });
        
        return res.status(401).json({
          error: 'Invalid session',
          message: 'Impersonation session is invalid. Please re-authenticate.'
        });
      }
    }

    // Set tenant admin context for downstream middleware
    req.tenantAdmin = {
      userId: req.session.userId,
      tenantId: req.context.tenantId,
      role: req.session.role,
      isImpersonated: req.session.role === 'tenant_admin_impersonated',
      impersonatedBy: req.session.impersonatedBy || null
    };

    logger.debug('Tenant admin authentication successful', {
      userId: req.session.userId,
      tenantId: req.context.tenantId,
      role: req.session.role,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Tenant admin authentication error', {
      error: error.message,
      userId: req.session?.userId,
      tenantId: req.context?.tenantId,
      path: req.path
    });

    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication.'
    });
  }
}

/**
 * Middleware to require tenant user authentication (account owner or agent)
 * Validates that the user belongs to the current tenant
 */
function requireTenantUser(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      logger.warn('Unauthenticated tenant user access attempt', {
        path: req.path,
        method: req.method,
        tenantId: req.context?.tenantId
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User authentication is required to access this resource.'
      });
    }

    // Check if user has appropriate role
    const validRoles = ['account_owner', 'agent', 'tenant_admin', 'tenant_admin_impersonated'];
    if (!validRoles.includes(req.session.role)) {
      logger.warn('Invalid role for tenant user access', {
        userId: req.session.userId,
        userRole: req.session.role,
        path: req.path,
        tenantId: req.context?.tenantId
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource.'
      });
    }

    // Validate tenant context exists
    if (!req.context || !req.context.tenantId) {
      logger.error('Missing tenant context in tenant user request', {
        userId: req.session.userId,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Tenant context is required for this operation.'
      });
    }

    // For non-admin users, validate they belong to the current tenant
    if (!req.session.role.includes('tenant_admin')) {
      if (!req.session.tenantId || req.session.tenantId !== req.context.tenantId) {
        logger.warn('Cross-tenant user access attempt', {
          userId: req.session.userId,
          sessionTenantId: req.session.tenantId,
          requestTenantId: req.context.tenantId,
          path: req.path
        });
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access resources from this tenant.'
        });
      }
    }

    // Set tenant user context for downstream middleware
    req.tenantUser = {
      userId: req.session.userId,
      tenantId: req.context.tenantId,
      role: req.session.role,
      accountId: req.session.accountId || null,
      agentId: req.session.agentId || null
    };

    logger.debug('Tenant user authentication successful', {
      userId: req.session.userId,
      tenantId: req.context.tenantId,
      role: req.session.role,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Tenant user authentication error', {
      error: error.message,
      userId: req.session?.userId,
      tenantId: req.context?.tenantId,
      path: req.path
    });

    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication.'
    });
  }
}

/**
 * Middleware to validate account ownership within tenant
 * Ensures the authenticated user can only access their own account data
 */
function requireAccountOwnership(req, res, next) {
  try {
    const accountId = req.params.accountId || req.body.accountId || req.query.accountId;
    
    if (!accountId) {
      return res.status(400).json({
        error: 'Missing account ID',
        message: 'Account ID is required for this operation.'
      });
    }

    // Tenant admins can access any account in their tenant
    if (req.session.role === 'tenant_admin' || req.session.role === 'tenant_admin_impersonated') {
      return next();
    }

    // Account owners can only access their own account
    if (req.session.role === 'account_owner' && req.session.accountId === accountId) {
      return next();
    }

    // Agents can only access their account
    if (req.session.role === 'agent' && req.session.accountId === accountId) {
      return next();
    }

    logger.warn('Account ownership validation failed', {
      userId: req.session.userId,
      userRole: req.session.role,
      userAccountId: req.session.accountId,
      requestedAccountId: accountId,
      path: req.path
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'You can only access your own account data.'
    });
  } catch (error) {
    logger.error('Account ownership validation error', {
      error: error.message,
      userId: req.session?.userId,
      path: req.path
    });

    res.status(500).json({
      error: 'Validation error',
      message: 'An error occurred during account ownership validation.'
    });
  }
}

module.exports = {
  requireTenantAdmin,
  requireTenantUser,
  requireAccountOwnership
};