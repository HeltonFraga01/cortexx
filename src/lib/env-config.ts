/**
 * Environment Configuration Manager
 * Centralizes loading and validation of environment variables
 * Ensures no hardcoded credentials in source code
 */

export interface EnvConfig {
  // NocoDB Configuration
  nocodbToken: string
  nocodbBaseUrl: string
  nocodbProjectId: string
  nocodbTableId: string
  
  // WuzAPI Configuration
  wuzapiBaseUrl: string
  adminToken: string | null // Optional - deprecated, use session-based auth
  
  // CORS Configuration
  corsAllowedOrigins: string[]
  
  // API Configuration
  apiTimeout: number
  rateLimitWindow: number
  rateLimitMax: number
  
  // App Configuration
  appName: string
  devMode: boolean
}

export class EnvConfigError extends Error {
  constructor(
    public readonly missingVars: string[],
    message?: string
  ) {
    super(message || `Missing required environment variables: ${missingVars.join(', ')}`)
    this.name = 'EnvConfigError'
  }
}

/**
 * Validates that a token is non-empty and properly formatted
 */
function validateToken(token: string | undefined, name: string): string {
  if (!token || token.trim() === '') {
    throw new EnvConfigError([name], `${name} is required and cannot be empty`)
  }
  
  const trimmed = token.trim()
  
  // Basic format validation - tokens should be alphanumeric with some special chars
  if (trimmed.length < 8) {
    throw new EnvConfigError([name], `${name} appears to be invalid (too short)`)
  }
  
  return trimmed
}

/**
 * Parses comma-separated origins into an array
 */
function parseOrigins(origins: string | undefined): string[] {
  if (!origins || origins.trim() === '') {
    return []
  }
  
  return origins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
}

/**
 * Loads and validates all environment configuration
 * Throws EnvConfigError if required variables are missing
 */
export function loadEnvConfig(): EnvConfig {
  const missingVars: string[] = []
  
  // Required variables
  const nocodbToken = import.meta.env.VITE_NOCODB_TOKEN
  // VITE_ADMIN_TOKEN is now optional - deprecated in favor of session-based auth
  const adminToken = import.meta.env.VITE_ADMIN_TOKEN
  
  // Validate required tokens
  if (!nocodbToken || nocodbToken.trim() === '') {
    missingVars.push('VITE_NOCODB_TOKEN')
  }
  
  // Note: VITE_ADMIN_TOKEN is no longer required
  // Superadmin authentication now uses email/password with session cookies
  
  // Throw if any required vars are missing
  if (missingVars.length > 0) {
    throw new EnvConfigError(missingVars)
  }
  
  // Build config object
  const config: EnvConfig = {
    // NocoDB - validate tokens
    nocodbToken: validateToken(nocodbToken, 'VITE_NOCODB_TOKEN'),
    nocodbBaseUrl: import.meta.env.VITE_NOCODB_BASE_URL || 'https://nocodb.wasend.com.br',
    nocodbProjectId: import.meta.env.VITE_NOCODB_PROJECT_ID || 'pu8znrvha2vlha9',
    nocodbTableId: import.meta.env.VITE_NOCODB_TABLE_ID || 'm2t976te0cowtfu',
    
    // WuzAPI
    wuzapiBaseUrl: import.meta.env.VITE_WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br',
    // adminToken is optional - deprecated in favor of session-based auth
    adminToken: adminToken && adminToken.trim() !== '' ? adminToken.trim() : null,
    
    // CORS
    corsAllowedOrigins: parseOrigins(import.meta.env.VITE_CORS_ALLOWED_ORIGINS),
    
    // API Settings
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
    rateLimitWindow: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW || '60000', 10),
    rateLimitMax: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX || '100', 10),
    
    // App
    appName: import.meta.env.VITE_APP_NAME || 'WhatsApp Manager',
    devMode: import.meta.env.VITE_DEV_MODE === 'true'
  }
  
  return config
}

// Singleton instance - lazy loaded
let _config: EnvConfig | null = null

/**
 * Gets the environment configuration (singleton)
 * Caches the config after first load
 */
export function getEnvConfig(): EnvConfig {
  if (!_config) {
    _config = loadEnvConfig()
  }
  return _config
}

/**
 * Resets the cached config (useful for testing)
 */
export function resetEnvConfig(): void {
  _config = null
}

/**
 * Checks if all required environment variables are set
 * Returns validation result without throwing
 * Note: VITE_ADMIN_TOKEN is no longer required - deprecated in favor of session-based auth
 */
export function validateEnvConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  if (!import.meta.env.VITE_NOCODB_TOKEN) {
    missing.push('VITE_NOCODB_TOKEN')
  }
  
  // VITE_ADMIN_TOKEN is no longer required
  // Superadmin authentication now uses email/password with session cookies
  
  return {
    valid: missing.length === 0,
    missing
  }
}
