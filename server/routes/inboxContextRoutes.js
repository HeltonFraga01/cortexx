/**
 * Inbox Context Routes
 * 
 * Endpoints para gerenciar o contexto de inbox do usuário autenticado via Supabase Auth.
 * 
 * Endpoints:
 * - GET /api/user/inbox-context - Retorna contexto atual do usuário
 * - POST /api/user/inbox-context/switch - Troca inbox ativa
 * - GET /api/user/inboxes/available - Lista inboxes disponíveis
 * - GET /api/user/inbox-status - Status de conexão da inbox ativa
 * 
 * Requirements: 2.1, 2.2, 7.4, 8.1, 10.3, 10.4, 12.2, 12.3
 * 
 * Note: CSRF is skipped for these endpoints because they use JWT authentication
 * (Supabase Auth). JWT tokens are sent in the Authorization header, not cookies,
 * making them inherently protected against CSRF attacks.
 */

const router = require('express').Router();
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { 
  inboxContextMiddleware, 
  invalidateContextCache 
} = require('../middleware/inboxContextMiddleware');
const InboxContextService = require('../services/InboxContextService');
const { logger } = require('../utils/logger');
const { z } = require('zod');
const { skipCsrf } = require('../middleware/csrf');

// Schemas de validação
const switchInboxSchema = z.object({
  inboxId: z.string().uuid('ID da inbox inválido')
});

const inboxSelectionSchema = z.object({
  selection: z.union([
    z.literal('all'),
    z.array(z.string().uuid('ID da inbox inválido')).min(1, 'Selecione pelo menos uma caixa')
  ])
});

/**
 * GET /api/user/inbox-context
 * Retorna o contexto atual do usuário (inbox ativa, account, permissões)
 * Requirements: 2.1, 2.2
 */
router.get('/inbox-context', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Getting inbox context', { userId, endpoint: '/inbox-context' });

    const context = await InboxContextService.getUserInboxContext(userId);

    // Remover campos internos antes de retornar
    const { _cachedAt, ...publicContext } = context;

    res.json({
      success: true,
      data: publicContext
    });
  } catch (error) {
    if (error.code && error.status) {
      logger.warn('Get inbox context error', {
        userId: req.user?.id,
        code: error.code,
        message: error.message,
        endpoint: '/inbox-context'
      });

      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Get inbox context failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      endpoint: '/inbox-context'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_LOAD_ERROR',
        message: 'Erro ao carregar contexto'
      }
    });
  }
});

/**
 * POST /api/user/inbox-context/switch
 * Troca a inbox ativa do usuário
 * Requirements: 7.4, 10.4, 12.3
 * Note: skipCsrf is used because this endpoint uses JWT authentication (Supabase Auth)
 */
router.post('/inbox-context/switch', skipCsrf, validateSupabaseToken, invalidateContextCache, async (req, res) => {
  try {
    const userId = req.user.id;

    // Validar input
    const validated = switchInboxSchema.parse(req.body);
    const { inboxId } = validated;

    logger.info('Switching inbox', { 
      userId, 
      inboxId, 
      endpoint: '/inbox-context/switch' 
    });

    const newContext = await InboxContextService.switchActiveInbox(userId, inboxId);

    // Remover campos internos antes de retornar
    const { _cachedAt, ...publicContext } = newContext;

    // Atualizar cache da sessão
    if (req.session) {
      req.session.inboxContext = newContext;
    }

    res.json({
      success: true,
      data: publicContext,
      message: 'Caixa de entrada alterada com sucesso'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.errors
        }
      });
    }

    if (error.code && error.status) {
      logger.warn('Switch inbox error', {
        userId: req.user?.id,
        code: error.code,
        message: error.message,
        endpoint: '/inbox-context/switch'
      });

      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Switch inbox failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      endpoint: '/inbox-context/switch'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SWITCH_ERROR',
        message: 'Erro ao trocar caixa de entrada'
      }
    });
  }
});

/**
 * GET /api/user/inboxes/available
 * Lista todas as inboxes disponíveis para o usuário
 * Requirements: 10.3, 12.2
 */
router.get('/inboxes/available', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Getting available inboxes', { userId, endpoint: '/inboxes/available' });

    // Primeiro, obter o contexto para saber o tipo de usuário e account
    const context = await InboxContextService.getUserInboxContext(userId);

    res.json({
      success: true,
      data: {
        inboxes: context.availableInboxes,
        activeInboxId: context.inboxId,
        userType: context.userType,
        accountId: context.accountId
      }
    });
  } catch (error) {
    if (error.code && error.status) {
      logger.warn('Get available inboxes error', {
        userId: req.user?.id,
        code: error.code,
        message: error.message,
        endpoint: '/inboxes/available'
      });

      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Get available inboxes failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      endpoint: '/inboxes/available'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Erro ao buscar caixas de entrada'
      }
    });
  }
});

/**
 * GET /api/user/inbox-status
 * Retorna o status de conexão da inbox ativa
 * Requirements: 8.1
 */
router.get('/inbox-status', validateSupabaseToken, inboxContextMiddleware(), async (req, res) => {
  try {
    const context = req.context;

    if (!context) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_CONTEXT',
          message: 'Nenhum contexto disponível'
        }
      });
    }

    // Verificar status atual da inbox (pode consultar WUZAPI se necessário)
    const isConnected = await InboxContextService.checkInboxConnectionStatus(context.inboxId);

    res.json({
      success: true,
      data: {
        inboxId: context.inboxId,
        inboxName: context.inboxName,
        phoneNumber: context.phoneNumber,
        isConnected,
        wuzapiToken: context.wuzapiToken ? '***' : null, // Mascarar token
        instance: context.instance,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get inbox status failed', {
      userId: req.user?.id,
      inboxId: req.context?.inboxId,
      error: error.message,
      endpoint: '/inbox-status'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_ERROR',
        message: 'Erro ao verificar status'
      }
    });
  }
});

/**
 * POST /api/user/inbox-context/refresh
 * Força atualização do contexto (invalida cache)
 * Note: skipCsrf is used because this endpoint uses JWT authentication (Supabase Auth)
 */
router.post('/inbox-context/refresh', skipCsrf, validateSupabaseToken, invalidateContextCache, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Refreshing inbox context', { userId, endpoint: '/inbox-context/refresh' });

    const context = await InboxContextService.getUserInboxContext(userId);

    // Atualizar cache da sessão
    if (req.session) {
      context._cachedAt = Date.now();
      req.session.inboxContext = context;
    }

    // Remover campos internos antes de retornar
    const { _cachedAt, ...publicContext } = context;

    res.json({
      success: true,
      data: publicContext,
      message: 'Contexto atualizado'
    });
  } catch (error) {
    if (error.code && error.status) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Refresh inbox context failed', {
      userId: req.user?.id,
      error: error.message,
      endpoint: '/inbox-context/refresh'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_ERROR',
        message: 'Erro ao atualizar contexto'
      }
    });
  }
});

/**
 * GET /api/user/inbox-selection
 * Retorna a seleção de inboxes salva do usuário
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
router.get('/inbox-selection', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Getting inbox selection', { userId, endpoint: '/inbox-selection' });

    const selection = await InboxContextService.getInboxSelection(userId);

    res.json({
      success: true,
      data: {
        selection
      }
    });
  } catch (error) {
    logger.error('Get inbox selection failed', {
      userId: req.user?.id,
      error: error.message,
      endpoint: '/inbox-selection'
    });

    // Retornar 'all' como padrão em caso de erro
    res.json({
      success: true,
      data: {
        selection: 'all'
      }
    });
  }
});

/**
 * POST /api/user/inbox-selection
 * Salva a seleção de inboxes do usuário
 * Requirements: 5.1
 * Note: skipCsrf is used because this endpoint uses JWT authentication (Supabase Auth)
 */
router.post('/inbox-selection', skipCsrf, validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Validar input
    const validated = inboxSelectionSchema.parse(req.body);
    const { selection } = validated;

    logger.info('Saving inbox selection', { 
      userId, 
      selection: selection === 'all' ? 'all' : `${selection.length} inboxes`,
      endpoint: '/inbox-selection' 
    });

    // Validar que os IDs existem e o usuário tem acesso
    if (selection !== 'all') {
      const context = await InboxContextService.getUserInboxContext(userId);
      const availableIds = context.availableInboxes.map(i => i.id);
      const invalidIds = selection.filter(id => !availableIds.includes(id));
      
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SELECTION',
            message: 'Algumas caixas de entrada não estão disponíveis',
            details: { invalidIds }
          }
        });
      }
    }

    await InboxContextService.saveInboxSelection(userId, selection);

    res.json({
      success: true,
      data: {
        selection
      },
      message: 'Seleção salva com sucesso'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.errors
        }
      });
    }

    logger.error('Save inbox selection failed', {
      userId: req.user?.id,
      error: error.message,
      endpoint: '/inbox-selection'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SAVE_ERROR',
        message: 'Erro ao salvar seleção'
      }
    });
  }
});

module.exports = router;
