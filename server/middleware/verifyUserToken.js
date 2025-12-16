const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const { hashToken, ensureSessionUserId } = require('../utils/userIdResolver');

// Cache para mapear token -> userId (evita chamadas repetidas ao admin endpoint)
const userIdCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Middleware para verificar token do usuário
 * 
 * Aceita token tanto no header Authorization quanto no header token.
 * Valida o token e adiciona informações do usuário ao request.
 * 
 * NOTA: Este middleware é para compatibilidade com código legado.
 * O novo sistema usa autenticação baseada em sessão (requireAuth, requireUser).
 */
const verifyUserToken = async (req, res, next) => {
  try {
    // Aceitar token tanto no header Authorization quanto no header token
    let userToken = null;
    
    // Tentar obter do header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userToken = authHeader.substring(7);
    }
    
    // Se não encontrou, tentar header token
    if (!userToken) {
      userToken = req.headers.token;
    }
    
    // Se não encontrou token, verificar se há sessão ativa
    if (!userToken && req.session?.userToken) {
      userToken = req.session.userToken;
    }
    
    if (!userToken) {
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
    
    // Validar token com WuzAPI
    const wuzapiClient = require('../utils/wuzapiClient');
    
    try {
      const response = await wuzapiClient.get('/session/status', {
        headers: { token: userToken }
      });
      
      // Token válido, adicionar ao request
      req.userToken = userToken;
      
      // Buscar userId do cache ou do endpoint admin
      let userId = null;
      const cached = userIdCache.get(userToken);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        userId = cached.userId;
        logger.debug('🔑 userId obtido do cache:', { userId: userId?.substring(0, 8) + '...' });
      } else {
        // Buscar userId via endpoint admin
        userId = await getUserIdFromToken(wuzapiClient, userToken);
        if (userId) {
          userIdCache.set(userToken, { userId, timestamp: Date.now() });
          logger.debug('🔑 userId obtido do admin endpoint:', { userId: userId.substring(0, 8) + '...' });
        } else {
          logger.warn('⚠️ Não foi possível obter userId, usando token como fallback');
        }
      }
      
      // Sempre registrar mapeamento sessionId -> token para webhooks (se temos userId)
      if (userId && userId !== userToken) {
        try {
          const { getSessionMappingService } = require('../services/SessionMappingService');
          const sessionMapping = getSessionMappingService(req.app?.locals?.db);
          if (sessionMapping) {
            await sessionMapping.registerMapping(userId, userToken, {
              instanceName: response.data?.data?.name
            });
          }
        } catch (mappingError) {
          logger.warn('Failed to register session mapping', { error: mappingError.message });
        }
      }
      
      req.userId = userId || userToken;
      logger.debug('🔑 req.userId definido:', { userId: req.userId?.substring(0, 8) + '...' });
      
      // Set session.userId and session.userToken for consistency with quota enforcement
      // This ensures quotaMiddleware can resolve the same userId
      // IMPORTANT: ensureSessionUserId now checks for admin role and skips if admin
      ensureSessionUserId(req, userToken);
      
      // Also set session.userId to the resolved userId (not just hash of token)
      // CRITICAL: Never overwrite admin session data - admin needs their token for WuzAPI validation
      if (req.session && userId && req.session.role !== 'admin') {
        req.session.userId = userId;
      }
      
      next();
      
    } catch (error) {
      logger.error('Token validation failed', {
        error: error.message,
        ip: req.ip
      });
      
      securityLogger.logTokenValidationFailure({
        ip: req.ip,
        path: req.path,
        reason: 'Invalid token'
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
