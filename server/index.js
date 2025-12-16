// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const helmet = require('helmet');
// SQLite removed - using Supabase only
const SupabaseService = require('./services/SupabaseService');
// Database compatibility layer for legacy code
const db = require('./database');

// Importar novos componentes de validação
const corsHandler = require('./middleware/corsHandler');
const errorHandler = require('./middleware/errorHandler');
const { userRecordRateLimiter, apiLimiter } = require('./middleware/rateLimiter');
const sessionConfig = require('./middleware/session');
const { csrfProtection, getCsrfToken, csrfErrorHandler } = require('./middleware/csrf');
const { logAdminRequests, logUnauthorizedAttempts } = require('./middleware/securityLogging');
const verifyUserToken = require('./middleware/verifyUserToken');
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const brandingRoutes = require('./routes/brandingRoutes');
const monitoringRoutes = require('./routes/monitoring');
const landingPageRoutes = require('./routes/landingPageRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const chatInboxRoutes = require('./routes/chatInboxRoutes');
const chatWebhookRoutes = require('./routes/chatWebhookRoutes');
const customLinksRoutes = require('./routes/customLinksRoutes');
const adminTablePermissionsRoutes = require('./routes/adminTablePermissionsRoutes');
const adminTablesRoutes = require('./routes/adminTablesRoutes');
const adminCustomThemesRoutes = require('./routes/adminCustomThemesRoutes');
const adminDatabaseUsersRoutes = require('./routes/adminDatabaseUsersRoutes');
const adminAutomationRoutes = require('./routes/adminAutomationRoutes');
// Admin User Management Routes
const adminPlanRoutes = require('./routes/adminPlanRoutes');
const adminUserSubscriptionRoutes = require('./routes/adminUserSubscriptionRoutes');
const adminUserQuotaRoutes = require('./routes/adminUserQuotaRoutes');
const adminUserFeatureRoutes = require('./routes/adminUserFeatureRoutes');
const adminUserActionRoutes = require('./routes/adminUserActionRoutes');
const adminUserInboxRoutes = require('./routes/adminUserInboxRoutes');
const adminBulkActionRoutes = require('./routes/adminBulkActionRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminAuditRoutes = require('./routes/adminAuditRoutes');
const adminReportRoutes = require('./routes/adminReportRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
// User Account Routes (subscription, quotas, features)
const userSubscriptionRoutes = require('./routes/userSubscriptionRoutes');
const userTableAccessRoutes = require('./routes/userTableAccessRoutes');
const userCustomThemesRoutes = require('./routes/userCustomThemesRoutes');
const contactImportRoutes = require('./routes/contactImportRoutes');
const contactListRoutes = require('./routes/contactListRoutes');
const bulkCampaignRoutes = require('./routes/bulkCampaignRoutes');
const linkPreviewRoutes = require('./routes/linkPreviewRoutes');
const botProxyRoutes = require('./routes/botProxyRoutes');
// Account Management Routes (multi-user system)
const accountAgentRoutes = require('./routes/accountAgentRoutes');
const accountTeamRoutes = require('./routes/accountTeamRoutes');
const accountInboxRoutes = require('./routes/accountInboxRoutes');
const accountRoleRoutes = require('./routes/accountRoleRoutes');
const accountAuditRoutes = require('./routes/accountAuditRoutes');
const agentAuthRoutes = require('./routes/agentAuthRoutes');
const sessionAccountRoutes = require('./routes/sessionAccountRoutes');

// Importar sistema de monitoramento
const { logger, requestLogger } = require('./utils/logger');
const { metrics } = require('./utils/metrics');
const { alertManager } = require('./utils/alerts');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security headers com Helmet
// CSP flexível para permitir HTML customizado na landing page com scripts de CDNs externos
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: ["'self'", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// Middleware - Aplicar CORS configurável
app.use(corsHandler.logCorsRequests.bind(corsHandler));
app.use(corsHandler.createCorsMiddleware());
app.use(bodyParser.json({ limit: '10mb' })); // Aumentar limite para uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware (DEVE vir antes do CSRF)
app.use(session(sessionConfig));

// CSRF protection (DEVE vir depois da sessão)
// Excluir rotas específicas do CSRF
const { skipCsrf } = require('./middleware/csrf');
app.use((req, res, next) => {
  // Rotas que não precisam de CSRF
  const csrfExemptPaths = [
    '/api/auth/login',
    '/api/auth/status',
    '/api/admin/database-connections', // Rotas de database-connections para integração externa
    '/api/webhook/events', // Webhook endpoint para receber eventos do WUZAPI
    '/api/bot/send/text', // Bot proxy endpoint para envio de mensagens de texto
    '/api/bot/send/image', // Bot proxy endpoint para envio de imagens
    '/api/bot/send/audio', // Bot proxy endpoint para envio de áudio
    '/api/bot/send/document', // Bot proxy endpoint para envio de documentos
    '/api/bot/send/video', // Bot proxy endpoint para envio de vídeos
    '/api/bot/send/sticker', // Bot proxy endpoint para envio de stickers
    '/api/agent/login', // Agent login endpoint (public)
    '/api/agent/register', // Agent registration endpoint (public)
    '/api/agent/invitation' // Agent invitation validation endpoint (public)
  ];

  // Verificar se a rota atual está na lista de exceções
  const isExempt = csrfExemptPaths.some(path => req.path.startsWith(path));

  if (isExempt) {
    return skipCsrf(req, res, next);
  }

  csrfProtection(req, res, next);
});

// Security logging middleware
app.use(logAdminRequests);

// Middleware de monitoramento
app.use(requestLogger); // Log estruturado de requisições
app.use(metrics.httpMetricsMiddleware()); // Coleta de métricas HTTP

// ==================== BRANDING CACHE ====================

// Cache de configuração de branding (5 minutos)
let brandingConfigCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos

/**
 * Obtém configuração de branding do cache ou do banco de dados
 * @param {Database} database - Instância do banco de dados
 * @returns {Promise<Object>} Configuração de branding
 */
async function getCachedBrandingConfig(database) {
  const now = Date.now();

  // Verificar se cache é válido
  if (brandingConfigCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    logger.info('✅ Usando configuração de branding do cache', {
      cache_age_seconds: Math.round((now - cacheTimestamp) / 1000),
      cache_duration_seconds: CACHE_DURATION / 1000
    });
    return brandingConfigCache;
  }

  // Cache expirado ou não existe, buscar do banco
  logger.info('🔄 Cache de branding expirado ou inexistente, buscando do banco');

  try {
    const config = await database.getBrandingConfig();

    // Atualizar cache
    brandingConfigCache = config;
    cacheTimestamp = now;

    logger.info('✅ Configuração de branding carregada e armazenada em cache', {
      has_custom_html: !!config.customHomeHtml,
      custom_html_length: config.customHomeHtml ? config.customHomeHtml.length : 0
    });

    return config;
  } catch (error) {
    logger.error('❌ Erro ao buscar configuração de branding', {
      error_message: error.message,
      error_stack: error.stack
    });

    // Retornar configuração padrão em caso de erro
    return {
      id: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customHomeHtml: null
    };
  }
}

/**
 * Invalida o cache de configuração de branding
 */
function invalidateBrandingCache() {
  logger.info('🗑️ Cache de branding invalidado');
  brandingConfigCache = null;
  cacheTimestamp = null;
}

// Inicializar Supabase (único backend de banco de dados)
async function initializeDatabase() {
  try {
    logger.info('🔧 Inicializando conexão com Supabase...');

    // Validar configuração do Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuração do Supabase incompleta. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    }

    // Testar conexão com Supabase
    const { data, error } = await SupabaseService.healthCheck();
    if (error) {
      throw new Error(`Falha na conexão com Supabase: ${error.message}`);
    }

    // Tornar o SupabaseService disponível para as rotas
    app.locals.supabase = SupabaseService;

    logger.info('✅ Conexão com Supabase estabelecida com sucesso');

    return true;
  } catch (error) {
    logger.error('❌ Erro ao inicializar Supabase:', error.message);
    throw error;
  }
}

// SQLite directory functions removed - using Supabase only

// SQLite migrations removed - using Supabase migrations via MCP

// Middleware de log estruturado
app.use(errorHandler.logRequest.bind(errorHandler));

// Health check - DEVE vir antes do middleware SPA
app.get('/health', async (req, res) => {
  try {
    const { environmentValidator } = require('./utils/environmentValidator');
    const { wuzapiConnectivityChecker } = require('./utils/wuzapiConnectivityChecker');

    const corsInfo = corsHandler.getConfigInfo();
    // SQLite removed - using Supabase only

    // 1. Verificar validação de ambiente
    const envValidation = environmentValidator.validate();
    const envConfig = environmentValidator.getConfigInfo();

    // 2. Verificar se banco está acessível
    let databaseStatus = 'unknown';
    let databaseStats = null;
    let databaseError = null;

    if (db && db.isInitialized) {
      try {
        databaseStats = await db.getDatabaseStats();
        databaseStatus = 'connected';

        // Verificar se consegue fazer uma query simples
        await db.query('SELECT 1 as test');

      } catch (dbError) {
        databaseStatus = 'error';
        databaseError = {
          message: dbError.message,
          code: dbError.code || 'UNKNOWN'
        };

        // Log de erro do banco de dados
        if (dbError.code) {
          logger.warn('⚠️ Erro ao verificar status do banco no health check:', dbError.message);
        }
      }
    } else {
      databaseStatus = 'not_initialized';
    }

    // 3. Verificar conectividade com WUZAPI
    const wuzapiStatus = await wuzapiConnectivityChecker.getStatus();

    // 6. Verificar S3 Storage
    let s3Status = {
      enabled: false,
      status: 'disabled',
      bucket: null,
      endpoint: null
    };
    try {
      const { s3Service } = require('./services/S3Service');
      s3Status = {
        enabled: s3Service.isEnabled(),
        status: s3Service.isEnabled() ? 'connected' : 'disabled',
        bucket: process.env.S3_BUCKET || null,
        endpoint: process.env.S3_ENDPOINT || null
      };
    } catch (s3Error) {
      s3Status = {
        enabled: false,
        status: 'error',
        error: s3Error.message
      };
    }

    // Determinar status geral do sistema
    const isHealthy =
      envValidation.valid &&
      databaseStatus === 'connected' &&
      wuzapiStatus.connected;

    const overallStatus = isHealthy ? 'ok' :
      (databaseStatus === 'connected' && envValidation.valid) ? 'degraded' : 'error';

    const packageJson = require('./package.json');

    const healthResponse = {
      status: overallStatus,
      message: 'WUZAPI Manager Server is running',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      version: packageJson.version,
      configuration: {
        valid: envValidation.valid,
        errors: envValidation.errors,
        warnings: envValidation.warnings,
        details: envConfig
      },
      cors_config: corsInfo,
      database: {
        type: 'Supabase',
        status: databaseStatus,
        url: process.env.SUPABASE_URL || 'not configured',
        stats: databaseStats,
        error: databaseError
      },
      wuzapi: {
        status: wuzapiStatus.connected ? 'connected' : 'error',
        baseUrl: wuzapiStatus.baseUrl,
        responseTime: wuzapiStatus.responseTime,
        lastCheck: wuzapiStatus.timestamp,
        cached: wuzapiStatus.cached || false,
        error: wuzapiStatus.error || null
      },
      s3_storage: s3Status
    };

    // Retornar status HTTP apropriado
    const httpStatus = overallStatus === 'ok' ? 200 :
      overallStatus === 'degraded' ? 503 : 500;
    res.status(httpStatus).json(healthResponse);

  } catch (error) {
    logger.error('❌ Erro no health check:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase',
        status: 'error',
        url: process.env.SUPABASE_URL || 'not configured'
      }
    });
  }
});

// ==================== NEW VALIDATION ROUTES ====================

// ==================== LANDING PAGE MIDDLEWARE ====================
// NOTA: Landing page customizada é OPCIONAL
// Por padrão, o SPA React será servido na raiz

// Rotas de autenticação (devem vir antes do CSRF para login)
app.use('/api/auth', authRoutes);

// Endpoint para obter CSRF token (deve vir antes das rotas protegidas)
app.get('/api/auth/csrf-token', getCsrfToken);

// Rotas de autenticação (devem vir antes das rotas protegidas)
app.use('/api/auth', authRoutes);

// Usar as novas rotas de validação
app.use('/api/session', sessionRoutes);

// Importar middleware de autenticação
const { requireAdmin } = require('./middleware/auth');

// ==================== ROTAS PÚBLICAS (SEM AUTENTICAÇÃO) ====================
// Estas rotas devem vir ANTES do middleware requireAdmin
// Elas fornecem informações públicas necessárias para a landing page

// Rota pública de branding (nome, logo, cores, HTML customizado)
app.use('/api/branding', brandingRoutes);

// Rota pública de custom links (links de navegação ativos)
app.use('/api/custom-links', customLinksRoutes);

// Rota pública para obter versão do sistema
app.get('/api/version', (req, res) => {
  const packageJson = require('./package.json');
  res.json({
    success: true,
    version: packageJson.version
  });
});

// ==================== ROTAS PROTEGIDAS (COM AUTENTICAÇÃO) ====================

// Rotas admin que usam autenticação via token (para APIs externas)
// DEVEM vir ANTES do middleware requireAdmin global
app.use('/api/admin/database-connections', adminDatabaseUsersRoutes);

// Aplicar middleware requireAdmin a todas as outras rotas admin
app.use('/api/admin', requireAdmin);

// Rotas admin (protegidas pelo middleware acima)
// Admin User Management Routes - MUST come BEFORE generic adminRoutes to avoid route conflicts
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/admin/users/bulk', adminBulkActionRoutes);
app.use('/api/admin/users', adminUserSubscriptionRoutes);
app.use('/api/admin/users', adminUserQuotaRoutes);
app.use('/api/admin/users', adminUserFeatureRoutes);
app.use('/api/admin/users', adminUserActionRoutes);
app.use('/api/admin/users', adminUserInboxRoutes);
app.use('/api/admin/management/dashboard', adminDashboardRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
// Generic admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/branding', brandingRoutes);
app.use('/api/admin/landing-page', landingPageRoutes);
app.use('/api/admin/table-permissions', adminTablePermissionsRoutes);
app.use('/api/admin/tables', adminTablesRoutes);
app.use('/api/admin/custom-themes', adminCustomThemesRoutes);
app.use('/api/admin/automation', adminAutomationRoutes);
app.use('/api/admin/custom-links', customLinksRoutes); // Rotas admin de custom links
app.use('/api/user/contacts', contactImportRoutes);
app.use('/api/user/contact-lists', contactListRoutes);

// Rotas de Templates
app.use('/api/user/templates', require('./routes/templateRoutes'));

// Rotas de Contatos de Banco de Dados
app.use('/api/user/database-connections', require('./routes/databaseContactRoutes'));

// Rotas de Analytics
app.use('/api/user/analytics', require('./routes/analyticsRoutes'));

// Rotas de Campanhas em Massa
app.use('/api/user/bulk-campaigns', require('./routes/bulkCampaignRoutes'));

// Rotas de Relatórios
app.use('/api/user/reports', require('./routes/reportRoutes'));

// Rotas de Rascunhos
app.use('/api/user/drafts', require('./routes/userDraftRoutes'));

// Rotas de Bots
// IMPORTANT: userBotTestRoutes MUST come BEFORE userBotRoutes
// because userBotRoutes has a /:id catch-all route that would intercept test routes
app.use('/api/user/bots', require('./routes/userBotTestRoutes')); // Bot test chat routes
app.use('/api/user/bots', require('./routes/userBotRoutes'));

// Rotas de Outgoing Webhooks
app.use('/api/user/outgoing-webhooks', require('./routes/userWebhookRoutes'));

// Rotas de Custom Themes (read-only para usuários)
app.use('/api/user/custom-themes', userCustomThemesRoutes);

// User Account Routes (subscription, quotas, features)
app.use('/api/user', userSubscriptionRoutes);

// Rotas de Teste (desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', require('./routes/testRoutes'));
}

app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat/inbox', chatInboxRoutes);
app.use('/api/chat/webhook', chatWebhookRoutes);
app.use('/api/webhook', require('./routes/webhookRoutes')); // Webhook events from WUZAPI
app.use('/api/bot', botProxyRoutes); // Bot proxy endpoints for external integrations
app.use('/api/tables', userTableAccessRoutes);
app.use('/api/link-preview', linkPreviewRoutes);

// Account Management Routes (multi-user system) - Agent token based
app.use('/api/account/agents', accountAgentRoutes);
app.use('/api/account/teams', accountTeamRoutes);
app.use('/api/account/inboxes', accountInboxRoutes);
app.use('/api/account/roles', accountRoleRoutes);
app.use('/api/account/audit', accountAuditRoutes);
app.use('/api/agent', agentAuthRoutes);

// Agent Data Routes (for agent dashboard - agent token based)
const agentDataRoutes = require('./routes/agentDataRoutes');
app.use('/api/agent', agentDataRoutes);

// Agent Chat Routes (for agent chat interface - agent token based)
const agentChatRoutes = require('./routes/agentChatRoutes');
app.use('/api/agent/chat', agentChatRoutes);

// Agent Messaging Routes (for agent message sending with owner quota)
const agentMessagingRoutes = require('./routes/agentMessagingRoutes');
app.use('/api/agent/messaging', agentMessagingRoutes);

// Session-based Account Management Routes (for admin/user dashboards)
app.use('/api/session', sessionAccountRoutes);

// Rotas de monitoramento
app.use('/', monitoringRoutes);

// ==================== DATABASE CONNECTIONS ROUTES ====================

// GET /api/database-connections - Listar todas as conexões
app.get('/api/database-connections', async (req, res) => {
  try {
    const connections = await db.getAllConnections();

    res.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (err) {
    console.error('Erro ao buscar conexões:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// GET /api/database-connections/:id - Buscar conexão por ID
app.get('/api/database-connections/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await db.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }

    res.json({
      success: true,
      data: connection
    });
  } catch (err) {
    console.error('Erro ao buscar conexão:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// POST /api/database-connections - Criar nova conexão
app.post('/api/database-connections', async (req, res) => {
  const connectionData = req.body;

  // Validação básica
  if (!connectionData.name || !connectionData.type || !connectionData.host) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: 'Nome, tipo e host são obrigatórios'
    });
  }

  // Validação específica por tipo
  if (connectionData.type === 'NOCODB') {
    // Suportar ambos os formatos: camelCase e snake_case
    const token = connectionData.nocodbToken || connectionData.nocodb_token || connectionData.password;
    const projectId = connectionData.nocodbProjectId || connectionData.nocodb_project_id || connectionData.database;
    const tableId = connectionData.nocodbTableId || connectionData.nocodb_table_id || connectionData.table_name;

    if (!token || !projectId || !tableId) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Para NocoDB, token, project ID e table ID são obrigatórios'
      });
    }
  } else {
    if (!connectionData.database || !connectionData.username || !connectionData.password) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'Para bancos relacionais, database, username e password são obrigatórios'
      });
    }
  }

  try {
    // Garantir que default_view_mode tenha um valor válido se não fornecido
    if (!connectionData.default_view_mode) {
      connectionData.default_view_mode = 'list';
    }

    const result = await db.createConnection(connectionData);

    res.status(201).json({
      success: true,
      message: 'Conexão criada com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao criar conexão:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// PUT /api/database-connections/:id - Atualizar conexão
app.put('/api/database-connections/:id', async (req, res) => {
  const { id } = req.params;
  const connectionData = req.body;

  // Validação básica
  if (!connectionData.name || !connectionData.type || !connectionData.host) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: 'Nome, tipo e host são obrigatórios'
    });
  }

  try {
    // Garantir que default_view_mode tenha um valor válido se não fornecido
    if (connectionData.default_view_mode && !['list', 'single'].includes(connectionData.default_view_mode)) {
      connectionData.default_view_mode = 'list';
    }

    const result = await db.updateConnection(id, connectionData);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }

    res.json({
      success: true,
      message: 'Conexão atualizada com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao atualizar conexão:', err);
    logger.error('❌ Erro ao atualizar conexão:', err.message);

    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// PATCH /api/database-connections/:id/status - Atualizar apenas o status
app.patch('/api/database-connections/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['connected', 'disconnected', 'error', 'testing'].includes(status)) {
    return res.status(400).json({
      error: 'Status inválido',
      message: 'Status deve ser: connected, disconnected, error ou testing'
    });
  }

  try {
    const result = await db.updateConnectionStatus(id, status);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    logger.error('❌ Erro ao atualizar status:', err.message);

    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// POST /api/database-connections/:id/test - Testar conexão
app.post('/api/database-connections/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await db.getConnectionById(id);

    if (!connection) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }

    // SQLite connections are no longer supported
    if (connection.type === 'SQLITE') {
      return res.status(400).json({
        success: false,
        error: 'SQLite connections are no longer supported. Please use Supabase.',
        data: {
          status: 'error',
          type: connection.type,
          database: connection.database
        }
      });
    }

    // Para outros tipos de banco, retornar que o teste não está implementado ainda
    res.json({
      success: true,
      message: 'Teste de conexão não implementado para este tipo de banco',
      data: {
        status: 'unknown',
        type: connection.type
      }
    });
  } catch (err) {
    console.error('Erro ao testar conexão:', err);
    logger.error('❌ Erro ao testar conexão:', err.message);

    // Atualizar status para error
    try {
      await db.updateConnectionStatus(id, 'error');
    } catch (updateErr) {
      logger.error('❌ Erro ao atualizar status:', updateErr.message);
    }

    return res.status(500).json({
      error: 'Erro ao testar conexão',
      message: err.message
    });
  }
});

// DELETE /api/database-connections/:id - Deletar conexão
app.delete('/api/database-connections/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.deleteConnection(id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Conexão não encontrada',
        message: `Conexão com ID ${id} não existe`
      });
    }

    res.json({
      success: true,
      message: 'Conexão deletada com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao deletar conexão:', err);
    logger.error('❌ Erro ao deletar conexão:', err.message);

    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// ==================== USER ROUTES ====================
// verifyUserToken agora é importado de ./middleware/verifyUserToken.js

// GET /api/admin/dashboard-stats - Buscar estatísticas do dashboard administrativo
app.get('/api/admin/dashboard-stats', async (req, res) => {
  // Verificar token de admin
  const authHeader = req.headers.authorization;
  const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';

  if (!authHeader || authHeader !== adminToken) {
    return res.status(401).json({
      success: false,
      error: 'Token de administrador inválido',
      code: 401,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    // Buscar health da API
    const healthResponse = await axios.get(`${wuzapiBaseUrl}/health`, {
      timeout: 5000
    });

    // Buscar lista de usuários
    const usersResponse = await axios.get(`${wuzapiBaseUrl}/admin/users`, {
      headers: {
        'Authorization': adminToken,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    const healthData = healthResponse.data || {};
    const usersData = usersResponse.data?.data || [];

    // Calcular estatísticas
    const connectedUsers = usersData.filter(user => user.connected).length;
    const loggedInUsers = usersData.filter(user => user.loggedIn).length;
    const totalUsers = usersData.length;

    const packageJson = require('./package.json');

    const stats = {
      systemStatus: healthData.status || 'unknown',
      uptime: healthData.uptime || '0s',
      version: healthData.version || packageJson.version,
      totalUsers: totalUsers,
      connectedUsers: connectedUsers,
      loggedInUsers: loggedInUsers,
      activeConnections: healthData.active_connections || 0,
      memoryStats: healthData.memory_stats || {
        alloc_mb: 0,
        sys_mb: 0,
        total_alloc_mb: 0,
        num_gc: 0
      },
      goroutines: healthData.goroutines || 0,
      users: usersData.slice(0, 10) // Primeiros 10 usuários para o dashboard
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas administrativas:', error);

    const packageJson = require('./package.json');

    // Retornar estatísticas padrão em caso de erro
    res.json({
      success: true,
      data: {
        systemStatus: 'error',
        uptime: '0s',
        version: packageJson.version,
        totalUsers: 0,
        connectedUsers: 0,
        loggedInUsers: 0,
        activeConnections: 0,
        memoryStats: {
          alloc_mb: 0,
          sys_mb: 0,
          total_alloc_mb: 0,
          num_gc: 0
        },
        goroutines: 0,
        users: []
      }
    });
  }
});

// GET /api/user/messages - Buscar histórico de mensagens do usuário
app.get('/api/user/messages', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const { limit = 10, offset = 0 } = req.query;

  try {
    // Por enquanto, retornar dados simulados já que a API WUZAPI não tem endpoint de histórico
    // Em uma implementação real, isso viria de um banco de dados local ou API específica
    const messages = [
      {
        id: '1',
        phone: '5511999999999',
        message: 'Olá! Como posso ajudá-lo hoje?',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min atrás
        status: 'sent',
        type: 'text'
      },
      {
        id: '2',
        phone: '5511888888888',
        message: 'Obrigado pelo contato! Retornaremos em breve.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h atrás
        status: 'delivered',
        type: 'text'
      },
      {
        id: '3',
        phone: '5511777777777',
        message: 'Sua solicitação foi recebida e está sendo processada.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 dia atrás
        status: 'read',
        type: 'text'
      }
    ];

    const paginatedMessages = messages.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        messages: paginatedMessages,
        total: messages.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);

    res.json({
      success: true,
      data: {
        messages: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  }
});



// GET /api/user/dashboard-stats - Buscar estatísticas do dashboard do usuário
app.get('/api/user/dashboard-stats', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;

  try {
    // Buscar informações do usuário na API WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    // Buscar status da sessão
    const sessionResponse = await axios.get(`${wuzapiBaseUrl}/session/status`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    const sessionData = sessionResponse.data?.data || {};

    // A API externa retorna connected/loggedIn em minúsculas
    const connected = sessionData.connected || false;
    const loggedIn = sessionData.loggedIn || false;

    // Estatísticas baseadas no status da sessão (valores fixos para evitar mudanças constantes)
    const stats = {
      messagesCount: loggedIn ? 58 : 0, // Valor fixo quando logado
      connectionsCount: connected ? 1 : 0,
      sessionStatus: {
        connected: connected,
        loggedIn: loggedIn,
        jid: sessionData.jid || null
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);

    // Retornar estatísticas padrão em caso de erro
    res.json({
      success: true,
      data: {
        messagesCount: 0,
        connectionsCount: 0,
        sessionStatus: {
          connected: false,
          loggedIn: false,
          jid: null
        }
      }
    });
  }
});

// GET /api/user/database-connections - Buscar conexões atribuídas ao usuário
app.get('/api/user/database-connections', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;

  try {
    const connections = await db.getUserConnections(userToken);

    res.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (err) {
    console.error('Erro ao buscar conexões do usuário:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
});

// GET /api/user/database-connections/:id/record - Buscar registro único do usuário
app.get('/api/user/database-connections/:id/record', userRecordRateLimiter, verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    logger.info('📊 Solicitação de registro único do usuário:', {
      connectionId: id,
      userToken: userToken.substring(0, 8) + '...'
    });

    // Buscar configuração da conexão
    const connection = await db.getConnectionById(parseInt(id));

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
        code: 'CONNECTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Validar usuário e obter ID
    let userId;
    try {
      userId = await db.validateUserAndGetId(userToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Verificar se o usuário tem acesso a esta conexão
    if (!db.validateUserConnectionAccess(userId, connection)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this connection',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString()
      });
    }

    // Buscar o registro do usuário usando o campo de vínculo
    const userLinkField = connection.user_link_field || connection.userLinkField;

    if (!userLinkField) {
      return res.status(400).json({
        success: false,
        error: 'User link field not configured for this connection',
        code: 'INVALID_CONFIGURATION',
        timestamp: new Date().toISOString()
      });
    }

    // Buscar registro baseado no tipo de banco
    let record = null;

    try {
      if (connection.type === 'NOCODB') {
        record = await db.fetchNocoDBUserRecord(connection, userLinkField, userToken);
      } else if (connection.type === 'MYSQL' || connection.type === 'POSTGRESQL' || connection.type === 'POSTGRES') {
        record = await db.fetchSQLUserRecord(connection, userLinkField, userToken);
      } else {
        return res.status(400).json({
          success: false,
          error: `Database type not supported: ${connection.type}`,
          code: 'UNSUPPORTED_TYPE',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('❌ Erro ao buscar registro do usuário:', {
        connectionId: id,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user record',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'No record found for this user',
        code: 'RECORD_NOT_FOUND',
        suggestion: 'Contact administrator to create a record for your account',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: record,
      metadata: {
        connectionId: parseInt(id),
        connectionName: connection.name,
        tableName: connection.table_name || connection.nocodb_table_id,
        userLinkField: userLinkField
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao buscar registro do usuário:', {
      connectionId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/database-connections/:id/data - Buscar dados da tabela para o usuário
app.get('/api/user/database-connections/:id/data', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    logger.info('📊 Solicitação de dados da tabela:', {
      connectionId: id,
      userToken: userToken.substring(0, 8) + '...'
    });

    const data = await db.getUserTableData(userToken, parseInt(id));

    res.json({
      success: true,
      data: data,
      metadata: {
        totalRecords: data.length,
        connectionId: parseInt(id),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao buscar dados da tabela:', {
      connectionId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    // Determinar código de status baseado no tipo de erro
    let statusCode = 500;
    let errorType = 'Internal Server Error';

    if (error.message.includes('Connection not found')) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (error.message.includes('Access denied')) {
      statusCode = 403;
      errorType = 'Forbidden';
    } else if (error.message.includes('Invalid or expired token') ||
      error.message.includes('Authentication failed')) {
      statusCode = 401;
      errorType = 'Unauthorized';
    }

    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/user/database-connections/:id/data - Criar registro na tabela do usuário
app.post('/api/user/database-connections/:id/data', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    const recordData = req.body;

    const result = await db.createUserTableRecord(userToken, id, recordData);

    res.status(201).json({
      success: true,
      message: 'Registro criado com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao criar registro:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/user/database-connections/:id/data/:recordId - Atualizar registro na tabela do usuário
app.put('/api/user/database-connections/:id/data/:recordId', verifyUserToken, async (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userToken = req.userToken;
    const recordData = req.body;

    const result = await db.updateUserTableRecord(userToken, id, recordId, recordData);

    res.json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao atualizar registro:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/user/database-connections/:id/data/:recordId - Deletar registro na tabela do usuário
app.delete('/api/user/database-connections/:id/data/:recordId', verifyUserToken, async (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userToken = req.userToken;

    const result = await db.deleteUserTableRecord(userToken, id, recordId);

    res.json({
      success: true,
      message: 'Registro deletado com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao deletar registro:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== WEBHOOK ENDPOINTS ====================

// GET /api/webhook - Buscar configuração de webhook do usuário
app.get('/api/webhook', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;

    logger.info('📊 Solicitação de configuração de webhook:', {
      userToken: userToken.substring(0, 8) + '...'
    });

    // Fazer requisição para a WuzAPI para buscar configuração de webhook
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    const axios = require('axios');

    const response = await axios.get(`${wuzapiBaseUrl}/webhook`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const webhookData = response.data.data || response.data;

    res.json({
      success: true,
      webhook: webhookData.webhook || '',
      events: webhookData.events || [],
      subscribe: webhookData.subscribe || ['Message'],
      data: webhookData
    });

  } catch (error) {
    logger.error('❌ Erro ao buscar configuração de webhook:', {
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });

    // Determinar código de status baseado no tipo de erro
    let statusCode = 500;
    let errorType = 'Internal Server Error';

    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 404) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    }

    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhook - Atualizar configuração de webhook do usuário
app.post('/api/webhook', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { webhook, events, subscribe } = req.body;

    logger.info('📊 Solicitação de atualização de webhook:', {
      userToken: userToken.substring(0, 8) + '...',
      webhook: webhook ? webhook.substring(0, 20) + '...' : 'empty',
      eventsCount: events?.length || 0
    });

    // Fazer requisição para a WuzAPI para atualizar configuração de webhook
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    const axios = require('axios');

    const response = await axios.put(`${wuzapiBaseUrl}/webhook`, {
      webhook,
      events,
      subscribe,
      active: true
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const result = response.data;

    res.json({
      success: true,
      message: 'Configuração de webhook atualizada com sucesso',
      data: result
    });

  } catch (error) {
    logger.error('❌ Erro ao atualizar configuração de webhook:', {
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });

    let statusCode = 500;
    let errorType = 'Internal Server Error';

    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 400) {
      statusCode = 400;
      errorType = 'Bad Request';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    }

    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== CHAT ENDPOINTS ====================
// NOTA: Todas as rotas de chat foram movidas para server/routes/chatRoutes.js
// Todas as rotas de envio de mensagens agora usam validatePhoneWithAPI para validação
// contra a API WUZAPI /user/check

// ==================== LEGACY ROUTES (mantidas para compatibilidade) ====================

// Rota legada para compatibilidade - redireciona para nova implementação
app.get('/api/session/status-legacy', async (req, res) => {
  logger.warn('Uso de rota legada detectado', {
    url: req.url,
    method: req.method,
    user_agent: req.get('User-Agent'),
    ip: req.ip
  });

  // Redirecionar para nova rota com header correto
  const token = req.headers.token || req.headers.authorization;
  if (token) {
    req.headers.authorization = token;
  }

  // Fazer proxy interno para nova rota
  return res.redirect(307, '/api/session/status');
});

// ==================== SPA MIDDLEWARE ====================

// Servir arquivos estáticos do build do React (sempre, não só em produção)
const distPath = path.join(__dirname, '../dist');
const indexPath = path.join(distPath, 'index.html');

// Verificar se o build existe
const fs = require('fs');

// IMPORTANTE: Verificar landing page customizada ANTES de servir arquivos estáticos
// Middleware para interceptar a rota raiz e servir landing page customizada se existir
app.get('/', async (req, res, next) => {
  try {
    // 1. Verificar se há HTML customizado no banco de dados
    if (db && db.isInitialized) {
      logger.info('🔍 Verificando HTML customizado no banco de dados');

      const brandingConfig = await getCachedBrandingConfig(db);

      if (brandingConfig && brandingConfig.customHomeHtml && brandingConfig.customHomeHtml.trim() !== '') {
        logger.info('✅ HTML customizado encontrado no banco de dados', {
          html_length: brandingConfig.customHomeHtml.length,
          html_size_kb: Math.round(brandingConfig.customHomeHtml.length / 1024),
          app_name: brandingConfig.appName,
          ip: req.ip,
          user_agent: req.get('User-Agent')
        });

        // Retornar HTML customizado exatamente como foi salvo (modo permissivo)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(brandingConfig.customHomeHtml);
      } else {
        logger.info('ℹ️ Nenhum HTML customizado configurado no banco de dados');
      }
    } else {
      logger.warn('⚠️ Banco de dados não inicializado, pulando verificação de HTML customizado');
    }

    // 2. Fallback: Verificar arquivo landing-custom.html
    const landingPagePath = path.join(__dirname, 'public/landing-custom.html');

    if (fs.existsSync(landingPagePath)) {
      logger.info('✅ Servindo landing page customizada do arquivo (fallback)');
      return res.sendFile(landingPagePath);
    }

    // 3. Fallback final: Continuar para SPA React
    logger.info('ℹ️ Nenhuma landing page customizada encontrada, continuando para SPA React');
    next();

  } catch (error) {
    // Em caso de erro, fazer fallback para SPA React
    logger.error('❌ Erro ao verificar HTML customizado', {
      error_message: error.message,
      error_stack: error.stack,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    logger.info('🔄 Fallback para SPA React devido a erro');
    next();
  }
});

// Agora sim, servir arquivos estáticos do React
if (fs.existsSync(distPath)) {
  logger.info('✅ Servindo arquivos estáticos do build React:', distPath);
  app.use(express.static(distPath));
} else {
  logger.warn('⚠️ Diretório dist/ não encontrado. Execute "npm run build" para criar o build do frontend.');
}

// Middleware para SPA - redirecionar todas as rotas não-API para index.html
// IMPORTANTE: Este middleware DEVE vir DEPOIS de todas as rotas de API
app.get('*', (req, res, next) => {
  // Se a rota começar com /api ou /health, continuar para as rotas da API
  if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/metrics')) {
    return next();
  }

  // Servir o SPA React para todas as outras rotas
  if (fs.existsSync(indexPath)) {
    logger.info('✅ Servindo SPA React:', req.path);
    return res.sendFile(indexPath);
  } else {
    // Se não existir build, retornar erro amigável
    logger.error('❌ Build do frontend não encontrado');
    return res.status(503).json({
      error: 'Frontend não disponível',
      message: 'Execute "npm run build" para criar o build do frontend',
      path: indexPath
    });
  }
});

// ==================== ERROR HANDLING ====================

// Middleware para rotas não encontradas (exceto rotas já tratadas)
app.use((req, res, next) => {
  // Se chegou aqui e não foi tratado, é 404
  errorHandler.handleNotFound.bind(errorHandler)(req, res, next);
});

// CSRF error handler (deve vir antes do error handler global)
app.use(csrfErrorHandler);

// Security logging error handler
app.use(logUnauthorizedAttempts);

// Middleware de tratamento de erros global
app.use(errorHandler.handleError.bind(errorHandler));

// ==================== SERVER START ====================

async function startServer() {
  try {
    // 1. Validar variáveis de ambiente ANTES de qualquer inicialização
    logger.info('🔍 Validando variáveis de ambiente...');
    const { environmentValidator } = require('./utils/environmentValidator');

    const isValid = environmentValidator.validateAndLog();

    if (!isValid) {
      logger.error('❌ Validação de ambiente falhou. Servidor não pode iniciar.');
      console.error('❌ Validação de ambiente falhou. Verifique os logs acima para detalhes.');
      console.error('💡 Dica: Verifique se todas as variáveis obrigatórias estão configuradas em server/.env');
      process.exit(1);
    }

    logger.info('✅ Validação de ambiente concluída com sucesso');

    // 2. Verificar variáveis de ambiente críticas
    logger.info('🔧 Configuração de inicialização:', {
      node_env: NODE_ENV,
      port: PORT,
      supabase_url: process.env.SUPABASE_URL || 'not configured'
    });

    // 3. Inicializar banco de dados antes de iniciar o servidor
    await initializeDatabase();

    // Inicializar CampaignScheduler para campanhas agendadas
    logger.info('📅 Inicializando CampaignScheduler...');
    const CampaignScheduler = require('./services/CampaignScheduler');
    const campaignScheduler = new CampaignScheduler(db);
    campaignScheduler.start();
    logger.info('✅ CampaignScheduler iniciado');

    // Inicializar StateSynchronizer para sincronização de estado
    logger.info('🔄 Inicializando StateSynchronizer...');
    const StateSynchronizer = require('./services/StateSynchronizer');
    const stateSynchronizer = new StateSynchronizer(db, campaignScheduler);
    
    // Restaurar campanhas que estavam rodando antes do reinício
    const restoredCampaigns = await stateSynchronizer.restoreRunningCampaigns();
    if (restoredCampaigns.length > 0) {
      logger.info('📋 Campanhas restauradas após reinício', {
        count: restoredCampaigns.length,
        campaigns: restoredCampaigns.map(c => c.name)
      });
    }
    
    // Iniciar sincronização periódica
    stateSynchronizer.startSync();
    logger.info('✅ StateSynchronizer iniciado');

    // Inicializar SingleMessageScheduler para mensagens únicas agendadas
    logger.info('📅 Inicializando SingleMessageScheduler...');
    const SingleMessageScheduler = require('./services/SingleMessageScheduler');
    const singleMessageScheduler = new SingleMessageScheduler(db);
    singleMessageScheduler.start();
    logger.info('✅ SingleMessageScheduler iniciado');

    // Inicializar LogRotationService para limpeza de logs
    logger.info('🗑️ Inicializando LogRotationService...');
    const AuditLogger = require('./services/AuditLogger');
    const LogRotationService = require('./services/LogRotationService');
    const auditLogger = new AuditLogger(db);
    const logRotationService = new LogRotationService(db, auditLogger, {
      auditRetentionDays: 30,
      deletedCampaignRetentionDays: 90,
      errorRetentionDays: 30,
      cleanupIntervalMs: 24 * 60 * 60 * 1000 // 24 hours
    });
    logRotationService.start();
    logger.info('✅ LogRotationService iniciado');

    // Tornar os schedulers disponíveis globalmente para as rotas
    app.locals.campaignScheduler = campaignScheduler;
    app.locals.singleMessageScheduler = singleMessageScheduler;
    app.locals.stateSynchronizer = stateSynchronizer;
    app.locals.auditLogger = auditLogger;
    app.locals.logRotationService = logRotationService;

    // Inicializar sistema de monitoramento
    logger.info('🔍 Inicializando sistema de monitoramento...');
    alertManager.start();
    logger.info('✅ Sistema de alertas iniciado');

    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info('WUZAPI Manager Server iniciado', {
        port: PORT,
        environment: NODE_ENV,
        health_check: `http://localhost:${PORT}/health`,
        api_base: `http://localhost:${PORT}/api`,
        frontend_served: NODE_ENV === 'production' ? `http://localhost:${PORT}` : false,
        database: 'Supabase',
        database_url: process.env.SUPABASE_URL || 'not configured'
      });

      console.log(`🚀 WUZAPI Manager Server rodando na porta ${PORT}`);
      console.log(`📊 Environment: ${NODE_ENV}`);
      console.log(`🗄️ Database: Supabase (${process.env.SUPABASE_URL || 'not configured'})`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);

      if (NODE_ENV === 'production') {
        console.log(`🌐 Frontend servido em: http://localhost:${PORT}`);
      }
    });

    // Initialize WebSocket server
    const { initializeWebSocket, getChatHandler } = require('./websocket');
    const io = initializeWebSocket(server, db);
    app.locals.io = io;
    app.locals.chatHandler = getChatHandler();
    logger.info('✅ WebSocket server initialized');
    console.log('🔌 WebSocket server initialized');

    return server;
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error.message);
    console.error('❌ Erro ao iniciar servidor:', error.message);

    // Fornecer orientações específicas baseadas no tipo de erro
    if (error.message.includes('Supabase')) {
      console.error('💡 Dica: Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configurados corretamente');
      console.error(`💡 URL atual: ${process.env.SUPABASE_URL || 'não configurado'}`);
    } else if (error.code === 'EADDRINUSE') {
      console.error(`💡 Dica: A porta ${PORT} já está em uso. Tente uma porta diferente ou pare o processo que está usando esta porta`);
    }

    process.exit(1);
  }
}

// Iniciar servidor
startServer().then(server => {
  // Log de startup com informações de restart (se disponível)
  const restartCount = process.env.RESTART_COUNT || 'unknown';
  const previousExitCode = process.env.PREVIOUS_EXIT_CODE || 'unknown';
  logger.info('Servidor iniciado', { 
    restartCount,
    previousExitCode,
    pid: process.pid,
    nodeVersion: process.version,
    uptime: process.uptime()
  });

  // Configurar graceful shutdown
  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    // Prevenir múltiplas chamadas de shutdown
    if (isShuttingDown) {
      logger.warn('Shutdown já em andamento, ignorando sinal duplicado', { signal });
      return;
    }
    isShuttingDown = true;

    const shutdownStartTime = Date.now();
    logger.info('Iniciando shutdown gracioso', { 
      signal,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
    console.log(`\n🛑 Recebido ${signal}. Encerrando servidor graciosamente...`);

    const logShutdownComplete = (exitCode) => {
      const shutdownDuration = Date.now() - shutdownStartTime;
      logger.info('Shutdown completo', { 
        signal,
        exitCode,
        shutdownDurationMs: shutdownDuration,
        totalUptimeSeconds: Math.floor(process.uptime())
      });
      console.log(`✅ Shutdown completo (duração: ${shutdownDuration}ms)`);
      process.exit(exitCode);
    };

    server.close(() => {
      logger.info('Servidor HTTP encerrado');
      console.log('✅ Servidor HTTP encerrado');

      // Parar StateSynchronizer
      if (app.locals.stateSynchronizer) {
        app.locals.stateSynchronizer.stopSync();
        logger.info('StateSynchronizer encerrado');
        console.log('✅ StateSynchronizer encerrado');
      }

      // Parar CampaignScheduler
      if (app.locals.campaignScheduler) {
        app.locals.campaignScheduler.stop();
        logger.info('CampaignScheduler encerrado');
        console.log('✅ CampaignScheduler encerrado');
      }

      // Parar sistema de alertas
      alertManager.stop();
      logger.info('Sistema de alertas encerrado');
      console.log('✅ Sistema de alertas encerrado');

      // Fechar streams de log
      logger.close();

      // Fechar conexão com banco de dados
      if (db && typeof db.close === 'function') {
        db.close().then(() => {
          logger.info('Conexão com banco de dados encerrada');
          console.log('✅ Conexão com banco de dados encerrada');
          logShutdownComplete(0);
        }).catch(err => {
          logger.error('Erro ao fechar banco de dados:', err.message);
          console.error('❌ Erro ao fechar banco de dados:', err.message);
          logShutdownComplete(1);
        });
      } else {
        logShutdownComplete(0);
      }
    });

    // Forçar encerramento após 10 segundos
    setTimeout(() => {
      const shutdownDuration = Date.now() - shutdownStartTime;
      logger.error('Forçando encerramento após timeout', { 
        signal,
        shutdownDurationMs: shutdownDuration 
      });
      console.error(`❌ Forçando encerramento após timeout (${shutdownDuration}ms)`);
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}).catch(error => {
  logger.error('❌ Erro crítico na inicialização:', error.message);
  console.error('❌ Erro crítico na inicialização:', error.message);
  process.exit(1);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error_message: err.message,
    error_stack: err.stack
  });
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Exportar funções auxiliares para uso em outros módulos
module.exports = {
  invalidateBrandingCache,
  getCachedBrandingConfig
};