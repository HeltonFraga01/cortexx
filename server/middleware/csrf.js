const csrf = require('csurf');
const { logger } = require('../utils/logger');

/**
 * CSRF Protection Middleware
 * 
 * Protege contra ataques Cross-Site Request Forgery (CSRF)
 * usando tokens únicos por sessão.
 * Supports both JWT (Supabase Auth) and session-based authentication.
 * 
 * Como funciona:
 * 1. Cliente faz GET /api/auth/csrf-token para obter token
 * 2. Cliente inclui token em requisições POST/PUT/DELETE
 * 3. Servidor valida token antes de processar requisição
 * 
 * Configuração:
 * - Usa sessão (não cookies) para armazenar secret
 * - Token deve ser enviado no header 'CSRF-Token' ou body '_csrf'
 */

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
}

/**
 * Middleware de proteção CSRF
 * 
 * Configuração:
 * - cookie: false - Usa sessão ao invés de cookie
 * - sessionKey: 'session' - Nome da chave de sessão
 * 
 * O token CSRF é gerado por sessão e validado em cada requisição
 * que modifica dados (POST, PUT, DELETE, PATCH)
 */
const csrfProtection = csrf({ 
  cookie: false, // Usar sessão ao invés de cookie (mais seguro)
  sessionKey: 'session', // Nome da chave de sessão no req
  
  // Métodos HTTP que requerem validação CSRF
  // GET, HEAD, OPTIONS não requerem (são idempotentes)
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
});

/**
 * Endpoint para obter token CSRF
 * 
 * GET /api/auth/csrf-token
 * 
 * Retorna:
 * {
 *   csrfToken: "token-unico-por-sessao"
 * }
 * 
 * O cliente deve:
 * 1. Fazer GET neste endpoint após login
 * 2. Armazenar token em memória (não localStorage)
 * 3. Incluir token em todas as requisições que modificam dados
 * 
 * Headers:
 * - CSRF-Token: {token}
 * 
 * Ou Body:
 * - _csrf: {token}
 */
function getCsrfToken(req, res) {
  try {
    const token = req.csrfToken();
    
    logger.debug('CSRF token generated', {
      userId: getUserId(req),
      sessionId: req.sessionID
    });
    
    res.json({ 
      csrfToken: token 
    });
  } catch (error) {
    logger.error('Error generating CSRF token', {
      error: error.message,
      userId: getUserId(req)
    });
    
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      code: 'CSRF_GENERATION_ERROR'
    });
  }
}

/**
 * Error handler para erros de validação CSRF
 * 
 * Captura erros EBADCSRFTOKEN e retorna resposta apropriada
 * 
 * Logs:
 * - IP do cliente
 * - Path da requisição
 * - User ID (se autenticado)
 * - Timestamp
 * 
 * Resposta:
 * - Status: 403 Forbidden
 * - Body: { error, code }
 */
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    // Token CSRF inválido ou ausente
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: getUserId(req),
      hasToken: !!req.headers['csrf-token'] || !!req.body._csrf,
      userAgent: req.get('user-agent')
    });
    
    return res.status(403).json({
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    });
  }
  
  // Outros erros, passar para próximo handler
  next(err);
}

/**
 * Middleware para skip CSRF em rotas específicas
 * 
 * Uso:
 * app.post('/webhook', skipCsrf, handler)
 * 
 * Útil para:
 * - Webhooks externos
 * - APIs públicas
 * - Endpoints que usam outros métodos de autenticação
 */
function skipCsrf(req, res, next) {
  req.csrfToken = () => 'skip';
  next();
}

/**
 * Middleware condicional de CSRF
 * 
 * Aplica CSRF apenas se usuário estiver autenticado
 * Supports both JWT (Supabase Auth) and session-based authentication
 * 
 * Uso:
 * app.use(conditionalCsrf)
 * 
 * Benefícios:
 * - Não bloqueia endpoints públicos
 * - Protege apenas usuários autenticados
 */
function conditionalCsrf(req, res, next) {
  const userId = getUserId(req);
  if (userId) {
    // Usuário autenticado, aplicar CSRF
    return csrfProtection(req, res, next);
  }
  // Usuário não autenticado, skip CSRF
  next();
}

module.exports = {
  csrfProtection,
  getCsrfToken,
  csrfErrorHandler,
  skipCsrf,
  conditionalCsrf
};
