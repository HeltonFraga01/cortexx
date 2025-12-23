/**
 * UserIdResolver - Centralized user identification utility
 * 
 * Provides consistent user ID resolution across all routes and middlewares.
 * This ensures quotas and features are correctly applied to the right user.
 * 
 * Requirements: 1.1, 1.4, 9.3
 */

const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Generate a consistent hash from a token
 * Used to create a stable userId from WUZAPI tokens
 * @param {string} token - WUZAPI token
 * @returns {string} 32-character hash
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

/**
 * Resolve user ID from request context
 * 
 * Priority order:
 * 1. session.userId - Set by verifyUserToken or login
 * 2. account.ownerUserId - Set by requireAgentAuth for agent routes
 * 3. hash(userToken) - Fallback for token-based auth
 * 4. user.id or userId - Legacy patterns
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} User ID or null if not resolvable
 */
function resolveUserId(req) {
  // 1. Session userId (highest priority - set by verifyUserToken or login)
  if (req.session?.userId) {
    return req.session.userId;
  }
  
  // 2. Account owner (set by requireAgentAuth for agent routes)
  if (req.account?.ownerUserId) {
    return req.account.ownerUserId;
  }
  
  // 3. Hash of userToken (fallback for token-based auth)
  if (req.userToken) {
    return hashToken(req.userToken);
  }
  
  // 4. Legacy patterns
  if (req.user?.id) {
    return req.user.id;
  }
  
  if (req.userId) {
    return req.userId;
  }
  
  // Unable to resolve
  logger.debug('Unable to resolve userId from request', {
    hasSession: !!req.session,
    hasAccount: !!req.account,
    hasUserToken: !!req.userToken,
    hasUser: !!req.user,
    hasUserId: !!req.userId
  });
  
  return null;
}

/**
 * Get the WUZAPI token from request
 * @param {Object} req - Express request object
 * @returns {string|null} WUZAPI token or null
 */
function getUserToken(req) {
  return req.userToken || req.session?.userToken || null;
}

/**
 * Get both userId and userToken for resource counting
 * This is useful for QuotaService methods that need to check
 * resources created with either identifier
 * 
 * @param {Object} req - Express request object
 * @returns {{ userId: string|null, userToken: string|null }}
 */
function getUserIdentifiers(req) {
  return {
    userId: resolveUserId(req),
    userToken: getUserToken(req)
  };
}

/**
 * Ensure session has userId set
 * Call this after token validation to ensure consistency
 * 
 * IMPORTANT: Never overwrite admin session data!
 * Admin sessions must preserve their admin token for WuzAPI validation.
 * 
 * @param {Object} req - Express request object
 * @param {string} userToken - WUZAPI token
 */
function ensureSessionUserId(req, userToken) {
  if (req.session && userToken) {
    // CRITICAL: Never overwrite admin session data
    // Admin sessions need to preserve their admin token for WuzAPI validation
    if (req.session.role === 'admin') {
      logger.debug('Skipping session update for admin user', {
        sessionUserId: req.session.userId,
        sessionRole: req.session.role
      });
      return;
    }
    
    req.session.userToken = userToken;
    // Only set userId if not already set (preserve existing userId)
    if (!req.session.userId) {
      req.session.userId = hashToken(userToken);
    }
    // CRITICAL: Always ensure role is set to avoid corrupted session
    if (!req.session.role) {
      req.session.role = 'user';
    }
  }
}

module.exports = {
  resolveUserId,
  hashToken,
  getUserToken,
  getUserIdentifiers,
  ensureSessionUserId
};
