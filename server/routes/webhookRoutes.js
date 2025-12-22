const express = require('express');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { getUserToken, getWuzapiTokenFromAccount } = require('../middleware/auth');

const router = express.Router();

/**
 * Webhook Routes
 * Handles webhook configuration and management
 */

// Cache para WUZAPI tokens (evita chamadas repetidas ao banco)
const wuzapiTokenCache = new Map();
const WUZAPI_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Get WUZAPI token from cache or database
 * @param {string} userId - Supabase user ID
 * @param {string} wuzapiId - Optional WUZAPI user ID from JWT metadata
 */
async function getCachedWuzapiToken(userId, wuzapiId = null) {
  if (!userId) return null;
  
  // Check cache first
  const cached = wuzapiTokenCache.get(userId);
  if (cached && Date.now() - cached.timestamp < WUZAPI_CACHE_TTL) {
    logger.debug('WUZAPI token obtained from cache (webhookRoutes)', { userId: userId.substring(0, 8) + '...' });
    return cached.token;
  }
  
  // Fetch from database (and potentially from WUZAPI API if wuzapiId is provided)
  const token = await getWuzapiTokenFromAccount(userId, wuzapiId);
  if (token) {
    wuzapiTokenCache.set(userId, { token, timestamp: Date.now() });
    logger.debug('WUZAPI token obtained from database (webhookRoutes)', { userId: userId.substring(0, 8) + '...' });
  }
  
  return token;
}

// Middleware para verificar token do usuário (via JWT Supabase, header ou sessão)
const verifyUserToken = async (req, res, next) => {
  let userToken = null;
  
  // Tentar obter token do header Authorization (JWT Supabase)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Validate Supabase JWT and extract user data
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Get userId and wuzapiId from validated JWT
      const userId = req.user?.id;
      const wuzapiId = req.user?.user_metadata?.wuzapi_id;
      
      if (userId) {
        // First try to get token from JWT metadata
        userToken = getUserToken(req);
        
        // If not in metadata, fetch from accounts table (passing wuzapiId for auto-correction)
        if (!userToken) {
          userToken = await getCachedWuzapiToken(userId, wuzapiId);
          
          if (userToken) {
            logger.debug('WUZAPI token fetched from accounts table', { 
              userId: userId.substring(0, 8) + '...',
              hasToken: true 
            });
          } else {
            logger.warn('No WUZAPI token found for user in accounts table', { 
              userId: userId.substring(0, 8) + '...' 
            });
          }
        }
      }
      
      if (userToken) {
        req.userToken = userToken;
        req.userId = userId;
        return next();
      }
    } catch (error) {
      logger.debug('JWT validation failed, trying other methods', { error: error.message });
    }
  }
  
  // Tentar obter token do header 'token' (legacy)
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    userToken = tokenHeader;
  } else if (req.session?.userToken) {
    // Fallback para token da sessão
    userToken = req.session.userToken;
  }
  
  if (!userToken) {
    return res.status(401).json({
      error: 'Token não fornecido',
      message: 'Header Authorization com Bearer token, header token ou sessão ativa é obrigatório'
    });
  }
  
  req.userToken = userToken;
  next();
};

// GET /api/webhook - Buscar configuração de webhook do usuário
router.get('/', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    
    logger.info('Solicitação de configuração de webhook:', { 
      userToken: userToken.substring(0, 8) + '...' 
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.get(`${wuzapiBaseUrl}/webhook`, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const webhookData = response.data.data || response.data;
    
    res.json({
      success: true,
      webhook: webhookData.webhook || '',
      events: webhookData.events || [],
      subscribe: webhookData.subscribe || ['Message'],
      data: webhookData
    });
    
  } catch (error) {
    logger.error('Erro ao buscar configuração de webhook:', { 
      error: error.message,
      status: error.response?.status,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (error.response?.status === 401) {
      statusCode = 401;
      errorType = 'Unauthorized';
    } else if (error.response?.status === 404) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorType = 'Service Unavailable';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhook/config - Atualizar configuração de webhook do usuário
router.post('/config', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { webhook, events, subscribe } = req.body;
    
    logger.info('Solicitação de atualização de webhook:', { 
      userToken: userToken.substring(0, 8) + '...',
      webhook: webhook ? webhook.substring(0, 20) + '...' : 'empty',
      eventsCount: events?.length || 0
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.put(`${wuzapiBaseUrl}/webhook`, {
      webhook,
      events,
      subscribe,
      active: true
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const result = response.data;
    
    res.json({
      success: true,
      message: 'Configuração de webhook atualizada com sucesso',
      data: result
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar configuração de webhook:', { 
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
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhook/events - Receber eventos de webhook da WUZAPI
// Este endpoint é chamado pela WUZAPI para enviar eventos (mensagens, status, etc)
router.post('/events', async (req, res) => {
  try {
    const { extractPhoneFromWebhook } = require('../utils/phoneUtils');
    const ChatMessageHandler = require('../webhooks/chatMessageHandler');
    
    const event = req.body;
    
    // Log do evento recebido com todas as chaves para debug
    logger.info('Evento de webhook recebido', {
      eventType: event?.type || event?.event,
      bodyKeys: Object.keys(event || {}),
      hasToken: !!event?.token,
      hasUserID: !!event?.userID,
      userID: event?.userID?.substring(0, 10),
      token: event?.token?.substring(0, 10),
      hasInstanceName: !!event?.instanceName,
      timestamp: new Date().toISOString()
    });
    
    // WUZAPI envia eventos em dois formatos possíveis:
    // 1. Formato JSON (WEBHOOK_FORMAT=json): { event, data, userID, instanceName, token, ... }
    // 2. Formato Form: campos separados incluindo jsonData
    
    // Extrair token do evento
    // WUZAPI inclui token no payload quando WEBHOOK_FORMAT=json
    // Prioridade: header > body.token > session mapping > body.userID (fallback)
    let userToken = req.headers.token || req.headers['x-user-token'];
    
    // Se não tem token no header, tentar extrair do body
    if (!userToken) {
      userToken = event.token;
    }
    
    // Se ainda não tem token, tentar buscar do mapeamento de sessão
    if (!userToken && event.userID) {
      const { getSessionMappingService } = require('../services/SessionMappingService');
      const sessionMapping = getSessionMappingService(req.app.locals.db);
      if (sessionMapping) {
        userToken = await sessionMapping.getTokenFromSessionId(event.userID);
        if (userToken) {
          logger.debug('Token resolved from session mapping', {
            sessionId: event.userID.substring(0, 10),
            token: userToken.substring(0, 10)
          });
        }
      }
    }
    
    // Fallback para userID se não conseguiu resolver
    if (!userToken) {
      userToken = event.userID || event.userId;
    }
    
    // Log para debug
    logger.debug('Webhook user identification', {
      hasHeaderToken: !!req.headers.token,
      hasBodyToken: !!event.token,
      hasUserID: !!event.userID,
      resolvedFromMapping: !!(event.userID && userToken !== event.userID),
      userToken: userToken?.substring(0, 10) + '...'
    });
    
    // Validar estrutura básica do evento
    // WUZAPI pode enviar em diferentes formatos:
    // 1. Formato JSON (WEBHOOK_FORMAT=json): { event: {...}, type: "Message", userID, instanceName }
    // 2. Formato antigo: { data: {...}, event: "Message" }
    // 3. Formato Form: campos separados incluindo jsonData
    
    let eventData = null;
    let eventType = null;
    
    // Formato novo: event contém os dados, type contém o tipo
    if (event.event && typeof event.event === 'object') {
      eventData = event.event;
      eventType = event.type || 'Message';
    }
    // Formato antigo: data contém os dados, event contém o tipo
    else if (event.data) {
      eventData = event.data;
      eventType = event.event;
    }
    // Formato form: jsonData contém tudo
    else if (event.jsonData) {
      try {
        const parsed = JSON.parse(event.jsonData);
        eventData = parsed.event || parsed.data || parsed;
        eventType = parsed.type || parsed.event || 'Message';
      } catch (parseError) {
        logger.warn('Falha ao parsear jsonData do webhook', {
          error: parseError.message
        });
      }
    }
    
    if (!eventData) {
      logger.warn('Webhook event com estrutura inválida', {
        hasEvent: !!event,
        hasData: !!event?.data,
        hasJsonData: !!event?.jsonData,
        eventType: typeof event.event,
        keys: Object.keys(event || {})
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook event structure',
        message: 'Event data is required'
      });
    }
    
    // Log detalhado para debug
    logger.debug('Webhook event parsed', {
      eventType,
      eventDataKeys: Object.keys(eventData || {}),
      hasInfo: !!eventData?.Info,
      hasMessage: !!eventData?.Message
    });
    
    // Extrair número de telefone do evento
    // extractPhoneFromWebhook é async quando precisa resolver LID
    const phone = await extractPhoneFromWebhook(eventData, userToken);
    
    // Log de sucesso na extração (mesmo se phone for vazio para alguns eventos)
    logger.info('Webhook event recebido', {
      eventType: eventType,
      phone: phone ? phone.substring(0, 8) + '...' : 'N/A',
      hasUserToken: !!userToken,
      timestamp: new Date().toISOString()
    });
    
    // Responder imediatamente para confirmar recebimento
    res.json({
      success: true,
      message: 'Webhook event received',
      phone: phone || null
    });
    
    // Processar evento em background para o chat inbox
    if (userToken && req.app.locals.db) {
      try {
        const db = req.app.locals.db;
        const chatHandler = req.app.locals.chatHandler;
        const handler = new ChatMessageHandler(db, chatHandler);
        
        // Mapear evento WUZAPI para formato do chatMessageHandler
        const chatEvent = {
          type: eventType || 'Message',
          data: eventData,
          timestamp: event.timestamp || new Date().toISOString()
        };
        
        const result = await handler.handleEvent(userToken, chatEvent);
        
        logger.info('Webhook event processado para chat', {
          eventType: chatEvent.type,
          handled: result.handled,
          conversationId: result.conversationId,
          skipped: result.skipped,
          reason: result.reason
        });
      } catch (chatError) {
        logger.error('Erro ao processar webhook para chat:', {
          error: chatError.message,
          eventType: eventType
        });
      }
    } else {
      logger.warn('Webhook event não processado para chat', {
        hasUserToken: !!userToken,
        hasDb: !!req.app.locals.db,
        eventType: eventType
      });
    }
    
  } catch (error) {
    logger.error('Erro ao processar webhook event:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/webhook - Atualizar configuração de webhook do usuário (compatibilidade)
router.post('/', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { webhook, events, subscribe } = req.body;
    
    logger.info('Solicitação de atualização de webhook:', { 
      userToken: userToken.substring(0, 8) + '...',
      webhook: webhook ? webhook.substring(0, 20) + '...' : 'empty',
      eventsCount: events?.length || 0
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    // WUZAPI POST /webhook expects WebhookURL (PascalCase), not webhook (lowercase)
    const response = await axios.post(`${wuzapiBaseUrl}/webhook`, {
      WebhookURL: webhook,
      events: events || subscribe || []
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const result = response.data;
    
    res.json({
      success: true,
      message: 'Configuração de webhook atualizada com sucesso',
      data: result
    });
    
  } catch (error) {
    logger.error('Erro ao atualizar configuração de webhook:', { 
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
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorType,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;