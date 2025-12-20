/**
 * Agent Chat Routes
 * 
 * Chat routes for agents - provides same functionality as user chat
 * but filtered by agent's assigned inboxes.
 * 
 * Requirements: Agent can only see conversations from their assigned inboxes.
 */

const router = require('express').Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const { requireAgentAuth, requirePermission } = require('../middleware/agentAuth');
const ChatService = require('../services/ChatService');
const InboxService = require('../services/InboxService');
const { validatePhoneWithAPI } = require('../services/PhoneValidationService');

// Services will be initialized with db
let chatService = null;
let inboxService = null;

function initServices(db) {
  if (!chatService) {
    chatService = new ChatService(db);
    inboxService = new InboxService(db);
  }
}

/**
 * Helper to get agent's inbox IDs
 */
async function getAgentInboxIds(agentId) {
  const inboxes = await inboxService.listAgentInboxes(agentId);
  return inboxes.map(inbox => inbox.id);
}

/**
 * Helper to get WUZAPI token from agent's account
 * The account's WUZAPI token is needed to access WUZAPI
 * 
 * Since req.account is loaded by requireAgentAuth middleware,
 * we can use req.account.wuzapiToken directly.
 * This function is kept for backward compatibility but now just
 * returns the token from the account object.
 */
function getAccountUserTokenFromRequest(req) {
  return req.account?.wuzapiToken || null;
}

/**
 * Legacy helper - queries database for WUZAPI token
 * Use getAccountUserTokenFromRequest(req) instead when req.account is available
 */
async function getAccountUserToken(db, accountId) {
  const SupabaseService = require('../services/SupabaseService');
  const { data, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
    query.select('wuzapi_token').eq('id', accountId).single()
  );
  if (error || !data) {
    logger.warn('Failed to get account WUZAPI token', { accountId, error: error?.message });
    return null;
  }
  return data.wuzapi_token || null;
}

/**
 * Helper to get WUZAPI token from inbox
 * The inbox's WUZAPI token is needed to send messages via WUZAPI
 */
async function getInboxWuzapiToken(db, inboxId) {
  const SupabaseService = require('../services/SupabaseService');
  const { data, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
    query.select('wuzapi_token').eq('id', inboxId).single()
  );
  if (error || !data) {
    logger.warn('Failed to get inbox WUZAPI token', { inboxId, error: error?.message });
    return null;
  }
  return data.wuzapi_token || null;
}

// ==================== Conversation Routes ====================

/**
 * GET /api/agent/chat/conversations
 * List conversations from agent's assigned inboxes
 * Supports assignment filtering: assignedToMe, unassigned
 * Requirements: 2.1, 2.4, 2.5
 */
router.get('/conversations', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { 
      status, hasUnread, assignedBotId, labelId, search, inboxId, 
      assignmentFilter, // 'mine', 'unassigned', 'all'
      limit = 50, offset = 0 
    } = req.query;
    
    // Get agent's assigned inboxes
    const agentInboxIds = await getAgentInboxIds(agentId);
    
    if (agentInboxIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, limit: parseInt(limit, 10), offset: parseInt(offset, 10), hasMore: false }
      });
    }
    
    // Get account's user token for WUZAPI access (from req.account loaded by middleware)
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      logger.error('Account user token not found', { accountId, agentId });
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Build filters - restrict to agent's inboxes
    const filters = {};
    if (status) filters.status = status;
    if (hasUnread === 'true') filters.hasUnread = true;
    if (assignedBotId) filters.assignedBotId = assignedBotId;
    if (labelId) filters.labelId = labelId;
    if (search) filters.search = search;
    
    // Assignment filter - Requirements 2.1, 2.4
    // Agents can only see: assigned to them OR unassigned
    if (assignmentFilter === 'mine') {
      filters.assignedAgentId = agentId;
    } else if (assignmentFilter === 'unassigned') {
      filters.assignedAgentId = null;
      filters.assignedAgentIdIsNull = true;
    } else {
      // Default 'all' - show assigned to me OR unassigned (not assigned to others)
      filters.assignedAgentIdFilter = { agentId, includeUnassigned: true };
    }
    
    // If specific inbox requested, verify agent has access
    if (inboxId) {
      // Inbox IDs are UUIDs (TEXT), not integers
      if (!agentInboxIds.includes(inboxId)) {
        return res.status(403).json({ success: false, error: 'Acesso negado a esta caixa de entrada' });
      }
      filters.inboxId = inboxId;
    } else {
      // Filter by all agent's inboxes
      filters.inboxIds = agentInboxIds;
    }
    
    const result = await chatService.getConversations(userToken, filters, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    
    res.json({
      success: true,
      data: result.conversations,
      pagination: {
        total: result.total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: result.total > parseInt(offset, 10) + result.conversations.length
      }
    });
  } catch (error) {
    logger.error('Error fetching agent conversations', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/chat/conversations/search
 * Search conversations in agent's assigned inboxes
 */
router.get('/conversations/search', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { q, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    
    if (agentInboxIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const results = await chatService.searchConversations(userToken, q, { 
      limit: parseInt(limit, 10),
      inboxIds: agentInboxIds
    });
    
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Error searching agent conversations', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/start
 * Start or get existing conversation with a phone number
 */
router.post('/conversations/start', requireAgentAuth(null), requirePermission('conversations:create'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { phone, name, avatarUrl } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Telefone é obrigatório' });
    }
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    
    if (agentInboxIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma caixa de entrada atribuída' });
    }
    
    // Use req.account.wuzapiToken directly (loaded by requireAgentAuth middleware)
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      logger.error('Account WUZAPI token not found', { accountId, agentId });
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Normalize phone number - remove non-digits
    let normalizedPhone = phone.replace(/\D/g, '');
    
    // Create JID format for WhatsApp
    const contactJid = `${normalizedPhone}@s.whatsapp.net`;
    
    // Use the first inbox for new conversations
    const defaultInboxId = agentInboxIds[0];
    
    const conversation = await chatService.getOrCreateConversation(
      userToken,
      contactJid,
      { name, avatarUrl, inboxId: defaultInboxId }
    );
    
    logger.info('Agent conversation started/retrieved', { 
      agentId,
      phone: normalizedPhone,
      conversationId: conversation.id,
      inboxId: defaultInboxId
    });
    
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error starting agent conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/chat/conversations/:id
 * Get single conversation (must be in agent's inbox)
 */
router.get('/conversations/:id', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const conversation = await chatService.getConversation(userToken, id);
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    
    // Verify agent has access to this conversation's inbox
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Error fetching agent conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/agent/chat/conversations/:id
 * Update conversation (status, mute, etc.)
 */
router.patch('/conversations/:id', requireAgentAuth(null), requirePermission('conversations:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { status, isMuted, assignedBotId } = req.body;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (isMuted !== undefined) updates.isMuted = isMuted;
    if (assignedBotId !== undefined) updates.assignedBotId = assignedBotId;
    
    const updated = await chatService.updateConversation(userToken, id, updates);
    
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating agent conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/read
 * Mark conversation as read
 */
router.post('/conversations/:id/read', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    await chatService.markConversationAsRead(userToken, id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking conversation as read', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Message Routes ====================

/**
 * GET /api/agent/chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { limit = 50, before, after } = req.query;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    const result = await chatService.getMessages(id, userToken, {
      limit: parseInt(limit, 10),
      before,
      after
    });
    
    res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error fetching agent messages', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/messages
 * Send a message in a conversation
 */
router.post('/conversations/:id/messages', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { content, messageType = 'text', mediaUrl, mediaMimeType, mediaFilename, replyToMessageId } = req.body;
    
    // Validate content for text messages
    if (!content && messageType === 'text') {
      return res.status(400).json({ success: false, error: 'Conteúdo é obrigatório para mensagens de texto' });
    }
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Get inbox's WUZAPI token for sending messages
    const inboxWuzapiToken = await getInboxWuzapiToken(db, conversation.inboxId);
    if (!inboxWuzapiToken) {
      return res.status(500).json({ success: false, error: 'Caixa de entrada não configurada para envio de mensagens' });
    }
    
    // Detect if it's a group (JID ends with @g.us)
    const isGroup = conversation.contactJid.endsWith('@g.us');
    
    // Extract phone number from JID or use JID for groups
    const phone = isGroup 
      ? conversation.contactJid 
      : conversation.contactJid.replace('@s.whatsapp.net', '');
    
    // Create message with pending status
    const message = await chatService.createMessage(userToken, id, {
      direction: 'outgoing',
      messageType,
      content,
      mediaUrl,
      mediaFilename,
      mediaMimeType,
      replyToMessageId,
      status: 'pending'
    });
    
    let validatedPhone;
    
    if (isGroup) {
      // For groups, use the JID directly (no need to validate with /user/check)
      validatedPhone = conversation.contactJid;
      
      logger.info('Agent sending message to group', {
        agentId,
        groupJid: validatedPhone,
        conversationId: id
      });
    } else {
      // Validate phone number using WUZAPI API
      const phoneValidation = await validatePhoneWithAPI(phone, inboxWuzapiToken);
      
      if (!phoneValidation.isValid) {
        logger.warn('Invalid phone number for agent chat message', {
          agentId,
          original: phone,
          error: phoneValidation.error,
          conversationId: id
        });
        
        // Update message status to failed
        await db.query(
          'UPDATE chat_messages SET status = ? WHERE id = ?',
          ['failed', message.id]
        );
        message.status = 'failed';
        
        return res.status(400).json({
          success: false,
          error: 'Número de telefone inválido',
          message: phoneValidation.error,
          data: message
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
      
      logger.debug('Phone validated for agent chat message', {
        agentId,
        original: phone,
        validated: validatedPhone
      });
    }
    
    // Send via WUZAPI using axios directly
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    let wuzapiResponse;
    let wuzapiSuccess = false;
    
    try {
      if (messageType === 'text') {
        const payload = {
          Phone: validatedPhone,
          Body: content
        };
        
        // Add reply context if replying to a message
        if (replyToMessageId) {
          payload.ContextInfo = {
            StanzaId: replyToMessageId,
            Participant: conversation.contactJid
          };
        }
        
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, payload, {
          headers: {
            'token': inboxWuzapiToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        wuzapiSuccess = true;
      } else if (messageType === 'image' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
          Phone: validatedPhone,
          Image: mediaUrl,
          Caption: content || ''
        }, {
          headers: {
            'token': inboxWuzapiToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        wuzapiSuccess = true;
      } else if (messageType === 'document' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/document`, {
          Phone: validatedPhone,
          Document: mediaUrl,
          FileName: mediaFilename || 'document'
        }, {
          headers: {
            'token': inboxWuzapiToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        wuzapiSuccess = true;
      } else if (messageType === 'audio' && mediaUrl) {
        let audioData = mediaUrl;
        
        if (!audioData.startsWith('data:')) {
          audioData = `data:audio/ogg;base64,${audioData}`;
        } else {
          audioData = audioData.replace(/data:audio\/ogg;\s*codecs=opus;base64,/i, 'data:audio/ogg;base64,');
          audioData = audioData.replace(/data:audio\/webm;codecs=opus;base64,/i, 'data:audio/ogg;base64,');
          audioData = audioData.replace(/data:audio\/webm;base64,/i, 'data:audio/ogg;base64,');
        }
        
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/audio`, {
          Phone: validatedPhone,
          Audio: audioData
        }, {
          headers: {
            'token': inboxWuzapiToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        wuzapiSuccess = true;
      } else if (messageType === 'video' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/video`, {
          Phone: validatedPhone,
          Video: mediaUrl,
          Caption: content || ''
        }, {
          headers: {
            'token': inboxWuzapiToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        wuzapiSuccess = true;
      }
    } catch (wuzapiError) {
      logger.error('WUZAPI request failed for agent message', {
        agentId,
        conversationId: id,
        phone: validatedPhone,
        messageType,
        error: wuzapiError.message,
        status: wuzapiError.response?.status
      });
      wuzapiSuccess = false;
    }
    
    // Update message status based on WUZAPI response
    const newStatus = wuzapiSuccess ? 'sent' : 'failed';
    
    await db.query(
      'UPDATE chat_messages SET status = ? WHERE id = ?',
      [newStatus, message.id]
    );
    
    message.status = newStatus;
    
    if (wuzapiSuccess) {
      logger.info('Agent message sent via WUZAPI', { 
        agentId,
        conversationId: id, 
        messageId: wuzapiResponse?.data?.Id,
        phone: validatedPhone 
      });
    }
    
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    logger.error('Error sending agent message', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Avatar Routes ====================

/**
 * POST /api/agent/chat/conversations/:id/fetch-avatar
 * Fetch and update avatar for a conversation's contact
 */
router.post('/conversations/:id/fetch-avatar', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Get inbox's WUZAPI token
    const inboxWuzapiToken = await getInboxWuzapiToken(db, conversation.inboxId);
    if (!inboxWuzapiToken) {
      return res.json({
        success: true,
        data: null,
        message: 'Caixa de entrada não configurada'
      });
    }
    
    const contactJid = conversation.contactJid;
    
    // Skip special JIDs that don't have avatars
    if (contactJid.includes('status@') || 
        contactJid.includes('@newsletter') || 
        contactJid.includes('@broadcast')) {
      return res.json({
        success: true,
        data: null,
        message: 'Special JID - no avatar available'
      });
    }
    
    // For groups, use the full JID; for contacts, extract phone number
    const phone = contactJid.includes('@g.us') 
      ? contactJid 
      : contactJid.replace('@s.whatsapp.net', '');
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    try {
      const response = await axios({
        method: 'POST',
        url: `${wuzapiBaseUrl}/user/avatar`,
        headers: {
          'token': inboxWuzapiToken,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        data: {
          Phone: phone,
          Preview: true
        },
        timeout: 10000
      });
      
      const avatarData = response.data?.data || response.data;
      const avatarUrl = avatarData?.URL || avatarData?.url;
      
      if (avatarUrl) {
        await db.query(
          'UPDATE conversations SET contact_avatar_url = ? WHERE id = ?',
          [avatarUrl, id]
        );
        
        logger.info('Agent fetched avatar', { agentId, conversationId: id, phone, hasUrl: true });
        
        res.json({
          success: true,
          data: {
            avatarUrl: avatarUrl,
            conversationId: id
          }
        });
      } else {
        res.json({
          success: true,
          data: null,
          message: 'No avatar available for this contact'
        });
      }
    } catch (wuzapiError) {
      logger.warn('WUZAPI avatar request failed for agent', {
        agentId,
        conversationId: id,
        phone,
        status: wuzapiError.response?.status,
        error: wuzapiError.message
      });
      
      return res.json({
        success: true,
        data: null,
        message: 'Avatar not available'
      });
    }
  } catch (error) {
    logger.error('Error fetching conversation avatar for agent', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Labels Routes ====================

/**
 * GET /api/agent/chat/labels
 * Get available labels
 */
router.get('/labels', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const labels = await chatService.getLabels(userToken);
    
    res.json({ success: true, data: labels });
  } catch (error) {
    logger.error('Error fetching labels', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/labels
 * Assign label to conversation
 */
router.post('/conversations/:id/labels', requireAgentAuth(null), requirePermission('conversations:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { labelId } = req.body;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    await chatService.assignLabel(userToken, id, labelId);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error assigning label', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/chat/conversations/:id/labels/:labelId
 * Remove label from conversation
 */
router.delete('/conversations/:id/labels/:labelId', requireAgentAuth(null), requirePermission('conversations:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id, labelId } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    await chatService.removeLabel(userToken, id, parseInt(labelId, 10));
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing label', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Canned Responses ====================

/**
 * GET /api/agent/chat/canned-responses
 * Get canned responses
 */
router.get('/canned-responses', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { search } = req.query;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const responses = await chatService.getCannedResponses(userToken, search);
    
    res.json({ success: true, data: responses });
  } catch (error) {
    logger.error('Error fetching canned responses', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Media ====================

/**
 * GET /api/agent/chat/messages/:messageId/media
 * Download media for a message
 */
router.get('/messages/:messageId/media', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { messageId } = req.params;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const media = await chatService.downloadMedia(userToken, parseInt(messageId, 10));
    
    res.json({ success: true, data: media });
  } catch (error) {
    logger.error('Error downloading media', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Contact Info ====================

/**
 * GET /api/agent/chat/contacts/:contactJid/attributes
 * Get contact attributes
 */
router.get('/contacts/:contactJid/attributes', requireAgentAuth(null), requirePermission('contacts:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid } = req.params;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const attributes = await chatService.getContactAttributes(userToken, contactJid);
    
    res.json({ success: true, data: attributes });
  } catch (error) {
    logger.error('Error fetching contact attributes', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/chat/contacts/:contactJid/notes
 * Get contact notes
 */
router.get('/contacts/:contactJid/notes', requireAgentAuth(null), requirePermission('contacts:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid } = req.params;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const notes = await chatService.getContactNotes(userToken, contactJid);
    
    res.json({ success: true, data: notes });
  } catch (error) {
    logger.error('Error fetching contact notes', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/contacts/:contactJid/notes
 * Create contact note
 */
router.post('/contacts/:contactJid/notes', requireAgentAuth(null), requirePermission('contacts:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const agentId = req.agent.id;
    const { contactJid } = req.params;
    const { content } = req.body;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    const note = await chatService.createContactNote(userToken, contactJid, content, agentId);
    
    res.json({ success: true, data: note });
  } catch (error) {
    logger.error('Error creating contact note', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/chat/conversations/:id/info
 * Get conversation info/stats
 */
router.get('/conversations/:id/info', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    const info = await chatService.getConversationInfo(userToken, id);
    
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error('Error fetching conversation info', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Assignment Routes ====================

const ConversationAssignmentService = require('../services/ConversationAssignmentService');
let assignmentService = null;

function initAssignmentService(db) {
  if (!assignmentService) {
    assignmentService = new ConversationAssignmentService(db);
  }
}

/**
 * POST /api/agent/chat/conversations/:id/pickup
 * Agent picks up an unassigned conversation
 * Requirements: 2.3
 */
router.post('/conversations/:id/pickup', requireAgentAuth(null), requirePermission('conversations:assign'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    initAssignmentService(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation exists and agent has access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Check if already assigned
    if (conversation.assignedAgentId) {
      return res.status(409).json({ 
        success: false, 
        error: 'Conversa já atribuída a outro agente' 
      });
    }
    
    // Pickup conversation
    const success = await assignmentService.pickupConversation(id, agentId);
    
    if (!success) {
      return res.status(409).json({ 
        success: false, 
        error: 'Conversa já foi atribuída a outro agente' 
      });
    }
    
    logger.info('Agent picked up conversation', { agentId, conversationId: id });
    
    res.json({ success: true, data: { conversationId: id, agentId } });
  } catch (error) {
    logger.error('Error picking up conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/transfer
 * Transfer conversation to another agent
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
router.post('/conversations/:id/transfer', requireAgentAuth(null), requirePermission('conversations:assign'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    initAssignmentService(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { targetAgentId } = req.body;
    
    if (!targetAgentId) {
      return res.status(400).json({ success: false, error: 'ID do agente destino é obrigatório' });
    }
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation exists and agent has access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Verify target agent is member of the inbox
    const targetAgentInboxes = await inboxService.listAgentInboxes(targetAgentId);
    const targetInboxIds = targetAgentInboxes.map(i => i.id);
    
    if (!targetInboxIds.includes(conversation.inboxId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agente destino não é membro desta caixa de entrada' 
      });
    }
    
    // Check target agent availability (warn but allow)
    const db = req.app.locals.db;
    const targetAgentResult = await db.query(
      'SELECT availability FROM agents WHERE id = ?',
      [targetAgentId]
    );
    
    const targetAgent = targetAgentResult.rows[0];
    const isOffline = targetAgent?.availability !== 'online';
    
    // Transfer conversation
    await assignmentService.transferConversation(id, targetAgentId, agentId);
    
    logger.info('Agent transferred conversation', { 
      agentId, 
      targetAgentId, 
      conversationId: id 
    });
    
    res.json({ 
      success: true, 
      data: { 
        conversationId: id, 
        targetAgentId,
        warning: isOffline ? 'Agente destino está offline' : null
      } 
    });
  } catch (error) {
    logger.error('Error transferring conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/release
 * Release conversation back to pool
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
router.post('/conversations/:id/release', requireAgentAuth(null), requirePermission('conversations:assign'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    initAssignmentService(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation exists and agent has access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Release conversation (do NOT auto-assign)
    await assignmentService.releaseConversation(id, agentId);
    
    logger.info('Agent released conversation', { agentId, conversationId: id });
    
    res.json({ success: true, data: { conversationId: id } });
  } catch (error) {
    logger.error('Error releasing conversation', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/chat/conversations/:id/transferable-agents
 * Get list of agents available for transfer
 */
router.get('/conversations/:id/transferable-agents', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    initAssignmentService(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation exists and agent has access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Get transferable agents (exclude current agent)
    const agents = await assignmentService.getTransferableAgents(
      conversation.inboxId, 
      agentId
    );
    
    res.json({ success: true, data: agents });
  } catch (error) {
    logger.error('Error fetching transferable agents', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Bot Routes for Agents ====================

/**
 * GET /api/agent/chat/bots
 * Get available bots from the account owner
 * Agents can see bots to assign/remove from conversations
 */
router.get('/bots', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Get bots from the account owner
    const BotService = require('../services/BotService');
    const botService = new BotService(req.app.locals.db);
    const bots = await botService.getBots(userToken);
    
    // Filter to only return active bots and minimal info (no access tokens)
    const safeBots = bots
      .filter(bot => bot.status === 'active')
      .map(bot => ({
        id: bot.id,
        name: bot.name,
        description: bot.description,
        avatarUrl: bot.avatarUrl,
        status: bot.status
      }));
    
    res.json({ success: true, data: safeBots });
  } catch (error) {
    logger.error('Error fetching bots for agent', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/conversations/:id/assign-bot
 * Assign or remove a bot from a conversation
 * Agents can manage bot assignment for conversations they have access to
 */
router.post('/conversations/:id/assign-bot', requireAgentAuth(null), requirePermission('conversations:update'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { botId } = req.body; // null to remove bot
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation exists and agent has access
    const conversation = await chatService.getConversation(userToken, id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // If assigning a bot, verify it exists and is active
    if (botId !== null && botId !== undefined) {
      const BotService = require('../services/BotService');
      const botService = new BotService(req.app.locals.db);
      const bot = await botService.getBotById(botId, userToken);
      
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot não encontrado' });
      }
      if (bot.status !== 'active') {
        return res.status(400).json({ success: false, error: 'Bot não está ativo' });
      }
    }
    
    // Update conversation with bot assignment
    const updatedConversation = await chatService.updateConversation(
      userToken,
      id,
      { assignedBotId: botId }
    );
    
    logger.info('Agent assigned bot to conversation', {
      agentId,
      conversationId: id,
      botId: botId || 'removed',
      accountId
    });
    
    res.json({ success: true, data: updatedConversation });
  } catch (error) {
    logger.error('Error assigning bot to conversation', { 
      error: error.message, 
      agentId: req.agent?.id,
      conversationId: req.params.id 
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Macros Routes for Agents ====================

/**
 * GET /api/agent/chat/macros
 * Get all macros from the account owner
 */
router.get('/macros', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const db = req.app.locals.db;
    const accountId = req.account.id;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Get macros with their actions
    const macrosResult = await db.query(
      'SELECT id, name, description, created_at, updated_at FROM macros WHERE user_id = ? ORDER BY name ASC',
      [userToken]
    );
    
    const macros = [];
    for (const macro of (macrosResult.rows || [])) {
      const actionsResult = await db.query(
        'SELECT id, action_type, params, action_order FROM macro_actions WHERE macro_id = ? ORDER BY action_order ASC',
        [macro.id]
      );
      
      macros.push({
        ...macro,
        actions: (actionsResult.rows || []).map(a => ({
          ...a,
          params: typeof a.params === 'string' ? JSON.parse(a.params) : a.params
        }))
      });
    }
    
    res.json({ success: true, data: macros });
  } catch (error) {
    logger.error('Error fetching macros for agent', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/chat/macros/:id/execute
 * Execute a macro on a conversation
 */
router.post('/macros/:id/execute', requireAgentAuth(null), requirePermission('conversations:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { id } = req.params;
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId é obrigatório' });
    }
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Verify conversation access
    const conversation = await chatService.getConversation(userToken, parseInt(conversationId, 10));
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }
    if (conversation.inboxId && !agentInboxIds.includes(conversation.inboxId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado a esta conversa' });
    }
    
    // Get macro
    const macroResult = await db.query(
      'SELECT id, name FROM macros WHERE id = ? AND user_id = ?',
      [id, userToken]
    );
    
    if (!macroResult.rows || macroResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Macro não encontrada' });
    }
    
    const macro = macroResult.rows[0];
    
    // Get macro actions
    const actionsResult = await db.query(
      'SELECT action_type, params FROM macro_actions WHERE macro_id = ? ORDER BY action_order ASC',
      [id]
    );
    
    const results = [];
    
    for (const action of (actionsResult.rows || [])) {
      const params = typeof action.params === 'string' ? JSON.parse(action.params) : action.params;
      
      try {
        switch (action.action_type) {
          case 'assign_label':
            if (params.labelId) {
              await chatService.assignLabel(userToken, conversationId, params.labelId);
              results.push({ action: 'assign_label', success: true });
            }
            break;
          case 'remove_label':
            if (params.labelId) {
              await chatService.removeLabel(userToken, conversationId, params.labelId);
              results.push({ action: 'remove_label', success: true });
            }
            break;
          case 'change_status':
            if (params.status) {
              await chatService.updateConversation(userToken, conversationId, { status: params.status });
              results.push({ action: 'change_status', success: true });
            }
            break;
          case 'assign_bot':
            await chatService.updateConversation(userToken, conversationId, { assignedBotId: params.botId || null });
            results.push({ action: 'assign_bot', success: true });
            break;
          default:
            results.push({ action: action.action_type, success: false, error: 'Ação não suportada' });
        }
      } catch (actionError) {
        results.push({ action: action.action_type, success: false, error: actionError.message });
      }
    }
    
    logger.info('Agent executed macro', { agentId, macroId: id, conversationId, results });
    
    res.json({ success: true, data: { macro: macro.name, results } });
  } catch (error) {
    logger.error('Error executing macro for agent', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Previous Conversations Route ====================

/**
 * GET /api/agent/chat/contacts/:contactJid/conversations
 * Get previous conversations with a contact
 */
router.get('/contacts/:contactJid/conversations', requireAgentAuth(null), requirePermission('conversations:view'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { contactJid } = req.params;
    const { excludeId } = req.query;
    
    const agentInboxIds = await getAgentInboxIds(agentId);
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    // Build query to get previous conversations
    let sql = `
      SELECT 
        c.id, c.status, c.created_at, c.last_message_at,
        c.last_message_preview,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.user_id = ? AND c.contact_jid = ?
    `;
    const params = [userToken, decodeURIComponent(contactJid)];
    
    // Filter by agent's inboxes
    if (agentInboxIds.length > 0) {
      sql += ` AND c.inbox_id IN (${agentInboxIds.map(() => '?').join(',')})`;
      params.push(...agentInboxIds);
    }
    
    if (excludeId) {
      sql += ' AND c.id != ?';
      params.push(excludeId);
    }
    
    sql += ' ORDER BY c.created_at DESC LIMIT 10';
    
    const result = await db.query(sql, params);
    
    const conversations = (result.rows || []).map(conv => ({
      id: conv.id,
      status: conv.status,
      createdAt: conv.created_at,
      lastMessageAt: conv.last_message_at,
      lastMessagePreview: conv.last_message_preview,
      messageCount: conv.message_count || 0
    }));
    
    res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('Error fetching previous conversations for agent', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Contact Attributes CRUD Routes ====================

/**
 * POST /api/agent/chat/contacts/:contactJid/attributes
 * Create a contact attribute
 */
router.post('/contacts/:contactJid/attributes', requireAgentAuth(null), requirePermission('contacts:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid } = req.params;
    const { name, value } = req.body;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    if (!name || !value) {
      return res.status(400).json({ success: false, error: 'Nome e valor são obrigatórios' });
    }
    
    const attribute = await chatService.createContactAttribute(userToken, decodeURIComponent(contactJid), { name, value });
    
    res.json({ success: true, data: attribute });
  } catch (error) {
    logger.error('Error creating contact attribute', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agent/chat/contacts/:contactJid/attributes/:attributeId
 * Update a contact attribute
 */
router.put('/contacts/:contactJid/attributes/:attributeId', requireAgentAuth(null), requirePermission('contacts:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid, attributeId } = req.params;
    const { value } = req.body;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    if (!value) {
      return res.status(400).json({ success: false, error: 'Valor é obrigatório' });
    }
    
    const attribute = await chatService.updateContactAttribute(userToken, decodeURIComponent(contactJid), parseInt(attributeId, 10), value);
    
    res.json({ success: true, data: attribute });
  } catch (error) {
    logger.error('Error updating contact attribute', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/chat/contacts/:contactJid/attributes/:attributeId
 * Delete a contact attribute
 */
router.delete('/contacts/:contactJid/attributes/:attributeId', requireAgentAuth(null), requirePermission('contacts:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid, attributeId } = req.params;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    await chatService.deleteContactAttribute(userToken, decodeURIComponent(contactJid), parseInt(attributeId, 10));
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting contact attribute', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/chat/contacts/:contactJid/notes/:noteId
 * Delete a contact note
 */
router.delete('/contacts/:contactJid/notes/:noteId', requireAgentAuth(null), requirePermission('contacts:manage'), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const accountId = req.account.id;
    const { contactJid, noteId } = req.params;
    const userToken = getAccountUserTokenFromRequest(req);
    
    if (!userToken) {
      return res.status(500).json({ success: false, error: 'Configuração de conta inválida' });
    }
    
    await chatService.deleteContactNote(userToken, decodeURIComponent(contactJid), parseInt(noteId, 10));
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting contact note', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
