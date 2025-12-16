const { logger } = require('../utils/logger');

/**
 * Middleware de tratamento de erros para o WUZAPI Manager
 * Centraliza o tratamento de erros e padroniza respostas de erro
 */
class ErrorHandler {

  /**
   * Middleware principal de tratamento de erros do Express
   * @param {Error} err - Erro capturado
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  handleError(err, req, res, next) {
    // Log do erro
    logger.error('Erro não tratado capturado pelo middleware', {
      error_message: err.message,
      error_stack: err.stack,
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    // Determinar código de status e mensagem
    const errorResponse = this._buildErrorResponse(err);
    
    // Enviar resposta de erro
    res.status(errorResponse.code).json({
      success: false,
      error: errorResponse.message,
      code: errorResponse.code,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trata erros de validação de token
   * @param {Object} validationResult - Resultado da validação que falhou
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   */
  handleValidationError(validationResult, req, res) {
    const errorCode = this._getValidationErrorCode(validationResult.error);
    
    logger.warn('Erro de validação de token', {
      error_message: validationResult.error,
      url: req.url,
      method: req.method,
      token_provided: !!req.headers.authorization,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(errorCode).json({
      success: false,
      error: validationResult.error,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trata erros de token ausente
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   */
  handleMissingToken(req, res) {
    logger.warn('Tentativa de acesso sem token de autorização', {
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(401).json({
      success: false,
      error: 'Token de autorização necessário',
      code: 401,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trata erros de timeout da WuzAPI
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   */
  handleTimeout(req, res) {
    logger.error('Timeout na comunicação com WuzAPI', {
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(504).json({
      success: false,
      error: 'Timeout na validação - tente novamente em alguns segundos',
      code: 504,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trata erros de serviço indisponível
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   */
  handleServiceUnavailable(req, res) {
    logger.error('Serviço WuzAPI indisponível', {
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Serviço de validação temporariamente indisponível',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Middleware para capturar requisições para rotas não encontradas
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   */
  handleNotFound(req, res) {
    logger.warn('Rota não encontrada', {
      url: req.url,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(404).json({
      success: false,
      error: 'Rota não encontrada',
      code: 404,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Constrói resposta de erro padronizada
   * @param {Error} err - Erro capturado
   * @returns {Object} Objeto com código e mensagem de erro
   * @private
   */
  _buildErrorResponse(err) {
    // Erros conhecidos
    if (err.name === 'ValidationError') {
      return { code: 400, message: 'Dados de entrada inválidos' };
    }
    
    if (err.name === 'UnauthorizedError') {
      return { code: 401, message: 'Não autorizado' };
    }
    
    if (err.code === 'ECONNREFUSED') {
      return { code: 500, message: 'Serviço temporariamente indisponível' };
    }
    
    if (err.code === 'ECONNABORTED') {
      return { code: 504, message: 'Timeout na requisição' };
    }

    // Erro genérico
    return { 
      code: 500, 
      message: process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : err.message 
    };
  }

  /**
   * Determina código de erro baseado na mensagem de validação
   * @param {string} errorMessage - Mensagem de erro da validação
   * @returns {number} Código de status HTTP apropriado
   * @private
   */
  _getValidationErrorCode(errorMessage) {
    if (!errorMessage) return 500;
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('inválido') || message.includes('expirado')) {
      return 401;
    }
    
    if (message.includes('necessário') || message.includes('obrigatório')) {
      return 400;
    }
    
    if (message.includes('timeout')) {
      return 504;
    }
    
    if (message.includes('indisponível') || message.includes('conectar')) {
      return 500;
    }
    
    if (message.includes('permiss')) {
      return 403;
    }
    
    return 400; // Default para bad request
  }

  /**
   * Middleware para log de requisições (para debugging)
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  logRequest(req, res, next) {
    const startTime = Date.now();
    
    // Override do método res.end para capturar o status code
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      logger.access(req, res, responseTime);
      
      originalEnd.apply(this, args);
    };
    
    next();
  }

  /**
   * Middleware para validar formato básico de token
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  validateTokenFormat(req, res, next) {
    const token = req.headers.token;
    
    if (!token) {
      return this.handleMissingToken(req, res);
    }
    
    // Validação básica de formato
    if (typeof token !== 'string' || token.length < 8 || token.length > 256) {
      logger.warn('Token com formato inválido', {
        url: req.url,
        method: req.method,
        token_length: token ? token.length : 0,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: 'Formato de token inválido',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  }

  /**
   * Middleware para validar formato básico de token de admin
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} res - Objeto de resposta do Express
   * @param {Function} next - Função next do Express
   */
  validateAdminTokenFormat(req, res, next) {
    const token = req.headers.authorization;
    const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
    
    if (!token) {
      return this.handleMissingToken(req, res);
    }
    
    // Validação básica de formato
    if (typeof token !== 'string' || token.length < 8 || token.length > 256) {
      logger.warn('Token de admin com formato inválido', {
        url: req.url,
        method: req.method,
        token_length: token ? token.length : 0,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: 'Formato de token inválido',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validar se o token corresponde ao token admin
    if (token !== adminToken) {
      logger.warn('Token de admin inválido', {
        url: req.url,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: 'Token de administrador inválido',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  }
}

module.exports = new ErrorHandler();