/**
 * Validador de variáveis de ambiente para WUZAPI Manager
 * Valida configurações críticas no startup do servidor
 */

const { logger } = require('./logger');

class EnvironmentValidator {
  constructor() {
    // Variáveis obrigatórias
    this.requiredVars = [
      'WUZAPI_BASE_URL',
      'CORS_ORIGINS',
      'SESSION_SECRET'
    ];

    // Variáveis opcionais com valores padrão
    this.optionalVars = {
      NODE_ENV: 'development',
      PORT: '3001',
      LOG_LEVEL: 'info',
      REQUEST_TIMEOUT: '10000'
    };

    // Variáveis sensíveis que não devem ser logadas
    this.sensitiveVars = [
      'SESSION_SECRET',
      'VITE_ADMIN_TOKEN'
    ];
  }

  /**
   * Valida todas as variáveis de ambiente necessárias
   * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validar variáveis obrigatórias
    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      } else {
        // Validações específicas por variável
        const validationError = this.validateVariable(varName, process.env[varName]);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    // Verificar variáveis opcionais
    for (const [varName, defaultValue] of Object.entries(this.optionalVars)) {
      if (!process.env[varName]) {
        warnings.push(`Optional variable ${varName} not set, using default: ${defaultValue}`);
        process.env[varName] = defaultValue;
      }
    }

    // Validar NODE_ENV
    const validEnvs = ['development', 'production', 'test'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
      warnings.push(`NODE_ENV="${process.env.NODE_ENV}" is not standard. Expected: ${validEnvs.join(', ')}`);
    }

    // Validar SESSION_SECRET em produção
    if (process.env.NODE_ENV === 'production') {
      if (process.env.SESSION_SECRET === 'your-secret-key-here-generate-with-openssl') {
        errors.push('SESSION_SECRET must be changed in production environment');
      }
      if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
        warnings.push('SESSION_SECRET should be at least 32 characters for better security');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida uma variável específica
   * @param {string} varName - Nome da variável
   * @param {string} value - Valor da variável
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  validateVariable(varName, value) {
    switch (varName) {
      case 'WUZAPI_BASE_URL':
        return this.validateUrl(value, varName);
      
      case 'CORS_ORIGINS':
        return this.validateCorsOrigins(value);
      
      case 'SESSION_SECRET':
        if (value.length < 16) {
          return 'SESSION_SECRET must be at least 16 characters long';
        }
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Valida formato de URL
   * @param {string} url - URL para validar
   * @param {string} varName - Nome da variável
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  validateUrl(url, varName) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return `${varName} must use http or https protocol`;
      }
      return null;
    } catch (error) {
      return `${varName} is not a valid URL: ${url}`;
    }
  }

  /**
   * Valida CORS_ORIGINS
   * @param {string} origins - Lista de origens separadas por vírgula
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  validateCorsOrigins(origins) {
    const originList = origins.split(',').map(o => o.trim());
    
    for (const origin of originList) {
      if (origin === '*') {
        continue; // Wildcard é válido
      }
      
      const urlError = this.validateUrl(origin, 'CORS_ORIGINS entry');
      if (urlError) {
        return urlError;
      }
    }
    
    return null;
  }

  /**
   * Retorna informações de configuração (sanitizadas)
   * @returns {Object} Objeto com configurações
   */
  getConfigInfo() {
    const config = {
      environment: process.env.NODE_ENV,
      server: {
        port: process.env.PORT
      },
      wuzapi: {
        baseUrl: process.env.WUZAPI_BASE_URL,
        timeout: process.env.REQUEST_TIMEOUT
      },
      database: {
        supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'not configured',
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'not configured'
      },
      cors: {
        origins: process.env.CORS_ORIGINS?.split(',').map(o => o.trim())
      },
      logging: {
        level: process.env.LOG_LEVEL
      },
      session: {
        secretConfigured: !!process.env.SESSION_SECRET,
        secretLength: process.env.SESSION_SECRET?.length || 0
      }
    };

    return config;
  }

  /**
   * Loga a configuração atual (sem expor valores sensíveis)
   */
  logConfiguration() {
    const config = this.getConfigInfo();
    
    logger.info('Environment configuration loaded', {
      type: 'configuration',
      config
    });

    // Log de variáveis sensíveis (apenas presença, não valor)
    const sensitiveStatus = {};
    for (const varName of this.sensitiveVars) {
      sensitiveStatus[varName] = process.env[varName] ? 'configured' : 'not configured';
    }
    
    logger.debug('Sensitive variables status', {
      type: 'configuration',
      sensitive: sensitiveStatus
    });
  }

  /**
   * Valida e loga a configuração no startup
   * @returns {boolean} true se válido, false caso contrário
   */
  validateAndLog() {
    logger.info('Validating environment configuration...');
    
    const result = this.validate();
    
    // Log de warnings
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        logger.warn(warning, { type: 'configuration' });
      }
    }
    
    // Log de erros
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        logger.error(error, { type: 'configuration' });
      }
      logger.error('Environment validation failed', {
        type: 'configuration',
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });
      return false;
    }
    
    logger.info('Environment validation successful', {
      type: 'configuration',
      warningCount: result.warnings.length
    });
    
    // Log da configuração
    this.logConfiguration();
    
    return true;
  }
}

// Instância singleton
const environmentValidator = new EnvironmentValidator();

module.exports = {
  EnvironmentValidator,
  environmentValidator
};
