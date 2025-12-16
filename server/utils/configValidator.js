/**
 * Configuration Validator
 * Task 17.3: Create configuration validation
 * 
 * Validates required environment variables on startup
 * Fails fast with clear error messages
 */

const logger = require('./logger');

/**
 * Required environment variables by database backend
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
  
  // Required for SQLite backend
  sqlite: [
    'SQLITE_DB_PATH',
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
  sqlite: [
    'SQLITE_WAL_MODE',
    'SQLITE_TIMEOUT',
  ],
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
  
  // Determine database backend
  const databaseBackend = process.env.DATABASE_BACKEND || 'sqlite';
  
  if (!['sqlite', 'supabase'].includes(databaseBackend)) {
    errors.push(`Invalid DATABASE_BACKEND: ${databaseBackend}. Must be 'sqlite' or 'supabase'`);
  }
  
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
  
  // Validate backend-specific required vars
  const backendVars = REQUIRED_VARS[databaseBackend] || [];
  for (const varName of backendVars) {
    const { valid } = validateVar(varName);
    if (!valid) {
      errors.push(`Missing required environment variable for ${databaseBackend} backend: ${varName}`);
    }
  }
  
  // Check recommended vars
  const recommendedCommon = RECOMMENDED_VARS.common || [];
  const recommendedBackend = RECOMMENDED_VARS[databaseBackend] || [];
  const allRecommended = [...recommendedCommon, ...recommendedBackend];
  
  for (const varName of allRecommended) {
    const { valid } = validateVar(varName);
    if (!valid) {
      warnings.push(`Recommended environment variable not set: ${varName}`);
    }
  }
  
  // Validate Supabase URL format
  if (databaseBackend === 'supabase') {
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
  }
  
  // Validate SQLite path
  if (databaseBackend === 'sqlite') {
    const dbPath = process.env.SQLITE_DB_PATH;
    if (dbPath && !dbPath.endsWith('.db')) {
      warnings.push('SQLITE_DB_PATH should end with .db extension');
    }
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
      databaseBackend,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  }
  
  return { valid, errors, warnings };
}

/**
 * Get current database backend
 * @returns {'sqlite' | 'supabase'}
 */
function getDatabaseBackend() {
  return process.env.DATABASE_BACKEND || 'sqlite';
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
 * Check if SQLite is configured
 * @returns {boolean}
 */
function isSqliteConfigured() {
  return !!process.env.SQLITE_DB_PATH;
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
  isSqliteConfigured,
  getSupabaseConfig,
  REQUIRED_VARS,
  RECOMMENDED_VARS,
};
