/**
 * NocoDB Connection Service
 * Handles operations for NocoDB connections
 * Tests connections server-side to avoid CORS issues
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Error codes for NocoDB operations
 */
const NOCODB_ERROR_CODES = {
  INVALID_URL: 'NOCODB_INVALID_URL',
  AUTH_FAILED: 'NOCODB_AUTH_FAILED',
  PERMISSION_DENIED: 'NOCODB_PERMISSION_DENIED',
  PROJECT_NOT_FOUND: 'NOCODB_PROJECT_NOT_FOUND',
  TABLE_NOT_FOUND: 'NOCODB_TABLE_NOT_FOUND',
  TIMEOUT: 'NOCODB_TIMEOUT',
  NETWORK_ERROR: 'NOCODB_NETWORK_ERROR',
  UNKNOWN: 'NOCODB_UNKNOWN_ERROR',
};

/**
 * Error messages in Portuguese
 */
const ERROR_MESSAGES = {
  [NOCODB_ERROR_CODES.INVALID_URL]: 'URL do NocoDB inválida. Verifique o endereço do servidor.',
  [NOCODB_ERROR_CODES.AUTH_FAILED]: 'Token de autenticação inválido. Verifique seu xc-token.',
  [NOCODB_ERROR_CODES.PERMISSION_DENIED]: 'Permissão negada. O token não tem acesso a este recurso.',
  [NOCODB_ERROR_CODES.PROJECT_NOT_FOUND]: 'Projeto não encontrado. Verifique o Project ID.',
  [NOCODB_ERROR_CODES.TABLE_NOT_FOUND]: 'Tabela não encontrada. Verifique o Table ID.',
  [NOCODB_ERROR_CODES.TIMEOUT]: 'Tempo limite excedido ao conectar ao NocoDB.',
  [NOCODB_ERROR_CODES.NETWORK_ERROR]: 'Erro de rede ao conectar ao NocoDB. Verifique se o servidor está acessível.',
  [NOCODB_ERROR_CODES.UNKNOWN]: 'Erro inesperado ao comunicar com NocoDB.',
};

class NocoDBConnectionService {
  /**
   * Create axios client for NocoDB
   * @param {Object} connection - Connection config
   * @returns {AxiosInstance}
   */
  static createClient(connection) {
    const token = connection.nocodb_token || connection.password || '';
    
    if (!connection.host) {
      throw this.createError(NOCODB_ERROR_CODES.INVALID_URL, 'Host não configurado');
    }
    
    if (!token) {
      throw this.createError(NOCODB_ERROR_CODES.AUTH_FAILED, 'Token não configurado');
    }
    
    return axios.create({
      baseURL: connection.host,
      headers: {
        'xc-token': token,
        'Content-Type': 'application/json',
      },
      timeout: parseInt(process.env.NOCODB_TIMEOUT) || 15000,
    });
  }

  /**
   * Test NocoDB connection
   * @param {Object} connection - Database connection config
   * @returns {Promise<Object>} Test result with status and details
   */
  static async testConnection(connection) {
    try {
      // Validate required fields
      if (!connection.host) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.INVALID_URL],
          details: { errorCode: NOCODB_ERROR_CODES.INVALID_URL }
        };
      }

      const token = connection.nocodb_token || connection.password;
      if (!token) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.AUTH_FAILED],
          details: { errorCode: NOCODB_ERROR_CODES.AUTH_FAILED }
        };
      }

      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;

      if (!projectId) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.PROJECT_NOT_FOUND],
          details: { errorCode: NOCODB_ERROR_CODES.PROJECT_NOT_FOUND }
        };
      }

      if (!tableId) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.TABLE_NOT_FOUND],
          details: { errorCode: NOCODB_ERROR_CODES.TABLE_NOT_FOUND }
        };
      }

      const client = this.createClient(connection);

      // Test connection by fetching 1 record from the table
      const response = await client.get(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        { params: { limit: 1 } }
      );

      // Check if response is valid
      if (response.status === 200) {
        const recordCount = response.data?.list?.length ?? response.data?.length ?? 0;
        
        logger.info('NocoDB connection test successful', {
          connectionId: connection.id,
          host: connection.host,
          projectId,
          tableId,
          recordCount
        });

        return {
          success: true,
          status: 'connected',
          message: 'Conexão estabelecida com sucesso',
          details: {
            projectId,
            tableId,
            recordCount,
            hasData: recordCount > 0
          }
        };
      }

      return {
        success: false,
        status: 'error',
        message: 'Resposta inesperada do servidor NocoDB',
        details: { statusCode: response.status }
      };

    } catch (error) {
      logger.error('NocoDB connection test failed', {
        connectionId: connection.id,
        host: connection.host,
        error: error.message,
        status: error.response?.status
      });

      return this.handleTestError(error);
    }
  }

  /**
   * Handle test connection errors
   * @param {Error} error
   * @returns {Object} Error result
   */
  static handleTestError(error) {
    // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        status: 'error',
        message: 'Não foi possível conectar ao servidor NocoDB. Verifique se o servidor está online.',
        details: { errorCode: NOCODB_ERROR_CODES.NETWORK_ERROR }
      };
    }

    if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        status: 'error',
        message: 'Servidor NocoDB não encontrado. Verifique a URL.',
        details: { errorCode: NOCODB_ERROR_CODES.INVALID_URL }
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        success: false,
        status: 'error',
        message: ERROR_MESSAGES[NOCODB_ERROR_CODES.TIMEOUT],
        details: { errorCode: NOCODB_ERROR_CODES.TIMEOUT }
      };
    }

    // HTTP errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.AUTH_FAILED],
          details: { 
            errorCode: NOCODB_ERROR_CODES.AUTH_FAILED,
            serverMessage: data?.message || data?.msg
          }
        };
      }

      if (status === 403) {
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.PERMISSION_DENIED],
          details: { 
            errorCode: NOCODB_ERROR_CODES.PERMISSION_DENIED,
            serverMessage: data?.message || data?.msg
          }
        };
      }

      if (status === 404) {
        // Could be project or table not found
        const message = data?.message || data?.msg || '';
        if (message.toLowerCase().includes('table') || message.toLowerCase().includes('tabela')) {
          return {
            success: false,
            status: 'error',
            message: ERROR_MESSAGES[NOCODB_ERROR_CODES.TABLE_NOT_FOUND],
            details: { 
              errorCode: NOCODB_ERROR_CODES.TABLE_NOT_FOUND,
              serverMessage: message
            }
          };
        }
        return {
          success: false,
          status: 'error',
          message: ERROR_MESSAGES[NOCODB_ERROR_CODES.PROJECT_NOT_FOUND],
          details: { 
            errorCode: NOCODB_ERROR_CODES.PROJECT_NOT_FOUND,
            serverMessage: message
          }
        };
      }

      // Other HTTP errors
      return {
        success: false,
        status: 'error',
        message: data?.message || data?.msg || `Erro HTTP ${status}`,
        details: { 
          errorCode: NOCODB_ERROR_CODES.UNKNOWN,
          statusCode: status,
          serverMessage: data?.message || data?.msg
        }
      };
    }

    // Generic error
    return {
      success: false,
      status: 'error',
      message: error.message || ERROR_MESSAGES[NOCODB_ERROR_CODES.UNKNOWN],
      details: { errorCode: NOCODB_ERROR_CODES.UNKNOWN }
    };
  }

  /**
   * Test NocoDB credentials before saving (without connection ID)
   * @param {Object} credentials - NocoDB credentials
   * @returns {Promise<Object>} Test result
   */
  static async testCredentials(credentials) {
    const { host, nocodb_token, nocodb_project_id, nocodb_table_id } = credentials;
    
    // Create a temporary connection object
    const tempConnection = {
      host,
      nocodb_token,
      nocodb_project_id,
      nocodb_table_id
    };

    return this.testConnection(tempConnection);
  }

  /**
   * List projects/bases from NocoDB
   * @param {Object} connection - Connection config
   * @returns {Promise<Array>} List of projects
   */
  static async listProjects(connection) {
    try {
      const client = this.createClient(connection);
      const response = await client.get('/api/v1/db/meta/projects');
      
      return response.data?.list || response.data || [];
    } catch (error) {
      logger.error('Failed to list NocoDB projects', {
        host: connection.host,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * List tables from a NocoDB project
   * @param {Object} connection - Connection config
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} List of tables
   */
  static async listTables(connection, projectId) {
    try {
      const client = this.createClient(connection);
      const response = await client.get(`/api/v1/db/meta/projects/${projectId}/tables`);
      
      return response.data?.list || [];
    } catch (error) {
      logger.error('Failed to list NocoDB tables', {
        host: connection.host,
        projectId,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Get table columns/metadata
   * @param {Object} connection - Connection config
   * @param {string} tableId - Table ID
   * @returns {Promise<Array>} List of columns
   */
  static async getTableColumns(connection, tableId) {
    try {
      const client = this.createClient(connection);
      const response = await client.get(`/api/v1/db/meta/tables/${tableId}`);
      
      return response.data?.columns || [];
    } catch (error) {
      logger.error('Failed to get NocoDB table columns', {
        host: connection.host,
        tableId,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Create a standardized error
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @returns {Error}
   */
  static createError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.userMessage = ERROR_MESSAGES[code] || message;
    return error;
  }

  /**
   * Translate NocoDB errors to user-friendly messages
   * @param {Error} error - Original error
   * @returns {Error} - Translated error
   */
  static translateError(error) {
    if (!error) return error;
    
    // Already translated
    if (error.code && ERROR_MESSAGES[error.code]) {
      error.userMessage = ERROR_MESSAGES[error.code];
      return error;
    }
    
    const message = error.message || '';
    const status = error.response?.status;
    
    if (status === 401 || message.includes('Unauthorized')) {
      return this.createError(NOCODB_ERROR_CODES.AUTH_FAILED, message);
    }
    
    if (status === 403 || message.includes('Forbidden')) {
      return this.createError(NOCODB_ERROR_CODES.PERMISSION_DENIED, message);
    }
    
    if (status === 404) {
      return this.createError(NOCODB_ERROR_CODES.PROJECT_NOT_FOUND, message);
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return this.createError(NOCODB_ERROR_CODES.TIMEOUT, message);
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return this.createError(NOCODB_ERROR_CODES.NETWORK_ERROR, message);
    }
    
    // Default error
    const translatedError = new Error(message);
    translatedError.code = NOCODB_ERROR_CODES.UNKNOWN;
    translatedError.userMessage = ERROR_MESSAGES[NOCODB_ERROR_CODES.UNKNOWN];
    translatedError.originalError = error;
    return translatedError;
  }
}

module.exports = NocoDBConnectionService;
