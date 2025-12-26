const axios = require('axios');
const { logger } = require('./logger');

/**
 * Circuit Breaker implementation for external service resilience
 * Prevents cascade failures when WUZAPI is unavailable
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.successThreshold = options.successThreshold || 2;
    
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailure = null;
  }

  /**
   * Check if request should be allowed
   * @returns {boolean} - Whether the request can proceed
   */
  canRequest() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          failures: this.failures,
          resetTimeout: this.resetTimeout
        });
        return true;
      }
      return false;
    }
    
    // HALF_OPEN - allow limited requests
    return true;
  }

  /**
   * Record a successful request
   */
  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * Record a failed request
   */
  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn('Circuit breaker OPEN - service still failing', {
        failures: this.failures
      });
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker OPEN - failure threshold reached', {
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      isOpen: this.state === 'OPEN'
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
  }
}

/**
 * Retry handler with exponential backoff
 */
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryableStatuses = options.retryableStatuses || [408, 429, 500, 502, 503, 504];
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    // Network errors are retryable
    if (error.code === 'ECONNABORTED' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // Check HTTP status codes
    if (error.response && this.retryableStatuses.includes(error.response.status)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for retry attempt
   */
  getDelay(attempt) {
    const delay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

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
    
    // Circuit breaker for resilience
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: parseInt(process.env.WUZAPI_CIRCUIT_FAILURE_THRESHOLD) || 5,
      resetTimeout: parseInt(process.env.WUZAPI_CIRCUIT_RESET_TIMEOUT) || 30000,
      successThreshold: 2
    });
    
    // Retry handler with exponential backoff
    this.retryHandler = new RetryHandler({
      maxRetries: parseInt(process.env.WUZAPI_MAX_RETRIES) || 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    });
    
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
      timeout: this.timeout,
      circuitBreaker: 'enabled',
      retryEnabled: true
    });
  }

  /**
   * Execute request with circuit breaker and retry logic
   * @private
   */
  async _executeWithResilience(requestFn, context = {}) {
    // Check circuit breaker
    if (!this.circuitBreaker.canRequest()) {
      const state = this.circuitBreaker.getState();
      logger.warn('WuzAPI request blocked by circuit breaker', {
        state: state.state,
        failures: state.failures,
        ...context
      });
      return {
        success: false,
        status: 503,
        error: 'Service temporarily unavailable (circuit breaker open)',
        code: 'CIRCUIT_OPEN',
        circuitState: state
      };
    }

    let lastError;
    
    for (let attempt = 0; attempt <= this.retryHandler.maxRetries; attempt++) {
      try {
        const response = await requestFn();
        
        // Success - notify circuit breaker
        this.circuitBreaker.onSuccess();
        
        return {
          success: true,
          status: response.status,
          data: response.data
        };
      } catch (error) {
        lastError = error;
        
        // Check if retryable
        if (!this.retryHandler.isRetryable(error) || attempt >= this.retryHandler.maxRetries) {
          // Not retryable or max retries reached
          this.circuitBreaker.onFailure();
          break;
        }
        
        // Wait before retry
        const delay = this.retryHandler.getDelay(attempt);
        logger.debug('WuzAPI request retry', {
          attempt: attempt + 1,
          maxRetries: this.retryHandler.maxRetries,
          delay,
          error: error.message,
          ...context
        });
        
        await this.retryHandler.sleep(delay);
      }
    }

    // All retries failed
    return this._handleError(lastError);
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
    await this._ensureConfig();
    
    return this._executeWithResilience(
      () => this.client.get(endpoint, options),
      { method: 'GET', endpoint }
    );
  }

  /**
   * Faz uma requisição POST para a WuzAPI
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados para enviar no body
   * @param {Object} options - Opções da requisição (headers, etc)
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async post(endpoint, data = {}, options = {}) {
    await this._ensureConfig();
    
    return this._executeWithResilience(
      () => this.client.post(endpoint, data, options),
      { method: 'POST', endpoint }
    );
  }

  /**
   * Faz uma requisição DELETE para a WuzAPI
   * @param {string} endpoint - Endpoint da API
   * @param {Object} options - Opções da requisição (headers, etc)
   * @returns {Promise<Object>} Resposta da WuzAPI
   */
  async delete(endpoint, options = {}) {
    await this._ensureConfig();
    
    return this._executeWithResilience(
      () => this.client.delete(endpoint, options),
      { method: 'DELETE', endpoint }
    );
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

  /**
   * Get circuit breaker state for health checks
   * @returns {Object} Circuit breaker state
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
    logger.info('WuzAPI circuit breaker manually reset');
  }

  /**
   * Obtém a lista de contatos do WhatsApp
   * @param {string} userToken - Token do usuário WUZAPI
   * @returns {Promise<Array>} Lista de contatos normalizada
   */
  async getContacts(userToken) {
    try {
      await this._ensureConfig();
      
      const response = await this.client.get('/user/contacts', {
        headers: {
          'token': userToken
        },
        timeout: 30000
      });

      const wuzapiResponse = response.data;

      if (!wuzapiResponse || !wuzapiResponse.data) {
        logger.warn('Invalid WUZAPI contacts response', { 
          hasResponse: !!wuzapiResponse,
          hasData: !!wuzapiResponse?.data 
        });
        return [];
      }

      const wuzapiContacts = wuzapiResponse.data;

      // Transform contacts object to array
      const contacts = Object.entries(wuzapiContacts)
        .filter(([jid, contact]) => jid && jid.includes('@') && contact.Found)
        .map(([jid, contact]) => {
          const phone = jid.split('@')[0];
          const normalizedPhone = phone.replace(/\D/g, '');
          const name = contact.FullName || contact.PushName || contact.BusinessName || null;

          return {
            phone: normalizedPhone,
            name: name,
            jid: jid,
            avatarUrl: contact.ProfilePictureUrl || null,
            valid: normalizedPhone.length >= 8
          };
        })
        .filter(contact => contact.valid);

      logger.info('Contacts fetched from WUZAPI', {
        totalEntries: Object.keys(wuzapiContacts).length,
        validContacts: contacts.length
      });

      return contacts;
    } catch (error) {
      logger.error('Failed to fetch contacts from WUZAPI', {
        error: error.message,
        status: error.response?.status
      });

      if (error.response?.status === 401) {
        throw new Error('Token WUZAPI inválido ou expirado');
      }
      if (error.response?.status === 404) {
        throw new Error('Instância WhatsApp não encontrada');
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Serviço WUZAPI indisponível');
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('Tempo limite excedido ao conectar com WUZAPI');
      }

      throw error;
    }
  }
}

// Exportar instância singleton
module.exports = new WuzAPIClient();