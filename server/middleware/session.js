const session = require('express-session');
const { logger } = require('../utils/logger');

/**
 * Session Configuration
 * 
 * Uses in-memory session store by default.
 * For production with multiple instances, consider using:
 * - connect-pg-simple for PostgreSQL/Supabase
 * - connect-redis for Redis
 * 
 * Note: In-memory store is suitable for single-instance deployments
 * which is the architecture constraint for this project.
 */

/**
 * Get cookie domain for multi-tenant subdomain support
 * 
 * For localhost development with subdomains (e.g., tenant.localhost:8080),
 * we need to set the cookie domain to allow sharing across subdomains.
 * 
 * In production, set COOKIE_DOMAIN to your root domain (e.g., .example.com)
 */
const getCookieDomain = () => {
  const domain = process.env.COOKIE_DOMAIN;
  
  // If domain is strictly 'localhost', return undefined to let browser handle it as host-only
  if (domain === 'localhost') return undefined;
  
  // If no domain configured, return undefined (host-only)
  if (!domain) return undefined;
  
  return domain;
};

const sessionConfig = {
  // Using default MemoryStore - suitable for single-instance architecture
  secret: process.env.SESSION_SECRET || 'wuzapi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'wuzapi.sid',
  cookie: {
    httpOnly: true,
    // Secure only if HTTPS is available (or production)
    // We trust the environment variable, defaulting to false if not set 'true'
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    // Domain for multi-tenant subdomain support
    domain: getCookieDomain()
  }
};

const sessionMiddleware = session(sessionConfig);

// Log session store type
if (process.env.NODE_ENV !== 'test') {
  logger.info('Session store: MemoryStore (single-instance architecture)');
}

// Logger to debug cookie issues
// Logger to debug cookie issues
const sessionDebugMiddleware = (req, res, next) => {
  if (req.headers.cookie && req.headers.cookie.includes('wuzapi.sid')) {
    logger.info('[SessionDebug] Incoming Cookies', { cookie: req.headers.cookie });
    logger.info('[SessionDebug] Resolved SessionID', { 
      sessionID: req.sessionID,
      userId: req.session ? req.session.userId : 'undefined',
      role: req.session ? req.session.role : 'undefined',
      keys: req.session ? Object.keys(req.session) : []
    });
  }
  next();
};

// Export sessionConfig and the debug middleware separately
sessionConfig.debugMiddleware = sessionDebugMiddleware;

module.exports = sessionConfig;
