/**
 * Centralized Routes Configuration
 * Manages all route imports and setup
 */

const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { requireAdmin } = require('../middleware/auth');
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
const userContactsRoutes = require('./userContactsRoutes');
const mediaRoutes = require('./mediaRoutes');
const botProxyRoutes = require('./botProxyRoutes');
const linkPreviewRoutes = require('./linkPreviewRoutes');
const userDashboardRoutes = require('./userDashboardRoutes');

// Chat API v1 Routes (external API)
const chatApiV1Routes = require('./api/v1/chatRoutes');
const webhookApiV1Routes = require('./api/v1/webhookRoutes');
const apiKeyRoutes = require('./api/v1/apiKeyRoutes');

// User Account Routes (subscription, quotas, features)
const userSubscriptionRoutes = require('./userSubscriptionRoutes');
const userBillingRoutes = require('./userBillingRoutes');
const userPlanRoutes = require('./userPlanRoutes');
const resellerRoutes = require('./resellerRoutes');

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
const adminTenantApiSettingsRoutes = require('./adminTenantApiSettingsRoutes');
const adminStripeRoutes = require('./adminStripeRoutes');
const adminCreditPackagesRoutes = require('./adminCreditPackagesRoutes');
const stripeWebhookRoutes = require('./stripeWebhookRoutes');

// Superadmin Routes
const superadminAuthRoutes = require('./superadminAuthRoutes');
const superadminTenantRoutes = require('./superadminTenantRoutes');
const superadminTenantAccountRoutes = require('./superadminTenantAccountRoutes');
const superadminTenantAgentRoutes = require('./superadminTenantAgentRoutes');
const superadminMetricsRoutes = require('./superadminMetricsRoutes');
const superadminImpersonationRoutes = require('./superadminImpersonationRoutes');

// Tenant Admin Routes
const tenantBrandingRoutes = require('./tenantBrandingRoutes');
const tenantPlanRoutes = require('./tenantPlanRoutes');
const tenantAccountRoutes = require('./tenantAccountRoutes');

// Auth Routes
const authRoutes = require('./authRoutes');
const userAuthRoutes = require('./userAuthRoutes');

// Independent User Management Routes
const adminUserManagementRoutes = require('./adminUserManagementRoutes');

// Public Routes
const publicRoutes = require('./publicRoutes');

// Inbox Context Routes (Supabase Auth)
const inboxContextRoutes = require('./inboxContextRoutes');
const sessionInboxWebhookRoutes = require('./sessionInboxWebhookRoutes');

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
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', userAuthRoutes); // Independent user auth routes
  app.use('/api/public', publicRoutes);
  
  // Superadmin Routes (mixed auth - login is public, others require auth)
  // IMPORTANT: More specific routes (with nested paths like /tenants/:id/accounts) 
  // MUST come BEFORE less specific routes (like /tenants/:id) to avoid route conflicts
  app.use('/api/superadmin', superadminAuthRoutes);
  app.use('/api/superadmin', superadminTenantAccountRoutes); // Must come before superadminTenantRoutes
  app.use('/api/superadmin', superadminTenantAgentRoutes);   // Must come before superadminTenantRoutes
  app.use('/api/superadmin', superadminTenantRoutes);        // Has /tenants/:id catch-all
  app.use('/api/superadmin', superadminMetricsRoutes);
  app.use('/api/superadmin', superadminImpersonationRoutes);
  
  // Tenant Admin Routes (require tenant admin auth and tenant context)
  app.use('/api/tenant', tenantBrandingRoutes);
  app.use('/api/tenant', tenantPlanRoutes);
  app.use('/api/tenant', tenantAccountRoutes);
  
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
  app.use('/api/admin/tenant/api-settings', adminTenantApiSettingsRoutes);
  app.use('/api/admin/stripe', adminStripeRoutes);
  app.use('/api/admin/credit-packages', adminCreditPackagesRoutes);
  
  // Independent User Management Routes (admin)
  app.use('/api/admin/independent-users', adminUserManagementRoutes);
  
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
  // New contacts routes (Supabase-based) - more specific paths first
  app.use('/api/user/contacts/tags', userContactsRoutes);
  app.use('/api/user/contacts/groups', userContactsRoutes);
  app.use('/api/user/contacts/import', userContactsRoutes);
  app.use('/api/user/contacts/migrate', userContactsRoutes);
  app.use('/api/user/contacts', userContactsRoutes);
  // Legacy contact import routes (for backward compatibility)
  app.use('/api/user/contacts', contactImportRoutes);
  app.use('/api/user/plans', userPlanRoutes); // Available plans for upgrade - MUST come BEFORE generic user routes
  app.use('/api/user', userSubscriptionRoutes); // subscription, quotas, features
  app.use('/api/user', userBillingRoutes); // Stripe billing routes
  app.use('/api/reseller', resellerRoutes); // Reseller/Connect routes
  app.use('/api/user/drafts', userDraftRoutes);
  // Inbox Context Routes (Supabase Auth user inbox binding)
  app.use('/api/user', inboxContextRoutes);
  // Session Inbox Webhook Routes (tenant-scoped webhook configuration)
  app.use('/api/session/inboxes', sessionInboxWebhookRoutes);
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
  app.use('/api/user/dashboard', userDashboardRoutes);
  
  // Chat API v1 (external API with API key auth)
  // Requirements: REQ-2.1, REQ-2.2 (chat-api-realtime-migration)
  app.use('/api/v1/chat', chatApiV1Routes);
  app.use('/api/v1/webhooks', webhookApiV1Routes);
  app.use('/api/v1/api-keys', apiKeyRoutes);
  
  // Stripe Webhook (no auth - uses signature verification)
  app.use('/api/webhooks/stripe', stripeWebhookRoutes);
  
  // Monitoring Routes (root level)
  app.use('/', monitoringRoutes);
  
  // Helper functions for JWT + Session auth
  function getUserId(req) {
    return req.user?.id || req.session?.userId;
  }
  
  function getUserRole(req) {
    return req.user?.role || req.session?.role;
  }
  
  // Admin dashboard stats route (usa middleware requireAdmin que suporta JWT e sessão)
  app.get('/api/admin/dashboard-stats', requireAdmin, async (req, res) => {
    // Priorizar token do ambiente sobre token da sessão
    const envAdminToken = process.env.WUZAPI_ADMIN_TOKEN;
    const sessionToken = req.session?.userToken;
    const adminToken = envAdminToken || sessionToken;
    const isAgentLogin = !!req.session?.agentRole;
    const userId = getUserId(req);
    
    // Log de extração de token
    logger.debug('Dashboard stats request', {
      type: 'dashboard_stats',
      sessionId: req.sessionID,
      userId: userId,
      hasEnvToken: !!envAdminToken,
      hasSessionToken: !!sessionToken,
      usingEnvToken: !!envAdminToken,
      isAgentLogin,
      agentRole: req.session?.agentRole,
      path: req.path
    });
    
    try {
      const axios = require('axios');
      const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
      
      // Buscar health da API (não requer token)
      let healthData = {};
      try {
        const healthResponse = await axios.get(`${wuzapiBaseUrl}/health`, {
          timeout: 5000
        });
        healthData = healthResponse.data || {};
      } catch (healthError) {
        logger.warn('Failed to fetch WUZAPI health', { error: healthError.message });
      }
      
      // Se não tem nenhum token WUZAPI disponível, retornar dados básicos
      if (!adminToken) {
        logger.info('Admin dashboard stats - no WUZAPI token available', {
          userId: userId,
          agentRole: req.session?.agentRole,
          accountId: req.session?.accountId || req.user?.accountId
        });
        
        // Retornar estatísticas básicas do sistema sem dados de usuários WUZAPI
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const formatUptime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
          if (minutes > 0) return `${minutes}m ${secs}s`;
          return `${secs}s`;
        };
        
        const bytesToMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
        
        return res.json({
          success: true,
          data: {
            systemStatus: healthData.status || 'ok',
            uptime: healthData.uptime || formatUptime(uptime),
            version: healthData.version || '1.0.0',
            totalUsers: 0,
            connectedUsers: 0,
            loggedInUsers: 0,
            activeConnections: healthData.active_connections || 0,
            memoryStats: healthData.memory_stats || {
              alloc_mb: bytesToMB(memoryUsage.heapUsed),
              sys_mb: bytesToMB(memoryUsage.rss),
              total_alloc_mb: bytesToMB(memoryUsage.heapTotal),
              num_gc: 0
            },
            goroutines: healthData.goroutines || 0,
            users: [],
            wuzapiConfigured: false,
            message: 'WUZAPI token não configurado. Configure WUZAPI_ADMIN_TOKEN no ambiente.'
          }
        });
      }
      
      // Buscar lista de usuários com token WUZAPI
      const usersResponse = await axios.get(`${wuzapiBaseUrl}/admin/users`, {
        headers: {
          'Authorization': adminToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
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
        users: usersData.slice(0, 10),
        wuzapiConfigured: true
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
      
      // Return success with empty data instead of error to prevent logout loop
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
          users: [],
          wuzapiConfigured: false,
          error: 'Erro ao conectar com WUZAPI'
        }
      });
    }
  });
}

module.exports = {
  setupRoutes
};