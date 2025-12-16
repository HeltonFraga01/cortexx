const cors = require('cors');
const { logger } = require('../utils/logger');

/**
 * Configurador de CORS para o WUZAPI Manager
 * Gerencia políticas de CORS baseadas no ambiente (desenvolvimento/produção)
 */
class CorsHandler {

  /**
   * Obtém configuração de CORS baseada no ambiente
   * @returns {Object} Configuração do CORS
   */
  getCorsConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const corsOrigins = process.env.CORS_ORIGINS;
    
    if (isProduction) {
      return this._getProductionConfig(corsOrigins);
    } else {
      return this._getDevelopmentConfig();
    }
  }

  /**
   * Cria middleware CORS configurado
   * @returns {Function} Middleware CORS do Express
   */
  createCorsMiddleware() {
    const config = this.getCorsConfig();
    
    logger.info('Configurando CORS', {
      environment: process.env.NODE_ENV || 'development',
      origins: Array.isArray(config.origin) ? config.origin : [config.origin],
      credentials: config.credentials
    });

    return cors(config);
  }

  /**
   * Middleware customizado para log de requisições CORS
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  logCorsRequests(req, res, next) {
    const origin = req.get('Origin');
    const method = req.method;
    
    // Log apenas para requisições cross-origin
    if (origin && method === 'OPTIONS') {
      logger.info('Requisição CORS preflight', {
        origin: origin,
        method: req.get('Access-Control-Request-Method'),
        headers: req.get('Access-Control-Request-Headers'),
        user_agent: req.get('User-Agent')
      });
    } else if (origin) {
      logger.debug('Requisição cross-origin', {
        origin: origin,
        method: method,
        url: req.url
      });
    }
    
    next();
  }

  /**
   * Configuração de CORS para ambiente de desenvolvimento
   * @returns {Object} Configuração permissiva para desenvolvimento
   * @private
   */
  _getDevelopmentConfig() {
    return {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:4173',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:8081',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:8081'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'token',
        'CSRF-Token' // Header para proteção CSRF
      ],
      credentials: true,
      optionsSuccessStatus: 200, // Para suporte a browsers legados
      preflightContinue: false
    };
  }

  /**
   * Configuração de CORS para ambiente de produção
   * @param {string} corsOrigins - Origens permitidas (separadas por vírgula)
   * @returns {Object} Configuração restritiva para produção
   * @private
   */
  _getProductionConfig(corsOrigins) {
    let allowedOrigins = [];
    
    if (corsOrigins) {
      allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
    }
    
    // Se não há origens configuradas, bloquear todas as requisições cross-origin
    if (allowedOrigins.length === 0) {
      logger.warn('Nenhuma origem CORS configurada para produção - bloqueando requisições cross-origin');
      allowedOrigins = false;
    }

    return {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'token',
        'CSRF-Token' // Header para proteção CSRF
      ],
      credentials: true,
      optionsSuccessStatus: 200,
      preflightContinue: false
    };
  }

  /**
   * Middleware para validar origem em produção
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  validateOrigin(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    const origin = req.get('Origin');
    
    if (!isProduction) {
      return next(); // Em desenvolvimento, permitir tudo
    }
    
    if (!origin) {
      return next(); // Requisições same-origin não têm header Origin
    }
    
    const corsOrigins = process.env.CORS_ORIGINS;
    if (!corsOrigins) {
      logger.warn('Requisição cross-origin bloqueada - nenhuma origem configurada', {
        origin: origin,
        url: req.url,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        error: 'Origem não permitida',
        code: 403
      });
    }
    
    const allowedOrigins = corsOrigins.split(',').map(o => o.trim()).filter(o => o.length > 0);
    
    if (!allowedOrigins.includes(origin)) {
      logger.warn('Requisição cross-origin bloqueada - origem não permitida', {
        origin: origin,
        allowed_origins: allowedOrigins,
        url: req.url,
        method: req.method,
        ip: req.ip
      });
      
      // Set retry-after header for rate-limited scenarios
      res.set('Retry-After', '60');
      
      return res.status(403).json({
        success: false,
        error: 'Origem não permitida',
        code: 'CORS_ORIGIN_NOT_ALLOWED'
      });
    }
    
    next();
  }

  /**
   * Middleware para tratar requisições OPTIONS manualmente (se necessário)
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  handlePreflight(req, res, next) {
    if (req.method === 'OPTIONS') {
      const config = this.getCorsConfig();
      
      // Definir headers CORS manualmente
      if (config.origin && Array.isArray(config.origin)) {
        const origin = req.get('Origin');
        if (origin && config.origin.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
        }
      } else if (config.origin) {
        res.header('Access-Control-Allow-Origin', config.origin);
      }
      
      res.header('Access-Control-Allow-Methods', config.methods.join(', '));
      res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      
      if (config.credentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      
      res.header('Access-Control-Max-Age', '86400'); // 24 horas
      
      return res.status(200).end();
    }
    
    next();
  }

  /**
   * Obtém informações sobre a configuração atual de CORS
   * @returns {Object} Informações de configuração
   */
  getConfigInfo() {
    const config = this.getCorsConfig();
    
    return {
      environment: process.env.NODE_ENV || 'development',
      origins: Array.isArray(config.origin) ? config.origin : [config.origin],
      methods: config.methods,
      allowedHeaders: config.allowedHeaders,
      credentials: config.credentials,
      configured_origins: process.env.CORS_ORIGINS || 'not set'
    };
  }
}

module.exports = new CorsHandler();