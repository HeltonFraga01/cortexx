const session = require('express-session');
const { Pool } = require('pg');
const { logger } = require('../utils/logger');

/**
 * Session Configuration with PostgreSQL Store
 * 
 * Uses connect-pg-simple for persistent session storage in PostgreSQL.
 * Sessions survive server restarts and are automatically cleaned up.
 * 
 * Architecture: Single-instance with PostgreSQL session store via Supabase.
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

/**
 * Build PostgreSQL connection string from Supabase URL
 * Supabase provides a pooler connection for direct PostgreSQL access
 */
const getConnectionString = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  
  if (!supabaseUrl) {
    logger.warn('SUPABASE_URL not configured, falling back to MemoryStore');
    return null;
  }
  
  if (!dbPassword) {
    logger.warn('SUPABASE_DB_PASSWORD not configured, falling back to MemoryStore');
    return null;
  }
  
  try {
    // Extract project reference from Supabase URL
    // Format: https://[project-ref].supabase.co
    const url = new URL(supabaseUrl);
    const projectRef = url.hostname.split('.')[0];
    
    // Build connection string for Supabase pooler
    // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    const region = process.env.SUPABASE_REGION || 'us-east-1';
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  } catch (error) {
    logger.error('Failed to build PostgreSQL connection string', { error: error.message });
    return null;
  }
};

/**
 * Create session store - PostgreSQL if available, MemoryStore as fallback
 */
const createSessionStore = () => {
  const connectionString = getConnectionString();
  
  if (!connectionString) {
    logger.info('Session store: MemoryStore (PostgreSQL not configured)');
    return null; // Will use default MemoryStore
  }
  
  try {
    const pgSession = require('connect-pg-simple')(session);
    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5, // Small pool for session operations
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    
    // Test connection
    pool.query('SELECT 1').then(() => {
      logger.info('Session store: PostgreSQL (persistent sessions enabled)');
    }).catch((err) => {
      logger.warn('PostgreSQL session store connection test failed', { error: err.message });
    });
    
    return new pgSession({
      pool,
      tableName: 'express_sessions',
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
      errorLog: (err) => {
        logger.error('Session store error', { error: err.message });
      }
    });
  } catch (error) {
    logger.warn('Failed to create PostgreSQL session store, using MemoryStore', { 
      error: error.message 
    });
    return null;
  }
};

// Create session store
const store = createSessionStore();

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'wuzapi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'wuzapi.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: getCookieDomain()
  }
};

// Add store if PostgreSQL is available
if (store) {
  sessionConfig.store = store;
}

const sessionMiddleware = session(sessionConfig);

// Logger to debug cookie issues
const sessionDebugMiddleware = (req, res, next) => {
  if (req.headers.cookie && req.headers.cookie.includes('wuzapi.sid')) {
    logger.debug('[SessionDebug] Incoming Cookies', { cookie: req.headers.cookie });
    logger.debug('[SessionDebug] Resolved SessionID', { 
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
