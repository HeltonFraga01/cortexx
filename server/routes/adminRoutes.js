const express = require('express');
const adminValidator = require('../validators/adminValidator');
const errorHandler = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const AutomationService = require('../services/AutomationService');
const AuditLogService = require('../services/AuditLogService');

const router = express.Router();

// Services will be initialized lazily using app.locals.db
let automationService = null;
let auditLogService = null;

// Helper function to get automation service
function getAutomationService(req) {
  if (!automationService) {
    const db = req.app.locals.db;
    if (db) {
      automationService = new AutomationService(db);
    }
  }
  return automationService;
}

// Helper function to get audit log service
function getAuditLogService(req) {
  if (!auditLogService) {
    const db = req.app.locals.db;
    if (db) {
      auditLogService = new AuditLogService(db);
    }
  }
  return auditLogService;
}

/**
 * Rota para listar usuários (validação administrativa)
 * GET /api/admin/users
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Query parameters opcionais:
 * - connected_only: true/false - filtrar apenas usuários conectados
 * - logged_in_only: true/false - filtrar apenas usuários logados
 * - include_stats: true/false - incluir estatísticas dos usuários
 * 
 * Responses:
 * - 200: Token administrativo válido, retorna lista de usuários
 * - 401: Token administrativo inválido ou expirado
 * - 403: Token não possui permissões administrativas
 * - 400: Token não fornecido ou formato inválido
 * - 504: Timeout na WuzAPI
 * - 500: Erro interno ou WuzAPI indisponível
 */
router.get('/users',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      const connectedOnly = req.query.connected_only === 'true';
      const loggedInOnly = req.query.logged_in_only === 'true';
      const includeStats = req.query.include_stats === 'true';
      
      // Validar formato do token administrativo
      if (!adminValidator.isValidTokenFormat(token)) {
        logger.warn('Token administrativo com formato inválido', {
          url: req.url,
          method: req.method,
          token_length: token ? token.length : 0,
          token_source: req.session.userToken ? 'session' : 'env',
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Formato de token administrativo inválido',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Token administrativo válido - processar e retornar dados
        let users = validationResult.users;
        
        // Aplicar filtros se solicitados
        if (connectedOnly) {
          users = adminValidator.filterUsersByConnection(users, true);
        }
        
        if (loggedInOnly) {
          users = adminValidator.filterUsersByLogin(users, true);
        }
        
        // Preparar resposta
        const responseData = {
          ...validationResult.rawData, // Dados originais da WuzAPI
          filtered_data: users
        };
        
        // Incluir estatísticas se solicitado
        if (includeStats) {
          responseData.stats = adminValidator.getUserStats(validationResult.users);
          responseData.filtered_stats = adminValidator.getUserStats(users);
        }
        
        logger.info('Validação administrativa bem-sucedida', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          total_users: validationResult.users.length,
          filtered_users: users.length,
          connected_only: connectedOnly,
          logged_in_only: loggedInOnly,
          include_stats: includeStats,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json(responseData);
      } else {
        // Token administrativo inválido - usar error handler
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na rota de validação administrativa', {
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
        error: 'Erro interno na validação administrativa',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para obter estatísticas de usuários
 * GET /api/admin/stats
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Retorna apenas estatísticas agregadas dos usuários
 */
router.get('/stats',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      
      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Gerar estatísticas
        const stats = adminValidator.getUserStats(validationResult.users);
        
        logger.info('Estatísticas administrativas obtidas', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          total_users: stats.total,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } else {
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na obtenção de estatísticas administrativas', {
        url: req.url,
        method: req.method,
        response_time_ms: responseTime,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na obtenção de estatísticas',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para obter estatísticas do dashboard administrativo
 * GET /api/admin/dashboard-stats
 * 
 * Retorna estatísticas agregadas do sistema incluindo:
 * - Status do sistema
 * - Total de usuários, conectados e logados
 * - Informações de memória e uptime
 * - Lista de usuários (primeiros 10)
 * 
 * Responses:
 * - 200: Estatísticas retornadas com sucesso
 * - 401: Token administrativo inválido ou expirado
 * - 503: Serviço WuzAPI temporariamente indisponível
 * - 500: Erro interno do servidor
 */
router.get('/dashboard-stats',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      
      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        const users = validationResult.users;
        
        // Calcular estatísticas
        const connectedUsers = users.filter(u => u.connected).length;
        const loggedInUsers = users.filter(u => u.loggedIn).length;
        
        // Obter informações do sistema
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        // Formatar uptime em formato legível
        const formatUptime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          
          if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
          } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
          } else {
            return `${secs}s`;
          }
        };
        
        // Converter bytes para MB
        const bytesToMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
        
        // Preparar resposta com estatísticas
        const dashboardStats = {
          systemStatus: 'ok',
          uptime: formatUptime(uptime),
          version: '1.0.0',
          totalUsers: users.length,
          connectedUsers: connectedUsers,
          loggedInUsers: loggedInUsers,
          activeConnections: connectedUsers,
          memoryStats: {
            alloc_mb: bytesToMB(memoryUsage.heapUsed),
            sys_mb: bytesToMB(memoryUsage.rss),
            total_alloc_mb: bytesToMB(memoryUsage.heapTotal),
            num_gc: 0, // Node.js não expõe contagem de GC facilmente
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            rss: memoryUsage.rss,
            external: memoryUsage.external
          },
          goroutines: 0, // Node.js não usa goroutines
          users: users.slice(0, 10) // Primeiros 10 usuários
        };
        
        logger.info('Dashboard stats obtidas com sucesso', {
          url: req.url,
          method: req.method,
          response_time_ms: responseTime,
          total_users: users.length,
          connected_users: connectedUsers,
          logged_in_users: loggedInUsers,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          data: dashboardStats,
          timestamp: new Date().toISOString()
        });
      } else {
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro ao buscar dashboard stats', {
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
        error: 'Erro ao buscar estatísticas do sistema',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para verificar saúde do serviço administrativo
 * GET /api/admin/health
 * 
 * Não requer autenticação - apenas verifica se o serviço está funcionando
 */
router.get('/health', async (req, res) => {
  try {
    const wuzapiClient = require('../utils/wuzapiClient');
    const isHealthy = await wuzapiClient.isHealthy();
    const config = wuzapiClient.getConfig();
    
    logger.info('Verificação de saúde do serviço administrativo', {
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
        service: 'admin-validation',
        status: 'healthy',
        wuzapi_connection: isHealthy ? 'connected' : 'disconnected',
        wuzapi_base_url: config.baseURL,
        timeout_ms: config.timeout
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro na verificação de saúde do serviço administrativo', {
      url: req.url,
      method: req.method,
      error_message: error.message,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Erro na verificação de saúde do serviço administrativo',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota para diagnóstico do S3 Storage
 * GET /api/admin/s3/status
 * 
 * Não requer autenticação - apenas verifica status do S3
 */
router.get('/s3/status', async (req, res) => {
  try {
    const { s3Service } = require('../services/S3Service');
    
    const status = {
      enabled: s3Service.isEnabled(),
      config: {
        endpoint: process.env.S3_ENDPOINT || null,
        region: process.env.S3_REGION || null,
        bucket: process.env.S3_BUCKET || null,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        maxUploadSize: parseInt(process.env.S3_UPLOAD_MAX_SIZE) || 52428800
      }
    };

    // Se habilitado, tentar listar arquivos para verificar conexão
    if (status.enabled) {
      try {
        const testList = await s3Service.listUserFiles('_health_check', { maxKeys: 1 });
        status.connectionTest = 'success';
        status.message = 'S3 connection verified';
      } catch (listError) {
        status.connectionTest = 'failed';
        status.connectionError = listError.message;
      }
    }

    logger.info('S3 status check', { status });

    return res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking S3 status', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota para testar upload S3
 * POST /api/admin/s3/test
 * 
 * Faz upload de um arquivo de teste e depois deleta
 */
router.post('/s3/test', async (req, res) => {
  try {
    const { s3Service } = require('../services/S3Service');
    
    if (!s3Service.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'S3 storage is not enabled',
        config: {
          S3_ENABLED: process.env.S3_ENABLED,
          S3_ENDPOINT: process.env.S3_ENDPOINT ? 'set' : 'not set',
          S3_BUCKET: process.env.S3_BUCKET ? 'set' : 'not set',
          S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? 'set' : 'not set',
          S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? 'set' : 'not set'
        }
      });
    }

    // Upload de arquivo de teste
    const testContent = Buffer.from(`S3 Test at ${new Date().toISOString()}`);
    const uploadResult = await s3Service.upload({
      body: testContent,
      originalName: 'health-check-test.txt',
      contentType: 'text/plain',
      userId: '_health_check'
    });

    // Verificar se existe
    const exists = await s3Service.exists(uploadResult.key);

    // Deletar arquivo de teste
    await s3Service.delete(uploadResult.key);

    logger.info('S3 test completed successfully', { key: uploadResult.key });

    return res.status(200).json({
      success: true,
      message: 'S3 test completed successfully',
      data: {
        uploadedKey: uploadResult.key,
        uploadedUrl: uploadResult.url,
        fileExisted: exists,
        fileDeleted: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('S3 test failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rota para obter informações sobre usuário específico
 * GET /api/admin/users/:userId
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Parâmetros:
 * - userId: ID do usuário para buscar
 */
router.get('/users/:userId',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      const userId = req.params.userId;
      
      if (!userId || userId.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'ID do usuário é obrigatório',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Buscar usuário específico
        const user = validationResult.users.find(u => u.id === userId);
        
        if (!user) {
          logger.warn('Usuário não encontrado', {
            url: req.url,
            method: req.method,
            user_id: userId,
            response_time_ms: responseTime,
            user_agent: req.get('User-Agent'),
            ip: req.ip
          });
          
          return res.status(404).json({
            success: false,
            error: 'Usuário não encontrado',
            code: 404,
            timestamp: new Date().toISOString()
          });
        }
        
        logger.info('Usuário específico obtido com sucesso', {
          url: req.url,
          method: req.method,
          user_id: userId,
          response_time_ms: responseTime,
          user_connected: user.connected,
          user_logged_in: user.loggedIn,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          data: user,
          timestamp: new Date().toISOString()
        });
      } else {
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na obtenção de usuário específico', {
        url: req.url,
        method: req.method,
        user_id: req.params.userId,
        response_time_ms: responseTime,
        error_message: error.message,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na obtenção do usuário',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para criar novo usuário
 * POST /api/admin/users
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Body (JSON):
 * - name: string (obrigatório) - Nome da instância
 * - token: string (obrigatório) - Token único do usuário
 * - webhook: string (opcional) - URL do webhook
 * - events: string (opcional) - Eventos separados por vírgula ou "All"
 * - proxyConfig: object (opcional) - Configurações de proxy
 * - s3Config: object (opcional) - Configurações de S3
 * 
 * Responses:
 * - 201: Usuário criado com sucesso
 * - 400: Dados inválidos ou token mal formatado
 * - 401: Token administrativo inválido ou expirado
 * - 403: Token não possui permissões administrativas
 * - 409: Usuário com este token já existe
 * - 502: Erro na comunicação com WuzAPI
 * - 500: Erro interno do servidor
 */
router.post('/users',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      const userData = req.body;
      
      // Validação básica dos dados obrigatórios
      if (!userData.name || !userData.token) {
        logger.warn('Dados obrigatórios ausentes para criação de usuário', {
          url: req.url,
          method: req.method,
          has_name: !!userData.name,
          has_token: !!userData.token,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Nome e token são obrigatórios',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar formato do token administrativo
      if (!adminValidator.isValidTokenFormat(token)) {
        logger.warn('Token administrativo com formato inválido para criação de usuário', {
          url: req.url,
          method: req.method,
          user_name: userData.name,
          token_length: token ? token.length : 0,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Formato de token administrativo inválido',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (!validationResult.isValid) {
        return errorHandler.handleValidationError(validationResult, req, res);
      }

      logger.info('Iniciando criação de usuário', {
        url: req.url,
        method: req.method,
        user_name: userData.name,
        user_token: userData.token.substring(0, 8) + '...',
        has_webhook: !!userData.webhook,
        has_events: !!userData.events,
        response_time_ms: responseTime,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Chamar WuzAPI para criar usuário
      const wuzapiClient = require('../utils/wuzapiClient');
      const createResult = await wuzapiClient.createUser(userData, token);
      const finalResponseTime = Date.now() - startTime;

      if (createResult.success) {
        logger.info('Usuário criado com sucesso', {
          url: req.url,
          method: req.method,
          user_name: userData.name,
          user_token: userData.token.substring(0, 8) + '...',
          response_time_ms: finalResponseTime,
          wuzapi_status: createResult.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        // Apply automations to new user (non-blocking, don't fail user creation)
        let automationResults = null;
        try {
          const autoService = getAutomationService(req);
          const auditService = getAuditLogService(req);
          if (autoService && auditService) {
            automationResults = await autoService.applyAutomationsToNewUser(
              userData.token,
              auditService
            );
            
            logger.info('Automations applied to new user', {
              user_token: userData.token.substring(0, 8) + '...',
              results: automationResults
            });
          }
        } catch (automationError) {
          // Log error but don't fail user creation
          logger.error('Failed to apply automations to new user', {
            user_token: userData.token.substring(0, 8) + '...',
            error: automationError.message
          });
        }

        return res.status(201).json({
          success: true,
          code: 201,
          data: createResult.data,
          message: 'Usuário criado com sucesso',
          automations: automationResults,
          timestamp: new Date().toISOString()
        });
      } else {
        // Tratar diferentes tipos de erro da WuzAPI
        let statusCode = 502; // Bad Gateway por padrão
        let errorMessage = 'Erro na comunicação com WuzAPI';

        if (createResult.status === 400) {
          statusCode = 400;
          errorMessage = 'Dados inválidos fornecidos';
        } else if (createResult.status === 401 || createResult.status === 403) {
          statusCode = createResult.status;
          errorMessage = 'Token administrativo inválido ou sem permissões';
        } else if (createResult.status === 409) {
          statusCode = 409;
          errorMessage = 'Usuário com este token já existe';
        } else if (createResult.code === 'TIMEOUT') {
          statusCode = 504;
          errorMessage = 'Timeout na comunicação com WuzAPI';
        } else if (createResult.code === 'CONNECTION_ERROR') {
          statusCode = 502;
          errorMessage = 'Não foi possível conectar com a WuzAPI';
        }

        logger.error('Erro na criação de usuário via WuzAPI', {
          url: req.url,
          method: req.method,
          user_name: userData.name,
          user_token: userData.token.substring(0, 8) + '...',
          response_time_ms: finalResponseTime,
          wuzapi_status: createResult.status,
          wuzapi_error: createResult.error,
          wuzapi_code: createResult.code,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          code: statusCode,
          details: createResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na criação de usuário', {
        url: req.url,
        method: req.method,
        user_name: req.body?.name,
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na criação do usuário',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para remover usuário do banco de dados (mantém sessão ativa)
 * DELETE /api/admin/users/:userId
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Parâmetros:
 * - userId: ID do usuário a ser removido
 * 
 * Responses:
 * - 200: Usuário removido com sucesso
 * - 400: ID do usuário inválido ou token mal formatado
 * - 401: Token administrativo inválido ou expirado
 * - 403: Token não possui permissões administrativas
 * - 404: Usuário não encontrado
 * - 502: Erro na comunicação com WuzAPI
 * - 500: Erro interno do servidor
 */
router.delete('/users/:userId',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      const userId = req.params.userId;
      
      // Validação básica do userId
      if (!userId || userId.trim() === '') {
        logger.warn('ID do usuário inválido para deleção', {
          url: req.url,
          method: req.method,
          user_id: userId,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'ID do usuário é obrigatório',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar formato do token administrativo
      if (!adminValidator.isValidTokenFormat(token)) {
        logger.warn('Token administrativo com formato inválido para deleção', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'database_only',
          token_length: token ? token.length : 0,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Formato de token administrativo inválido',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (!validationResult.isValid) {
        return errorHandler.handleValidationError(validationResult, req, res);
      }

      logger.info('Iniciando deleção de usuário', {
        url: req.url,
        method: req.method,
        user_id: userId,
        deletion_type: 'database_only',
        response_time_ms: responseTime,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Chamar WuzAPI para deletar usuário
      const wuzapiClient = require('../utils/wuzapiClient');
      const deleteResult = await wuzapiClient.deleteUser(userId, token);
      const finalResponseTime = Date.now() - startTime;

      if (deleteResult.success) {
        logger.info('Usuário deletado com sucesso', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'database_only',
          response_time_ms: finalResponseTime,
          wuzapi_status: deleteResult.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          data: {
            message: 'Usuário removido do banco de dados com sucesso',
            userId: userId,
            deletionType: 'database_only',
            ...deleteResult.data
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Tratar diferentes tipos de erro da WuzAPI
        let statusCode = 502; // Bad Gateway por padrão
        let errorMessage = 'Erro na comunicação com WuzAPI';

        if (deleteResult.status === 404) {
          statusCode = 404;
          errorMessage = 'Usuário não encontrado';
        } else if (deleteResult.status === 401 || deleteResult.status === 403) {
          statusCode = deleteResult.status;
          errorMessage = 'Token administrativo inválido ou sem permissões';
        } else if (deleteResult.code === 'TIMEOUT') {
          statusCode = 504;
          errorMessage = 'Timeout na comunicação com WuzAPI';
        } else if (deleteResult.code === 'CONNECTION_ERROR') {
          statusCode = 502;
          errorMessage = 'Não foi possível conectar com a WuzAPI';
        }

        logger.error('Erro na deleção de usuário via WuzAPI', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'database_only',
          response_time_ms: finalResponseTime,
          wuzapi_status: deleteResult.status,
          wuzapi_error: deleteResult.error,
          wuzapi_code: deleteResult.code,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          code: statusCode,
          details: deleteResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na deleção de usuário', {
        url: req.url,
        method: req.method,
        user_id: req.params.userId,
        deletion_type: 'database_only',
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na deleção do usuário',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Rota para remover usuário completamente (incluindo sessões ativas)
 * DELETE /api/admin/users/:userId/full
 * 
 * Headers necessários:
 * - Authorization: {admin_token}
 * 
 * Parâmetros:
 * - userId: ID do usuário a ser removido completamente
 * 
 * Responses:
 * - 200: Usuário removido completamente com sucesso
 * - 400: ID do usuário inválido ou token mal formatado
 * - 401: Token administrativo inválido ou expirado
 * - 403: Token não possui permissões administrativas
 * - 404: Usuário não encontrado
 * - 502: Erro na comunicação com WuzAPI
 * - 500: Erro interno do servidor
 */
router.delete('/users/:userId/full',
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verificar explicitamente se o token está na sessão
      if (!req.session.userToken) {
        logger.error('Token missing from session', {
          type: 'token_missing',
          sessionId: req.sessionID,
          userId: req.session.userId,
          role: req.session.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          success: false,
          error: 'Token de administrador não encontrado na sessão',
          code: 'TOKEN_MISSING',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter token da sessão (já validado pelo middleware requireAdmin)
      const token = req.session.userToken;
      const userId = req.params.userId;
      
      // Validação básica do userId
      if (!userId || userId.trim() === '') {
        logger.warn('ID do usuário inválido para deleção completa', {
          url: req.url,
          method: req.method,
          user_id: userId,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'ID do usuário é obrigatório',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar formato do token administrativo
      if (!adminValidator.isValidTokenFormat(token)) {
        logger.warn('Token administrativo com formato inválido para deleção completa', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'full',
          token_length: token ? token.length : 0,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(400).json({
          success: false,
          error: 'Formato de token administrativo inválido',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Validar token administrativo na WuzAPI
      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (!validationResult.isValid) {
        return errorHandler.handleValidationError(validationResult, req, res);
      }

      logger.info('Iniciando deleção completa de usuário', {
        url: req.url,
        method: req.method,
        user_id: userId,
        deletion_type: 'full',
        response_time_ms: responseTime,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      // Chamar WuzAPI para deletar usuário completamente
      const wuzapiClient = require('../utils/wuzapiClient');
      const deleteResult = await wuzapiClient.deleteUserFull(userId, token);
      const finalResponseTime = Date.now() - startTime;

      if (deleteResult.success) {
        logger.info('Usuário deletado completamente com sucesso', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'full',
          response_time_ms: finalResponseTime,
          wuzapi_status: deleteResult.status,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          code: 200,
          data: {
            message: 'Usuário removido completamente com sucesso',
            userId: userId,
            deletionType: 'full',
            ...deleteResult.data
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Tratar diferentes tipos de erro da WuzAPI
        let statusCode = 502; // Bad Gateway por padrão
        let errorMessage = 'Erro na comunicação com WuzAPI';

        if (deleteResult.status === 404) {
          statusCode = 404;
          errorMessage = 'Usuário não encontrado';
        } else if (deleteResult.status === 401 || deleteResult.status === 403) {
          statusCode = deleteResult.status;
          errorMessage = 'Token administrativo inválido ou sem permissões';
        } else if (deleteResult.code === 'TIMEOUT') {
          statusCode = 504;
          errorMessage = 'Timeout na comunicação com WuzAPI';
        } else if (deleteResult.code === 'CONNECTION_ERROR') {
          statusCode = 502;
          errorMessage = 'Não foi possível conectar com a WuzAPI';
        }

        logger.error('Erro na deleção completa de usuário via WuzAPI', {
          url: req.url,
          method: req.method,
          user_id: userId,
          deletion_type: 'full',
          response_time_ms: finalResponseTime,
          wuzapi_status: deleteResult.status,
          wuzapi_error: deleteResult.error,
          wuzapi_code: deleteResult.code,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });

        return res.status(statusCode).json({
          success: false,
          error: errorMessage,
          code: statusCode,
          details: deleteResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na deleção completa de usuário', {
        url: req.url,
        method: req.method,
        user_id: req.params.userId,
        deletion_type: 'full',
        response_time_ms: responseTime,
        error_message: error.message,
        error_stack: error.stack,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno na deleção completa do usuário',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;