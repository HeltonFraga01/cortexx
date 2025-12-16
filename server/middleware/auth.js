const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');

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
 * Verifica se existe uma sessão ativa com userId.
 * Se não houver, retorna 401 Unauthorized.
 */
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    // Log detalhado quando sessão está ausente
    logger.error('Authentication failed - No active session', {
      type: 'authentication_failure',
      sessionId: req.sessionID,
      hasSession: !!req.session,
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
    logger.debug('Authentication successful', {
      type: 'authentication_success',
      userId: req.session.userId,
      role: req.session.role,
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
 * Se não houver sessão, retorna 401.
 * Se houver sessão mas não for admin, retorna 403.
 */
function requireAdmin(req, res, next) {
  // Log detalhado do estado da sessão em requisições admin
  const sessionState = {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId || null,
    role: req.session?.role || null,
    hasToken: !!req.session?.userToken,
    tokenPresence: req.session?.userToken ? 'present' : 'missing',
    path: req.path,
    method: req.method,
    ip: req.ip
  };

  if (!req.session?.userId) {
    // Log detalhado quando sessão está ausente
    logger.error('Admin authentication failed - No active session', {
      type: 'admin_auth_failure',
      reason: 'no_session',
      session: sessionState,
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
  
  if (req.session.role !== 'admin') {
    // Log detalhado quando role não é admin
    logger.error('Admin authentication failed - Insufficient permissions', {
      type: 'admin_auth_failure',
      reason: 'insufficient_permissions',
      session: sessionState,
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
    logger.error('Admin token missing from session', {
      type: 'admin_token_missing',
      session: sessionState,
      userAgent: req.get('User-Agent'),
      warning: 'Session exists with admin role but userToken is missing'
    });
  }

  // Log de acesso admin bem-sucedido em modo debug
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Admin access granted', {
      type: 'admin_access_granted',
      userId: req.session.userId,
      hasToken: !!req.session.userToken,
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
 * Também garante que o usuário tenha uma subscription ativa.
 * 
 * Requirements: 1.1, 1.2
 */
async function requireUser(req, res, next) {
  if (!req.session?.userId) {
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
    const db = req.app.locals.db;
    if (db) {
      const SubscriptionEnsurer = require('../services/SubscriptionEnsurer');
      const subscriptionEnsurer = new SubscriptionEnsurer(db);
      await subscriptionEnsurer.ensureSubscription(req.session.userId);
    }
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

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminToken,
  requireUser,
  debugSession
};
