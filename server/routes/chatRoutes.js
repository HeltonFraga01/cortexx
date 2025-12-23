const express = require('express');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { normalizePhoneNumber, validatePhoneFormat } = require('../utils/phoneUtils');
const { validatePhoneWithAPI } = require('../services/PhoneValidationService');
const { quotaMiddleware, getQuotaService, resolveUserId } = require('../middleware/quotaEnforcement');
const { featureMiddleware } = require('../middleware/featureEnforcement');
const QuotaService = require('../services/QuotaService');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');

const router = express.Router();

/**
 * Chat Routes
 * Handles message sending and chat operations
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * instead of the accounts table. This ensures the correct token is used when
 * users have multiple inboxes.
 * 
 * Requirements: 8.1 (Update Chat to use InboxContext)
 */

/**
 * Middleware para verificar token do usuário usando InboxContext
 * Usa o token da inbox ativa em vez do token da account
 * 
 * Fluxo:
 * 1. Valida JWT do Supabase
 * 2. Carrega contexto da inbox (via inboxContextMiddleware)
 * 3. Usa wuzapiToken da inbox ativa
 * 4. Fallback para header 'token' (legacy) ou sessão
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Se tem JWT, usar inboxContextMiddleware para obter token da inbox correta
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Validar JWT do Supabase
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Carregar contexto da inbox
      await new Promise((resolve, reject) => {
        inboxContextMiddleware({ required: false, useCache: true })(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Se temos contexto, usar o token da inbox ativa
      if (req.context?.wuzapiToken) {
        req.userToken = req.context.wuzapiToken;
        req.userId = req.user?.id;
        req.inboxId = req.context.inboxId;
        
        logger.debug('WUZAPI token obtained from inbox context for chat', {
          userId: req.userId?.substring(0, 8) + '...',
          inboxId: req.inboxId?.substring(0, 8) + '...',
          hasToken: true
        });
        
        return next();
      }
      
      // Se não tem contexto mas tem usuário, tentar continuar
      if (req.user?.id) {
        logger.warn('No inbox context available for chat user', {
          userId: req.user.id.substring(0, 8) + '...',
          path: req.path
        });
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for chat, trying other methods', { 
        error: error.message,
        path: req.path
      });
    }
  }
  
  // Fallback: Tentar obter token do header 'token' (legacy)
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    req.userToken = tokenHeader;
    return next();
  }
  
  // Fallback: Token da sessão
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    return next();
  }
  
  // Nenhum token encontrado
  return res.status(401).json({
    success: false,
    error: {
      code: 'NO_TOKEN',
      message: 'Token não fornecido. Use Authorization Bearer, header token ou sessão ativa.'
    }
  });
};

// Alias para compatibilidade
const verifyUserToken = verifyUserTokenWithInbox;

// Importar serviços de variação
const templateProcessor = require('../services/TemplateProcessor');
const variationTracker = require('../services/VariationTracker');

/**
 * Helper to increment quota usage after successful message send
 * @param {Object} req - Express request
 * @param {string} userId - User ID for quota tracking
 */
async function incrementMessageQuota(req, userId) {
  try {
    const quotaService = getQuotaService(req);
    if (!quotaService || !userId) {
      logger.warn('Quota increment skipped - service or userId not available', { 
        hasService: !!quotaService, 
        hasUserId: !!userId 
      });
      return;
    }
    
    await quotaService.incrementUsage(userId, QuotaService.QUOTA_TYPES.MAX_MESSAGES_PER_DAY, 1);
    await quotaService.incrementUsage(userId, QuotaService.QUOTA_TYPES.MAX_MESSAGES_PER_MONTH, 1);
    
    logger.debug('Message quota incremented', { userId });
  } catch (error) {
    logger.error('Failed to increment message quota', { 
      error: error.message, 
      userId 
    });
  }
}

/**
 * Verifica se o identificador é um JID de grupo do WhatsApp
 * Grupos têm formato: 120363123456789@g.us ou 553194974759-1604417602@g.us
 * @param {string} identifier - Phone ou JID
 * @returns {boolean} true se for um grupo
 */
function isGroupJid(identifier) {
  if (!identifier) return false;
  // Grupos terminam com @g.us
  if (identifier.endsWith('@g.us')) return true;
  // Formato alternativo: número-timestamp (ex: 553194974759-1604417602)
  // Grupos antigos têm formato: telefone-timestamp
  if (/^\d{10,15}-\d{10,13}$/.test(identifier)) return true;
  return false;
}

// POST /api/chat/send/text - Enviar mensagem de texto
// Quota: max_messages_per_day
router.post('/send/text', verifyUserToken, quotaMiddleware.messages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { Phone, Body, variables = {}, campaignId = null, messageId = null, isScheduled = false, scheduledAt = null, instance = null, recipientName = null, ...options } = req.body;
    
    // Detectar se é um grupo
    const isGroup = isGroupJid(Phone);
    
    logger.info('Solicitação de envio de mensagem:', { 
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone ? Phone.substring(0, 8) + '...' : 'empty',
      messageLength: Body ? Body.length : 0,
      hasVariables: Object.keys(variables).length > 0,
      isGroup
    });
    
    // Validar parâmetros obrigatórios
    if (!Phone || !Body) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Body are required',
        timestamp: new Date().toISOString()
      });
    }

    let validatedPhone;
    
    if (isGroup) {
      // Para grupos, usar o JID diretamente (não precisa validar com /user/check)
      // Garantir que tenha o sufixo @g.us
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
      
      logger.info('Enviando mensagem para grupo', {
        groupJid: validatedPhone
      });
    } else {
      // Para contatos individuais, validar número de telefone usando API WUZAPI /user/check
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        logger.warn('Número de telefone inválido', {
          original: Phone,
          error: phoneValidation.error
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error,
          timestamp: new Date().toISOString()
        });
      }
      
      // Usar o número validado pela API (campo Query)
      validatedPhone = phoneValidation.validatedPhone;
      
      logger.debug('Número de telefone validado pela API', {
        original: Phone,
        validated: validatedPhone,
        jid: phoneValidation.jid
      });
    }

    // Se for agendada, salvar no banco e retornar
    if (isScheduled && scheduledAt) {
      // Check scheduled_messages feature
      const { getFeatureService } = require('../middleware/featureEnforcement');
      const featureService = getFeatureService(req);
      const userId = req.session?.userId || req.userId;
      
      if (featureService && userId) {
        const isEnabled = await featureService.isFeatureEnabled(userId, 'scheduled_messages');
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            code: 'FEATURE_DISABLED',
            details: {
              featureName: 'scheduled_messages',
              message: 'O recurso de mensagens agendadas não está disponível no seu plano atual. Faça upgrade para acessar.'
            }
          });
        }
      }
      
      if (!instance) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Instance is required for scheduled messages',
          timestamp: new Date().toISOString()
        });
      }

      const db = req.app.locals.db;
      if (!db) {
        return res.status(500).json({
          success: false,
          error: 'Database not available',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const messageId = await db.createScheduledSingleMessage(
          userToken,
          instance,
          validatedPhone,
          recipientName,
          'text',
          Body,
          null,
          scheduledAt
        );

        logger.info('Mensagem de texto agendada criada', {
          messageId,
          recipient: validatedPhone,
          scheduledAt
        });

        return res.json({
          success: true,
          message: 'Mensagem agendada com sucesso',
          data: {
            messageId,
            scheduledAt,
            status: 'scheduled'
          }
        });
      } catch (error) {
        logger.error('Erro ao agendar mensagem:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to schedule message',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Processar template com variações e variáveis
    const processed = templateProcessor.process(Body, variables);
    
    // Verificar se houve erro no processamento
    if (!processed.success) {
      logger.warn('Erro ao processar template:', { errors: processed.errors });
      return res.status(400).json({
        success: false,
        error: 'Template inválido',
        message: 'Erro ao processar variações no template',
        errors: processed.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Usar mensagem processada (com variações e variáveis aplicadas)
    const finalMessage = processed.finalMessage;
    
    logger.info('Template processado:', {
      hasVariations: processed.metadata.hasVariations,
      hasVariables: processed.metadata.hasVariables,
      originalLength: Body.length,
      finalLength: finalMessage.length
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
      Phone: validatedPhone,
      Body: finalMessage,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const result = response.data;
    
    // Registrar mensagem enviada no banco de dados
    const db = req.app.locals.db;
    if (db) {
      await db.logSentMessage(userToken, validatedPhone, finalMessage, 'text', result);
    }
    
    // Increment quota usage after successful send
    const userId = resolveUserId(req);
    await incrementMessageQuota(req, userId);
    
    // Registrar variações usadas (se houver)
    if (processed.metadata.hasVariations && processed.selections.length > 0) {
      try {
        await variationTracker.logVariation({
          campaignId,
          messageId: messageId || result.id || null,
          template: Body,
          selections: processed.selections,
          recipient: validatedPhone,
          userId: null // Pode ser adicionado se houver user_id disponível
        });
        
        logger.info('Variações registradas:', {
          campaignId,
          recipient: Phone.substring(0, 8) + '...',
          selectionsCount: processed.selections.length
        });
      } catch (trackError) {
        // Não falhar o envio se o tracking falhar
        logger.error('Erro ao registrar variações:', trackError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: result,
      processed: {
        hasVariations: processed.metadata.hasVariations,
        hasVariables: processed.metadata.hasVariables,
        selectionsCount: processed.selections.length
      }
    });
    
  } catch (error) {
    logger.error('Erro ao enviar mensagem:', { 
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 400) {
      statusCode = 400;
      errorType = 'Bad Request';
    } else if (error.response?.status === 403) {
      statusCode = 403;
      errorType = 'Forbidden';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      errorType = 'Request Timeout';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/chat/send/image - Enviar mensagem com imagem
// Quota: max_messages_per_day
router.post('/send/image', verifyUserToken, quotaMiddleware.messages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { Phone, Image, Caption, isScheduled = false, scheduledAt = null, instance = null, recipientName = null, ...options } = req.body;
    
    // Detectar se é um grupo
    const isGroup = isGroupJid(Phone);
    
    logger.info('Solicitação de envio de imagem:', { 
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone ? Phone.substring(0, 8) + '...' : 'empty',
      hasCaption: !!Caption,
      isScheduled,
      isGroup
    });
    
    if (!Phone || !Image) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Image are required',
        timestamp: new Date().toISOString()
      });
    }

    let validatedPhone;
    
    if (isGroup) {
      // Para grupos, usar o JID diretamente (não precisa validar com /user/check)
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
      
      logger.info('Enviando imagem para grupo', {
        groupJid: validatedPhone
      });
    } else {
      // Para contatos individuais, validar número de telefone usando API WUZAPI /user/check
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        logger.warn('Número de telefone inválido', {
          original: Phone,
          error: phoneValidation.error
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error,
          timestamp: new Date().toISOString()
        });
      }
      
      // Usar o número validado pela API (campo Query)
      validatedPhone = phoneValidation.validatedPhone;
      
      logger.debug('Número de telefone validado pela API', {
        original: Phone,
        validated: validatedPhone,
        jid: phoneValidation.jid
      });
    }

    // Se for agendada, salvar no banco e retornar
    if (isScheduled && scheduledAt) {
      // Check scheduled_messages feature
      const { getFeatureService } = require('../middleware/featureEnforcement');
      const featureService = getFeatureService(req);
      const userId = req.session?.userId || req.userId;
      
      if (featureService && userId) {
        const isEnabled = await featureService.isFeatureEnabled(userId, 'scheduled_messages');
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            code: 'FEATURE_DISABLED',
            details: {
              featureName: 'scheduled_messages',
              message: 'O recurso de mensagens agendadas não está disponível no seu plano atual. Faça upgrade para acessar.'
            }
          });
        }
      }
      
      if (!instance) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Instance is required for scheduled messages',
          timestamp: new Date().toISOString()
        });
      }

      const db = req.app.locals.db;
      if (!db) {
        return res.status(500).json({
          success: false,
          error: 'Database not available',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const messageId = await db.createScheduledSingleMessage(
          userToken,
          instance,
          validatedPhone,
          recipientName,
          'media',
          Caption || '[Imagem]',
          { url: Image, type: 'image' },
          scheduledAt
        );

        logger.info('Mensagem de imagem agendada criada', {
          messageId,
          recipient: validatedPhone,
          scheduledAt
        });

        return res.json({
          success: true,
          message: 'Mensagem agendada com sucesso',
          data: {
            messageId,
            scheduledAt,
            status: 'scheduled'
          }
        });
      } catch (error) {
        logger.error('Erro ao agendar mensagem:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to schedule message',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
      Phone: validatedPhone,
      Image,
      Caption,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Maior timeout para imagens
    });
    
    const result = response.data;
    
    // Registrar mensagem enviada no banco de dados
    const db = req.app.locals.db;
    if (db) {
      await db.logSentMessage(userToken, validatedPhone, Caption || '[Imagem]', 'image', result);
    }
    
    // Increment quota usage after successful send
    const userId = resolveUserId(req);
    await incrementMessageQuota(req, userId);
    
    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      data: result
    });
    
  } catch (error) {
    logger.error('Erro ao enviar imagem:', { 
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 400) {
      statusCode = 400;
      errorType = 'Bad Request';
    } else if (error.response?.status === 403) {
      statusCode = 403;
      errorType = 'Forbidden';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      errorType = 'Request Timeout';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== Assignment Routes (User/Owner) ====================

const ConversationAssignmentService = require('../services/ConversationAssignmentService');
const db = require('../database');

/**
 * POST /api/chat/conversations/:id/assign
 * Manual assignment by user/owner
 * Requirements: 3.3
 */
router.post('/conversations/:id/assign', verifyUserToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID do agente é obrigatório' 
      });
    }
    
    // Verify conversation belongs to user
    const convResult = await db.query(
      'SELECT id, inbox_id FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversa não encontrada' 
      });
    }
    
    const conversation = convResult.rows[0];
    
    // Verify agent is member of the inbox (if inbox exists)
    if (conversation.inbox_id) {
      const memberResult = await db.query(
        'SELECT 1 FROM inbox_members WHERE inbox_id = ? AND agent_id = ?',
        [conversation.inbox_id, agentId]
      );
      
      if (memberResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Agente não é membro desta caixa de entrada' 
        });
      }
    }
    
    // Perform manual assignment
    const assignmentService = new ConversationAssignmentService(db);
    await assignmentService.manualAssign(parseInt(id, 10), agentId, userId);
    
    logger.info('User manually assigned conversation', { 
      userId, 
      conversationId: id, 
      agentId 
    });
    
    res.json({ 
      success: true, 
      data: { conversationId: parseInt(id, 10), agentId } 
    });
  } catch (error) {
    logger.error('Error manually assigning conversation', { 
      error: error.message, 
      userId: req.userId 
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/chat/conversations/:id/agents
 * Get agents available for assignment in conversation's inbox
 * Requirements: 3.3
 */
router.get('/conversations/:id/agents', verifyUserToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    
    // Verify conversation belongs to user
    const convResult = await db.query(
      'SELECT id, inbox_id FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversa não encontrada' 
      });
    }
    
    const conversation = convResult.rows[0];
    
    if (!conversation.inbox_id) {
      return res.json({ success: true, data: [] });
    }
    
    // Get agents in inbox
    const assignmentService = new ConversationAssignmentService(db);
    const agents = await assignmentService.getTransferableAgents(conversation.inbox_id);
    
    res.json({ success: true, data: agents });
  } catch (error) {
    logger.error('Error fetching agents for assignment', { 
      error: error.message, 
      userId: req.userId 
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// POST /api/chat/check - Verificar se número existe no WhatsApp
router.post('/check', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    let { Phone } = req.body;
    
    // Garantir que Phone seja um array
    if (!Phone) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Converter para array se for string
    const phoneArray = Array.isArray(Phone) ? Phone : [Phone];
    
    logger.info('Verificando número(s) no WhatsApp:', { 
      userToken: userToken.substring(0, 8) + '...',
      phones: phoneArray.map(p => p.substring(0, 8) + '...').join(', ')
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/user/check`, {
      Phone: phoneArray
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const result = response.data;
    
    // Se foi enviado apenas um número, retornar apenas o primeiro resultado
    if (!Array.isArray(Phone) && result.data && result.data.Users && result.data.Users.length > 0) {
      res.json({
        success: true,
        data: result.data.Users[0]
      });
    } else {
      res.json({
        success: true,
        data: result.data || result
      });
    }
    
  } catch (error) {
    logger.error('Erro ao verificar número:', { 
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 400) {
      statusCode = 400;
      errorType = 'Bad Request';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      errorType = 'Request Timeout';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
