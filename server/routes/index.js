/**
 * Centralized Routes Configuration
 * Manages all route imports and setup
 */

const { logger } = require('../utils/logger');
const sessionRoutes = require('./sessionRoutes');
const adminRoutes = require('./adminRoutes');
const brandingRoutes = require('./brandingRoutes');
const monitoringRoutes = require('./monitoring');
const databaseRoutes = require('./databaseRoutes');
const userRoutes = require('./userRoutes');
const userDraftRoutes = require('./userDraftRoutes');
const webhookRoutes = require('./webhookRoutes');
const chatRoutes = require('./chatRoutes');
const chatInboxRoutes = require('./chatInboxRoutes');
const userBotRoutes = require('./userBotRoutes');
const userBotTestRoutes = require('./userBotTestRoutes');
const userWebhookRoutes = require('./userWebhookRoutes');
const adminTablePermissionsRoutes = require('./adminTablePermissionsRoutes');
const adminTablesRoutes = require('./adminTablesRoutes');
const adminCustomThemesRoutes = require('./adminCustomThemesRoutes');
const adminAutomationRoutes = require('./adminAutomationRoutes');
const userTableAccessRoutes = require('./userTableAccessRoutes');
const userCustomThemesRoutes = require('./userCustomThemesRoutes');
const contactImportRoutes = require('./contactImportRoutes');
const mediaRoutes = require('./mediaRoutes');
const botProxyRoutes = require('./botProxyRoutes');
const linkPreviewRoutes = require('./linkPreviewRoutes');

// User Account Routes (subscription, quotas, features)
const userSubscriptionRoutes = require('./userSubscriptionRoutes');

// Admin User Management Routes
const adminPlanRoutes = require('./adminPlanRoutes');
const adminUserSubscriptionRoutes = require('./adminUserSubscriptionRoutes');
const adminUserQuotaRoutes = require('./adminUserQuotaRoutes');
const adminUserFeatureRoutes = require('./adminUserFeatureRoutes');
const adminUserActionRoutes = require('./adminUserActionRoutes');
const adminBulkActionRoutes = require('./adminBulkActionRoutes');
const adminUserInboxRoutes = require('./adminUserInboxRoutes');
const adminDashboardRoutes = require('./adminDashboardRoutes');
const adminAuditRoutes = require('./adminAuditRoutes');
const adminReportRoutes = require('./adminReportRoutes');
const adminSettingsRoutes = require('./adminSettingsRoutes');
const adminApiSettingsRoutes = require('./adminApiSettingsRoutes');

logger.debug('contactImportRoutes loaded', { 
  type: typeof contactImportRoutes, 
  routeCount: contactImportRoutes.stack ? contactImportRoutes.stack.length : 0 
});

/**
 * Setup all application routes
 * @param {Express} app - Express application instance
 */
function setupRoutes(app) {
  // Public Routes (sem autenticação) - devem vir ANTES das rotas protegidas
  app.use('/api/branding', brandingRoutes);
  
  // API Routes (protegidas)
  app.use('/api/session', sessionRoutes);
  
  // Admin User Management Routes - MUST come BEFORE adminRoutes to avoid route conflicts
  // These routes have more specific paths like /users/:userId/subscription
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
  app.use('/api/admin/api-settings', adminApiSettingsRoutes);
  
  // Generic admin routes - MUST come AFTER specific routes
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin/table-permissions', adminTablePermissionsRoutes);
  app.use('/api/admin/tables', adminTablesRoutes);
  app.use('/api/admin/custom-themes', adminCustomThemesRoutes);
  app.use('/api/admin/automation', adminAutomationRoutes);
  app.use('/api/database-connections', databaseRoutes);
  // IMPORTANTE: Rotas mais específicas devem vir antes das genéricas
  logger.debug('Registering /api/user/contacts', { 
    routeCount: contactImportRoutes.stack ? contactImportRoutes.stack.length : 0 
  });
  app.use('/api/user/contacts', contactImportRoutes);
  app.use('/api/user', userSubscriptionRoutes); // subscription, quotas, features
  app.use('/api/user/drafts', userDraftRoutes);
  // IMPORTANT: userBotTestRoutes MUST come BEFORE userBotRoutes
  // because userBotRoutes has a /:id catch-all route that would intercept test routes
  app.use('/api/user/bots', userBotTestRoutes); // Bot test chat routes
  app.use('/api/user/bots', userBotRoutes);
  app.use('/api/user/outgoing-webhooks', userWebhookRoutes);
  app.use('/api/user/custom-themes', userCustomThemesRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/webhook', webhookRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/chat/inbox', chatInboxRoutes);
  app.use('/api/tables', userTableAccessRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/bot', botProxyRoutes);
  app.use('/api/link-preview', linkPreviewRoutes);
  
  // Monitoring Routes (root level)
  app.use('/', monitoringRoutes);
  
  // Admin dashboard stats route (usando sessão)
  app.get('/api/admin/dashboard-stats', (req, res, next) => {
    // Log detalhado do estado da sessão
    const sessionState = {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId || null,
      role: req.session?.role || null,
      hasToken: !!req.session?.userToken,
      path: req.path,
      method: req.method,
      ip: req.ip
    };
    
    // Verificar se está autenticado como admin
    if (!req.session?.userId || req.session?.role !== 'admin') {
      logger.error('Dashboard stats access denied - Not authenticated as admin', {
        type: 'dashboard_stats_auth_failure',
        session: sessionState,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        error: 'Não autenticado como administrador',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log quando token está ausente da sessão
    if (!req.session.userToken) {
      logger.error('Token missing from session on dashboard-stats', {
        type: 'token_missing',
        session: sessionState,
        userAgent: req.get('User-Agent')
      });
    }
    
    next();
  }, async (req, res) => {
    // Verificar explicitamente se o token está na sessão
    if (!req.session.userToken) {
      logger.error('Token missing from session on dashboard-stats', {
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
    
    const adminToken = req.session.userToken;
    
    // Log de extração de token bem-sucedida
    logger.debug('Token extracted from session for dashboard-stats', {
      type: 'token_extracted',
      sessionId: req.sessionID,
      userId: req.session.userId,
      hasToken: true,
      path: req.path
    });
    
    try {
      const axios = require('axios');
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
      
      const stats = {
        systemStatus: healthData.status || 'unknown',
        uptime: healthData.uptime || '0s',
        version: healthData.version || '1.0.0',
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
        users: usersData.slice(0, 10)
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Failed to fetch admin dashboard stats', { 
        error: error.message,
        endpoint: '/api/admin/dashboard-stats'
      });
      
      res.json({
        success: true,
        data: {
          systemStatus: 'error',
          uptime: '0s',
          version: '1.0.0',
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
}

module.exports = {
  setupRoutes
};