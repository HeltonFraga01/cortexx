/**
 * User Bot Routes
 * 
 * Handles bot management for users (CRUD, pause/resume)
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * instead of the accounts table. This ensures the correct token is used when
 * users have multiple inboxes.
 * 
 * Requirements: 17.1-17.6, 18.1-18.4, 8.x (InboxContext integration)
 */

const express = require('express')
const router = express.Router()
const { logger } = require('../utils/logger')
const BotService = require('../services/BotService')
const AutomationService = require('../services/AutomationService')
const QuotaService = require('../services/QuotaService')
const SupabaseService = require('../services/SupabaseService')
const { quotaMiddleware, resolveUserId } = require('../middleware/quotaEnforcement')
const { featureMiddleware } = require('../middleware/featureEnforcement')
const { validateSupabaseToken } = require('../middleware/supabaseAuth')
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware')

// Initialize services at module level (they use SupabaseService internally)
const botService = new BotService()
const automationService = new AutomationService()
const quotaService = new QuotaService()

/**
 * Middleware para verificar token do usuário usando InboxContext
 * 
 * Ordem de prioridade para obter o token WUZAPI:
 * 1. Header 'token' (explícito - para operações específicas de inbox)
 * 2. Contexto da inbox ativa (via JWT do Supabase)
 * 3. Token da sessão (legacy)
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
  // PRIORIDADE 1: Token explícito no header
  const tokenHeader = req.headers.token;
  if (tokenHeader && tokenHeader.trim()) {
    req.userToken = tokenHeader.trim();
    req.tokenSource = 'header';
    
    logger.debug('WUZAPI token obtained from header for bots', {
      tokenPreview: req.userToken.substring(0, 8) + '...',
      path: req.path
    });
    
    return next();
  }
  
  // PRIORIDADE 2: JWT + Contexto da inbox ativa
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        inboxContextMiddleware({ required: false, useCache: true })(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      if (req.context?.wuzapiToken) {
        req.userToken = req.context.wuzapiToken;
        req.userId = req.user?.id;
        req.inboxId = req.context.inboxId;
        req.tokenSource = 'context';
        
        logger.debug('WUZAPI token obtained from inbox context for bots', {
          userId: req.userId?.substring(0, 8) + '...',
          inboxId: req.inboxId?.substring(0, 8) + '...',
          tokenPreview: req.userToken.substring(0, 8) + '...',
          path: req.path
        });
        
        return next();
      }
      
      if (req.user?.id) {
        req.userId = req.user.id;
        logger.warn('No inbox context available for bots user', {
          userId: req.user.id.substring(0, 8) + '...',
          path: req.path
        });
        return next();
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for bots, trying session fallback', { 
        error: error.message,
        path: req.path
      });
    }
  }
  
  // PRIORIDADE 3: Token da sessão (legacy)
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    req.tokenSource = 'session';
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: {
      code: 'NO_WUZAPI_TOKEN',
      message: 'Token WUZAPI não fornecido. Use header token, Authorization Bearer com inbox ativa, ou sessão.'
    }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

/**
 * Helper to get consistent userId for bot operations
 * Uses the same logic as quota enforcement to ensure consistency
 * @param {Object} req - Express request
 * @returns {string} User ID (token as fallback)
 */
function getBotUserId(req) {
  // Use resolveUserId for consistency with quota enforcement
  const resolvedId = resolveUserId(req);
  // Fallback to token if no resolved ID (for backwards compatibility)
  return resolvedId || req.userToken || req.userId;
}

/**
 * GET /api/user/bots
 * List all bots for the user
 */
router.get('/', verifyUserToken, async (req, res) => {
  try {
    const userId = getBotUserId(req)
    
    const bots = await botService.getBots(userId)

    res.json({ success: true, data: bots })
  } catch (error) {
    logger.error('Error fetching bots', { error: error.message, userId: getBotUserId(req) })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/user/bots/assigned
 * Get admin-assigned bots for the user with quota usage
 * Returns bot templates assigned to user's inboxes with current quota information
 * 
 * IMPORTANT: This route MUST be defined BEFORE /:id to avoid "assigned" being treated as an ID
 * 
 * Requirements: 9.1, 9.2, 9.3
 */
router.get('/assigned', verifyUserToken, async (req, res) => {
  try {
    const userId = getBotUserId(req)

    // Get user's inboxes via accounts table using Supabase
    // Users own accounts, accounts have inboxes
    const { data: inboxes, error: inboxError } = await SupabaseService.adminClient
      .from('inboxes')
      .select('id, name, account_id, accounts!inner(owner_user_id)')
      .eq('accounts.owner_user_id', userId)

    if (inboxError) {
      logger.error('Error fetching user inboxes', { error: inboxError.message, userId })
      return res.json({ success: true, data: [] })
    }

    if (!inboxes || inboxes.length === 0) {
      return res.json({ success: true, data: [] })
    }

    const inboxIds = inboxes.map(i => i.id)
    const inboxMap = new Map(inboxes.map(i => [i.id, i.name]))

    // Get bot templates assigned to these inboxes
    const assignedBots = await automationService.getBotTemplatesForInboxes(inboxIds)

    // Get quota usage for the user
    const quotaUsage = await quotaService.getBotQuotaUsage(userId)

    // Combine bot info with quota usage and inbox names
    const botsWithQuota = assignedBots.map(bot => ({
      ...bot,
      inboxAssignments: bot.inboxAssignments.map(a => ({
        inboxId: a.inboxId,
        inboxName: inboxMap.get(a.inboxId) || `Inbox ${a.inboxId}`
      })),
      quotaUsage: {
        calls: {
          daily: quotaUsage.botCallsDaily,
          monthly: quotaUsage.botCallsMonthly,
          dailyLimit: quotaUsage.maxBotCallsPerDay,
          monthlyLimit: quotaUsage.maxBotCallsPerMonth
        },
        messages: {
          daily: quotaUsage.botMessagesDaily,
          monthly: quotaUsage.botMessagesMonthly,
          dailyLimit: quotaUsage.maxBotMessagesPerDay,
          monthlyLimit: quotaUsage.maxBotMessagesPerMonth
        },
        tokens: {
          daily: quotaUsage.botTokensDaily,
          monthly: quotaUsage.botTokensMonthly,
          dailyLimit: quotaUsage.maxBotTokensPerDay,
          monthlyLimit: quotaUsage.maxBotTokensPerMonth
        },
        dailyResetAt: quotaUsage.dailyResetAt,
        monthlyResetAt: quotaUsage.monthlyResetAt
      }
    }))

    logger.info('Fetched assigned bots for user', { 
      userId, 
      inboxCount: inboxIds.length, 
      botCount: botsWithQuota.length 
    })

    res.json({ success: true, data: botsWithQuota })
  } catch (error) {
    logger.error('Error fetching assigned bots', { error: error.message, userId: getBotUserId(req) })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/user/bots/available
 * Lista bots disponíveis para o usuário (para seleção em inbox)
 * IMPORTANTE: Esta rota DEVE vir ANTES de /:id para não ser capturada
 */
router.get('/available', validateSupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Getting available bots', { userId, endpoint: '/bots/available' });

    // Buscar account do usuário
    const { data: agent } = await SupabaseService.queryAsAdmin('agents', (query) =>
      query.select('account_id').eq('user_id', userId).single()
    );

    if (!agent) {
      return res.json({
        success: true,
        data: { bots: [] }
      });
    }

    // Buscar bots da account
    const { data: bots, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('id, name, description, bot_type, status, avatar_url')
        .eq('account_id', agent.account_id)
        .order('name', { ascending: true })
    );

    if (error) {
      logger.error('Failed to fetch available bots', { error: error.message, userId });
      throw error;
    }

    res.json({
      success: true,
      data: {
        bots: (bots || []).map(bot => ({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          botType: bot.bot_type,
          status: bot.status,
          avatarUrl: bot.avatar_url
        }))
      }
    });
  } catch (error) {
    logger.error('Get available bots failed', {
      userId: req.user?.id,
      error: error.message,
      endpoint: '/bots/available'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BOTS_FETCH_ERROR',
        message: 'Erro ao buscar bots disponíveis'
      }
    });
  }
});

/**
 * GET /api/user/bots/:id
 * Get a specific bot
 */
router.get('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = getBotUserId(req)
    
    const bot = await botService.getBotById(parseInt(id, 10), userId)
    
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error fetching bot', { error: error.message, botId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/bots
 * Create a new bot
 */
router.post('/', verifyUserToken, featureMiddleware.botAutomation, quotaMiddleware.bots, async (req, res) => {
  try {
    const { name, description, avatarUrl, outgoingUrl, includeHistory } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }
    if (!outgoingUrl) {
      return res.status(400).json({ success: false, error: 'Outgoing webhook URL is required' })
    }

    const userId = getBotUserId(req)
    
    const bot = await botService.createBot(userId, {
      name,
      description,
      avatarUrl,
      outgoingUrl,
      includeHistory: includeHistory || false
    })

    res.status(201).json({ success: true, data: bot })
  } catch (error) {
    // Handle quota exceeded error from BotService
    if (error.code === 'QUOTA_EXCEEDED') {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        details: error.details,
        message: 'Você atingiu o limite de bots. Faça upgrade do seu plano para continuar.'
      })
    }
    logger.error('Error creating bot', { error: error.message, userId: getBotUserId(req) })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/user/bots/:id
 * Update a bot
 */
router.put('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, avatarUrl, outgoingUrl, includeHistory } = req.body

    const userId = getBotUserId(req)
    
    const bot = await botService.updateBot(parseInt(id, 10), userId, {
      name,
      description,
      avatarUrl,
      outgoingUrl,
      includeHistory
    })

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error updating bot', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/user/bots/:id
 * Delete a bot
 */
router.delete('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const userId = getBotUserId(req)
    
    await botService.deleteBot(parseInt(id, 10), userId)

    res.json({ success: true, message: 'Bot deleted' })
  } catch (error) {
    logger.error('Error deleting bot', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/bots/:id/pause
 * Pause a bot
 */
router.post('/:id/pause', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const userId = getBotUserId(req)
    
    const bot = await botService.pauseBot(parseInt(id, 10), userId)

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error pausing bot', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/bots/:id/resume
 * Resume a bot
 */
router.post('/:id/resume', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const userId = getBotUserId(req)
    
    const bot = await botService.resumeBot(parseInt(id, 10), userId)

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error resuming bot', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/bots/:id/regenerate-token
 * Regenerate bot access token
 */
router.post('/:id/regenerate-token', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const userId = getBotUserId(req)
    
    const bot = await botService.regenerateAccessToken(parseInt(id, 10), userId)

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error regenerating bot token', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/bots/:id/set-default
 * Set a bot as the default bot for auto-assignment
 * 
 * Requirements: 3.1
 */
router.post('/:id/set-default', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const userId = getBotUserId(req)
    
    const bot = await botService.setDefaultBot(parseInt(id, 10), userId)

    res.json({ success: true, data: bot })
  } catch (error) {
    logger.error('Error setting default bot', { error: error.message, botId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/user/bots/priorities
 * Update priorities for multiple bots (for drag-and-drop reordering)
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
router.put('/priorities', verifyUserToken, async (req, res) => {
  try {
    const { priorities } = req.body

    if (!Array.isArray(priorities) || priorities.length === 0) {
      return res.status(400).json({ success: false, error: 'Priorities array is required' })
    }

    const userId = getBotUserId(req)
    
    await botService.updatePriorities(userId, priorities)

    // Return updated bots list
    const bots = await botService.getBots(userId)

    res.json({ success: true, data: bots })
  } catch (error) {
    logger.error('Error updating bot priorities', { error: error.message, userId: getBotUserId(req) })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
