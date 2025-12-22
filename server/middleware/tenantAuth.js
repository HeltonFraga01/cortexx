const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('./supabaseAuth');
const { setRlsContext } = require('./rlsContext');

/**
 * Tenant Authentication Middleware
 * Validates tenant admin access and prevents cross-tenant access
 * Supports both JWT (Supabase Auth) and session-based authentication
 * Requirements: 5.1, 9.2
 */

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
}

/**
 * Helper to get user role from request (JWT or session)
 */
function getUserRole(req) {
  return req.user?.role || req.session?.role;
}

/**
 * Helper to get tenant ID from request (JWT or session or context)
 */
function getTenantId(req) {
  return req.user?.tenantId || req.tenantId || req.session?.tenantId || req.context?.tenantId;
}

/**
 * Middleware to require tenant admin authentication
 * Validates that the user is authenticated as a tenant admin for the current tenant
 * Supports both JWT (Supabase Auth) and session-based authentication
 */
async function requireTenantAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    // Check for JWT token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use Supabase JWT authentication
      await validateSupabaseToken(req, res, () => {
        // After token validation, check tenant admin role
        const userId = getUserId(req);
        const userRole = getUserRole(req);
        
        if (!userId) {
          logger.warn('Unauthenticated tenant admin access attempt (JWT)', {
            path: req.path,
            method: req.method,
            tenantId: req.context?.tenantId,
            ip: req.ip
          });
          
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Tenant admin authentication is required to access this resource.'
          });
        }

        // Check if user has tenant admin role
        if (userRole !== 'tenant_admin' && userRole !== 'tenant_admin_impersonated' && userRole !== 'admin') {
          logger.warn('Non-tenant-admin access attempt (JWT)', {
            userId,
            userRole,
            path: req.path,
            tenantId: req.context?.tenantId
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'Tenant admin privileges are required to access this resource.'
          });
        }

        // Continue with tenant context validation
        return validateTenantContext(req, res, next, userId, userRole);
      });
      return;
    }

    // Fallback to session-based authentication (legacy support)
    const userId = req.session?.userId;
    const userRole = req.session?.role;
    
    // Check if user is authenticated
    if (!userId) {
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
    if (userRole !== 'tenant_admin' && userRole !== 'tenant_admin_impersonated') {
      logger.warn('Non-tenant-admin access attempt', {
        userId,
        userRole,
        path: req.path,
        tenantId: req.context?.tenantId
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Tenant admin privileges are required to access this resource.'
      });
    }

    // Continue with tenant context validation
    return validateTenantContext(req, res, next, userId, userRole);
  } catch (error) {
    logger.error('Tenant admin authentication error', {
      error: error.message,
      userId: getUserId(req),
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
 * Helper function to validate tenant context after authentication
 */
function validateTenantContext(req, res, next, userId, userRole) {
  try {
    const tenantId = getTenantId(req);
    const sessionTenantId = req.user?.tenantId || req.session?.tenantId;

    // Validate tenant context exists
    if (!tenantId) {
      logger.error('Missing tenant context in tenant admin request', {
        userId,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Tenant context is required for this operation.'
      });
    }

    // Prevent cross-tenant access
    if (sessionTenantId && sessionTenantId !== tenantId) {
      logger.warn('Cross-tenant access attempt detected', {
        userId,
        sessionTenantId,
        requestTenantId: tenantId,
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
    if (userRole === 'tenant_admin_impersonated') {
      if (!req.session?.impersonatedBy && !req.session?.impersonationToken) {
        logger.warn('Invalid impersonation session', {
          userId,
          tenantId,
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
      userId,
      tenantId,
      role: userRole,
      isImpersonated: userRole === 'tenant_admin_impersonated',
      impersonatedBy: req.session?.impersonatedBy || null
    };

    logger.debug('Tenant admin authentication successful', {
      userId,
      tenantId,
      role: userRole,
      path: req.path,
      authMethod: req.user ? 'jwt' : 'session'
    });

    next();
  } catch (error) {
    logger.error('Tenant context validation error', {
      error: error.message,
      userId,
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
 * Supports both JWT (Supabase Auth) and session-based authentication
 */
async function requireTenantUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    // Check for JWT token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use Supabase JWT authentication
      await validateSupabaseToken(req, res, () => {
        return validateTenantUserAccess(req, res, next);
      });
      return;
    }

    // Fallback to session-based authentication (legacy support)
    return validateTenantUserAccess(req, res, next);
  } catch (error) {
    logger.error('Tenant user authentication error', {
      error: error.message,
      userId: getUserId(req),
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
 * Helper function to validate tenant user access after authentication
 */
function validateTenantUserAccess(req, res, next) {
  try {
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    const tenantId = getTenantId(req);
    const sessionTenantId = req.user?.tenantId || req.session?.tenantId;
    
    // Check if user is authenticated
    if (!userId) {
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
    const validRoles = ['account_owner', 'agent', 'tenant_admin', 'tenant_admin_impersonated', 'admin', 'user', 'owner', 'administrator'];
    if (!validRoles.includes(userRole)) {
      logger.warn('Invalid role for tenant user access', {
        userId,
        userRole,
        path: req.path,
        tenantId: req.context?.tenantId
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource.'
      });
    }

    // Validate tenant context exists
    if (!tenantId) {
      logger.error('Missing tenant context in tenant user request', {
        userId,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Tenant context is required for this operation.'
      });
    }

    // For non-admin users, validate they belong to the current tenant
    const isAdmin = userRole && (userRole.includes('tenant_admin') || userRole === 'admin');
    if (!isAdmin) {
      if (sessionTenantId && sessionTenantId !== tenantId) {
        logger.warn('Cross-tenant user access attempt', {
          userId,
          sessionTenantId,
          requestTenantId: tenantId,
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
      userId,
      tenantId,
      role: userRole,
      accountId: req.user?.accountId || req.session?.accountId || null,
      agentId: req.session?.agentId || null
    };

    logger.debug('Tenant user authentication successful', {
      userId,
      tenantId,
      role: userRole,
      path: req.path,
      authMethod: req.user ? 'jwt' : 'session'
    });

    next();
  } catch (error) {
    logger.error('Tenant user access validation error', {
      error: error.message,
      userId: getUserId(req),
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
 * Supports both JWT (Supabase Auth) and session-based authentication
 */
function requireAccountOwnership(req, res, next) {
  try {
    const accountId = req.params.accountId || req.body.accountId || req.query.accountId;
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    const userAccountId = req.user?.accountId || req.session?.accountId;
    
    if (!accountId) {
      return res.status(400).json({
        error: 'Missing account ID',
        message: 'Account ID is required for this operation.'
      });
    }

    // Tenant admins can access any account in their tenant
    if (userRole === 'tenant_admin' || userRole === 'tenant_admin_impersonated' || userRole === 'admin') {
      return next();
    }

    // Account owners can only access their own account
    if ((userRole === 'account_owner' || userRole === 'owner') && userAccountId === accountId) {
      return next();
    }

    // Agents can only access their account
    if (userRole === 'agent' && userAccountId === accountId) {
      return next();
    }

    logger.warn('Account ownership validation failed', {
      userId,
      userRole,
      userAccountId,
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
      userId: getUserId(req),
      path: req.path
    });

    res.status(500).json({
      error: 'Validation error',
      message: 'An error occurred during account ownership validation.'
    });
  }
}

/**
 * Middleware to combine tenant admin auth with RLS context
 * Use this for routes that need both tenant admin auth and RLS-aware queries
 */
function withTenantRlsContext() {
  return [requireTenantAdmin, setRlsContext];
}

/**
 * Middleware to combine tenant user auth with RLS context
 * Use this for routes that need both tenant user auth and RLS-aware queries
 */
function withTenantUserRlsContext() {
  return [requireTenantUser, setRlsContext];
}

module.exports = {
  requireTenantAdmin,
  requireTenantUser,
  requireAccountOwnership,
  withTenantRlsContext,
  withTenantUserRlsContext
};