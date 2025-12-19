const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');

/**
 * Superadmin Authentication Middleware
 * Validates superadmin access and permissions
 * Requirements: 1.2
 */

/**
 * Middleware to require superadmin authentication
 * Validates that the user is authenticated as a superadmin
 */
function requireSuperadmin(req, res, next) {
  try {
    // Debug logging for session state
    logger.debug('Superadmin auth check', {
      path: req.path,
      method: req.method,
      hasSession: !!req.session,
      sessionId: req.sessionID,
      userId: req.session?.userId,
      role: req.session?.role,
      hasSessionToken: !!req.session?.sessionToken,
      cookies: Object.keys(req.cookies || {}),
      ip: req.ip
    });

    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      logger.warn('Unauthenticated superadmin access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID,
        hasSession: !!req.session
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Superadmin authentication is required to access this resource.'
      });
    }

    // Check if user has superadmin role
    if (req.session.role !== 'superadmin') {
      logger.warn('Non-superadmin access attempt to superadmin resource', {
        userId: req.session.userId,
        userRole: req.session.role,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Superadmin privileges are required to access this resource.'
      });
    }

    // Validate superadmin context
    if (req.context && req.context.role !== 'superadmin') {
      logger.warn('Invalid context for superadmin request', {
        userId: req.session.userId,
        contextRole: req.context.role,
        path: req.path
      });
      
      return res.status(403).json({
        error: 'Invalid context',
        message: 'This resource requires superadmin context.'
      });
    }

    // Set superadmin context for downstream middleware
    req.superadmin = {
      userId: req.session.userId,
      role: 'superadmin',
      sessionToken: req.session.sessionToken
    };

    // Set RLS context for superadmin bypass
    req.supabaseContext = {
      'app.user_role': 'superadmin'
    };

    logger.debug('Superadmin authentication successful', {
      superadminId: req.session.userId,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Superadmin authentication error', {
      error: error.message,
      userId: req.session?.userId,
      path: req.path
    });

    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during superadmin authentication.'
    });
  }
}

/**
 * Middleware to validate superadmin session token
 * Checks if the session token is still valid
 */
async function validateSuperadminSession(req, res, next) {
  try {
    if (!req.session || !req.session.sessionToken || req.session.role !== 'superadmin') {
      return next(); // Let requireSuperadmin handle authentication
    }

    // Verify session token is still valid
    const sessionData = await SuperadminService.verifySession(req.session.sessionToken);
    
    if (!sessionData) {
      logger.warn('Invalid superadmin session token', {
        userId: req.session.userId,
        path: req.path
      });
      
      // Clear invalid session
      req.session.destroy();
      
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired. Please log in again.'
      });
    }

    // Update session with fresh data
    req.session.superadminData = sessionData;

    next();
  } catch (error) {
    logger.error('Superadmin session validation error', {
      error: error.message,
      userId: req.session?.userId,
      path: req.path
    });

    // Don't fail the request, let it continue to requireSuperadmin
    next();
  }
}

/**
 * Middleware to log superadmin actions for audit purposes
 * Logs all superadmin operations for security auditing
 */
function auditSuperadminAction(req, res, next) {
  try {
    if (req.session && req.session.role === 'superadmin') {
      // Store original res.json to intercept response
      const originalJson = res.json;
      
      res.json = function(data) {
        // Log the action after successful response
        if (res.statusCode < 400) {
          logger.info('Superadmin action completed', {
            superadminId: req.session.userId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            body: req.method !== 'GET' ? req.body : undefined,
            query: Object.keys(req.query).length > 0 ? req.query : undefined
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
    }

    next();
  } catch (error) {
    logger.error('Superadmin audit logging error', {
      error: error.message,
      userId: req.session?.userId,
      path: req.path
    });

    // Don't fail the request due to logging issues
    next();
  }
}

/**
 * Middleware to prevent superadmin access to tenant-specific resources
 * Ensures superadmins use proper impersonation for tenant operations
 */
function preventDirectTenantAccess(req, res, next) {
  try {
    if (req.session && req.session.role === 'superadmin') {
      // Check if this is a tenant-specific endpoint
      const isTenantEndpoint = req.path.startsWith('/api/tenant/') || 
                              req.path.startsWith('/api/user/') ||
                              req.path.startsWith('/api/account/');

      if (isTenantEndpoint && !req.session.impersonationToken) {
        logger.warn('Superadmin attempted direct tenant access without impersonation', {
          superadminId: req.session.userId,
          path: req.path,
          method: req.method
        });

        return res.status(403).json({
          error: 'Impersonation required',
          message: 'Superadmins must use impersonation to access tenant-specific resources.'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Tenant access prevention error', {
      error: error.message,
      userId: req.session?.userId,
      path: req.path
    });

    next();
  }
}

module.exports = {
  requireSuperadmin,
  validateSuperadminSession,
  auditSuperadminAction,
  preventDirectTenantAccess
};