/**
 * API Settings Validator
 * Validates input for API configuration settings
 */

const { z } = require('zod');

/**
 * URL validation schema - accepts only HTTP/HTTPS URLs
 */
const urlSchema = z.string()
  .min(1, 'URL é obrigatória')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'URL inválida. Use formato http:// ou https://' });

/**
 * Timeout validation schema - 1000ms to 120000ms (1s to 2min)
 */
const timeoutSchema = z.number()
  .int('Timeout deve ser um número inteiro')
  .min(1000, 'Timeout mínimo é 1000ms (1 segundo)')
  .max(120000, 'Timeout máximo é 120000ms (2 minutos)');

/**
 * Token validation schema - non-empty string
 */
const tokenSchema = z.string()
  .min(1, 'Token de administrador é obrigatório');

/**
 * Full API settings update schema
 */
const apiSettingsUpdateSchema = z.object({
  wuzapiBaseUrl: urlSchema.optional(),
  wuzapiAdminToken: tokenSchema.optional(),
  wuzapiTimeout: timeoutSchema.optional()
}).refine((data) => {
  // At least one field must be provided
  return data.wuzapiBaseUrl !== undefined || 
         data.wuzapiAdminToken !== undefined || 
         data.wuzapiTimeout !== undefined;
}, { message: 'Pelo menos uma configuração deve ser fornecida' });

/**
 * Validates a URL string
 * @param {string} url - URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateUrl(url) {
  const result = urlSchema.safeParse(url);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message || 'URL inválida' };
}

/**
 * Validates a timeout value
 * @param {number} timeout - Timeout in milliseconds
 * @returns {{valid: boolean, error?: string}}
 */
function validateTimeout(timeout) {
  const result = timeoutSchema.safeParse(timeout);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message || 'Timeout inválido' };
}

/**
 * Validates a token string
 * @param {string} token - Token to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateToken(token) {
  const result = tokenSchema.safeParse(token);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message || 'Token inválido' };
}

/**
 * Validates API settings update payload
 * @param {Object} data - Settings data to validate
 * @returns {{valid: boolean, data?: Object, errors?: Array}}
 */
function validateApiSettingsUpdate(data) {
  const result = apiSettingsUpdateSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { 
    valid: false, 
    errors: result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }))
  };
}

module.exports = {
  validateUrl,
  validateTimeout,
  validateToken,
  validateApiSettingsUpdate,
  // Export schemas for testing
  urlSchema,
  timeoutSchema,
  tokenSchema,
  apiSettingsUpdateSchema
};
