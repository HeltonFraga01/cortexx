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
function getCookieDomain() {
  // If explicitly set, use that
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }
  
  // In development, don't set domain to allow localhost subdomains to work
  // Note: For localhost, browsers handle this automatically
  return undefined;
}

const sessionConfig = {
  // Using default MemoryStore - suitable for single-instance architecture
  // For multi-instance, use connect-pg-simple with Supabase
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  name: 'wuzapi.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Secure apenas se HTTPS estiver disponível (não apenas em produção)
    // Permite testes locais em produção via HTTP
    secure: process.env.COOKIE_SECURE === 'true' || false,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    // Domain for multi-tenant subdomain support
    domain: getCookieDomain()
  }
};

// Log session store type
if (process.env.NODE_ENV !== 'test') {
  logger.info('Session store: MemoryStore (single-instance architecture)');
}

module.exports = sessionConfig;
