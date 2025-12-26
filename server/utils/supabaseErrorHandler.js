/**
 * Supabase Error Handler
 * Translates Supabase/PostgreSQL errors to user-friendly messages
 * Requirements: 9.1, 9.2, 9.5
 */

const { logger } = require('./logger');

/**
 * Error codes for Supabase operations
 */
const SUPABASE_ERROR_CODES = {
  INVALID_URL: 'INVALID_SUPABASE_URL',
  AUTH_FAILED: 'SUPABASE_AUTH_FAILED',
  PERMISSION_DENIED: 'SUPABASE_PERMISSION_DENIED',
  TABLE_NOT_FOUND: 'SUPABASE_TABLE_NOT_FOUND',
  RLS_VIOLATION: 'SUPABASE_RLS_VIOLATION',
  TIMEOUT: 'SUPABASE_TIMEOUT',
  RATE_LIMITED: 'SUPABASE_RATE_LIMITED',
  UNKNOWN: 'SUPABASE_UNKNOWN_ERROR',
  DUPLICATE_KEY: 'SUPABASE_DUPLICATE_KEY',
  FOREIGN_KEY_VIOLATION: 'SUPABASE_FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION: 'SUPABASE_NOT_NULL_VIOLATION',
  CHECK_VIOLATION: 'SUPABASE_CHECK_VIOLATION',
};

/**
 * Error messages in Portuguese
 */
const ERROR_MESSAGES = {
  [SUPABASE_ERROR_CODES.INVALID_URL]: 'URL do Supabase inválida. Use o formato: https://seu-projeto.supabase.co',
  [SUPABASE_ERROR_CODES.AUTH_FAILED]: 'Falha na autenticação. Verifique sua API key.',
  [SUPABASE_ERROR_CODES.PERMISSION_DENIED]: 'Permissão negada. A API key não tem acesso a este recurso.',
  [SUPABASE_ERROR_CODES.TABLE_NOT_FOUND]: 'Tabela não encontrada no projeto Supabase.',
  [SUPABASE_ERROR_CODES.RLS_VIOLATION]: 'Acesso negado pela política de segurança (RLS).',
  [SUPABASE_ERROR_CODES.TIMEOUT]: 'Tempo limite excedido ao conectar ao Supabase.',
  [SUPABASE_ERROR_CODES.RATE_LIMITED]: 'Muitas requisições. Aguarde alguns segundos.',
  [SUPABASE_ERROR_CODES.UNKNOWN]: 'Erro inesperado ao comunicar com Supabase.',
  [SUPABASE_ERROR_CODES.DUPLICATE_KEY]: 'Registro duplicado. Este valor já existe.',
  [SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION]: 'Referência inválida. O registro relacionado não existe.',
  [SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION]: 'Campo obrigatório não preenchido.',
  [SUPABASE_ERROR_CODES.CHECK_VIOLATION]: 'Valor inválido. Não atende às restrições do campo.',
};

/**
 * PostgreSQL error code mapping
 */
const PG_ERROR_MAP = {
  '23505': SUPABASE_ERROR_CODES.DUPLICATE_KEY,
  '23503': SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION,
  '23502': SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION,
  '23514': SUPABASE_ERROR_CODES.CHECK_VIOLATION,
  '42501': SUPABASE_ERROR_CODES.PERMISSION_DENIED,
  '42P01': SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
  '42703': SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
  'PGRST301': SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
  'PGRST204': SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
  'PGRST116': SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
};

/**
 * Translate error to user-friendly message
 * @param {Error} error - Original error
 * @param {Object} context - Additional context for logging
 * @returns {Object} Translated error with code and message
 */
function translateError(error, context = {}) {
  if (!error) {
    return {
      code: SUPABASE_ERROR_CODES.UNKNOWN,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.UNKNOWN],
      originalError: null
    };
  }
  
  const message = error.message || '';
  const code = error.code || '';
  
  // Log the error with context
  logger.error('Supabase error occurred', {
    errorCode: code,
    errorMessage: message,
    ...context
  });
  
  // Check PostgreSQL error codes
  if (PG_ERROR_MAP[code]) {
    const appCode = PG_ERROR_MAP[code];
    return {
      code: appCode,
      message: ERROR_MESSAGES[appCode],
      originalError: error
    };
  }
  
  // Check message patterns
  if (message.includes('Invalid API key') || code === '401' || message.includes('JWT')) {
    return {
      code: SUPABASE_ERROR_CODES.AUTH_FAILED,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.AUTH_FAILED],
      originalError: error
    };
  }
  
  if (message.includes('permission denied')) {
    return {
      code: SUPABASE_ERROR_CODES.PERMISSION_DENIED,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.PERMISSION_DENIED],
      originalError: error
    };
  }
  
  if (message.includes('does not exist')) {
    return {
      code: SUPABASE_ERROR_CODES.TABLE_NOT_FOUND,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.TABLE_NOT_FOUND],
      originalError: error
    };
  }
  
  if (message.includes('row-level security') || message.includes('RLS')) {
    return {
      code: SUPABASE_ERROR_CODES.RLS_VIOLATION,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.RLS_VIOLATION],
      originalError: error
    };
  }
  
  if (message.includes('timeout') || code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    return {
      code: SUPABASE_ERROR_CODES.TIMEOUT,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.TIMEOUT],
      originalError: error
    };
  }
  
  if (message.includes('rate limit') || code === '429') {
    return {
      code: SUPABASE_ERROR_CODES.RATE_LIMITED,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.RATE_LIMITED],
      originalError: error
    };
  }
  
  if (message.includes('duplicate') || message.includes('unique constraint')) {
    return {
      code: SUPABASE_ERROR_CODES.DUPLICATE_KEY,
      message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.DUPLICATE_KEY],
      originalError: error
    };
  }
  
  // Default error
  return {
    code: SUPABASE_ERROR_CODES.UNKNOWN,
    message: ERROR_MESSAGES[SUPABASE_ERROR_CODES.UNKNOWN],
    originalError: error
  };
}

/**
 * Check if error is retryable
 * @param {string} errorCode - Error code
 * @returns {boolean}
 */
function isRetryableError(errorCode) {
  const retryableCodes = [
    SUPABASE_ERROR_CODES.TIMEOUT,
    SUPABASE_ERROR_CODES.RATE_LIMITED,
  ];
  return retryableCodes.includes(errorCode);
}

/**
 * Get HTTP status code for error
 * @param {string} errorCode - Error code
 * @returns {number}
 */
function getHttpStatus(errorCode) {
  const statusMap = {
    [SUPABASE_ERROR_CODES.INVALID_URL]: 400,
    [SUPABASE_ERROR_CODES.AUTH_FAILED]: 401,
    [SUPABASE_ERROR_CODES.PERMISSION_DENIED]: 403,
    [SUPABASE_ERROR_CODES.TABLE_NOT_FOUND]: 404,
    [SUPABASE_ERROR_CODES.RLS_VIOLATION]: 403,
    [SUPABASE_ERROR_CODES.TIMEOUT]: 504,
    [SUPABASE_ERROR_CODES.RATE_LIMITED]: 429,
    [SUPABASE_ERROR_CODES.DUPLICATE_KEY]: 409,
    [SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION]: 400,
    [SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION]: 400,
    [SUPABASE_ERROR_CODES.CHECK_VIOLATION]: 400,
    [SUPABASE_ERROR_CODES.UNKNOWN]: 500,
  };
  return statusMap[errorCode] || 500;
}

/**
 * Create error response for API
 * @param {Error} error - Original error
 * @param {Object} context - Additional context
 * @returns {Object} API error response
 */
function createErrorResponse(error, context = {}) {
  const translated = translateError(error, context);
  return {
    success: false,
    error: translated.message,
    errorCode: translated.code,
    status: getHttpStatus(translated.code)
  };
}

module.exports = {
  SUPABASE_ERROR_CODES,
  ERROR_MESSAGES,
  translateError,
  isRetryableError,
  getHttpStatus,
  createErrorResponse
};
