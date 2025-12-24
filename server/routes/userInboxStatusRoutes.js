/**
 * User Inbox Status Routes
 * 
 * Endpoints para consultar status de conexão de inboxes.
 * O status SEMPRE vem da API do Provider (WUZAPI, Evolution, etc.) como fonte única de verdade.
 * 
 * Endpoints:
 * - GET /api/user/inbox/:id/status - Status de conexão de uma inbox específica
 * - GET /api/user/inboxes/status - Status de todas as inboxes do usuário
 * 
 * Requirements: 3.1, 3.2, 3.3, 5.1, 5.2 (wuzapi-status-source-of-truth spec)
 */

const router = require('express').Router();
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const InboxStatusService = require('../services/InboxStatusService');
const InboxContextService = require('../services/InboxContextService');
const { logger } = require('../utils/logger');

/**
 * GET /api/user/inbox/:id/status
 * Retorna o status de conexão de uma inbox específica
 * SEMPRE consulta o Provider API - nunca retorna dados cacheados como autoritativos
 * 
 * Requirements: 3.1, 3.2, 3.3, 5.2
 */
router.get('/inbox/:id/status', validateSupabaseToken, async (req, res) => {
  const { id: inboxId } = req.params;
  const userId = req.user.id;

  try {
    logger.debug('Getting inbox status', { 
      userId, 
      inboxId, 
      endpoint: '/inbox/:id/status' 
    });

    // Verificar se o usuário tem acesso a esta inbox
    const hasAccess = await InboxContextService.userHasAccessToInbox(userId, inboxId);
    
    if (!hasAccess) {
      logger.warn('Inbox access denied', { userId, inboxId });
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Você não tem acesso a esta caixa de entrada'
        }
      });
    }

    // Consultar status do Provider (fonte única de verdade)
    const result = await InboxStatusService.getStatus(inboxId);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('Get inbox status failed', {
      userId,
      inboxId,
      error: error.message,
      stack: error.stack,
      endpoint: '/inbox/:id/status'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Erro ao consultar status da caixa de entrada'
      }
    });
  }
});

/**
 * GET /api/user/inboxes/status
 * Retorna o status de conexão de todas as inboxes do usuário
 * SEMPRE consulta o Provider API para cada inbox
 * 
 * Requirements: 3.1, 5.2
 */
router.get('/inboxes/status', validateSupabaseToken, async (req, res) => {
  const userId = req.user.id;

  try {
    logger.debug('Getting all inboxes status', { 
      userId, 
      endpoint: '/inboxes/status' 
    });

    // Obter contexto do usuário para listar inboxes disponíveis
    const context = await InboxContextService.getUserInboxContext(userId);
    
    if (!context || !context.availableInboxes || context.availableInboxes.length === 0) {
      return res.json({
        success: true,
        data: {
          statuses: []
        }
      });
    }

    // Consultar status de todas as inboxes em paralelo
    const inboxIds = context.availableInboxes.map(inbox => inbox.id);
    const statusMap = await InboxStatusService.getMultipleStatus(inboxIds);

    // Converter Map para array de resultados
    const statuses = Array.from(statusMap.entries()).map(([inboxId, result]) => ({
      inboxId,
      ...result
    }));

    res.json({
      success: true,
      data: {
        statuses,
        totalInboxes: inboxIds.length,
        connectedCount: statuses.filter(s => s.status?.loggedIn).length,
        errorCount: statuses.filter(s => s.source === 'error').length
      }
    });
  } catch (error) {
    if (error.code && error.status) {
      logger.warn('Get inboxes status error', {
        userId,
        code: error.code,
        message: error.message,
        endpoint: '/inboxes/status'
      });

      return res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Get inboxes status failed', {
      userId,
      error: error.message,
      stack: error.stack,
      endpoint: '/inboxes/status'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Erro ao consultar status das caixas de entrada'
      }
    });
  }
});

module.exports = router;
