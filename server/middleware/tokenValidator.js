/**
 * Token Validator Middleware
 * 
 * Validates that custom tokens provided in requests belong to the authenticated user
 * or that the user has admin permissions to use any token.
 * 
 * Security Requirements:
 * - Validates token ownership against authenticated user
 * - Allows admin bypass for token validation
 * - Returns generic error messages without exposing token details
 * 
 * @module server/middleware/tokenValidator
 */

const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');

// Cache for token -> userId mapping to avoid repeated lookups
const tokenOwnerCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validates if a token belongs to the requesting user or if user is admin
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.allowAdminBypass - Allow admins to use any token (default: true)
 * @param {boolean} options.requireSession - Require active session (default: true)
 * @returns {Function} Express middleware function
 */
function createTokenValidator(options = {}) {
  const {
    allowAdminBypass = true,
    requireSession = true
  } = options;

  return async (req, res, next) => {
    try {
      // Extract token from request (header or body)
      const providedToken = extractToken(req);

      if (!providedToken) {
        return res.status(401).json({
          error: 'Token de autenticação não fornecido',
          code: 'NO_TOKEN'
        });
      }

      // Check if user has active session
      if (requireSession && !req.session?.userId) {
        securityLogger.logUnauthorizedAccess({
          ip: req.ip,
          path: req.path,
          reason: 'No active session for token validation'
        });

        return res.status(401).json({
          error: 'Sessão não encontrada',
          code: 'SESSION_REQUIRED'
        });
      }

      // Admin bypass - admins can use any token
      if (allowAdminBypass && req.session?.role === 'admin') {
        logger.debug('Token validation bypassed for admin', {
          userId: req.session.userId,
          path: req.path
        });
        req.userToken = providedToken;
        req.tokenValidated = true;
        return next();
      }

      // For regular users, validate token ownership
      const sessionToken = req.session?.userToken;

      // If user provides their own session token, allow it
      if (sessionToken && providedToken === sessionToken) {
        req.userToken = providedToken;
        req.tokenValidated = true;
        return next();
      }

      // If different token provided, validate ownership
      const isOwner = await validateTokenOwnership(providedToken, req.session?.userId);

      if (!isOwner) {
        // Log security event without exposing token
        securityLogger.logUnauthorizedAccess({
          userId: req.session?.userId,
          ip: req.ip,
          path: req.path,
          reason: 'Token ownership validation failed'
        });

        logger.warn('Token validation failed - not owner', {
          userId: req.session?.userId,
          path: req.path,
          method: req.method
          // Note: Never log the actual token
        });

        // Return generic error without exposing token details
        return res.status(403).json({
          error: 'Acesso não autorizado',
          code: 'TOKEN_NOT_OWNED'
        });
      }

      req.userToken = providedToken;
      req.tokenValidated = true;
      next();

    } catch (error) {
      logger.error('Error in token validation middleware', {
        error: error.message,
        path: req.path
        // Note: Never log the actual token
      });

      // Return generic error without exposing internal details
      res.status(500).json({
        error: 'Erro ao validar credenciais',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Extracts token from request headers or body
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
function extractToken(req) {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try token header
  if (req.headers.token) {
    return req.headers.token;
  }

  // Try instance field in body (for campaign creation)
  if (req.body?.instance) {
    return req.body.instance;
  }

  // Fallback to session token
  if (req.session?.userToken) {
    return req.session.userToken;
  }

  return null;
}

/**
 * Validates if a token belongs to a specific user
 * 
 * @param {string} token - Token to validate
 * @param {string} userId - User ID to check ownership against
 * @returns {Promise<boolean>} True if token belongs to user
 */
async function validateTokenOwnership(token, userId) {
  if (!token || !userId) {
    return false;
  }

  // Check cache first
  const cacheKey = `${token.substring(0, 8)}:${userId}`;
  const cached = tokenOwnerCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isOwner;
  }

  try {
    // Validate with WuzAPI
    const wuzapiClient = require('../utils/wuzapiClient');
    const adminToken = process.env.WUZAPI_ADMIN_TOKEN;

    if (!adminToken) {
      logger.warn('WUZAPI_ADMIN_TOKEN not configured, falling back to session check');
      return false;
    }

    // Get all users from admin endpoint
    const response = await wuzapiClient.getAdmin('/admin/users', adminToken);

    if (!response.success || !response.data?.data) {
      logger.error('Failed to fetch users for token validation');
      return false;
    }

    const users = response.data.data;
    const tokenUser = users.find(u => u.token === token);

    if (!tokenUser) {
      // Token not found in system
      tokenOwnerCache.set(cacheKey, { isOwner: false, timestamp: Date.now() });
      return false;
    }

    // Check if token belongs to the requesting user
    const isOwner = tokenUser.id === userId;

    // Cache result
    tokenOwnerCache.set(cacheKey, { isOwner, timestamp: Date.now() });

    return isOwner;

  } catch (error) {
    logger.error('Error validating token ownership', {
      error: error.message
      // Note: Never log the actual token
    });
    return false;
  }
}

/**
 * Clears the token owner cache
 * Useful for testing or when user tokens are updated
 */
function clearTokenCache() {
  tokenOwnerCache.clear();
  logger.debug('Token owner cache cleared');
}

/**
 * Gets cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return {
    size: tokenOwnerCache.size,
    maxAge: CACHE_TTL
  };
}

// Pre-configured middleware for common use cases
const validateToken = createTokenValidator();
const validateTokenStrict = createTokenValidator({ allowAdminBypass: false });

module.exports = {
  createTokenValidator,
  validateToken,
  validateTokenStrict,
  extractToken,
  validateTokenOwnership,
  clearTokenCache,
  getCacheStats
};
