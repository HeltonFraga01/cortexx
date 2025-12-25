/**
 * Security Configuration Module (Task 3.1, 3.2)
 * Handles session security and CSP configuration
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * Validates and returns session configuration
 * @throws {Error} If SESSION_SECRET is invalid in production
 * @returns {Object} Session configuration object
 */
function getSessionConfig() {
  const secret = process.env.SESSION_SECRET;
  
  // Validation
  if (!secret) {
    if (IS_PRODUCTION) {
      logger.error('FATAL: SESSION_SECRET is required in production', {
        environment: NODE_ENV,
        action: 'server_termination'
      });
      console.error('❌ FATAL: SESSION_SECRET is required in production');
      process.exit(1);
    }
    
    // Development fallback with warning
    const devSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('SESSION_SECRET not set - using random secret for development', {
      environment: NODE_ENV,
      secretLength: devSecret.length,
      warning: 'DO NOT USE IN PRODUCTION'
    });
    
    return {
      secret: devSecret,
      isSecure: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    };
  }
  
  // Validate minimum length
  if (secret.length < 32) {
    logger.error('SESSION_SECRET must be at least 32 characters', {
      currentLength: secret.length,
      requiredLength: 32,
      environment: NODE_ENV
    });
    
    if (IS_PRODUCTION) {
      console.error('❌ FATAL: SESSION_SECRET must be at least 32 characters');
      process.exit(1);
    }
  }
  
  logger.info('Session security configured', {
    secretLength: secret.length,
    environment: NODE_ENV,
    secure: IS_PRODUCTION
  });
  
  return {
    secret,
    isSecure: true,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
}

/**
 * Generates a cryptographic nonce for CSP
 * @returns {string} Base64 encoded nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Generates CSP header with optional nonce support
 * @param {string} [nonce] - Optional nonce for script-src
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.reportOnly=false] - Use report-only mode
 * @returns {Object} CSP configuration object
 */
function generateCSP(nonce, options = {}) {
  const { reportOnly = false } = options;
  
  // Get allowed origins from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const wuzapiUrl = process.env.WUZAPI_BASE_URL;
  
  // Build connect-src with allowed origins
  const connectSrc = ["'self'", 'https:'];
  if (supabaseUrl) {
    try {
      connectSrc.push(new URL(supabaseUrl).origin);
    } catch (e) {
      logger.warn('Invalid SUPABASE_URL for CSP', { url: supabaseUrl });
    }
  }
  if (wuzapiUrl) {
    try {
      connectSrc.push(new URL(wuzapiUrl).origin);
    } catch (e) {
      logger.warn('Invalid WUZAPI_BASE_URL for CSP', { url: wuzapiUrl });
    }
  }
  
  // CSP directives
  const directives = {
    'default-src': ["'self'"],
    'script-src': IS_PRODUCTION && nonce
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"], // Dev needs HMR
    'style-src': ["'self'", "'unsafe-inline'", "https:"], // Required for UI libraries
    'img-src': ["'self'", "data:", "https:", "blob:"],
    'connect-src': connectSrc,
    'font-src': ["'self'", "data:", "https:"],
    'object-src': ["'none'"],
    'media-src': ["'self'", "data:", "blob:", "https:"],
    'frame-src': ["'self'", "https:"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  
  // Add report-uri in production
  if (IS_PRODUCTION) {
    directives['report-uri'] = ['/api/csp-report'];
  }
  
  // Build CSP string
  const cspString = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
  
  return {
    headerName: reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    headerValue: cspString,
    nonce,
    directives
  };
}

/**
 * Express middleware to add CSP headers
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.reportOnly=false] - Use report-only mode
 * @returns {Function} Express middleware
 */
function cspMiddleware(options = {}) {
  return (req, res, next) => {
    // Generate nonce for this request
    const nonce = generateNonce();
    
    // Store nonce in res.locals for use in templates
    res.locals.cspNonce = nonce;
    
    // Generate and set CSP header
    const csp = generateCSP(nonce, options);
    res.setHeader(csp.headerName, csp.headerValue);
    
    next();
  };
}

/**
 * Validates required environment variables
 * @returns {Object} Validation result
 */
function validateSecurityEnv() {
  const errors = [];
  const warnings = [];
  
  // Check SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    if (IS_PRODUCTION) {
      errors.push('SESSION_SECRET is required in production');
    } else {
      warnings.push('SESSION_SECRET not set - using insecure default');
    }
  } else if (process.env.SESSION_SECRET.length < 32) {
    if (IS_PRODUCTION) {
      errors.push('SESSION_SECRET must be at least 32 characters');
    } else {
      warnings.push('SESSION_SECRET is shorter than recommended 32 characters');
    }
  }
  
  // Check SUPABASE credentials
  if (!process.env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  getSessionConfig,
  generateNonce,
  generateCSP,
  cspMiddleware,
  validateSecurityEnv,
  IS_PRODUCTION
};
