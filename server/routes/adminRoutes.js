const express = require('express');
const adminValidator = require('../validators/adminValidator');
const errorHandler = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const AutomationService = require('../services/AutomationService');
const AuditLogService = require('../services/AuditLogService');
const supabaseService = require('../services/SupabaseService');
const { sanitizeUsersArray, warnIfUnsanitized } = require('../utils/sanitizeResponse');

const router = express.Router();

// Services initialized at module level (use SupabaseService internally)
const automationService = new AutomationService();
const auditLogService = new AuditLogService();

/**
 * Helper function to get the best available WUZAPI admin token
 * Priority: 1) Environment token, 2) Session token
 * This ensures admin users logged via agent credentials can still access WUZAPI
 * @param {Object} req - Express request object
 * @returns {string|null} The WUZAPI admin token or null if not available
 */
function getWuzapiAdminToken(req) {
  const envToken = process.env.WUZAPI_ADMIN_TOKEN;
  const sessionToken = req.session?.userToken;
  
  // Prefer environment token as it's more reliable
  const token = envToken || sessionToken;
  
  logger.debug('WUZAPI token selection', {
    hasEnvToken: !!envToken,
    hasSessionToken: !!sessionToken,
    usingEnvToken: !!envToken,
    isAgentLogin: !!req.session?.agentRole
  });
  
  return token;
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
      const connectedOnly = req.query.connected_only === 'true';
      const loggedInOnly = req.query.logged_in_only === 'true';
      const includeStats = req.query.include_stats === 'true';
      
      if (!token) {
        return res.status(200).json({
          success: true,
          code: 200,
          data: [],
          filtered_data: [],
          message: 'WUZAPI token não configurado',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validar formato do token administrativo
      if (!adminValidator.isValidTokenFormat(token)) {
        logger.warn('Token administrativo com formato inválido', {
          url: req.url,
          method: req.method,
          token_length: token ? token.length : 0,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        });
        
        return res.status(200).json({
          success: true,
          code: 200,
          data: [],
          filtered_data: [],
          message: 'Formato de token WUZAPI inválido',
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
      
      if (!token) {
        return res.status(200).json({
          success: true,
          code: 200,
          data: { total: 0, connected: 0, loggedIn: 0, withWebhook: 0, connectionRate: 0, loginRate: 0 },
          message: 'WUZAPI token não configurado',
          timestamp: new Date().toISOString()
        });
      }
      
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
        // Return empty stats instead of error
        return res.status(200).json({
          success: true,
          code: 200,
          data: { total: 0, connected: 0, loggedIn: 0, withWebhook: 0, connectionRate: 0, loginRate: 0 },
          message: validationResult.error || 'Token WUZAPI inválido',
          timestamp: new Date().toISOString()
        });
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

      return res.status(200).json({
        success: true,
        code: 200,
        data: { total: 0, connected: 0, loggedIn: 0, withWebhook: 0, connectionRate: 0, loginRate: 0 },
        error: 'Erro ao conectar com WUZAPI',
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
 * - 401: Não autenticado como admin
 * - 500: Erro interno do servidor
 */
router.get('/dashboard-stats',
  async (req, res) => {
    const startTime = Date.now();
    
    // Modificado para suportar tanto sessão quanto JWT (req.user)
    // Isso permite que o frontend novo (Supabase) acesse este endpoint
    const userRole = req.session?.role || req.user?.role;
    const userId = req.session?.userId || req.user?.id;
    
    // Check for superadmin impersonation context
    // Superadmins can access admin routes when impersonating a tenant
    let isImpersonating = false;
    let impersonationTenantId = null;
    
    // Check session for impersonation
    if (req.session?.impersonation?.tenantId) {
      isImpersonating = true;
      impersonationTenantId = req.session.impersonation.tenantId;
    }
    
    // Fallback to header for cross-subdomain support
    const headerContext = req.headers['x-impersonation-context'];
    if (!isImpersonating && headerContext) {
      try {
        const parsed = JSON.parse(headerContext);
        if (parsed.tenantId && parsed.sessionId) {
          isImpersonating = true;
          impersonationTenantId = parsed.tenantId;
        }
      } catch (error) {
        logger.warn('Failed to parse X-Impersonation-Context header', {
          error: error.message
        });
      }
    }
    
    // Allow superadmin with active impersonation to access admin routes
    const isSuperadminImpersonating = userRole === 'superadmin' && isImpersonating;
    
    // Verificar se está autenticado como admin (or superadmin impersonating)
    const validAdminRoles = ['admin', 'owner', 'administrator', 'tenant_admin'];
    if (!userId || (!validAdminRoles.includes(userRole) && !isSuperadminImpersonating)) {
      logger.error('Dashboard stats access denied - Not authenticated as admin', {
        type: 'dashboard_stats_auth_failure',
        sessionId: req.sessionID,
        userId: userId,
        role: userRole,
        isImpersonating,
        impersonationTenantId,
        path: req.path,
        ip: req.ip,
        auth_method: req.user ? 'jwt' : 'session'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Não autenticado como administrador',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log superadmin impersonation access
    if (isSuperadminImpersonating) {
      logger.info('Superadmin accessing admin dashboard via impersonation', {
        superadminId: userId,
        tenantId: impersonationTenantId,
        endpoint: '/dashboard-stats'
      });
    }
    
    // Para admin logado via agente, usar o token WUZAPI do ambiente
    // O token da sessão (account.wuzapiToken) pode ser inválido
    const isAgentLogin = !!req.session?.agentRole; // Apenas disponível na sessão legacy
    const envAdminToken = process.env.WUZAPI_ADMIN_TOKEN;
    const sessionToken = req.session?.userToken;
    
    // Prioridade: 1) Token do ambiente, 2) Token da sessão
    const token = envAdminToken || sessionToken;
    
    logger.debug('Dashboard stats - token selection', {
      isAgentLogin,
      hasEnvToken: !!envAdminToken,
      hasSessionToken: !!sessionToken,
      usingEnvToken: !!envAdminToken,
      authMethod: req.user ? 'jwt' : 'session'
    });
    
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
    
    try {
      // Se não tem nenhum token WUZAPI disponível, retornar dados básicos
      if (!token) {
        logger.info('Dashboard stats - no WUZAPI token available', {
          userId: req.session.userId,
          agentRole: req.session.agentRole,
          accountId: req.session.accountId
        });
        
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        return res.status(200).json({
          success: true,
          data: {
            systemStatus: 'ok',
            uptime: formatUptime(uptime),
            version: '1.0.0',
            totalUsers: 0,
            connectedUsers: 0,
            loggedInUsers: 0,
            activeConnections: 0,
            memoryStats: {
              alloc_mb: bytesToMB(memoryUsage.heapUsed),
              sys_mb: bytesToMB(memoryUsage.rss),
              total_alloc_mb: bytesToMB(memoryUsage.heapTotal),
              num_gc: 0,
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
              rss: memoryUsage.rss,
              external: memoryUsage.external
            },
            goroutines: 0,
            users: [],
            wuzapiConfigured: false,
            message: 'WUZAPI token não configurado. Configure WUZAPI_ADMIN_TOKEN no ambiente.'
          },
          timestamp: new Date().toISOString()
        });
      }
      
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
          // SECURITY: Sanitize user data to prevent token leakage
          users: sanitizeUsersArray(users.slice(0, 10)),
          wuzapiConfigured: true
        };
        
        // Development warning for unsanitized data
        warnIfUnsanitized(dashboardStats, '/api/admin/dashboard-stats');
        
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
        // Token WUZAPI inválido - retornar dados básicos em vez de erro
        // Isso evita o loop de logout quando o token WUZAPI é inválido
        logger.warn('WUZAPI token validation failed, returning basic stats', {
          userId: req.session.userId,
          error: validationResult.error
        });
        
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        return res.status(200).json({
          success: true,
          data: {
            systemStatus: 'ok',
            uptime: formatUptime(uptime),
            version: '1.0.0',
            totalUsers: 0,
            connectedUsers: 0,
            loggedInUsers: 0,
            activeConnections: 0,
            memoryStats: {
              alloc_mb: bytesToMB(memoryUsage.heapUsed),
              sys_mb: bytesToMB(memoryUsage.rss),
              total_alloc_mb: bytesToMB(memoryUsage.heapTotal),
              num_gc: 0,
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
              rss: memoryUsage.rss,
              external: memoryUsage.external
            },
            goroutines: 0,
            users: [],
            wuzapiConfigured: false,
            error: validationResult.error || 'Token WUZAPI inválido'
          },
          timestamp: new Date().toISOString()
        });
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

      // Return success with empty data instead of error to prevent logout loop
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return res.status(200).json({
        success: true,
        data: {
          systemStatus: 'error',
          uptime: formatUptime(uptime),
          version: '1.0.0',
          totalUsers: 0,
          connectedUsers: 0,
          loggedInUsers: 0,
          activeConnections: 0,
          memoryStats: {
            alloc_mb: bytesToMB(memoryUsage.heapUsed),
            sys_mb: bytesToMB(memoryUsage.rss),
            total_alloc_mb: bytesToMB(memoryUsage.heapTotal),
            num_gc: 0,
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            rss: memoryUsage.rss,
            external: memoryUsage.external
          },
          goroutines: 0,
          users: [],
          wuzapiConfigured: false,
          error: 'Erro ao conectar com WUZAPI'
        },
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
      const userId = req.params.userId;
      
      if (!userId || userId.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'ID do usuário é obrigatório',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      if (!token) {
        return res.status(200).json({
          success: false,
          error: 'WUZAPI token não configurado',
          code: 'TOKEN_MISSING',
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
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
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'WUZAPI token não configurado. Configure WUZAPI_ADMIN_TOKEN no ambiente.',
          code: 'TOKEN_MISSING',
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
        return res.status(400).json({
          success: false,
          error: validationResult.error || 'Token WUZAPI inválido',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        });
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
          if (automationService && auditLogService) {
            automationResults = await automationService.applyAutomationsToNewUser(
              userData.token,
              auditLogService
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
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
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'WUZAPI token não configurado',
          code: 'TOKEN_MISSING',
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
        return res.status(400).json({
          success: false,
          error: validationResult.error || 'Token WUZAPI inválido',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        });
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
      // Obter token WUZAPI (prioriza env sobre sessão)
      const token = getWuzapiAdminToken(req);
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
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'WUZAPI token não configurado',
          code: 'TOKEN_MISSING',
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
        return res.status(400).json({
          success: false,
          error: validationResult.error || 'Token WUZAPI inválido',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        });
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


/**
 * Helper to get tenant ID from request context
 * @param {Object} req - Express request object
 * @returns {string|null} Tenant ID or null
 */
function getTenantIdFromRequest(req) {
  return req.context?.tenantId || req.session?.tenantId || null;
}

/**
 * Rota para listar usuários do Supabase (TENANT-SCOPED)
 * GET /api/admin/supabase/users
 * 
 * MULTI-TENANT: Filtra usuários para mostrar apenas os que pertencem ao tenant do admin
 */
router.get('/supabase/users', async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      logger.warn('Supabase users list without tenant context', {
        sessionId: req.sessionID,
        userId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }

    const { page = 1, per_page = 50, search = '' } = req.query;
    
    // Obter cliente admin do Supabase
    const supabase = supabaseService.adminClient;
    
    // Primeiro, buscar todos os user IDs que pertencem a este tenant via accounts
    const { data: tenantAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('owner_user_id')
      .eq('tenant_id', tenantId)
      .not('owner_user_id', 'is', null);

    if (accountsError) {
      logger.error('Error fetching tenant accounts', { error: accountsError.message, tenantId });
      throw accountsError;
    }

    // Extrair IDs de usuários do tenant
    const tenantUserIds = new Set(tenantAccounts?.map(a => a.owner_user_id) || []);

    // Listar usuários do Supabase Auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: parseInt(page),
      perPage: parseInt(per_page)
    });

    if (error) throw error;

    // Filtrar para mostrar apenas usuários do tenant
    let filteredUsers = users.filter(user => tenantUserIds.has(user.id));

    // Aplicar filtro de busca se houver
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.email?.toLowerCase().includes(searchLower) || 
        user.id.includes(searchLower) ||
        (user.user_metadata?.wuzapi_id === search)
      );
    }

    logger.debug('Supabase users listed', {
      tenantId,
      totalUsers: users.length,
      tenantUsers: filteredUsers.length,
      page,
      per_page
    });

    return res.status(200).json({
      success: true,
      data: filteredUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao listar usuários do Supabase', { 
      error: error.message,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para obter detalhes de um usuário do Supabase
 * GET /api/admin/supabase/users/:id
 */
router.get('/supabase/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = supabaseService.adminClient;

    const { data: { user }, error } = await supabase.auth.admin.getUserById(id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao obter usuário do Supabase', { error: error.message, id: req.params.id });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para criar usuário no Supabase
 * POST /api/admin/supabase/users
 * 
 * MULTI-TENANT: Cria o usuário no Supabase Auth E uma entrada na tabela accounts
 * para associar o usuário ao tenant do admin que está criando
 */
router.post('/supabase/users', async (req, res) => {
  try {
    const { email, password, email_confirm = true, phone, phone_confirm = true, user_metadata = {} } = req.body;
    const supabase = supabaseService.adminClient;
    
    // Get tenant ID from admin context
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      logger.warn('Supabase user creation without tenant context', {
        sessionId: req.sessionID,
        userId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios'
      });
    }

    // 1. Create user in Supabase Auth
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm,
      phone,
      phone_confirm,
      user_metadata
    });

    if (error) {
      // Check for common errors
      if (error.message?.includes('already been registered')) {
        return res.status(409).json({
          success: false,
          error: 'Este email já está registrado.'
        });
      }
      throw error;
    }

    // 2. Create account entry to associate user with tenant
    // This is required for the user to appear in tenant-scoped lists
    try {
      const accountName = email.split('@')[0]; // Use email prefix as account name
      // Generate a unique wuzapi_token (required field - NOT NULL constraint)
      const crypto = require('crypto');
      const wuzapiToken = crypto.randomBytes(32).toString('hex');
      
      // Check if account already exists for this user (in case of retry)
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id, tenant_id')
        .eq('owner_user_id', user.id)
        .single();

      if (existingAccount) {
        // Account exists but might not have tenant_id set (created by trigger)
        // Update tenant_id if it's null
        if (!existingAccount.tenant_id) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ tenant_id: tenantId })
            .eq('id', existingAccount.id);
          
          if (updateError) {
            logger.error('Failed to update tenant_id for existing account', {
              userId: user.id,
              accountId: existingAccount.id,
              tenantId,
              error: updateError.message
            });
          } else {
            logger.info('Updated tenant_id for existing account', {
              userId: user.id,
              accountId: existingAccount.id,
              tenantId
            });
          }
        } else {
          logger.info('Account already exists for user', {
            userId: user.id,
            accountId: existingAccount.id,
            tenantId
          });
        }
      } else {
        const { error: accountError } = await supabase
          .from('accounts')
          .insert({
            name: accountName,
            owner_user_id: user.id,
            tenant_id: tenantId,
            wuzapi_token: wuzapiToken,
            status: 'active'
          });

        if (accountError) {
          logger.error('Failed to create account for new user', {
            userId: user.id,
            tenantId,
            error: accountError.message
          });
          // Don't fail the request - user was created, just log the error
          // The user can be associated with tenant later
        } else {
          logger.info('Account created for new user', {
            userId: user.id,
            tenantId,
            email
          });
        }
      }
    } catch (accountErr) {
      logger.error('Exception creating account for new user', {
        userId: user.id,
        tenantId,
        error: accountErr.message
      });
    }

    return res.status(201).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao criar usuário no Supabase', { error: error.message });
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Erro interno ao criar usuário'
    });
  }
});

/**
 * Rota para atualizar usuário no Supabase
 * PUT /api/admin/supabase/users/:id
 */
router.put('/supabase/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, user_metadata, email_confirm, phone, phone_confirm } = req.body;
    const supabase = supabaseService.adminClient;

    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (user_metadata) updates.user_metadata = user_metadata;
    if (email_confirm !== undefined) updates.email_confirm = email_confirm;
    if (phone) updates.phone = phone;
    if (phone_confirm !== undefined) updates.phone_confirm = phone_confirm;

    const { data: { user }, error } = await supabase.auth.admin.updateUserById(
      id,
      updates
    );

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao atualizar usuário no Supabase', { error: error.message, id: req.params.id });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para deletar usuário no Supabase
 * DELETE /api/admin/supabase/users/:id
 */
router.delete('/supabase/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = supabaseService.adminClient;

    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Usuário deletado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao deletar usuário do Supabase', { error: error.message, id: req.params.id });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para obter dados completos de um usuário Supabase (TENANT-SCOPED)
 * GET /api/admin/supabase/users/:id/full
 * 
 * Retorna: user (auth), account, subscription com plan, quotas, inboxes, agents, bots, stats
 * MULTI-TENANT: Valida que o usuário pertence ao tenant do admin
 */
router.get('/supabase/users/:id/full', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      logger.warn('Full user data request without tenant context', {
        userId: id,
        sessionId: req.sessionID
      });
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // 1. Get Supabase Auth user
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
    if (userError || !user) {
      logger.warn('User not found in Supabase Auth', { userId: id });
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // 2. Get account and validate tenant ownership
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (accountError && accountError.code !== 'PGRST116') {
      logger.error('Error fetching account', { error: accountError.message, userId: id });
    }
    
    // If no account found for this tenant, deny access
    if (!account) {
      logger.warn('Cross-tenant access attempt blocked', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // 3. Get subscription with plan details (tenant_plans)
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*, plan:tenant_plans(*)')
      .eq('account_id', account.id)
      .single();
    
    // 4. Get all quota usage for this account
    const { data: quotaUsage } = await supabase
      .from('user_quota_usage')
      .select('*')
      .eq('account_id', account.id);
    
    // 5. Get inboxes via user_inboxes relationship
    // First get user record from users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    // Get inboxes assigned to this user via user_inboxes
    let inboxes = [];
    if (userRecord) {
      const { data: userInboxes, error: userInboxesError } = await supabase
        .from('user_inboxes')
        .select(`
          inbox:inboxes(
            id,
            account_id,
            name,
            channel_type,
            phone_number,
            status,
            wuzapi_token,
            wuzapi_user_id,
            wuzapi_connected,
            description,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userRecord.id);
      
      if (userInboxesError) {
        logger.error('Error fetching user_inboxes', { 
          error: userInboxesError.message, 
          userId: id,
          userRecordId: userRecord.id 
        });
      }
      
      // Flatten the inbox data
      inboxes = (userInboxes || [])
        .map(ui => ui.inbox)
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      logger.debug('User inboxes fetched via user_inboxes', {
        userId: id,
        userRecordId: userRecord.id,
        count: inboxes.length,
        inboxIds: inboxes.map(i => i.id)
      });
    }
    
    // Also get inboxes directly linked to account (legacy support)
    const { data: accountInboxes } = await supabase
      .from('inboxes')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    // Merge both sources, avoiding duplicates
    const inboxIds = new Set(inboxes.map(i => i.id));
    const mergedInboxes = [
      ...inboxes,
      ...(accountInboxes || []).filter(i => !inboxIds.has(i.id))
    ];
    
    logger.debug('Merged inboxes', {
      userId: id,
      userInboxesCount: inboxes.length,
      accountInboxesCount: (accountInboxes || []).length,
      mergedCount: mergedInboxes.length,
      userInboxIds: inboxes.map(i => i.id),
      accountInboxIds: (accountInboxes || []).map(i => i.id)
    });
    
    // 6. Get agents
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    // 7. Get bots
    const { data: bots } = await supabase
      .from('agent_bots')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    // 8. Get conversations count and stats
    const { data: conversations, count: conversationsCount } = await supabase
      .from('conversations')
      .select('id, status, created_at', { count: 'exact' })
      .eq('account_id', account.id);
    
    // 9. Get messages count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: messagesCount } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', (conversations || []).map(c => c.id));
    
    // 10. Get contacts count
    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id);
    
    // 11. Get campaigns
    const { data: campaigns } = await supabase
      .from('bulk_campaigns')
      .select('id, name, status, total_contacts, sent_count, failed_count, created_at')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 12. Get webhooks
    const { data: webhooks } = await supabase
      .from('outgoing_webhooks')
      .select('*')
      .eq('account_id', account.id);
    
    // 13. Get teams
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('account_id', account.id);
    
    // 14. Get labels
    const { data: labels } = await supabase
      .from('labels')
      .select('*')
      .eq('account_id', account.id);
    
    // 15. Get canned responses count
    const { count: cannedResponsesCount } = await supabase
      .from('canned_responses')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id);
    
    // 16. Get database connections
    const { data: databaseConnections } = await supabase
      .from('database_connections')
      .select('*')
      .eq('account_id', account.id);
    
    // 17. Get credit transactions (last 10)
    const { data: creditTransactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 18. Get message templates count
    const { count: templatesCount } = await supabase
      .from('message_templates')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id);
    
    // 19. Get scheduled messages count
    const { count: scheduledMessagesCount } = await supabase
      .from('scheduled_single_messages')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id)
      .eq('status', 'pending');
    
    // 20. Get audit log (last 20 actions)
    const { data: auditLog } = await supabase
      .from('audit_log')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Calculate conversation stats
    const conversationStats = {
      total: conversationsCount || 0,
      open: (conversations || []).filter(c => c.status === 'open').length,
      resolved: (conversations || []).filter(c => c.status === 'resolved').length,
      pending: (conversations || []).filter(c => c.status === 'pending').length,
      snoozed: (conversations || []).filter(c => c.status === 'snoozed').length
    };
    
    // Build quotas object from usage data
    const quotas = {};
    if (quotaUsage && quotaUsage.length > 0) {
      quotaUsage.forEach(q => {
        quotas[q.quota_key] = {
          used: q.used_value,
          period_start: q.period_start,
          period_end: q.period_end
        };
      });
    }
    
    // Get plan limits for comparison
    const planLimits = subscription?.plan?.quotas || {};
    
    logger.info('Full user data fetched', {
      userId: id,
      tenantId,
      hasAccount: !!account,
      hasSubscription: !!subscription,
      inboxesCount: inboxes?.length || 0,
      agentsCount: agents?.length || 0,
      botsCount: bots?.length || 0
    });
    
    return res.status(200).json({
      success: true,
      data: {
        user,
        account,
        subscription,
        quotas,
        planLimits,
        // Resources
        inboxes: mergedInboxes || [],
        agents: agents || [],
        bots: bots || [],
        teams: teams || [],
        labels: labels || [],
        webhooks: webhooks || [],
        databaseConnections: databaseConnections || [],
        campaigns: campaigns || [],
        creditTransactions: creditTransactions || [],
        auditLog: auditLog || [],
        // Stats
        stats: {
          conversations: conversationStats,
          messages: messagesCount || 0,
          contacts: contactsCount || 0,
          templates: templatesCount || 0,
          cannedResponses: cannedResponsesCount || 0,
          scheduledMessages: scheduledMessagesCount || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching full user data', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para resetar senha de usuário Supabase (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/reset-password
 * 
 * Body: { sendEmail?: boolean }
 * Se sendEmail=true, envia email de reset. Caso contrário, gera senha temporária.
 */
router.post('/supabase/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { sendEmail = true } = req.body;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Validate tenant access
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!account) {
      logger.warn('Cross-tenant password reset attempt blocked', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // Get user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    if (sendEmail && user.email) {
      // Send password reset email via Supabase
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
      });
      
      if (resetError) throw resetError;
      
      logger.info('Password reset email sent', {
        userId: id,
        email: user.email,
        adminId: req.session?.userId,
        tenantId
      });
      
      return res.status(200).json({
        success: true,
        message: 'Email de redefinição de senha enviado',
        timestamp: new Date().toISOString()
      });
    } else {
      // Generate temporary password
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
        password: tempPassword
      });
      
      if (updateError) throw updateError;
      
      logger.info('Temporary password generated', {
        userId: id,
        adminId: req.session?.userId,
        tenantId
      });
      
      return res.status(200).json({
        success: true,
        tempPassword,
        message: 'Senha temporária gerada. Informe ao usuário para alterá-la no primeiro acesso.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error resetting password', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para suspender usuário Supabase (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/suspend
 * 
 * Atualiza status da account para 'suspended'
 */
router.post('/supabase/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Update account status with tenant validation
    const { data: account, error } = await supabase
      .from('accounts')
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error || !account) {
      logger.warn('Suspend user failed - access denied or not found', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId,
        error: error?.message
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado ou usuário não encontrado'
      });
    }
    
    logger.info('User suspended', {
      userId: id,
      tenantId,
      adminId: req.session?.userId
    });
    
    return res.status(200).json({
      success: true,
      data: account,
      message: 'Usuário suspenso com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error suspending user', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para reativar usuário Supabase (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/reactivate
 * 
 * Atualiza status da account para 'active'
 */
router.post('/supabase/users/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Update account status with tenant validation
    const { data: account, error } = await supabase
      .from('accounts')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error || !account) {
      logger.warn('Reactivate user failed - access denied or not found', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId,
        error: error?.message
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado ou usuário não encontrado'
      });
    }
    
    logger.info('User reactivated', {
      userId: id,
      tenantId,
      adminId: req.session?.userId
    });
    
    return res.status(200).json({
      success: true,
      data: account,
      message: 'Usuário reativado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error reactivating user', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para confirmar email de usuário Supabase manualmente (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/confirm-email
 */
router.post('/supabase/users/:id/confirm-email', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Validate tenant access
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!account) {
      logger.warn('Confirm email attempt blocked - access denied', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // Confirm email via Supabase Admin API
    const { data: { user }, error } = await supabase.auth.admin.updateUserById(id, {
      email_confirm: true
    });
    
    if (error) throw error;
    
    logger.info('Email confirmed manually', {
      userId: id,
      email: user?.email,
      adminId: req.session?.userId,
      tenantId
    });
    
    return res.status(200).json({
      success: true,
      data: user,
      message: 'Email confirmado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error confirming email', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para atualizar account de usuário Supabase (TENANT-SCOPED)
 * PUT /api/admin/supabase/users/:id/account
 * 
 * Body: { name?, status?, timezone?, locale?, settings? }
 */
router.put('/supabase/users/:id/account', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, timezone, locale, settings } = req.body;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Build update object
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (timezone !== undefined) updates.timezone = timezone;
    if (locale !== undefined) updates.locale = locale;
    if (settings !== undefined) updates.settings = settings;
    
    // Update account with tenant validation
    const { data: account, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error || !account) {
      logger.warn('Update account failed - access denied or not found', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId,
        error: error?.message
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado ou usuário não encontrado'
      });
    }
    
    logger.info('Account updated', {
      userId: id,
      tenantId,
      adminId: req.session?.userId,
      updatedFields: Object.keys(updates).filter(k => k !== 'updated_at')
    });
    
    return res.status(200).json({
      success: true,
      data: account,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating account', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para criar inbox para usuário Supabase (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/inboxes
 * 
 * Body: { name, phone_number?, wuzapi_token?, channel_type? }
 */
router.post('/supabase/users/:id/inboxes', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_number, wuzapi_token, channel_type = 'whatsapp' } = req.body;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nome da inbox é obrigatório'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Validate user belongs to tenant
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (accountError || !account) {
      logger.warn('Create inbox failed - access denied', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // Create inbox
    const { data: inbox, error: inboxError } = await supabase
      .from('inboxes')
      .insert({
        account_id: account.id,
        name,
        phone_number: phone_number || null,
        wuzapi_token: wuzapi_token || null,
        channel_type,
        status: 'active'
      })
      .select()
      .single();
    
    if (inboxError) {
      throw inboxError;
    }
    
    logger.info('Inbox created for user', {
      userId: id,
      tenantId,
      inboxId: inbox.id,
      inboxName: name,
      adminId: req.session?.userId
    });
    
    return res.status(201).json({
      success: true,
      data: inbox,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating inbox', {
      error: error.message,
      userId: req.params.id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para deletar/desassociar inbox de usuário Supabase (TENANT-SCOPED)
 * DELETE /api/admin/supabase/users/:id/inboxes/:inboxId
 * 
 * Comportamento:
 * - Se a inbox pertence ao account do usuário: deleta a inbox completamente
 * - Se a inbox foi atribuída via user_inboxes (pertence a outro account): apenas remove a associação
 */
router.delete('/supabase/users/:id/inboxes/:inboxId', async (req, res) => {
  try {
    const { id, inboxId } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Validate user belongs to tenant
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (accountError || !account) {
      logger.warn('Delete inbox failed - access denied', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // Check if inbox belongs to user's account or was assigned via user_inboxes
    const { data: inbox, error: inboxError } = await supabase
      .from('inboxes')
      .select('id, account_id')
      .eq('id', inboxId)
      .single();
    
    if (inboxError || !inbox) {
      return res.status(404).json({
        success: false,
        error: 'Inbox não encontrada'
      });
    }
    
    // Get user record
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (inbox.account_id === account.id) {
      // Inbox belongs to user's account - delete completely
      // First remove from user_inboxes if exists
      if (userRecord) {
        await supabase
          .from('user_inboxes')
          .delete()
          .eq('inbox_id', inboxId)
          .eq('user_id', userRecord.id);
      }
      
      // Then delete the inbox
      const { error: deleteError } = await supabase
        .from('inboxes')
        .delete()
        .eq('id', inboxId)
        .eq('account_id', account.id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      logger.info('Inbox deleted completely', {
        userId: id,
        tenantId,
        inboxId,
        adminId: req.session?.userId
      });
    } else {
      // Inbox belongs to another account - just remove the association
      if (!userRecord) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }
      
      const { error: unassignError } = await supabase
        .from('user_inboxes')
        .delete()
        .eq('inbox_id', inboxId)
        .eq('user_id', userRecord.id);
      
      if (unassignError) {
        throw unassignError;
      }
      
      logger.info('Inbox unassigned from user', {
        userId: id,
        tenantId,
        inboxId,
        inboxAccountId: inbox.account_id,
        adminId: req.session?.userId
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Inbox removida com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error deleting/unassigning inbox', {
      error: error.message,
      userId: req.params.id,
      inboxId: req.params.inboxId,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para listar inboxes não atribuídas a nenhum usuário (TENANT-SCOPED)
 * GET /api/admin/inboxes/unassigned
 * 
 * Retorna inboxes que existem na tabela inboxes mas não estão na tabela user_inboxes
 */
router.get('/inboxes/unassigned', async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Get all inboxes for this tenant's accounts
    const { data: allInboxes, error: inboxError } = await supabase
      .from('inboxes')
      .select(`
        id,
        name,
        channel_type,
        phone_number,
        status,
        created_at,
        account:accounts!inner(
          id,
          tenant_id
        )
      `)
      .eq('accounts.tenant_id', tenantId)
      .eq('status', 'active');
    
    if (inboxError) {
      throw inboxError;
    }
    
    // Get all inbox IDs that are already assigned to users
    const { data: assignedInboxes, error: assignedError } = await supabase
      .from('user_inboxes')
      .select('inbox_id');
    
    if (assignedError) {
      throw assignedError;
    }
    
    const assignedInboxIds = new Set(assignedInboxes?.map(ui => ui.inbox_id) || []);
    
    // Filter to get only unassigned inboxes
    const unassignedInboxes = (allInboxes || [])
      .filter(inbox => !assignedInboxIds.has(inbox.id))
      .map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        channel_type: inbox.channel_type,
        phone_number: inbox.phone_number,
        status: inbox.status,
        created_at: inbox.created_at
      }));
    
    logger.info('Listed unassigned inboxes', {
      tenantId,
      count: unassignedInboxes.length,
      adminId: req.session?.userId
    });
    
    return res.status(200).json({
      success: true,
      data: unassignedInboxes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error listing unassigned inboxes', {
      error: error.message,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota para atribuir inbox existente a um usuário (TENANT-SCOPED)
 * POST /api/admin/supabase/users/:id/inboxes/assign
 * 
 * Body: { inbox_id: string }
 */
router.post('/supabase/users/:id/inboxes/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { inbox_id } = req.body;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Tenant context required'
      });
    }
    
    if (!inbox_id) {
      return res.status(400).json({
        success: false,
        error: 'inbox_id é obrigatório'
      });
    }
    
    const supabase = supabaseService.adminClient;
    
    // Validate user belongs to tenant
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (accountError || !account) {
      logger.warn('Assign inbox failed - user access denied', {
        type: 'security_violation',
        targetUserId: id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado ao usuário'
      });
    }
    
    // Validate inbox belongs to tenant and is not already assigned
    const { data: inbox, error: inboxError } = await supabase
      .from('inboxes')
      .select(`
        id,
        name,
        account:accounts!inner(tenant_id)
      `)
      .eq('id', inbox_id)
      .eq('accounts.tenant_id', tenantId)
      .single();
    
    if (inboxError || !inbox) {
      logger.warn('Assign inbox failed - inbox access denied', {
        type: 'security_violation',
        inboxId: inbox_id,
        tenantId,
        adminId: req.session?.userId
      });
      return res.status(403).json({
        success: false,
        error: 'Acesso negado à inbox'
      });
    }
    
    // Check if inbox is already assigned to another user
    const { data: existingAssignment, error: existingError } = await supabase
      .from('user_inboxes')
      .select('id, user_id')
      .eq('inbox_id', inbox_id)
      .maybeSingle();
    
    if (existingError) {
      throw existingError;
    }
    
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        error: 'Esta inbox já está atribuída a outro usuário'
      });
    }
    
    // Get user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Create user_inbox assignment
    const { data: userInbox, error: assignError } = await supabase
      .from('user_inboxes')
      .insert({
        user_id: user.id,
        inbox_id: inbox_id,
        is_primary: false
      })
      .select()
      .single();
    
    if (assignError) {
      throw assignError;
    }
    
    logger.info('Inbox assigned to user', {
      userId: id,
      tenantId,
      inboxId: inbox_id,
      userInboxId: userInbox.id,
      adminId: req.session?.userId
    });
    
    return res.status(200).json({
      success: true,
      data: userInbox,
      message: 'Inbox atribuída com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error assigning inbox to user', {
      error: error.message,
      userId: req.params.id,
      inboxId: req.body.inbox_id,
      tenantId: getTenantIdFromRequest(req)
    });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;