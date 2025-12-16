const securityLogger = require('../utils/securityLogger');

/**
 * Middleware para log de requisições admin
 * 
 * Loga todas as requisições para endpoints administrativos
 */
function logAdminRequests(req, res, next) {
  if (req.path.startsWith('/api/admin')) {
    securityLogger.logAdminAccess({
      userId: req.session?.userId || 'anonymous',
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
      userId: req.session?.userId,
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
 */
function logSessionChanges(req, res, next) {
  // Hook para log de criação de sessão
  if (req.session && !req.session.logged) {
    req.session.logged = true;
    
    // Log quando sessão é criada (após login)
    if (req.session.userId) {
      securityLogger.logSessionChange('created', {
        userId: req.session.userId,
        sessionId: req.sessionID,
        ip: req.ip
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
