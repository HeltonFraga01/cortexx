/**
 * Supabase Connection Validators
 * Validates Supabase connection data before processing
 * Requirements: 7.3
 */

const logger = require('../utils/logger');

/**
 * Validates Supabase URL format
 * Accepts: https://*.supabase.co, https://*.supabase.in, or custom HTTPS domains
 * @param {string} url - Supabase project URL
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSupabaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL do Supabase é obrigatória' };
  }

  const trimmedUrl = url.trim();

  // Must start with https://
  if (!trimmedUrl.startsWith('https://')) {
    return { valid: false, error: 'URL do Supabase deve começar com https://' };
  }

  // Standard Supabase URL patterns
  const supabasePatterns = [
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i,
    /^https:\/\/[a-z0-9-]+\.supabase\.in\/?$/i,
  ];

  // Check if matches standard Supabase patterns
  const isStandardSupabase = supabasePatterns.some(pattern => pattern.test(trimmedUrl));
  
  // Also accept custom domains (any valid HTTPS URL)
  const customDomainPattern = /^https:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9]\.[a-z]{2,}\/?$/i;
  const isCustomDomain = customDomainPattern.test(trimmedUrl);

  if (!isStandardSupabase && !isCustomDomain) {
    return { 
      valid: false, 
      error: 'URL do Supabase inválida. Use o formato: https://seu-projeto.supabase.co' 
    };
  }

  return { valid: true };
}

/**
 * Validates Supabase API key format
 * @param {string} key - Supabase API key
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSupabaseKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key do Supabase é obrigatória' };
  }

  const trimmedKey = key.trim();

  // Supabase keys are JWT tokens, typically 200+ characters
  if (trimmedKey.length < 100) {
    return { valid: false, error: 'API key do Supabase parece inválida (muito curta)' };
  }

  // JWT format check (three parts separated by dots)
  const jwtParts = trimmedKey.split('.');
  if (jwtParts.length !== 3) {
    return { valid: false, error: 'API key do Supabase deve ser um token JWT válido' };
  }

  return { valid: true };
}

/**
 * Validates Supabase key type
 * @param {string} keyType - Key type ('service_role' or 'anon')
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSupabaseKeyType(keyType) {
  const validTypes = ['service_role', 'anon'];
  
  if (!keyType || typeof keyType !== 'string') {
    return { valid: false, error: 'Tipo de API key é obrigatório' };
  }

  if (!validTypes.includes(keyType)) {
    return { 
      valid: false, 
      error: `Tipo de API key inválido. Use: ${validTypes.join(' ou ')}` 
    };
  }

  return { valid: true };
}

/**
 * Validates Supabase credentials only (for testing before save)
 * @param {Object} data - Credentials data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSupabaseCredentials(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Dados de conexão inválidos'] };
  }

  // Validate URL
  const urlResult = validateSupabaseUrl(data.supabase_url);
  if (!urlResult.valid) {
    errors.push(urlResult.error);
  }

  // Validate API key
  const keyResult = validateSupabaseKey(data.supabase_key);
  if (!keyResult.valid) {
    errors.push(keyResult.error);
  }

  // Validate key type
  const keyTypeResult = validateSupabaseKeyType(data.supabase_key_type);
  if (!keyTypeResult.valid) {
    errors.push(keyTypeResult.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates complete Supabase connection object
 * @param {Object} data - Connection data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSupabaseConnection(data) {
  // First validate credentials
  const credentialsResult = validateSupabaseCredentials(data);
  const errors = [...credentialsResult.errors];

  // Validate table name if provided
  if (data.supabase_table !== undefined && data.supabase_table !== null) {
    if (typeof data.supabase_table !== 'string' || data.supabase_table.trim() === '') {
      errors.push('Nome da tabela deve ser uma string não vazia');
    }
  }

  // Validate connection name
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('Nome da conexão é obrigatório');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates table name format
 * @param {string} tableName - Table name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTableName(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    return { valid: false, error: 'Nome da tabela é obrigatório' };
  }

  const trimmed = tableName.trim();
  
  // PostgreSQL identifier rules
  const validPattern = /^[a-z_][a-z0-9_]*$/i;
  if (!validPattern.test(trimmed)) {
    return { 
      valid: false, 
      error: 'Nome da tabela contém caracteres inválidos' 
    };
  }

  if (trimmed.length > 63) {
    return { 
      valid: false, 
      error: 'Nome da tabela muito longo (máximo 63 caracteres)' 
    };
  }

  return { valid: true };
}

/**
 * Middleware for validating Supabase connection in routes
 */
function validateSupabaseConnectionMiddleware(req, res, next) {
  const { type, supabase_url, supabase_key, supabase_key_type } = req.body;

  // Only validate if type is SUPABASE
  if (type !== 'SUPABASE') {
    return next();
  }

  const result = validateSupabaseConnection({
    ...req.body,
    supabase_url,
    supabase_key,
    supabase_key_type
  });

  if (!result.valid) {
    logger.warn('Supabase connection validation failed', {
      errors: result.errors,
      userId: req.user?.id
    });
    return res.status(400).json({
      success: false,
      error: result.errors.join('. ')
    });
  }

  next();
}

module.exports = {
  validateSupabaseUrl,
  validateSupabaseKey,
  validateSupabaseKeyType,
  validateSupabaseCredentials,
  validateSupabaseConnection,
  validateTableName,
  validateSupabaseConnectionMiddleware
};
