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

/**
 * GET /api/user/inbox/:inboxId/connection
 * Retorna dados de conexão para uma inbox específica
 * Requirements: 1.1, 1.2, 1.4 (inbox-connection-sync spec)
 * 
 * IMPORTANTE: Busca dados do WUZAPI (source of truth) para JID, Connected, LoggedIn
 */
router.get('/inbox/:inboxId/connection', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inboxId } = req.params;

    logger.debug('Getting inbox connection data', { userId, inboxId, endpoint: '/inbox/:inboxId/connection' });

    // Validar UUID
    if (!z.string().uuid().safeParse(inboxId).success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INBOX_ID',
          message: 'ID da inbox inválido'
        }
      });
    }

    // Verificar acesso à inbox
    const hasAccess = await InboxContextService.hasInboxAccess(userId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INBOX_ACCESS_DENIED',
          message: 'Acesso negado a esta caixa de entrada'
        }
      });
    }

    // Buscar dados da inbox do Supabase
    const { data: inbox, error } = await require('../services/SupabaseService').queryAsAdmin('inboxes', (query) =>
      query.select('*').eq('id', inboxId).single()
    );

    if (error || !inbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INBOX_NOT_FOUND',
          message: 'Caixa de entrada não encontrada'
        }
      });
    }

    // Buscar dados do WUZAPI (source of truth para JID, Connected, LoggedIn)
    let wuzapiStatus = { connected: false, loggedIn: false, jid: null };
    if (inbox.wuzapi_token) {
      const wuzapiClient = require('../utils/wuzapiClient');
      const response = await wuzapiClient.get('/session/status', {
        headers: { 'token': inbox.wuzapi_token }
      });
      
      if (response.success && response.data) {
        // WUZAPI response structure: { code, data: { connected, loggedIn, jid, ... }, success }
        // wuzapiClient wraps it: { success, status, data: <wuzapi response> }
        const wuzapiResponse = response.data;
        const statusData = wuzapiResponse?.data || wuzapiResponse;
        
        wuzapiStatus = {
          connected: statusData?.connected === true,
          loggedIn: statusData?.loggedIn === true,
          jid: statusData?.jid || null
        };
        
        logger.debug('WUZAPI status fetched', { 
          inboxId, 
          connected: wuzapiStatus.connected,
          loggedIn: wuzapiStatus.loggedIn,
          jid: wuzapiStatus.jid
        });
      } else {
        logger.warn('WUZAPI status fetch failed', { 
          inboxId, 
          success: response.success,
          error: response.error,
          endpoint: '/inbox/:inboxId/connection'
        });
      }
    }

    // Extrair phone do JID (formato: 553194974759:64@s.whatsapp.net)
    const jid = wuzapiStatus.jid || null;
    const phoneNumber = jid ? jid.split(':')[0] : inbox.phone_number;

    res.json({
      success: true,
      data: {
        inboxId: inbox.id,
        inboxName: inbox.name,
        wuzapiUserId: inbox.wuzapi_user_id,
        wuzapiToken: inbox.wuzapi_token,
        jid: jid,
        phoneNumber: phoneNumber,
        isConnected: wuzapiStatus.connected ?? false,
        isLoggedIn: wuzapiStatus.loggedIn ?? false,
        profilePicture: inbox.profile_picture || null
      }
    });
  } catch (error) {
    logger.error('Get inbox connection failed', {
      userId: req.user?.id,
      inboxId: req.params?.inboxId,
      error: error.message,
      endpoint: '/inbox/:inboxId/connection'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONNECTION_FETCH_ERROR',
        message: 'Erro ao buscar dados de conexão'
      }
    });
  }
});

/**
 * NOTE: GET /api/user/inbox/:inboxId/status route has been moved to userInboxStatusRoutes.js
 * The new implementation uses the Provider Adapter pattern (source of truth from WUZAPI API)
 * See: server/routes/userInboxStatusRoutes.js
 */

/**
 * GET /api/user/inboxes/quota
 * Retorna informações de quota de inboxes do usuário
 * Requirements: 7.1, 7.4 (connection-status-sync spec)
 */
router.get('/inboxes/quota', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Getting inbox quota', { userId, endpoint: '/inboxes/quota' });

    const QuotaService = require('../services/QuotaService');
    const quotaService = new QuotaService();

    // Get current inbox count and limit
    const currentCount = await quotaService.countUserInboxes(userId);
    const limit = await quotaService.getEffectiveLimit(userId, QuotaService.QUOTA_TYPES.MAX_INBOXES);

    res.json({
      success: true,
      data: {
        current: currentCount,
        limit: limit,
        canCreate: currentCount < limit,
        remaining: Math.max(0, limit - currentCount)
      }
    });
  } catch (error) {
    logger.error('Get inbox quota failed', {
      userId: req.user?.id,
      error: error.message,
      endpoint: '/inboxes/quota'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'QUOTA_FETCH_ERROR',
        message: 'Erro ao buscar quota de caixas de entrada'
      }
    });
  }
});

/**
 * GET /api/user/inbox/:inboxId/bot-assignment
 * Retorna o bot atribuído a uma inbox específica
 */
router.get('/inbox/:inboxId/bot-assignment', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inboxId } = req.params;

    logger.debug('Getting inbox bot assignment', { userId, inboxId, endpoint: '/inbox/:inboxId/bot-assignment' });

    // Validar UUID
    if (!z.string().uuid().safeParse(inboxId).success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INBOX_ID',
          message: 'ID da inbox inválido'
        }
      });
    }

    // Verificar acesso à inbox
    const hasAccess = await InboxContextService.hasInboxAccess(userId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INBOX_ACCESS_DENIED',
          message: 'Acesso negado a esta caixa de entrada'
        }
      });
    }

    // Buscar assignment atual
    const { data: assignment, error } = await require('../services/SupabaseService').queryAsAdmin('bot_inbox_assignments', (query) =>
      query.select(`
        id,
        bot_id,
        inbox_id,
        created_at,
        agent_bots(id, name, description, bot_type, status, avatar_url)
      `).eq('inbox_id', inboxId).maybeSingle()
    );

    if (error) {
      logger.error('Failed to fetch bot assignment', { error: error.message, inboxId });
      throw error;
    }

    res.json({
      success: true,
      data: {
        assignment: assignment ? {
          id: assignment.id,
          botId: assignment.bot_id,
          inboxId: assignment.inbox_id,
          createdAt: assignment.created_at,
          bot: assignment.agent_bots ? {
            id: assignment.agent_bots.id,
            name: assignment.agent_bots.name,
            description: assignment.agent_bots.description,
            botType: assignment.agent_bots.bot_type,
            status: assignment.agent_bots.status,
            avatarUrl: assignment.agent_bots.avatar_url
          } : null
        } : null
      }
    });
  } catch (error) {
    logger.error('Get inbox bot assignment failed', {
      userId: req.user?.id,
      inboxId: req.params?.inboxId,
      error: error.message,
      endpoint: '/inbox/:inboxId/bot-assignment'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BOT_ASSIGNMENT_FETCH_ERROR',
        message: 'Erro ao buscar atribuição de bot'
      }
    });
  }
});

/**
 * POST /api/user/inbox/:inboxId/bot-assignment
 * Atribui ou remove um bot de uma inbox
 * Note: skipCsrf is used because this endpoint uses JWT authentication (Supabase Auth)
 */
router.post('/inbox/:inboxId/bot-assignment', skipCsrf, validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inboxId } = req.params;
    const { botId } = req.body; // null para remover

    logger.info('Setting inbox bot assignment', { userId, inboxId, botId, endpoint: '/inbox/:inboxId/bot-assignment' });

    // Validar UUID da inbox
    if (!z.string().uuid().safeParse(inboxId).success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INBOX_ID',
          message: 'ID da inbox inválido'
        }
      });
    }

    // Verificar acesso à inbox
    const hasAccess = await InboxContextService.hasInboxAccess(userId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INBOX_ACCESS_DENIED',
          message: 'Acesso negado a esta caixa de entrada'
        }
      });
    }

    const SupabaseService = require('../services/SupabaseService');

    // Se botId é null, remover assignment existente
    if (!botId) {
      await SupabaseService.queryAsAdmin('bot_inbox_assignments', (query) =>
        query.delete().eq('inbox_id', inboxId)
      );

      return res.json({
        success: true,
        data: { assignment: null },
        message: 'Bot removido da caixa de entrada'
      });
    }

    // Validar UUID do bot
    if (!z.string().uuid().safeParse(botId).success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BOT_ID',
          message: 'ID do bot inválido'
        }
      });
    }

    // Verificar se o bot pertence ao usuário (via account)
    const { data: inbox } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
      query.select('account_id').eq('id', inboxId).single()
    );

    const { data: bot, error: botError } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('id, name, account_id').eq('id', botId).single()
    );

    if (botError || !bot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BOT_NOT_FOUND',
          message: 'Bot não encontrado'
        }
      });
    }

    // Verificar se bot pertence à mesma account da inbox
    if (bot.account_id !== inbox.account_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BOT_ACCESS_DENIED',
          message: 'Bot não pertence a esta conta'
        }
      });
    }

    // Remover assignment existente e criar novo (upsert)
    await SupabaseService.queryAsAdmin('bot_inbox_assignments', (query) =>
      query.delete().eq('inbox_id', inboxId)
    );

    const { data: newAssignment, error: insertError } = await SupabaseService.queryAsAdmin('bot_inbox_assignments', (query) =>
      query.insert({
        bot_id: botId,
        inbox_id: inboxId
      }).select(`
        id,
        bot_id,
        inbox_id,
        created_at,
        agent_bots(id, name, description, bot_type, status, avatar_url)
      `).single()
    );

    if (insertError) {
      logger.error('Failed to create bot assignment', { error: insertError.message, inboxId, botId });
      throw insertError;
    }

    res.json({
      success: true,
      data: {
        assignment: {
          id: newAssignment.id,
          botId: newAssignment.bot_id,
          inboxId: newAssignment.inbox_id,
          createdAt: newAssignment.created_at,
          bot: newAssignment.agent_bots ? {
            id: newAssignment.agent_bots.id,
            name: newAssignment.agent_bots.name,
            description: newAssignment.agent_bots.description,
            botType: newAssignment.agent_bots.bot_type,
            status: newAssignment.agent_bots.status,
            avatarUrl: newAssignment.agent_bots.avatar_url
          } : null
        }
      },
      message: 'Bot atribuído à caixa de entrada'
    });
  } catch (error) {
    logger.error('Set inbox bot assignment failed', {
      userId: req.user?.id,
      inboxId: req.params?.inboxId,
      error: error.message,
      endpoint: '/inbox/:inboxId/bot-assignment'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BOT_ASSIGNMENT_ERROR',
        message: 'Erro ao atribuir bot'
      }
    });
  }
});

/**
 * GET /api/user/inbox/:inboxId/webhook
 * Retorna configuração de webhook para uma inbox específica
 * Requirements: 1.1 (inbox-connection-sync spec)
 */
router.get('/inbox/:inboxId/webhook', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inboxId } = req.params;

    logger.debug('Getting inbox webhook config', { userId, inboxId, endpoint: '/inbox/:inboxId/webhook' });

    // Validar UUID
    if (!z.string().uuid().safeParse(inboxId).success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INBOX_ID',
          message: 'ID da inbox inválido'
        }
      });
    }

    // Verificar acesso à inbox
    const hasAccess = await InboxContextService.hasInboxAccess(userId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INBOX_ACCESS_DENIED',
          message: 'Acesso negado a esta caixa de entrada'
        }
      });
    }

    // Buscar dados da inbox
    const { data: inbox, error } = await require('../services/SupabaseService').queryAsAdmin('inboxes', (query) =>
      query.select('wuzapi_token').eq('id', inboxId).single()
    );

    if (error || !inbox) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INBOX_NOT_FOUND',
          message: 'Caixa de entrada não encontrada'
        }
      });
    }

    // Buscar webhook config via WUZAPI
    let webhookConfig = {
      webhook: '',
      subscribe: []
    };

    if (inbox.wuzapi_token) {
      try {
        const wuzapiClient = require('../utils/wuzapiClient');
        const webhookResponse = await wuzapiClient.get('/webhook', {
          headers: { 'token': inbox.wuzapi_token }
        });

        if (webhookResponse.success && webhookResponse.data) {
          webhookConfig = {
            webhook: webhookResponse.data.Webhook || '',
            subscribe: webhookResponse.data.Subscribe || []
          };
        }
      } catch (wuzapiError) {
        logger.warn('Could not fetch WUZAPI webhook config', { inboxId, error: wuzapiError.message });
      }
    }

    res.json({
      success: true,
      data: webhookConfig
    });
  } catch (error) {
    logger.error('Get inbox webhook config failed', {
      userId: req.user?.id,
      inboxId: req.params?.inboxId,
      error: error.message,
      endpoint: '/inbox/:inboxId/webhook'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_FETCH_ERROR',
        message: 'Erro ao buscar configuração de webhook'
      }
    });
  }
});

module.exports = router;
