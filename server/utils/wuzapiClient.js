const axios = require('axios');
const { logger } = require('./logger');

/**
 * Cliente base para comunicação com a WuzAPI
 * Centraliza configurações de timeout, headers e base URL
 * Suporta configurações dinâmicas do banco de dados via ApiSettingsService
 */
class WuzAPIClient {
  constructor() {
    // Initial config from environment (will be overridden by database settings)
    this.baseURL = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
    
    // Cache for dynamic config
    this._configCache = null;
    this._configCacheExpiry = null;
    this._configCacheTTL = 30000; // 30 seconds cache
    
    // Criar instância do axios com configurações padrão
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNABORTED') {
          logger.error('WuzAPI request timeout', {
            url: error.config?.url,
            method: error.config?.method,
            timeout: this.timeout
          });
        } else if (error.code === 'ECONNREFUSED') {
          logger.error('WuzAPI connection refused', {
            url: error.config?.url,
            baseURL: this.baseURL
          });
        }
        return Promise.reject(error);
      }
    );
    
    logger.info('WuzAPIClient initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout
    });
  }

  /**
   * Reloads configuration from ApiSettingsService
   * Called automatically when cache expires
   */
  async reloadConfig() {
    try {
      // Lazy load to avoid circular dependency
      const ApiSettingsService = require('../services/ApiSettingsService');
      
      const [baseUrl, timeout] = await Promise.all([
        ApiSettingsService.getBaseUrl(),
        ApiSettingsService.getTimeout()
      ]);

      const configChanged = this.baseURL !== baseUrl || this.timeout !== timeout;
      
      if (configChanged) {
        this.baseURL = baseUrl;
        this.timeout = timeout;
        
        // Recreate axios client with new config
        this.client = axios.create({
          baseURL: this.baseURL,
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        logger.info('WuzAPIClient config reloaded', {
          baseURL: this.baseURL,
          timeout: this.timeout
        });
      }

      this._configCache = { baseURL: this.baseURL, timeout: this.timeout };
      this._configCacheExpiry = Date.now() + this._configCacheTTL;
      
      return this._configCache;
    } catch (error) {
      logger.warn('Failed to reload WuzAPIClient config, using current values', {
        error: error.message
      });
      return { baseURL: this.baseURL, timeout: this.timeout };
    }
  }

  /**
   * Ensures config is up to date before making requests
   */
  async _ensureConfig() {
    if (!this._configCache || !this._configCacheExpiry || Date.now() > this._configCacheExpiry) {
      await this.reloadConfig();
    }
  }

  /**
   * Faz uma requisição GET para a WuzAPI
   * @param {string} endpoint - Endpoint da API (ex: '/session/status')
   * @param {Object} options - Opções da requisição (headers, etc)
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async get(endpoint, options = {}) {
    try {
      await this._ensureConfig();
      const response = await this.client.get(endpoint, options);
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Faz uma requisição POST para a WuzAPI
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados para enviar no body
   * @param {Object} options - Opções da requisição (headers, etc)
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async post(endpoint, data = {}, options = {}) {
    try {
      await this._ensureConfig();
      const response = await this.client.post(endpoint, data, options);
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Faz uma requisição DELETE para a WuzAPI
   * @param {string} endpoint - Endpoint da API
   * @param {Object} options - Opções da requisição (headers, etc)
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async delete(endpoint, options = {}) {
    try {
      await this._ensureConfig();
      const response = await this.client.delete(endpoint, options);
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Faz uma requisição GET para endpoints administrativos da WuzAPI
   * @param {string} endpoint - Endpoint da API (ex: '/admin/users')
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async getAdmin(endpoint, adminToken) {
    try {
      await this._ensureConfig();
      const response = await this.client.get(endpoint, {
        headers: {
          'Authorization': adminToken
        }
      });
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Faz uma requisição POST para endpoints administrativos da WuzAPI
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados para enviar no body
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async postAdmin(endpoint, data, adminToken) {
    try {
      await this._ensureConfig();
      const response = await this.client.post(endpoint, data, {
        headers: {
          'Authorization': adminToken
        }
      });
      
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Trata erros das requisições para a WuzAPI
   * @param {Error} error - Erro capturado
   * @returns {Object} Objeto de erro padronizado
   * @private
   */
  _handleError(error) {
    if (error.response) {
      // Erro com resposta da WuzAPI
      return {
        success: false,
        status: error.response.status,
        data: error.response.data,
        error: error.response.data?.error || error.message
      };
    } else if (error.code === 'ECONNABORTED') {
      // Timeout
      return {
        success: false,
        status: 504,
        error: 'Timeout na requisição para WuzAPI',
        code: 'TIMEOUT'
      };
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      // Erro de conexão
      return {
        success: false,
        status: 500,
        error: 'Não foi possível conectar com a WuzAPI',
        code: 'CONNECTION_ERROR'
      };
    } else {
      // Outros erros
      return {
        success: false,
        status: 500,
        error: error.message || 'Erro desconhecido na comunicação com WuzAPI',
        code: 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Verifica se a WuzAPI está disponível
   * @returns {Promise<boolean>} True se a API estiver disponível
   */
  async isHealthy() {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um novo usuário na WuzAPI
   * @param {Object} userData - Dados do usuário a ser criado
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async createUser(userData, adminToken) {
    return await this.postAdmin('/admin/users', userData, adminToken);
  }

  /**
   * Obtém informações de um usuário específico da WuzAPI
   * @param {string} userId - ID do usuário
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI com dados do usuário
   */
  async getUser(userId, adminToken) {
    return await this.getAdmin(`/admin/users/${userId}`, adminToken);
  }

  /**
   * Lista todos os usuários da WuzAPI
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI com lista de usuários
   */
  async getUsers(adminToken) {
    return await this.getAdmin('/admin/users', adminToken);
  }

  /**
   * Remove um usuário do banco de dados (mantém sessão ativa)
   * @param {string} userId - ID do usuário a ser removido
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async deleteUser(userId, adminToken) {
    return await this.delete(`/admin/users/${userId}`, {
      headers: {
        'Authorization': adminToken
      }
    });
  }

  /**
   * Remove um usuário completamente (incluindo sessões ativas)
   * @param {string} userId - ID do usuário a ser removido completamente
   * @param {string} adminToken - Token de autorização administrativo
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async deleteUserFull(userId, adminToken) {
    return await this.delete(`/admin/users/${userId}/full`, {
      headers: {
        'Authorization': adminToken
      }
    });
  }

  /**
   * Valida um token de usuário com a WuzAPI
   * @param {string} userToken - Token do usuário a ser validado
   * @returns {Promise<Object>} Dados do usuário se válido
   * @throws {Error} Se o token for inválido
   */
  async validateUserToken(userToken) {
    try {
      const response = await this.client.get('/session/status', {
        headers: {
          'token': userToken
        }
      });
      
      if (response.status === 200 && response.data) {
        return {
          id: response.data.id || userToken,
          token: userToken,
          valid: true
        };
      }
      
      throw new Error('Invalid user token');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid user token');
      }
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Valida um token de admin com a WuzAPI
   * @param {string} adminToken - Token admin a ser validado
   * @returns {Promise<Object>} Dados do admin se válido
   * @throws {Error} Se o token for inválido
   */
  async validateAdminToken(adminToken) {
    try {
      // Tentar fazer uma requisição admin simples para validar o token
      const response = await this.client.get('/admin/health', {
        headers: {
          'Authorization': adminToken
        }
      });
      
      if (response.status === 200) {
        return {
          id: 'admin',
          token: adminToken,
          valid: true,
          role: 'admin'
        };
      }
      
      throw new Error('Invalid admin token');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid admin token');
      }
      throw new Error(`Admin token validation failed: ${error.message}`);
    }
  }

  /**
   * Obtém informações de configuração do cliente
   * @returns {Object} Configurações atuais
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout
    };
  }
}

// Exportar instância singleton
module.exports = new WuzAPIClient();