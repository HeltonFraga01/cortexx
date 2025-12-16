/**
 * WUZAPI Connectivity Checker
 * Verifica conectividade e saúde da API WUZAPI
 */

const wuzapiClient = require('./wuzapiClient');
const { logger } = require('./logger');

class WuzapiConnectivityChecker {
  constructor() {
    this.lastCheckTime = null;
    this.lastCheckResult = null;
    this.checkInterval = 60000; // 1 minuto
  }

  /**
   * Verifica conectividade básica com WUZAPI
   * @returns {Promise<Object>} Resultado da verificação
   */
  async checkConnectivity() {
    const startTime = Date.now();
    
    try {
      // Tentar fazer uma requisição simples para verificar conectividade
      const response = await wuzapiClient.get('/health', { timeout: 5000 });
      const duration = Date.now() - startTime;

      const result = {
        connected: response.success,
        status: response.status,
        responseTime: duration,
        baseUrl: wuzapiClient.getConfig().baseURL,
        timestamp: new Date().toISOString(),
        error: null
      };

      this.lastCheckTime = Date.now();
      this.lastCheckResult = result;

      logger.debug('WUZAPI connectivity check successful', {
        type: 'wuzapi_connectivity',
        ...result
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result = {
        connected: false,
        status: null,
        responseTime: duration,
        baseUrl: wuzapiClient.getConfig().baseURL,
        timestamp: new Date().toISOString(),
        error: error.message,
        errorCode: error.code
      };

      this.lastCheckTime = Date.now();
      this.lastCheckResult = result;

      logger.error('WUZAPI connectivity check failed', {
        type: 'wuzapi_connectivity',
        ...result
      });

      return result;
    }
  }

  /**
   * Testa validação de token com WUZAPI
   * @param {string} token - Token para testar
   * @param {string} role - Role do token ('admin' ou 'user')
   * @returns {Promise<Object>} Resultado do teste
   */
  async testTokenValidation(token, role = 'user') {
    const startTime = Date.now();

    try {
      let result;
      
      if (role === 'admin') {
        result = await wuzapiClient.validateAdminToken(token);
      } else {
        result = await wuzapiClient.validateUserToken(token);
      }

      const duration = Date.now() - startTime;

      const testResult = {
        success: true,
        valid: result.valid,
        role,
        responseTime: duration,
        timestamp: new Date().toISOString(),
        error: null
      };

      logger.debug('WUZAPI token validation test successful', {
        type: 'wuzapi_token_test',
        ...testResult
      });

      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      const testResult = {
        success: false,
        valid: false,
        role,
        responseTime: duration,
        timestamp: new Date().toISOString(),
        error: error.message
      };

      logger.warn('WUZAPI token validation test failed', {
        type: 'wuzapi_token_test',
        ...testResult
      });

      return testResult;
    }
  }

  /**
   * Executa verificação completa de saúde da WUZAPI
   * @returns {Promise<Object>} Resultado completo da verificação
   */
  async healthCheck() {
    const startTime = Date.now();
    
    logger.info('Starting WUZAPI health check...');

    // 1. Verificar conectividade básica
    const connectivityResult = await this.checkConnectivity();

    // 2. Verificar configuração
    const config = wuzapiClient.getConfig();
    const configValid = this.validateConfig(config);

    const totalDuration = Date.now() - startTime;

    const healthResult = {
      healthy: connectivityResult.connected && configValid.valid,
      connectivity: connectivityResult,
      configuration: configValid,
      totalCheckTime: totalDuration,
      timestamp: new Date().toISOString()
    };

    if (healthResult.healthy) {
      logger.info('WUZAPI health check passed', {
        type: 'wuzapi_health_check',
        duration: totalDuration
      });
    } else {
      logger.error('WUZAPI health check failed', {
        type: 'wuzapi_health_check',
        duration: totalDuration,
        issues: {
          connectivity: !connectivityResult.connected,
          configuration: !configValid.valid
        }
      });
    }

    return healthResult;
  }

  /**
   * Valida configuração do cliente WUZAPI
   * @param {Object} config - Configuração a validar
   * @returns {Object} Resultado da validação
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validar baseURL
    if (!config.baseURL) {
      errors.push('WUZAPI_BASE_URL is not configured');
    } else {
      try {
        const url = new URL(config.baseURL);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('WUZAPI_BASE_URL must use http or https protocol');
        }
      } catch (error) {
        errors.push(`WUZAPI_BASE_URL is not a valid URL: ${config.baseURL}`);
      }
    }

    // Validar timeout
    if (!config.timeout || config.timeout < 1000) {
      warnings.push('REQUEST_TIMEOUT is very low, may cause frequent timeouts');
    }
    if (config.timeout > 30000) {
      warnings.push('REQUEST_TIMEOUT is very high, may cause slow responses');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: {
        baseURL: config.baseURL,
        timeout: config.timeout
      }
    };
  }

  /**
   * Retorna o resultado da última verificação
   * @returns {Object|null} Último resultado ou null se nunca verificado
   */
  getLastCheckResult() {
    return this.lastCheckResult;
  }

  /**
   * Verifica se é necessário fazer uma nova verificação
   * @returns {boolean} True se deve verificar novamente
   */
  shouldCheck() {
    if (!this.lastCheckTime) {
      return true;
    }
    return (Date.now() - this.lastCheckTime) > this.checkInterval;
  }

  /**
   * Obtém status resumido da conectividade
   * @returns {Promise<Object>} Status resumido
   */
  async getStatus() {
    // Se já verificou recentemente, retornar resultado em cache
    if (!this.shouldCheck() && this.lastCheckResult) {
      return {
        ...this.lastCheckResult,
        cached: true,
        cacheAge: Date.now() - this.lastCheckTime
      };
    }

    // Fazer nova verificação
    const result = await this.checkConnectivity();
    return {
      ...result,
      cached: false
    };
  }

  /**
   * Executa diagnóstico completo para troubleshooting
   * @returns {Promise<Object>} Informações de diagnóstico
   */
  async diagnose() {
    logger.info('Starting WUZAPI diagnostic...');

    const diagnostic = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        wuzapiBaseUrl: process.env.WUZAPI_BASE_URL,
        requestTimeout: process.env.REQUEST_TIMEOUT
      },
      connectivity: null,
      configuration: null,
      recommendations: []
    };

    // Verificar conectividade
    diagnostic.connectivity = await this.checkConnectivity();

    // Verificar configuração
    const config = wuzapiClient.getConfig();
    diagnostic.configuration = this.validateConfig(config);

    // Gerar recomendações
    if (!diagnostic.connectivity.connected) {
      diagnostic.recommendations.push('Check if WUZAPI service is running and accessible');
      diagnostic.recommendations.push('Verify network connectivity and firewall rules');
      diagnostic.recommendations.push('Check if WUZAPI_BASE_URL is correct');
    }

    if (diagnostic.configuration.errors.length > 0) {
      diagnostic.recommendations.push('Fix configuration errors before proceeding');
    }

    if (diagnostic.connectivity.responseTime > 5000) {
      diagnostic.recommendations.push('WUZAPI response time is high, check network latency');
    }

    logger.info('WUZAPI diagnostic completed', {
      type: 'wuzapi_diagnostic',
      connected: diagnostic.connectivity.connected,
      configValid: diagnostic.configuration.valid,
      recommendationCount: diagnostic.recommendations.length
    });

    return diagnostic;
  }
}

// Instância singleton
const wuzapiConnectivityChecker = new WuzapiConnectivityChecker();

module.exports = {
  WuzapiConnectivityChecker,
  wuzapiConnectivityChecker
};
