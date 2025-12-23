/**
 * Inbox Context Middleware
 * 
 * Carrega o contexto completo da inbox para o usuário autenticado via Supabase Auth.
 * Deve ser usado após validateSupabaseToken.
 * 
 * Fluxo:
 * 1. Verifica se usuário é owner ou agent
 * 2. Busca account associada
 * 3. Busca inboxes disponíveis (todas para owner, associadas para agent)
 * 4. Seleciona inbox ativa (preferência salva ou padrão)
 * 5. Popula req.context com todos os dados
 * 
 * Requirements: 2.2, 6.1, 6.2, 6.3, 6.4, 6.5
 */

const InboxContextService = require('../services/InboxContextService');
const { logger } = require('../utils/logger');

/**
 * Middleware que carrega o contexto completo da inbox para o usuário autenticado.
 * Deve ser usado após validateSupabaseToken.
 * 
 * @param {Object} options - Opções do middleware
 * @param {boolean} options.required - Se true, retorna erro se não houver contexto (default: true)
 * @param {boolean} options.useCache - Se true, usa cache da sessão (default: true)
 */
function inboxContextMiddleware(options = {}) {
  const { required = true, useCache = true } = options;

  return async (req, res, next) => {
    try {
      // Verificar se req.user existe (após validateSupabaseToken)
      if (!req.user || !req.user.id) {
        if (required) {
          logger.warn('Inbox context middleware - No user in request', {
            path: req.path,
            method: req.method
          });
          return res.status(401).json({
            success: false,
            error: {
              code: 'AUTH_REQUIRED',
              message: 'Autenticação necessária'
            }
          });
        }
        return next();
      }

      const userId = req.user.id;

      // Verificar cache na sessão (se habilitado)
      if (useCache && req.session?.inboxContext) {
        const cachedContext = req.session.inboxContext;
        const cacheAge = Date.now() - (cachedContext._cachedAt || 0);
        const maxCacheAge = 5 * 60 * 1000; // 5 minutos

        if (cacheAge < maxCacheAge) {
          req.context = cachedContext;
          logger.debug('Using cached inbox context', {
            userId,
            inboxId: cachedContext.inboxId,
            cacheAge: Math.round(cacheAge / 1000) + 's'
          });
          return next();
        }
      }

      // Carregar contexto do serviço
      const context = await InboxContextService.getUserInboxContext(userId);

      // Adicionar timestamp de cache
      context._cachedAt = Date.now();

      // Popular req.context
      req.context = context;

      // Salvar no cache da sessão (se disponível)
      if (useCache && req.session) {
        req.session.inboxContext = context;
      }

      logger.debug('Inbox context loaded', {
        userId,
        userType: context.userType,
        accountId: context.accountId,
        inboxId: context.inboxId,
        isConnected: context.isConnected,
        availableInboxes: context.availableInboxes?.length || 0
      });

      next();
    } catch (error) {
      // Tratar erros conhecidos
      if (error.code && error.status) {
        logger.warn('Inbox context error', {
          userId: req.user?.id,
          code: error.code,
          message: error.message,
          path: req.path
        });

        if (!required && (error.code === 'NO_ACCOUNT' || error.code === 'NO_INBOX')) {
          // Se não é obrigatório, continuar sem contexto
          req.context = null;
          return next();
        }

        return res.status(error.status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      // Erro interno
      logger.error('Inbox context middleware error', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        path: req.path
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'CONTEXT_LOAD_ERROR',
          message: 'Erro ao carregar contexto'
        }
      });
    }
  };
}

/**
 * Middleware que invalida o cache de contexto
 * Útil após operações que alteram o contexto (ex: switch inbox)
 */
function invalidateContextCache(req, res, next) {
  if (req.session) {
    delete req.session.inboxContext;
  }
  next();
}

/**
 * Middleware que verifica se o usuário tem acesso a uma inbox específica
 * Deve ser usado após inboxContextMiddleware
 * 
 * @param {string} inboxIdParam - Nome do parâmetro que contém o inboxId (default: 'inboxId')
 */
function requireInboxAccess(inboxIdParam = 'inboxId') {
  return async (req, res, next) => {
    try {
      const inboxId = req.params[inboxIdParam] || req.body[inboxIdParam] || req.query[inboxIdParam];

      if (!inboxId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_INBOX_ID',
            message: 'ID da caixa de entrada não fornecido'
          }
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Autenticação necessária'
          }
        });
      }

      const hasAccess = await InboxContextService.hasInboxAccess(req.user.id, inboxId);

      if (!hasAccess) {
        logger.warn('Inbox access denied', {
          userId: req.user.id,
          inboxId,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'INBOX_ACCESS_DENIED',
            message: 'Acesso negado a esta caixa de entrada'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Inbox access check error', {
        userId: req.user?.id,
        error: error.message,
        path: req.path
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'ACCESS_CHECK_ERROR',
          message: 'Erro ao verificar acesso'
        }
      });
    }
  };
}

/**
 * Middleware que verifica se a inbox ativa está conectada
 * Deve ser usado após inboxContextMiddleware
 */
function requireConnectedInbox(req, res, next) {
  if (!req.context) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_CONTEXT',
        message: 'Contexto não carregado'
      }
    });
  }

  if (!req.context.isConnected) {
    logger.warn('Inbox not connected', {
      userId: req.user?.id,
      inboxId: req.context.inboxId,
      path: req.path
    });

    return res.status(503).json({
      success: false,
      error: {
        code: 'INBOX_DISCONNECTED',
        message: 'Caixa de entrada desconectada'
      }
    });
  }

  next();
}

/**
 * Middleware que verifica se o usuário tem uma permissão específica
 * Deve ser usado após inboxContextMiddleware
 * 
 * @param {string} permission - Permissão necessária (ex: 'messages:send')
 */
function requireContextPermission(permission) {
  return (req, res, next) => {
    if (!req.context) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_CONTEXT',
          message: 'Contexto não carregado'
        }
      });
    }

    const permissions = req.context.permissions || [];

    // Owner tem todas as permissões
    if (permissions.includes('*')) {
      return next();
    }

    if (!permissions.includes(permission)) {
      logger.warn('Permission denied', {
        userId: req.user?.id,
        permission,
        userPermissions: permissions,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Permissão necessária: ${permission}`
        }
      });
    }

    next();
  };
}

module.exports = {
  inboxContextMiddleware,
  invalidateContextCache,
  requireInboxAccess,
  requireConnectedInbox,
  requireContextPermission
};
