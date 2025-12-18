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
    const devDomain = process.env.DEV_BASE_DOMAIN || 'cortexx.local';
    
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) {
          return callback(null, true);
        }
        
        // Allow localhost variations
        const localhostPatterns = [
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/127\.0\.0\.1:\d+$/
        ];
        
        // Allow development domain subdomains (e.g., *.cortexx.local)
        const devDomainPattern = new RegExp(`^http:\\/\\/([a-z0-9-]+\\.)?${devDomain.replace('.', '\\.')}(:\\d+)?$`);
        
        const isAllowed = localhostPatterns.some(p => p.test(origin)) || devDomainPattern.test(origin);
        
        if (isAllowed) {
          callback(null, true);
        } else {
          logger.debug('CORS origin not allowed in development', { origin });
          callback(null, true); // Still allow in development for flexibility
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'token',
        'CSRF-Token',
        'X-Tenant-Subdomain' // Header para simular subdomain em desenvolvimento
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
    const baseDomain = process.env.BASE_DOMAIN || 'cortexx.online';
    let allowedOrigins = [];
    let wildcardPatterns = [];
    
    if (corsOrigins) {
      corsOrigins.split(',').map(origin => origin.trim()).forEach(origin => {
        if (origin.includes('*')) {
          // Convert wildcard to regex pattern
          // e.g., https://*.cortexx.online -> /^https:\/\/[a-z0-9-]+\.cortexx\.online$/
          const pattern = origin
            .replace(/\./g, '\\.')
            .replace(/\*/g, '[a-z0-9-]+');
          wildcardPatterns.push(new RegExp(`^${pattern}$`));
        } else {
          allowedOrigins.push(origin);
        }
      });
    }
    
    // Always allow the base domain and its subdomains
    const baseDomainPattern = new RegExp(`^https:\\/\\/([a-z0-9-]+\\.)?${baseDomain.replace('.', '\\.')}$`);
    wildcardPatterns.push(baseDomainPattern);

    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) {
          return callback(null, true);
        }
        
        // Check exact matches
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Check wildcard patterns
        const matchesWildcard = wildcardPatterns.some(pattern => pattern.test(origin));
        if (matchesWildcard) {
          return callback(null, true);
        }
        
        logger.warn('CORS origin blocked in production', { origin, allowedOrigins });
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'token',
        'CSRF-Token',
        'X-Tenant-Subdomain'
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