const express = require('express');
const sessionValidator = require('../validators/sessionValidator');
const errorHandler = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * Rota para validação de status de sessão de usuários
 * GET /api/session/status
 * 
 * Headers necessários:
 * - Authorization: {user_token}
 * 
 * Responses:
 * - 200: Token válido, retorna dados da sessão
 * - 401: Token inválido ou expirado
 * - 400: Token não fornecido ou formato inválido
 * - 504: Timeout na WuzAPI
 * - 500: Erro interno ou WuzAPI indisponível
 */
router.get('/status', 
  // Middleware de validação de formato de token
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.token;
      
      // Validar formato do token
      if (!sessionValidator.isValidTokenFormat(token)) {
        logger.warn('Token com formato inválido na validação de sessão', {
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

      // Validar token na WuzAPI
      const validationResult = await sessionValidator.validateUserToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Token válido - retornar dados da sessão
        logger.info('Validação de sessão bem-sucedida', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          connected: validationResult.userData.connected,
          logged_in: validationResult.userData.loggedIn,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          data: {
            Connected: validationResult.userData.connected,
            LoggedIn: validationResult.userData.loggedIn,
            JID: validationResult.userData.jid
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Token inválido - usar error handler
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota de validação de sessão', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na validação de sessão',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para debug de sessão (apenas em desenvolvimento)
 * GET /api/session/debug
 * 
 * Retorna informações detalhadas sobre o estado da sessão atual
 * Apenas disponível em modo de desenvolvimento
 */
router.get('/debug', (req, res) => {
  // Verificar se está em modo de desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    logger.warn('Tentativa de acessar endpoint de debug em produção', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(404).json({
      success: false,
      error: 'Endpoint não disponível',
      code: 404,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Coletar informações detalhadas da sessão
    const sessionDebugInfo = {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session ? {
        userId: req.session.userId || null,
        userName: req.session.userName || null,
        role: req.session.role || null,
        hasToken: !!req.session.userToken,
        tokenLength: req.session.userToken?.length || 0,
        tokenPrefix: req.session.userToken ? req.session.userToken.substring(0, 8) + '...' : null,
        createdAt: req.session.createdAt || null,
        lastActivity: req.session.lastActivity || null,
        cookie: {
          maxAge: req.session.cookie?.maxAge || null,
          expires: req.session.cookie?.expires || null,
          httpOnly: req.session.cookie?.httpOnly || null,
          secure: req.session.cookie?.secure || null,
          sameSite: req.session.cookie?.sameSite || null
        }
      } : null,
      request: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        sessionSecret: process.env.SESSION_SECRET ? 'configured' : 'missing',
        wuzapiBaseUrl: process.env.WUZAPI_BASE_URL || 'not configured',
        hasAdminToken: !!process.env.WUZAPI_ADMIN_TOKEN
      }
    };

    logger.info('Session debug info requested', {
      type: 'session_debug_request',
      sessionId: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId,
      role: req.session?.role,
      ip: req.ip
    });

    return res.status(200).json({
      success: true,
      code: 200,
      data: sessionDebugInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao obter informações de debug da sessão', {
      url: req.url,
      method: req.method,
      error_message: error.message,
      error_stack: error.stack,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Erro ao obter informações de debug',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota para verificar saúde do serviço de validação de sessão
 * GET /api/session/health
 * 
 * Não requer autenticação - apenas verifica se o serviço está funcionando
 */
router.get('/health', async (req, res) => {
  try {
    const wuzapiClient = require('../utils/wuzapiClient');
    const isHealthy = await wuzapiClient.isHealthy();
    const config = wuzapiClient.getConfig();
    
    logger.info('Verificação de saúde do serviço de sessão', {
      url: req.url,
      method: req.method,
      wuzapi_healthy: isHealthy,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(200).json({
      success: true,
      code: 200,
      data: {
        service: 'session-validation',
        status: 'healthy',
        wuzapi_connection: isHealthy ? 'connected' : 'disconnected',
        wuzapi_base_url: config.baseURL,
        timeout_ms: config.timeout
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro na verificação de saúde do serviço de sessão', {
      url: req.url,
      method: req.method,
      error_message: error.message,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Erro na verificação de saúde do serviço',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota para obter informações sobre o token (sem validar na WuzAPI)
 * GET /api/session/token-info
 * 
 * Headers necessários:
 * - Authorization: {user_token}
 * 
 * Retorna informações básicas sobre o formato do token sem fazer validação externa
 */
router.get('/token-info',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  (req, res) => {
    try {
      const token = req.headers.token;
      const isValidFormat = sessionValidator.isValidTokenFormat(token);
      
      logger.info('Verificação de informações do token', {
        url: req.url,
        method: req.method,
        token_length: token ? token.length : 0,
        valid_format: isValidFormat,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json({
        success: true,
        code: 200,
        data: {
          token_provided: !!token,
          token_length: token ? token.length : 0,
          valid_format: isValidFormat,
          token_prefix: token ? token.substring(0, 8) + '...' : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Erro na verificação de informações do token', {
        url: req.url,
        method: req.method,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro na verificação de informações do token',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para conectar sessão do WhatsApp
 * POST /api/session/connect
 */
router.post('/connect',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      const response = await wuzapiClient.post('/session/connect', req.body, {
        headers: { 'token': token }
      });
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.success) {
        logger.error('Erro ao conectar sessão', {
          url: req.url,
          method: req.method,
          error: response.error,
          status: response.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(response.status || 500).json({
          success: false,
          error: response.error || 'Erro ao conectar sessão',
          code: response.status || 500,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('Sessão conectada com sucesso', {
        url: req.url,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json(response.data);
    } catch (error) {
      logger.error('Erro ao conectar sessão', {
        url: req.url,
        method: req.method,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro ao conectar sessão',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para desconectar sessão do WhatsApp
 * POST /api/session/disconnect
 */
router.post('/disconnect',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      const response = await wuzapiClient.post('/session/disconnect', {}, {
        headers: { 'token': token }
      });
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.success) {
        logger.error('Erro ao desconectar sessão', {
          url: req.url,
          method: req.method,
          error: response.error,
          status: response.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(response.status || 500).json({
          success: false,
          error: response.error || 'Erro ao desconectar sessão',
          code: response.status || 500,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('Sessão desconectada com sucesso', {
        url: req.url,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json(response.data);
    } catch (error) {
      logger.error('Erro ao desconectar sessão', {
        url: req.url,
        method: req.method,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro ao desconectar sessão',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para fazer logout da sessão do WhatsApp
 * POST /api/session/logout
 */
router.post('/logout',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      const response = await wuzapiClient.post('/session/logout', {}, {
        headers: { 'token': token }
      });
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.success) {
        logger.error('Erro ao fazer logout', {
          url: req.url,
          method: req.method,
          error: response.error,
          status: response.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(response.status || 500).json({
          success: false,
          error: response.error || 'Erro ao fazer logout',
          code: response.status || 500,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('Logout realizado com sucesso', {
        url: req.url,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json(response.data);
    } catch (error) {
      logger.error('Erro ao fazer logout', {
        url: req.url,
        method: req.method,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para obter QR Code da sessão
 * GET /api/session/qr
 */
router.get('/qr',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      const response = await wuzapiClient.get('/session/qr', {
        headers: { 'token': token }
      });
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.success) {
        logger.error('Erro ao obter QR Code', {
          url: req.url,
          method: req.method,
          error: response.error,
          status: response.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(response.status || 500).json({
          success: false,
          error: response.error || 'Erro ao obter QR Code',
          code: response.status || 500,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('QR Code obtido com sucesso', {
        url: req.url,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(200).json(response.data);
    } catch (error) {
      logger.error('Erro ao obter QR Code', {
        url: req.url,
        method: req.method,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro ao obter QR Code',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;