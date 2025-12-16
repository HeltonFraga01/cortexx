/**
 * Credential Sanitizer Utility
 *
 * Masks sensitive credential fields (password, nocodb_token) in database connection objects
 * before returning them in API responses.
 *
 * This ensures that sensitive data is never exposed in network traffic or logs.
 *
 * @module utils/credentialSanitizer
 */

const MASK = '********';

/**
 * Masks sensitive credential fields in a single database connection object
 *
 * @param {Object|null} connection - Database connection object
 * @returns {Object|null} Connection with masked credentials, or null if input is null/undefined
 *
 * @example
 * const conn = { name: 'MyDB', password: 'secret123', nocodb_token: 'token456' };
 * sanitizeConnection(conn);
 * // Returns: { name: 'MyDB', password: '********', nocodb_token: '********' }
 */
function sanitizeConnection(connection) {
  if (!connection) {
    return connection;
  }

  return {
    ...connection,
    password: connection.password ? MASK : null,
    nocodb_token: connection.nocodb_token ? MASK : null,
  };
}

/**
 * Masks sensitive credential fields in an array of database connection objects
 *
 * @param {Array<Object>} connections - Array of database connection objects
 * @returns {Array<Object>} Array of connections with masked credentials
 *
 * @example
 * const conns = [
 *   { name: 'DB1', password: 'pass1' },
 *   { name: 'DB2', password: null }
 * ];
 * sanitizeConnections(conns);
 * // Returns: [
 * //   { name: 'DB1', password: '********' },
 * //   { name: 'DB2', password: null }
 * // ]
 */
function sanitizeConnections(connections) {
  if (!Array.isArray(connections)) {
    return [];
  }

  return connections.map(sanitizeConnection);
}

module.exports = {
  sanitizeConnection,
  sanitizeConnections,
  MASK,
};
