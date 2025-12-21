const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { validateSupabaseToken } = require('./supabaseAuth');

/**
 * Superadmin Authentication Middleware
 * Validates superadmin access and permissions using Supabase Auth
 * Requirements: 1.2
 */

/**
 * Middleware to require superadmin authentication
 * Validates that the user is authenticated as a superadmin via Supabase JWT
 * 
 * This middleware:
 * 1. First validates the Supabase JWT token
 * 2. Then checks if the user has 'superadmin' role in user_metadata
 */
async function requireSuperadmin(req, res, next) {
  try {
    // First, validate the Supabase JWT token
    const authHeader = req.headers.authorization;
    
    // Debug logging for auth state
    logger.debug('Superadmin auth check', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      hasSession: !!req.session,
      sessionUserId: req.session?.userId,
      sessionRole: req.session?.role,
      ip: req.ip
    });

    // Check for JWT token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use Supabase JWT authentication
      await validateSupabaseToken(req, res, async () => {
        // After token validation, check superadmin role
        if (!req.user) {
          logger.warn('Unauthenticated superadmin access attempt (no user after token validation)', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Superadmin authentication is required to access this resource.'
          });
        }

        // Check if user has superadmin role from user_metadata
        if (req.user.role !== 'superadmin') {
          logger.warn('Non-superadmin access attempt to superadmin resource', {
            userId: req.user.id,
            userRole: req.user.role,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'Superadmin privileges are required to access this resource.'
          });
        }

        // Override context role for superadmin
        if (!req.context) {
          req.context = {};
        }
        req.context.role = 'superadmin';

        // Set superadmin context for downstream middleware
        req.superadmin = {
          userId: req.user.id,
          role: 'superadmin',
          email: req.user.email
        };

        // Set RLS context for superadmin bypass
        req.supabaseContext = {
          'app.user_role': 'superadmin'
        };

        logger.debug('Superadmin authentication successful (JWT)', {
          superadminId: req.user.id,
          email: req.user.email,
          path: req.path,
          method: req.method
        });

        next();
      });
      return; // Important: return after calling validateSupabaseToken
    }

    // Fallback to session-based authentication (legacy support)
    if (req.session && req.session.userId && req.session.role === 'superadmin') {
      // Override context role for superadmin session
      if (!req.context) {
        req.context = {};
      }
      req.context.role = 'superadmin';

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

      logger.debug('Superadmin authentication successful (session)', {
        superadminId: req.session.userId,
        path: req.path,
        method: req.method
      });

      return next();
    }

    // No valid authentication found
    logger.warn('Unauthenticated superadmin access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasAuthHeader: !!authHeader,
      hasSession: !!req.session
    });
    
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Superadmin authentication is required to access this resource.'
    });

  } catch (error) {
    logger.error('Superadmin authentication error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id || req.session?.userId,
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