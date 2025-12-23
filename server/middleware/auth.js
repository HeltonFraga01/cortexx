const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const { validateSupabaseToken } = require('./supabaseAuth');
const { validateSession, destroyCorruptedSession, getSessionDiagnostics } = require('../utils/sessionHelper');
const { normalizeToUUID } = require('../utils/userIdHelper');
const { setRlsContext, setSuperadminContext } = require('./rlsContext');

/**
 * Helper to get user ID from request (JWT or session)
 * Exported for use in route handlers
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
}

/**
 * Helper to get user role from request (JWT or session)
 * Exported for use in route handlers
 */
function getUserRole(req) {
  // Check Supabase metadata first, then standard role, then session
  return req.user?.user_metadata?.role || req.user?.role || req.session?.role;
}

/**
 * Helper to get user token from request (JWT metadata or session)
 * Exported for use in route handlers
 * 
 * Priority:
 * 1. JWT user_metadata.userToken
 * 2. Session userToken
 * 3. Cached wuzapiToken from account lookup (set by middleware)
 */
function getUserToken(req) {
  return req.user?.user_metadata?.userToken || req.session?.userToken || req.wuzapiToken;
}

/**
 * Helper to get WUZAPI token from account table or WUZAPI API
 * This is an async function that looks up the token from the database
 * If the token in the database is invalid, it tries to fetch from WUZAPI API
 * 
 * @param {string} userId - User ID (Supabase Auth ID)
 * @param {string} wuzapiId - Optional WUZAPI user ID from JWT metadata
 * @returns {Promise<string|null>} WUZAPI token or null
 */
async function getWuzapiTokenFromAccount(userId, wuzapiId = null) {
  if (!userId) return null;
  
  try {
    const SupabaseService = require('../services/SupabaseService');
    
    // Use helper to normalize to UUID format
    const uuidUserId = normalizeToUUID(userId);
    
    if (!uuidUserId) {
      logger.debug('Invalid userId format', { userId: userId.substring(0, 8) + '...' });
      return null;
    }
    
    const { data: account, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, wuzapi_token')
      .eq('owner_user_id', uuidUserId)
      .single();
    
    if (error || !account) {
      logger.debug('No account found for user', { userId: userId.substring(0, 8) + '...' });
      return null;
    }
    
    const storedToken = account.wuzapi_token;
    
    // If we have a wuzapiId from JWT metadata, try to get the real token from WUZAPI
    // This handles the case where the stored token is actually the userId (incorrect)
    if (wuzapiId) {
      try {
        const wuzapiClient = require('../utils/wuzapiClient');
        const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
        
        if (adminToken) {
          // Get user from WUZAPI by ID
          const response = await wuzapiClient.getUser(wuzapiId, adminToken);
          
          if (response.success && response.data?.data?.token) {
            const realToken = response.data.data.token;
            
            // If the stored token is different from the real token, update the database
            if (realToken !== storedToken) {
              logger.info('Updating wuzapi_token in accounts table', {
                userId: userId.substring(0, 8) + '...',
                wuzapiId: wuzapiId.substring(0, 8) + '...',
                oldTokenPrefix: storedToken?.substring(0, 8) + '...',
                newTokenPrefix: realToken.substring(0, 8) + '...'
              });
              
              // Update the account with the correct token
              await SupabaseService.adminClient
                .from('accounts')
                .update({ wuzapi_token: realToken, updated_at: new Date().toISOString() })
                .eq('id', account.id);
              
              return realToken;
            }
          }
        }
      } catch (wuzapiError) {
        logger.warn('Failed to fetch WUZAPI token from API, using stored token', {
          error: wuzapiError.message,
          wuzapiId: wuzapiId?.substring(0, 8) + '...'
        });
      }
    }
    
    return storedToken;
  } catch (error) {
    logger.error('Error fetching WUZAPI token from account', { 
      error: error.message, 
      userId: userId?.substring(0, 8) + '...' 
    });
    return null;
  }
}

/**
 * Middleware de debug de sessão (apenas em desenvolvimento)
 * Loga informações detalhadas sobre o estado da sessão em cada requisição admin
 */
function debugSession(req, res, next) {
  // Apenas em modo de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    const sessionInfo = {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId || null,
      role: req.session?.role || null,
      hasToken: !!req.session?.userToken,
      tokenLength: req.session?.userToken?.length || 0,
      lastActivity: req.session?.lastActivity || null,
      path: req.path,
      method: req.method,
      ip: req.ip
    };

    logger.debug('Session state on admin request', {
      type: 'session_debug',
      session: sessionInfo
    });
  }
  
  next();
}

/**
 * Middleware que requer autenticação (admin ou user)
 * 
 * Verifica se existe uma sessão ativa com userId ou JWT válido.
 * Se não houver, retorna 401 Unauthorized.
 * 
 * FIXED: Now properly validates session data, not just session existence.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Check for JWT token in Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await validateSupabaseToken(req, res, () => {
        const userId = getUserId(req);
        
        if (!userId) {
          logger.error('Authentication failed - Invalid JWT', {
            type: 'authentication_failure',
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          securityLogger.logUnauthorizedAccess({
            ip: req.ip,
            path: req.path,
            reason: 'Invalid JWT token'
          });
          
          return res.status(401).json({ 
            error: 'Autenticação necessária',
            code: 'AUTH_REQUIRED',
            timestamp: new Date().toISOString()
          });
        }
        
        // Log de autenticação bem-sucedida em modo debug
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Authentication successful (JWT)', {
            type: 'authentication_success',
            userId,
            role: getUserRole(req),
            authMethod: 'jwt',
            path: req.path,
            method: req.method
          });
        }
        
        next();
      });
      return;
    } catch (error) {
      logger.error('JWT validation error in requireAuth', {
        error: error.message,
        path: req.path
      });
      // Fall through to session-based auth
    }
  }

  // Session-based authentication with proper validation
  const validation = validateSession(req.session);
  
  if (!validation.valid) {
    // Handle corrupted session (exists but missing data)
    if (validation.corrupted) {
      logger.error('Authentication failed - Corrupted session detected', {
        type: 'authentication_failure',
        reason: validation.reason,
        session: getSessionDiagnostics(req),
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Destroy corrupted session and clear cookie
      await destroyCorruptedSession(req, res);
      
      securityLogger.logUnauthorizedAccess({
        ip: req.ip,
        path: req.path,
        reason: `Corrupted session: ${validation.reason}`
      });
      
      return res.status(401).json({ 
        error: 'Sessão corrompida. Por favor, faça login novamente.',
        code: 'SESSION_CORRUPTED',
        timestamp: new Date().toISOString()
      });
    }
    
    // No session at all
    logger.error('Authentication failed - No active session', {
      type: 'authentication_failure',
      reason: validation.reason,
      session: getSessionDiagnostics(req),
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    securityLogger.logUnauthorizedAccess({
      ip: req.ip,
      path: req.path,
      reason: 'No active session'
    });
    
    return res.status(401).json({ 
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }
  
  // Log de autenticação bem-sucedida em modo debug
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Authentication successful (session)', {
      type: 'authentication_success',
      userId: req.session.userId,
      role: req.session.role,
      authMethod: 'session',
      path: req.path,
      method: req.method
    });
  }
  
  // Atualizar última atividade
  req.session.lastActivity = new Date();
  
  next();
}

/**
 * Middleware que aceita token de admin direto no header (para APIs externas)
 * 
 * Verifica o header Authorization contra o token de admin configurado.
 * Útil para integrações com n8n, Zapier, Make, etc.
 */
function requireAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.VITE_ADMIN_TOKEN;
  
  // SECURITY: Reject all requests if admin token is not configured
  if (!adminToken) {
    logger.error('VITE_ADMIN_TOKEN not configured - admin token authentication disabled', {
      type: 'admin_token_not_configured',
      path: req.path,
      method: req.method,
      ip: req.ip,
      warning: 'Server is rejecting admin token requests due to missing configuration'
    });
    
    securityLogger.logUnauthorizedAccess({
      ip: req.ip,
      path: req.path,
      reason: 'Admin token not configured on server'
    });
    
    return res.status(500).json({ 
      error: 'Erro de configuração do servidor',
      code: 'ADMIN_TOKEN_NOT_CONFIGURED',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!authHeader || authHeader !== adminToken) {
    logger.error('Admin token authentication failed', {
      type: 'admin_token_auth_failure',
      hasHeader: !!authHeader,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    securityLogger.logUnauthorizedAccess({
      ip: req.ip,
      path: req.path,
      reason: 'Invalid or missing admin token'
    });
    
    return res.status(401).json({ 
      error: 'Token de administrador inválido',
      code: 'INVALID_ADMIN_TOKEN',
      timestamp: new Date().toISOString()
    });
  }
  
  // Log de acesso bem-sucedido
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Admin token authentication successful', {
      type: 'admin_token_auth_success',
      path: req.path,
      method: req.method
    });
  }
  
  next();
}

/**
 * Middleware que requer role de admin
 * 
 * Verifica se existe uma sessão ativa E se o role é 'admin'.
 * Suporta tanto JWT (Supabase Auth) quanto sessão tradicional.
 * Se não houver sessão/JWT, retorna 401.
 * Se houver sessão/JWT mas não for admin, retorna 403.
 * 
 * FIXED: Now properly validates session data and handles corrupted sessions.
 */
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Check for JWT token in Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Use Supabase JWT authentication
      await validateSupabaseToken(req, res, () => {
        const userId = getUserId(req);
        const userRole = getUserRole(req);
        
        // Log detalhado do estado da autenticação
        const authState = {
          userId,
          role: userRole,
          authMethod: 'jwt',
          path: req.path,
          method: req.method,
          ip: req.ip
        };

        if (!userId) {
          logger.error('Admin authentication failed - Invalid JWT', {
            type: 'admin_auth_failure',
            reason: 'invalid_jwt',
            auth: authState,
            userAgent: req.get('User-Agent')
          });
          
          securityLogger.logUnauthorizedAccess({
            ip: req.ip,
            path: req.path,
            reason: 'Invalid JWT token'
          });
          
          return res.status(401).json({ 
            error: 'Autenticação necessária',
            code: 'AUTH_REQUIRED',
            timestamp: new Date().toISOString()
          });
        }
        
        // Check if user has admin role (admin, tenant_admin, or owner)
        const validAdminRoles = ['admin', 'tenant_admin', 'tenant_admin_impersonated', 'owner', 'administrator'];
        if (!validAdminRoles.includes(userRole)) {
          logger.error('Admin authentication failed - Insufficient permissions (JWT)', {
            type: 'admin_auth_failure',
            reason: 'insufficient_permissions',
            auth: authState,
            userAgent: req.get('User-Agent')
          });
          
          securityLogger.logUnauthorizedAccess({
            userId,
            ip: req.ip,
            path: req.path,
            reason: 'Insufficient permissions - admin role required'
          });
          
          return res.status(403).json({ 
            error: 'Acesso de administrador necessário',
            code: 'FORBIDDEN',
            timestamp: new Date().toISOString()
          });
        }

        // Log de acesso admin bem-sucedido em modo debug
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Admin access granted (JWT)', {
            type: 'admin_access_granted',
            userId,
            role: userRole,
            authMethod: 'jwt',
            path: req.path,
            method: req.method
          });
        }
        
        next();
      });
      return;
    } catch (error) {
      logger.error('JWT validation error in requireAdmin', {
        error: error.message,
        path: req.path
      });
      // Fall through to session-based auth
    }
  }

  // Session-based authentication with proper validation
  const validation = validateSession(req.session);
  
  if (!validation.valid) {
    // Handle corrupted session (exists but missing data)
    if (validation.corrupted) {
      logger.error('Admin authentication failed - Corrupted session detected', {
        type: 'admin_auth_failure',
        reason: validation.reason,
        session: getSessionDiagnostics(req),
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Destroy corrupted session and clear cookie
      await destroyCorruptedSession(req, res);
      
      securityLogger.logUnauthorizedAccess({
        ip: req.ip,
        path: req.path,
        reason: `Corrupted session: ${validation.reason}`
      });
      
      return res.status(401).json({ 
        error: 'Sessão corrompida. Por favor, faça login novamente.',
        code: 'SESSION_CORRUPTED',
        timestamp: new Date().toISOString()
      });
    }
    
    // No session at all
    logger.error('Admin authentication failed - No active session', {
      type: 'admin_auth_failure',
      reason: validation.reason,
      session: getSessionDiagnostics(req),
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    securityLogger.logUnauthorizedAccess({
      ip: req.ip,
      path: req.path,
      reason: 'No active session'
    });
    
    return res.status(401).json({ 
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }
  
  // Check admin role
  const validAdminRoles = ['admin', 'tenant_admin', 'tenant_admin_impersonated', 'owner', 'administrator'];
  if (!validAdminRoles.includes(req.session.role)) {
    logger.error('Admin authentication failed - Insufficient permissions', {
      type: 'admin_auth_failure',
      reason: 'insufficient_permissions',
      session: getSessionDiagnostics(req),
      userAgent: req.get('User-Agent')
    });
    
    securityLogger.logUnauthorizedAccess({
      userId: req.session.userId,
      ip: req.ip,
      path: req.path,
      reason: 'Insufficient permissions - admin role required'
    });
    
    return res.status(403).json({ 
      error: 'Acesso de administrador necessário',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    });
  }

  // Log detalhado quando token está ausente da sessão
  if (!req.session.userToken) {
    logger.warn('Admin token missing from session', {
      type: 'admin_token_missing',
      session: getSessionDiagnostics(req),
      userAgent: req.get('User-Agent'),
      warning: 'Session exists with admin role but userToken is missing'
    });
  }

  // Log de acesso admin bem-sucedido em modo debug
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Admin access granted (session)', {
      type: 'admin_access_granted',
      userId: req.session.userId,
      hasToken: !!req.session.userToken,
      authMethod: 'session',
      path: req.path,
      method: req.method
    });
  }
  
  // Atualizar última atividade
  req.session.lastActivity = new Date();
  
  next();
}

/**
 * Middleware que requer role de user (não admin)
 * 
 * Verifica se existe uma sessão ativa E se o role é 'user'.
 * Suporta tanto JWT (Supabase Auth) quanto sessão tradicional.
 * Também garante que o usuário tenha uma subscription ativa.
 * 
 * FIXED: Now properly validates session data and handles corrupted sessions.
 * FIXED: Now supports JWT authentication in addition to session-based auth.
 * 
 * Requirements: 1.1, 1.2
 */
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Check for JWT token in Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await validateSupabaseToken(req, res, async () => {
        const userId = getUserId(req);
        const userRole = getUserRole(req);
        
        if (!userId) {
          logger.error('User authentication failed - Invalid JWT', {
            type: 'user_auth_failure',
            reason: 'invalid_jwt',
            path: req.path,
            method: req.method,
            ip: req.ip
          });
          
          securityLogger.logUnauthorizedAccess({
            ip: req.ip,
            path: req.path,
            reason: 'Invalid JWT token'
          });
          
          return res.status(401).json({ 
            error: 'Autenticação necessária',
            code: 'AUTH_REQUIRED',
            timestamp: new Date().toISOString()
          });
        }
        
        // Check if user has user role (not admin)
        if (userRole !== 'user') {
          logger.error('User authentication failed - Wrong role (JWT)', {
            type: 'user_auth_failure',
            reason: 'wrong_role',
            userId,
            role: userRole,
            path: req.path,
            method: req.method,
            ip: req.ip
          });
          
          securityLogger.logUnauthorizedAccess({
            userId,
            ip: req.ip,
            path: req.path,
            reason: 'User role required'
          });
          
          return res.status(403).json({ 
            error: 'Acesso de usuário necessário',
            code: 'FORBIDDEN',
            timestamp: new Date().toISOString()
          });
        }
        
        // Ensure user has a subscription (assign default plan if missing)
        try {
          const SubscriptionEnsurer = require('../services/SubscriptionEnsurer');
          const subscriptionEnsurer = new SubscriptionEnsurer();
          await subscriptionEnsurer.ensureSubscription(userId);
        } catch (error) {
          logger.warn('Failed to ensure subscription in requireUser middleware (JWT)', {
            userId,
            error: error.message
          });
        }
        
        // Fetch WUZAPI token from account if not in JWT metadata
        if (!getUserToken(req)) {
          try {
            const wuzapiId = req.user?.user_metadata?.wuzapi_id;
            const wuzapiToken = await getWuzapiTokenFromAccount(userId, wuzapiId);
            if (wuzapiToken) {
              req.wuzapiToken = wuzapiToken;
              logger.debug('WUZAPI token fetched from account', { 
                userId: userId.substring(0, 8) + '...',
                hasToken: true 
              });
            }
          } catch (error) {
            logger.warn('Failed to fetch WUZAPI token from account', {
              userId: userId.substring(0, 8) + '...',
              error: error.message
            });
          }
        }
        
        if (process.env.NODE_ENV === 'development') {
          logger.debug('User access granted (JWT)', {
            type: 'user_access_granted',
            userId,
            role: userRole,
            hasWuzapiToken: !!getUserToken(req),
            authMethod: 'jwt',
            path: req.path,
            method: req.method
          });
        }
        
        next();
      });
      return;
    } catch (error) {
      logger.error('JWT validation error in requireUser', {
        error: error.message,
        path: req.path
      });
      // Fall through to session-based auth
    }
  }

  // Session-based authentication with proper validation
  const validation = validateSession(req.session);
  
  if (!validation.valid) {
    // Handle corrupted session (exists but missing data)
    if (validation.corrupted) {
      logger.error('User authentication failed - Corrupted session detected', {
        type: 'user_auth_failure',
        reason: validation.reason,
        session: getSessionDiagnostics(req),
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      // Destroy corrupted session and clear cookie
      await destroyCorruptedSession(req, res);
      
      securityLogger.logUnauthorizedAccess({
        ip: req.ip,
        path: req.path,
        reason: `Corrupted session: ${validation.reason}`
      });
      
      return res.status(401).json({ 
        error: 'Sessão corrompida. Por favor, faça login novamente.',
        code: 'SESSION_CORRUPTED',
        timestamp: new Date().toISOString()
      });
    }
    
    // No session at all
    securityLogger.logUnauthorizedAccess({
      ip: req.ip,
      path: req.path,
      reason: 'No active session'
    });
    
    return res.status(401).json({ 
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.session.role !== 'user') {
    securityLogger.logUnauthorizedAccess({
      userId: req.session.userId,
      ip: req.ip,
      path: req.path,
      reason: 'User role required'
    });
    
    return res.status(403).json({ 
      error: 'Acesso de usuário necessário',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    });
  }
  
  // Ensure user has a subscription (assign default plan if missing)
  try {
    const SubscriptionEnsurer = require('../services/SubscriptionEnsurer');
    const subscriptionEnsurer = new SubscriptionEnsurer();
    await subscriptionEnsurer.ensureSubscription(req.session.userId);
  } catch (error) {
    // Log but don't block - subscription check is not critical for auth
    logger.warn('Failed to ensure subscription in requireUser middleware', {
      userId: req.session.userId,
      error: error.message
    });
  }
  
  // Atualizar última atividade
  req.session.lastActivity = new Date();
  
  next();
}

/**
 * Middleware that combines authentication with RLS context setting
 * Use this for routes that need both auth and RLS-aware database queries
 * 
 * @param {string} authType - 'admin', 'user', or 'any' (default: 'any')
 * @returns {Function[]} Array of middleware functions
 */
function withRlsContext(authType = 'any') {
  const authMiddleware = authType === 'admin' ? requireAdmin : 
                         authType === 'user' ? requireUser : 
                         requireAuth;
  
  return [authMiddleware, setRlsContext];
}

/**
 * Middleware for superadmin routes with RLS context
 * Sets superadmin context for RLS bypass
 */
function withSuperadminContext() {
  return [setSuperadminContext];
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminToken,
  requireUser,
  debugSession,
  getUserId,
  getUserRole,
  getUserToken,
  getWuzapiTokenFromAccount,
  withRlsContext,
  withSuperadminContext,
  setRlsContext,
  setSuperadminContext
};
