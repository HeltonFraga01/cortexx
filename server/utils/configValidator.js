/**
 * Configuration Validator
 * 
 * Validates required environment variables on startup
 * Fails fast with clear error messages
 * 
 * Note: SQLite support has been removed. Supabase is the only database backend.
 */

const { logger } = require('./logger');

/**
 * Required environment variables
 */
const REQUIRED_VARS = {
  // Always required
  common: [
    'NODE_ENV',
    'PORT',
  ],
  
  // Required for Supabase backend
  supabase: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
  ],
};

/**
 * Optional but recommended variables
 */
const RECOMMENDED_VARS = {
  common: [
    'LOG_LEVEL',
    'CORS_ORIGINS',
    'SESSION_SECRET',
  ],
  supabase: [],
};

/**
 * Validate a single environment variable
 * @param {string} name - Variable name
 * @returns {{ valid: boolean, value: string | undefined }}
 */
function validateVar(name) {
  const value = process.env[name];
  return {
    valid: value !== undefined && value !== '',
    value,
  };
}

/**
 * Validate all required configuration
 * @param {object} options - Validation options
 * @param {boolean} options.exitOnError - Exit process on validation failure (default: true)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateConfig(options = { exitOnError: true }) {
  const errors = [];
  const warnings = [];
  
  // Validate common required vars
  for (const varName of REQUIRED_VARS.common) {
    const { valid } = validateVar(varName);
    if (!valid) {
      // PORT and NODE_ENV have defaults, so just warn
      if (varName === 'PORT' || varName === 'NODE_ENV') {
        warnings.push(`${varName} not set, using default`);
      } else {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }
  }
  
  // Validate Supabase required vars
  for (const varName of REQUIRED_VARS.supabase) {
    const { valid } = validateVar(varName);
    if (!valid) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }
  
  // Check recommended vars
  const allRecommended = [...RECOMMENDED_VARS.common, ...RECOMMENDED_VARS.supabase];
  
  for (const varName of allRecommended) {
    const { valid } = validateVar(varName);
    if (!valid) {
      warnings.push(`Recommended environment variable not set: ${varName}`);
    }
  }
  
  // Validate Supabase URL format
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('supabase.co')) {
    warnings.push('SUPABASE_URL does not appear to be a valid Supabase URL');
  }
  
  // Check key formats
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (anonKey && anonKey.length < 100) {
    warnings.push('SUPABASE_ANON_KEY appears to be too short');
  }
  
  if (serviceKey && serviceKey.length < 100) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY appears to be too short');
  }
  
  // Security check: ensure service key is not exposed in frontend vars
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SECURITY ERROR: SUPABASE_SERVICE_ROLE_KEY must NOT be prefixed with VITE_');
  }
  
  // Log results
  const valid = errors.length === 0;
  
  if (warnings.length > 0) {
    logger.warn('Configuration warnings:', { warnings });
  }
  
  if (!valid) {
    logger.error('Configuration validation failed', { errors });
    
    if (options.exitOnError) {
      console.error('\n❌ Configuration validation failed:\n');
      errors.forEach(err => console.error(`  - ${err}`));
      console.error('\nPlease check your environment variables and try again.\n');
      process.exit(1);
    }
  } else {
    logger.info('Configuration validated successfully', {
      databaseBackend: 'supabase',
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  }
  
  return { valid, errors, warnings };
}

/**
 * Get current database backend
 * @returns {'supabase'}
 */
function getDatabaseBackend() {
  return 'supabase';
}

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
function isSupabaseConfigured() {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_ANON_KEY
  );
}

/**
 * Get Supabase configuration
 * @returns {{ url: string, anonKey: string, serviceRoleKey: string } | null}
 */
function getSupabaseConfig() {
  if (!isSupabaseConfigured()) return null;
  
  return {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

module.exports = {
  validateConfig,
  getDatabaseBackend,
  isSupabaseConfigured,
  getSupabaseConfig,
  REQUIRED_VARS,
  RECOMMENDED_VARS,
};
