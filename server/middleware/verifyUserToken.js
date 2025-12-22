const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const { hashToken, ensureSessionUserId } = require('../utils/userIdResolver');
const { validateSupabaseToken } = require('./supabaseAuth');
const { getWuzapiTokenFromAccount } = require('./auth');

/**
 * @deprecated Este middleware está DEPRECATED e será removido em versões futuras.
 * 
 * Use os seguintes middlewares em vez deste:
 * - `requireAuth` - Para autenticação básica (JWT ou sessão)
 * - `requireUser` - Para endpoints de usuário (valida sessão e token)
 * - `requireAdmin` - Para endpoints de admin (valida role de admin)
 * 
 * Exemplo de migração:
 * ```javascript
 * // Antes (deprecated):
 * const verifyUserToken = require('../middleware/verifyUserToken');
 * router.get('/endpoint', verifyUserToken, handler);
 * 
 * // Depois (recomendado):
 * const { requireAuth, requireUser } = require('../middleware/auth');
 * router.get('/endpoint', requireAuth, handler);
 * // ou para endpoints que precisam de token WUZAPI:
 * router.get('/endpoint', requireUser, handler);
 * ```
 * 
 * @see server/middleware/auth.js para os novos middlewares
 */

// Cache para mapear token -> userId (evita chamadas repetidas ao admin endpoint)
const userIdCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para mapear userId -> wuzapiToken (evita chamadas repetidas ao banco)
const wuzapiTokenCache = new Map();
const WUZAPI_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Check if a token looks like a JWT (Supabase Auth token)
 * JWTs have 3 parts separated by dots and start with 'eyJ'
 */
function isJwtToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && token.startsWith('eyJ');
}

/**
 * Get WUZAPI token from cache or database
 * @param {string} userId - Supabase user ID
 * @param {string} wuzapiId - Optional WUZAPI user ID from JWT metadata
 */
async function getWuzapiToken(userId, wuzapiId = null) {
  if (!userId) return null;
  
  // Check cache first
  const cached = wuzapiTokenCache.get(userId);
  if (cached && Date.now() - cached.timestamp < WUZAPI_CACHE_TTL) {
    logger.debug('WUZAPI token obtained from cache', { userId: userId.substring(0, 8) + '...' });
    return cached.token;
  }
  
  // Fetch from database (and potentially from WUZAPI API if wuzapiId is provided)
  const token = await getWuzapiTokenFromAccount(userId, wuzapiId);
  if (token) {
    wuzapiTokenCache.set(userId, { token, timestamp: Date.now() });
    logger.debug('WUZAPI token obtained from database', { userId: userId.substring(0, 8) + '...' });
  }
  
  return token;
}

/**
 * Middleware para verificar token do usuário
 * 
 * Aceita token tanto no header Authorization quanto no header token.
 * Valida o token e adiciona informações do usuário ao request.
 * 
 * UPDATED: Now supports both Supabase JWT and WUZAPI tokens.
 * - If JWT is detected, validates with Supabase and fetches WUZAPI token from accounts table
 * - If WUZAPI token is detected, validates directly with WUZAPI
 * 
 * NOTA: Este middleware é para compatibilidade com código legado.
 * O novo sistema usa autenticação baseada em sessão (requireAuth, requireUser).
 */
const verifyUserToken = async (req, res, next) => {
  try {
    // Aceitar token tanto no header Authorization quanto no header token
    let providedToken = null;
    
    // Tentar obter do header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7);
    }
    
    // Se não encontrou, tentar header token
    if (!providedToken) {
      providedToken = req.headers.token;
    }
    
    // Se não encontrou token, verificar se há sessão ativa
    if (!providedToken && req.session?.userToken) {
      providedToken = req.session.userToken;
    }
    
    if (!providedToken) {
      securityLogger.logTokenValidationFailure({
        ip: req.ip,
        path: req.path,
        reason: 'No token provided'
      });
      
      return res.status(401).json({
        error: 'Token de autenticação não fornecido',
        code: 'NO_TOKEN'
      });
    }
    
    // Check if the token is a JWT (Supabase Auth token)
    if (isJwtToken(providedToken)) {
      logger.debug('JWT token detected, validating with Supabase', { 
        path: req.path,
        tokenPrefix: providedToken.substring(0, 20) + '...'
      });
      
      try {
        // Validate JWT with Supabase
        await new Promise((resolve, reject) => {
          validateSupabaseToken(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Extract userId from validated JWT
        const userId = req.user?.id;
        const wuzapiId = req.user?.user_metadata?.wuzapi_id;
        
        if (!userId) {
          logger.error('JWT validation succeeded but no userId found', { path: req.path });
          return res.status(401).json({
            error: 'Token JWT inválido - userId não encontrado',
            code: 'INVALID_JWT'
          });
        }
        
        // Fetch WUZAPI token from accounts table (passing wuzapiId for auto-correction)
        const wuzapiToken = await getWuzapiToken(userId, wuzapiId);
        
        if (!wuzapiToken) {
          logger.warn('No WUZAPI token found for user', { 
            userId: userId.substring(0, 8) + '...',
            path: req.path 
          });
          // Continue without WUZAPI token - some endpoints may not need it
          // The endpoint will handle the missing token appropriately
        }
        
        // Set request properties
        req.userToken = wuzapiToken || providedToken; // Use WUZAPI token if available, otherwise JWT
        req.userId = userId;
        req.isJwtAuth = true;
        
        logger.debug('JWT authentication successful', {
          userId: userId.substring(0, 8) + '...',
          hasWuzapiToken: !!wuzapiToken,
          path: req.path
        });
        
        // Set session data for consistency
        if (req.session && req.session.role !== 'admin') {
          req.session.userId = userId;
          if (wuzapiToken) {
            req.session.userToken = wuzapiToken;
          }
        }
        
        return next();
        
      } catch (jwtError) {
        logger.error('JWT validation failed', {
          error: jwtError.message,
          path: req.path,
          ip: req.ip
        });
        
        securityLogger.logTokenValidationFailure({
          ip: req.ip,
          path: req.path,
          reason: 'Invalid JWT token'
        });
        
        return res.status(401).json({
          error: 'Token JWT inválido ou expirado',
          code: 'INVALID_JWT'
        });
      }
    }
    
    // Token is not a JWT, validate as WUZAPI token
    const wuzapiClient = require('../utils/wuzapiClient');
    
    try {
      const response = await wuzapiClient.get('/session/status', {
        headers: { token: providedToken }
      });
      
      // Token válido, adicionar ao request
      req.userToken = providedToken;
      
      // Buscar userId do cache ou do endpoint admin
      let userId = null;
      const cached = userIdCache.get(providedToken);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        userId = cached.userId;
        logger.debug('🔑 userId obtido do cache:', { userId: userId?.substring(0, 8) + '...' });
      } else {
        // Buscar userId via endpoint admin
        userId = await getUserIdFromToken(wuzapiClient, providedToken);
        if (userId) {
          userIdCache.set(providedToken, { userId, timestamp: Date.now() });
          logger.debug('🔑 userId obtido do admin endpoint:', { userId: userId.substring(0, 8) + '...' });
        } else {
          logger.warn('⚠️ Não foi possível obter userId, usando token como fallback');
        }
      }
      
      // Sempre registrar mapeamento sessionId -> token para webhooks (se temos userId)
      if (userId && userId !== providedToken) {
        try {
          const { getSessionMappingService } = require('../services/SessionMappingService');
          const sessionMapping = getSessionMappingService(req.app?.locals?.db);
          if (sessionMapping) {
            await sessionMapping.registerMapping(userId, providedToken, {
              instanceName: response.data?.data?.name
            });
          }
        } catch (mappingError) {
          logger.warn('Failed to register session mapping', { error: mappingError.message });
        }
      }
      
      req.userId = userId || providedToken;
      logger.debug('🔑 req.userId definido:', { userId: req.userId?.substring(0, 8) + '...' });
      
      // Set session.userId and session.userToken for consistency with quota enforcement
      // This ensures quotaMiddleware can resolve the same userId
      // IMPORTANT: ensureSessionUserId now checks for admin role and skips if admin
      ensureSessionUserId(req, providedToken);
      
      // Also set session.userId to the resolved userId (not just hash of token)
      // CRITICAL: Never overwrite admin session data - admin needs their token for WuzAPI validation
      if (req.session && userId && req.session.role !== 'admin') {
        req.session.userId = userId;
      }
      
      next();
      
    } catch (error) {
      logger.error('WUZAPI token validation failed', {
        error: error.message,
        ip: req.ip
      });
      
      securityLogger.logTokenValidationFailure({
        ip: req.ip,
        path: req.path,
        reason: 'Invalid WUZAPI token'
      });
      
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
    
  } catch (error) {
    logger.error('Error in verifyUserToken middleware', {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Erro ao verificar token',
      code: 'TOKEN_VERIFICATION_ERROR'
    });
  }
};

/**
 * Busca o userId (hash) a partir do token do usuário
 * @param {Object} wuzapiClient - Cliente WuzAPI
 * @param {string} userToken - Token do usuário
 * @returns {string|null} userId ou null se não encontrado
 */
async function getUserIdFromToken(wuzapiClient, userToken) {
  try {
    const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
    if (!adminToken) {
      logger.warn('WUZAPI_ADMIN_TOKEN não configurado, usando token como userId');
      return null;
    }
    
    const response = await wuzapiClient.getAdmin('/admin/users', adminToken);
    
    if (response.success && response.data?.data) {
      const users = response.data.data;
      const user = users.find(u => u.token === userToken);
      if (user) {
        return user.id;
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Erro ao buscar userId do token:', { error: error.message });
    return null;
  }
}

module.exports = verifyUserToken;
