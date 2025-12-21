const securityLogger = require('../utils/securityLogger');

/**
 * Security Logging Middleware
 * 
 * Provides logging for security-related events.
 * Supports both JWT (Supabase Auth) and session-based authentication.
 */

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
}

/**
 * Middleware para log de requisições admin
 * 
 * Loga todas as requisições para endpoints administrativos
 */
function logAdminRequests(req, res, next) {
  if (req.path.startsWith('/api/admin')) {
    securityLogger.logAdminAccess({
      userId: getUserId(req) || 'anonymous',
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }
  next();
}

/**
 * Middleware para log de tentativas de acesso não autorizado
 * 
 * Captura erros 401 e 403 e loga como tentativas não autorizadas
 */
function logUnauthorizedAttempts(err, req, res, next) {
  if (err.status === 401 || err.status === 403) {
    securityLogger.logUnauthorizedAccess({
      userId: getUserId(req),
      ip: req.ip,
      path: req.path,
      reason: err.message
    });
  }
  next(err);
}

/**
 * Middleware para log de rate limit excedido
 * 
 * Loga quando um cliente excede o rate limit
 */
function logRateLimitExceeded(req, res, next) {
  // Este middleware é chamado pelo express-rate-limit quando o limite é excedido
  securityLogger.logRateLimitExceeded({
    ip: req.ip,
    path: req.path,
    limit: req.rateLimit?.limit || 'unknown'
  });
  next();
}

/**
 * Middleware para log de mudanças de sessão
 * 
 * Loga criação e destruição de sessões
 * Supports both JWT (Supabase Auth) and session-based authentication
 */
function logSessionChanges(req, res, next) {
  // Hook para log de criação de sessão
  if (req.session && !req.session.logged) {
    req.session.logged = true;
    
    // Log quando sessão é criada (após login)
    const userId = getUserId(req);
    if (userId) {
      securityLogger.logSessionChange('created', {
        userId,
        sessionId: req.sessionID,
        ip: req.ip,
        authMethod: req.user ? 'jwt' : 'session'
      });
    }
  }
  
  next();
}

module.exports = {
  logAdminRequests,
  logUnauthorizedAttempts,
  logRateLimitExceeded,
  logSessionChanges
};
