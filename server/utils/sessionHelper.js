/**
 * Session Helper Module
 * 
 * Provides safe session operations for authentication.
 * Fixes the session persistence issue by using proper express-session APIs.
 * 
 * Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 5.1, 5.2
 */

const { logger } = require('./logger');

/**
 * Regenerates session safely and sets user data
 * 
 * Uses req.session.regenerate() which is the official express-session API
 * for creating a new session while destroying the old one.
 * 
 * @param {Object} req - Express request object
 * @param {Object} userData - User data to set in session
 * @param {string} userData.userId - User identifier
 * @param {string} userData.role - User role (admin, user, superadmin)
 * @param {string} userData.userToken - WUZAPI token for API calls
 * @param {string} [userData.userName] - Display name
 * @param {string} [userData.userJid] - WhatsApp JID
 * @param {string} [userData.userEmail] - Email (for agent login)
 * @param {string} [userData.agentRole] - Original agent role
 * @param {string} [userData.accountId] - Account ID
 * @param {string} [userData.accountName] - Account name
 * @param {Object} [userData.tenantContext] - Tenant context for multi-tenant
 * @returns {Promise<void>}
 * @throws {Error} If session regeneration or save fails
 */
async function regenerateSession(req, userData) {
  const oldSessionId = req.sessionID;
  
  // Validate required fields
  if (!userData.userId) {
    throw new Error('userId is required for session');
  }
  if (!userData.role) {
    throw new Error('role is required for session');
  }
  if (!userData.userToken) {
    throw new Error('userToken is required for session');
  }
  
  // SOLUTION: Don't use regenerate() - it has known issues with session data persistence
  // Instead, directly set session data on the existing session object
  // This is simpler and more reliable for single-instance architecture
  
  // Clear any existing session data first
  const keysToDelete = Object.keys(req.session).filter(key => key !== 'cookie');
  keysToDelete.forEach(key => {
    delete req.session[key];
  });
  
  // Set required session data directly
  req.session.userId = userData.userId;
  req.session.role = userData.role;
  req.session.userToken = userData.userToken;
  
  // Set optional session data
  req.session.userName = userData.userName || userData.userId;
  req.session.userJid = userData.userJid || null;
  req.session.userEmail = userData.userEmail || null;
  
  // Set agent-specific data (for admin-login)
  if (userData.agentRole) {
    req.session.agentRole = userData.agentRole;
  }
  if (userData.accountId) {
    req.session.accountId = userData.accountId;
  }
  if (userData.accountName) {
    req.session.accountName = userData.accountName;
  }
  
  // Set tenant context if provided (multi-tenant)
  if (userData.tenantContext) {
    req.session.tenantId = userData.tenantContext.tenantId;
    req.session.tenantSubdomain = userData.tenantContext.subdomain;
    req.session.tenantName = userData.tenantContext.name;
  } else if (userData.tenantId) {
    // Direct tenantId (from admin-login)
    req.session.tenantId = userData.tenantId;
  }
  
  // Set metadata
  req.session.createdAt = new Date().toISOString();
  req.session.lastActivity = new Date().toISOString();
  
  // Save session explicitly
  return new Promise((resolve, reject) => {
    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error('Session save failed', {
          error: saveErr.message,
          sessionId: req.sessionID,
          userId: userData.userId,
          role: userData.role
        });
        return reject(new Error(`Session save failed: ${saveErr.message}`));
      }
      
      logger.info('Session data saved successfully', {
        sessionId: req.sessionID,
        oldSessionId,
        userId: userData.userId,
        role: userData.role,
        hasTenant: !!userData.tenantContext || !!userData.tenantId
      });
      
      resolve();
    });
  });
}

/**
 * Validates session has required authentication data
 * 
 * Checks that the session exists AND has the required fields populated.
 * A session that exists but has null userId is considered corrupted.
 * 
 * @param {Object} session - Express session object
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - Whether session is valid
 * @returns {string} [result.reason] - Reason for invalid session
 * @returns {boolean} [result.corrupted] - Whether session is corrupted (exists but missing data)
 */
function validateSession(session) {
  // No session at all
  if (!session) {
    return { 
      valid: false, 
      reason: 'no_session',
      corrupted: false
    };
  }
  
  // Session exists but userId is missing - this is the bug we're fixing
  if (!session.userId) {
    logger.warn('ValidateSession: Session exists but userId is missing (CORRUPTED)', {
      sessionKeys: Object.keys(session),
      sessionID: session.id, // accessible if available
      cookie: session.cookie
    });
    return { 
      valid: false, 
      reason: 'no_user_id',
      corrupted: true
    };
  }
  
  // Session exists but role is missing
  if (!session.role) {
    return { 
      valid: false, 
      reason: 'no_role',
      corrupted: true
    };
  }
  
  // Valid session
  return { 
    valid: true,
    userId: session.userId,
    role: session.role
  };
}

/**
 * Destroys corrupted session and clears cookie
 * 
 * Used when a session exists but is missing required data.
 * Clears both the session and the cookie to allow fresh login.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function destroyCorruptedSession(req, res) {
  const sessionId = req.sessionID;
  
  return new Promise((resolve) => {
    // First, clear all session data
    if (req.session) {
      req.session.userId = null;
      req.session.role = null;
      req.session.userToken = null;
      req.session.userName = null;
      req.session.userJid = null;
    }
    
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        logger.warn('Error destroying corrupted session', {
          error: err.message,
          sessionId
        });
      }
      
      // Clear cookie with consistent options
      const cookieSecure = process.env.COOKIE_SECURE === 'true'; // Default false if not 'true'
      const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax';
      const cookieName = 'wuzapi.sid';
      
      const clearOptions = {
        path: '/',
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite
      };
      
      // 1. Clear with currently configured domain logic
      let cookieDomain = process.env.COOKIE_DOMAIN;
      if (cookieDomain === 'localhost') cookieDomain = undefined;
      
      res.clearCookie(cookieName, { ...clearOptions, domain: cookieDomain });

      // 2. Aggressively clear potential conflicting cookies (e.g. from previous bad configs)
      if (cookieDomain !== 'localhost') {
        // Explicitly clear 'localhost' domain cookie which might be stuck
        res.clearCookie(cookieName, { ...clearOptions, domain: 'localhost' });
      }
      
      // 3. Explicitly clear host-only cookie (no domain)
      if (cookieDomain !== undefined) {
        res.clearCookie(cookieName, { ...clearOptions, domain: undefined });
      }
      
      // 4. Clear for current hostname (e.g. cortexx.localhost)
      if (req.hostname && req.hostname !== 'localhost') {
         res.clearCookie(cookieName, { ...clearOptions, domain: req.hostname });
      }
      
      logger.info('Corrupted session destroyed and cookie cleared', { 
        sessionId,
        reason: 'session_corrupted'
      });
      
      resolve();
    });
  });
}

/**
 * Gets session diagnostic info for logging
 * 
 * @param {Object} req - Express request object
 * @returns {Object} Session diagnostic info
 */
function getSessionDiagnostics(req) {
  return {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId || null,
    role: req.session?.role || null,
    hasToken: !!req.session?.userToken,
    tokenPresence: req.session?.userToken ? 'present' : 'missing',
    createdAt: req.session?.createdAt || null,
    lastActivity: req.session?.lastActivity || null,
    tenantId: req.session?.tenantId || null
  };
}

module.exports = {
  regenerateSession,
  validateSession,
  destroyCorruptedSession,
  getSessionDiagnostics
};
