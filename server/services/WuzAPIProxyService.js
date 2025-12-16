const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Serviço de proxy para WuzAPI
 * 
 * Este serviço atua como intermediário entre o frontend e a WuzAPI,
 * garantindo que tokens nunca sejam expostos ao cliente.
 * 
 * Funcionalidades:
 * - Proxy de requisições de usuário (usa token da sessão)
 * - Proxy de requisições admin (usa token do servidor)
 * - Logging de todas as requisições
 * - Tratamento de erros padronizado
 */
class WuzAPIProxyService {
  constructor() {
    this.baseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    this.adminToken = process.env.WUZAPI_ADMIN_TOKEN;
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT) || 10000;
    
    if (!this.adminToken) {
      logger.warn('WUZAPI_ADMIN_TOKEN not configured - admin proxy will not work');
    }
  }
  
  /**
   * Proxy de requisição para WuzAPI usando token da sessão do usuário
   * 
   * @param {string} method - Método HTTP (GET, POST, PUT, DELETE, etc)
   * @param {string} path - Caminho da API (ex: /session/status)
   * @param {Object} data - Dados para enviar no body (para POST/PUT)
   * @param {string} userToken - Token do usuário da sessão
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async proxyUserRequest(method, path, data, userToken, query = {}) {
    try {
      const url = `${this.baseUrl}${path}`;
      
      logger.debug('Proxying user request to WuzAPI', {
        method,
        path,
        hasData: !!data,
        hasQuery: Object.keys(query).length > 0
      });
      
      const response = await axios({
        method,
        url,
        data,
        params: query,
        headers: {
          'token': userToken,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      logger.debug('WuzAPI user request successful', {
        method,
        path,
        status: response.status
      });
      
      return response.data;
      
    } catch (error) {
      logger.error('WuzAPI user proxy error', {
        method,
        path,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Re-throw com informações estruturadas
      const proxyError = new Error(error.response?.data?.error || error.message);
      proxyError.status = error.response?.status || 500;
      proxyError.code = error.response?.data?.code || 'WUZAPI_ERROR';
      proxyError.originalError = error;
      
      throw proxyError;
    }
  }
  
  /**
   * Proxy de requisição para WuzAPI usando token admin do servidor
   * 
   * @param {string} method - Método HTTP (GET, POST, PUT, DELETE, etc)
   * @param {string} path - Caminho da API (ex: /admin/users)
   * @param {Object} data - Dados para enviar no body (para POST/PUT)
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async proxyAdminRequest(method, path, data, query = {}) {
    try {
      if (!this.adminToken) {
        throw new Error('Admin token not configured');
      }
      
      const url = `${this.baseUrl}${path}`;
      
      logger.debug('Proxying admin request to WuzAPI', {
        method,
        path,
        hasData: !!data,
        hasQuery: Object.keys(query).length > 0
      });
      
      const response = await axios({
        method,
        url,
        data,
        params: query,
        headers: {
          'token': this.adminToken,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      logger.debug('WuzAPI admin request successful', {
        method,
        path,
        status: response.status
      });
      
      return response.data;
      
    } catch (error) {
      logger.error('WuzAPI admin proxy error', {
        method,
        path,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Re-throw com informações estruturadas
      const proxyError = new Error(error.response?.data?.error || error.message);
      proxyError.status = error.response?.status || 500;
      proxyError.code = error.response?.data?.code || 'WUZAPI_ERROR';
      proxyError.originalError = error;
      
      throw proxyError;
    }
  }
  
  /**
   * Verifica se a WuzAPI está disponível
   * 
   * @returns {Promise<boolean>} True se disponível
   */
  async isHealthy() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('WuzAPI health check failed', {
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Obtém configuração atual do proxy
   * 
   * @returns {Object} Configuração
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      hasAdminToken: !!this.adminToken
    };
  }
}

// Exportar instância singleton
module.exports = new WuzAPIProxyService();
