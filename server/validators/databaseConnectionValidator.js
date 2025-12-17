/**
 * Database Connection Validator
 * Validates database connection data for create and update operations
 *
 * @module validators/databaseConnectionValidator
 */

const VALID_TYPES = ['POSTGRES', 'MYSQL', 'NOCODB', 'API'];
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Validates if a string is a valid host (URL or localhost)
 *
 * @param {string} host - Host string to validate
 * @returns {boolean} True if valid host format
 */
function isValidHost(host) {
  if (!host || typeof host !== 'string') {
    return false;
  }

  const trimmedHost = host.trim();

  // Allow localhost variants
  if (
    trimmedHost === 'localhost' ||
    trimmedHost.startsWith('localhost:') ||
    trimmedHost === '127.0.0.1' ||
    trimmedHost.startsWith('127.0.0.1:')
  ) {
    return true;
  }

  // Allow IP addresses (basic validation)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
  if (ipPattern.test(trimmedHost)) {
    return true;
  }

  // Allow URLs with protocol
  try {
    const url = new URL(trimmedHost);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    // Not a valid URL with protocol, try adding https://
    try {
      const url = new URL(`https://${trimmedHost}`);
      // Check if it has a valid hostname (not just a path)
      return url.hostname.length > 0 && url.hostname.includes('.');
    } catch {
      return false;
    }
  }
}

/**
 * Validates database connection data
 *
 * @param {Object} data - Connection data to validate
 * @param {string} data.name - Connection name (1-100 characters)
 * @param {string} data.type - Connection type (POSTGRES, MYSQL, NOCODB, API)
 * @param {string} data.host - Host URL or localhost
 * @param {number} [data.port] - Port number (1-65535)
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 *
 * @example
 * const result = validateConnectionData({
 *   name: 'My Database',
 *   type: 'POSTGRES',
 *   host: 'localhost',
 *   port: 5432
 * });
 * // Returns: { valid: true, errors: [] }
 */
function validateConnectionData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Dados de conexão inválidos'] };
  }

  // Validate name (required, 1-100 characters)
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Nome é obrigatório');
  } else {
    const trimmedName = data.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      errors.push(`Nome deve ter pelo menos ${MIN_NAME_LENGTH} caractere`);
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.push(`Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`);
    }
  }

  // Validate type (required, must be one of valid types)
  if (!data.type || typeof data.type !== 'string') {
    errors.push('Tipo é obrigatório');
  } else if (!VALID_TYPES.includes(data.type.toUpperCase())) {
    errors.push(`Tipo deve ser um de: ${VALID_TYPES.join(', ')}`);
  }

  // Validate host (required, must be valid URL or localhost)
  if (!data.host || typeof data.host !== 'string') {
    errors.push('Host é obrigatório');
  } else if (!isValidHost(data.host)) {
    errors.push('Host deve ser uma URL válida ou localhost');
  }

  // Validate port (optional, but if provided must be 1-65535)
  if (data.port !== undefined && data.port !== null && data.port !== '') {
    const port = Number(data.port);
    if (isNaN(port) || !Number.isInteger(port)) {
      errors.push('Porta deve ser um número inteiro');
    } else if (port < MIN_PORT || port > MAX_PORT) {
      errors.push(`Porta deve estar entre ${MIN_PORT} e ${MAX_PORT}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateConnectionData,
  isValidHost,
  VALID_TYPES,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PORT,
  MAX_PORT,
};
