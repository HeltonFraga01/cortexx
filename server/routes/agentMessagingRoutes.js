/**
 * Agent Messaging Routes
 * 
 * Routes for agents to send messages using the owner's quota/balance.
 * Messages are sent via the inbox's WUZAPI token but quota is consumed
 * from the account owner.
 * 
 * Requirements: Agent messaging with owner quota consumption
 */

const router = require('express').Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const { requireAgentAuth, requirePermission } = require('../middleware/agentAuth');
const InboxService = require('../services/InboxService');
const QuotaService = require('../services/QuotaService');
const SupabaseService = require('../services/SupabaseService');
const { validatePhoneWithAPI } = require('../services/PhoneValidationService');

// Template processor for message variations
const templateProcessor = require('../services/TemplateProcessor');

// Services initialized without db parameter (use SupabaseService internally)
const inboxService = new InboxService();
const quotaService = new QuotaService();

/**
 * Helper to get agent's inbox IDs
 */
async function getAgentInboxIds(agentId) {
  const inboxes = await inboxService.listAgentInboxes(agentId);
  return inboxes.map(inbox => inbox.id);
}

/**
 * Helper to get account owner's user ID for quota consumption
 */
async function getAccountOwnerId(accountId) {
  const { data, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
    query.select('owner_user_id').eq('id', accountId).single()
  );
  if (error || !data) {
    logger.warn('Failed to get account owner ID', { accountId, error: error?.message });
    return null;
  }
  return data.owner_user_id || null;
}

/**
 * Helper to get inbox details including WUZAPI token
 */
async function getInboxDetails(inboxId) {
  const { data, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
    query.select('id, name, wuzapi_token, phone_number, wuzapi_connected').eq('id', inboxId).single()
  );
  if (error || !data) {
    logger.warn('Failed to get inbox details', { inboxId, error: error?.message });
    return null;
  }
  return data;
}

/**
 * Check if it's a group JID
 */
function isGroupJid(identifier) {
  if (!identifier) return false;
  if (identifier.endsWith('@g.us')) return true;
  if (/^\d{10,15}-\d{10,13}$/.test(identifier)) return true;
  return false;
}

// ==================== Inbox Routes ====================

/**
 * GET /api/agent/messaging/inboxes
 * List agent's available inboxes for messaging
 */
router.get('/inboxes', requireAgentAuth(null), async (req, res) => {
  try {
    const agentId = req.agent.id;
    
    const inboxes = await inboxService.listAgentInboxes(agentId);
    
    // Format for frontend
    const formattedInboxes = inboxes.map(inbox => ({
      id: inbox.id,
      name: inbox.name,
      phoneNumber: inbox.phoneNumber,
      connected: inbox.wuzapiConnected,
      wuzapiToken: inbox.wuzapiToken
    }));
    
    res.json({ success: true, data: formattedInboxes });
  } catch (error) {
    logger.error('Failed to list agent inboxes for messaging', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Message Sending Routes ====================

/**
 * POST /api/agent/messaging/send/text
 * Send a text message using owner's quota
 */
router.post('/send/text', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { Phone, Body, inboxId, variables = {} } = req.body;
    
    // Validate required fields
    if (!Phone || !Body) {
      return res.status(400).json({
        success: false,
        error: 'Phone and Body are required'
      });
    }
    
    if (!inboxId) {
      return res.status(400).json({
        success: false,
        error: 'inboxId is required'
      });
    }
    
    // Verify agent has access to this inbox
    const agentInboxIds = await getAgentInboxIds(agentId);
    if (!agentInboxIds.includes(inboxId)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta caixa de entrada'
      });
    }
    
    // Get inbox details
    const inbox = await getInboxDetails(inboxId);
    if (!inbox || !inbox.wuzapi_token) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada não configurada para envio'
      });
    }
    
    if (!inbox.wuzapi_connected) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada não está conectada'
      });
    }
    
    // Get owner's user ID for quota consumption
    const ownerId = await getAccountOwnerId(accountId);
    if (!ownerId) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de conta inválida'
      });
    }
    
    // Check owner's quota
    const dailyQuotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 1);
    if (!dailyQuotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        details: {
          quotaType: 'max_messages_per_day',
          limit: dailyQuotaCheck.limit,
          currentUsage: dailyQuotaCheck.usage,
          remaining: dailyQuotaCheck.remaining
        },
        message: 'O limite diário de mensagens foi atingido. Entre em contato com o administrador.'
      });
    }
    
    const monthlyQuotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_month', 1);
    if (!monthlyQuotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        details: {
          quotaType: 'max_messages_per_month',
          limit: monthlyQuotaCheck.limit,
          currentUsage: monthlyQuotaCheck.usage,
          remaining: monthlyQuotaCheck.remaining
        },
        message: 'O limite mensal de mensagens foi atingido. Entre em contato com o administrador.'
      });
    }
    
    // Validate phone number
    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, inbox.wuzapi_token);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone inválido',
          message: phoneValidation.error
        });
      }
      validatedPhone = phoneValidation.validatedPhone;
    }
    
    // Generate dynamic variables
    const now = new Date();
    const hour = now.getHours();
    let saudacao = 'Olá';
    if (hour >= 6 && hour < 12) {
      saudacao = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      saudacao = 'Boa tarde';
    } else {
      saudacao = 'Boa noite';
    }
    
    const dynamicVars = {
      data: now.toLocaleDateString('pt-BR'),
      saudacao: saudacao,
      empresa: inbox.name || 'Empresa',
      telefone: Phone
    };
    
    // Merge user variables with dynamic variables
    const allVariables = {
      ...variables,
      ...dynamicVars
    };
    
    // Process template with variations and variables
    const processed = templateProcessor.process(Body, allVariables);
    if (!processed.success) {
      return res.status(400).json({
        success: false,
        error: 'Template inválido',
        errors: processed.errors
      });
    }
    
    const finalMessage = processed.finalMessage;
    
    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
      Phone: validatedPhone,
      Body: finalMessage
    }, {
      headers: {
        'token': inbox.wuzapi_token,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    // Increment owner's quota usage
    await quotaService.incrementUsage(ownerId, 'max_messages_per_day', 1);
    await quotaService.incrementUsage(ownerId, 'max_messages_per_month', 1);
    
    logger.info('Agent sent text message', {
      agentId,
      accountId,
      ownerId,
      inboxId,
      phone: Phone.substring(0, 8) + '...',
      messageLength: finalMessage.length
    });
    
    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: response.data
    });
    
  } catch (error) {
    logger.error('Failed to send agent text message', {
      error: error.message,
      agentId: req.agent?.id,
      accountId: req.account?.id
    });
    
    if (error.response?.status === 401) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    if (error.response?.status === 400) {
      return res.status(400).json({ success: false, error: error.response?.data?.message || 'Requisição inválida' });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/messaging/send/image
 * Send an image message using owner's quota
 */
router.post('/send/image', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { Phone, Image, Caption, inboxId } = req.body;
    
    if (!Phone || !Image || !inboxId) {
      return res.status(400).json({
        success: false,
        error: 'Phone, Image and inboxId are required'
      });
    }
    
    // Verify agent has access to this inbox
    const agentInboxIds = await getAgentInboxIds(agentId);
    if (!agentInboxIds.includes(inboxId)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta caixa de entrada'
      });
    }
    
    // Get inbox details
    const inbox = await getInboxDetails(inboxId);
    if (!inbox || !inbox.wuzapi_token || !inbox.wuzapi_connected) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada não configurada ou não conectada'
      });
    }
    
    // Get owner's user ID for quota consumption
    const ownerId = await getAccountOwnerId(accountId);
    if (!ownerId) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de conta inválida'
      });
    }
    
    // Check owner's quota
    const dailyQuotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 1);
    if (!dailyQuotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        message: 'O limite diário de mensagens foi atingido.'
      });
    }
    
    // Validate phone
    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, inbox.wuzapi_token);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone inválido',
          message: phoneValidation.error
        });
      }
      validatedPhone = phoneValidation.validatedPhone;
    }
    
    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
      Phone: validatedPhone,
      Image,
      Caption: Caption || ''
    }, {
      headers: {
        'token': inbox.wuzapi_token,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Increment owner's quota
    await quotaService.incrementUsage(ownerId, 'max_messages_per_day', 1);
    await quotaService.incrementUsage(ownerId, 'max_messages_per_month', 1);
    
    logger.info('Agent sent image message', {
      agentId,
      accountId,
      ownerId,
      inboxId,
      phone: Phone.substring(0, 8) + '...'
    });
    
    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      data: response.data
    });
    
  } catch (error) {
    logger.error('Failed to send agent image message', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/messaging/send/document
 * Send a document message using owner's quota
 */
router.post('/send/document', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { Phone, Document, FileName, Caption, inboxId } = req.body;
    
    if (!Phone || !Document || !inboxId) {
      return res.status(400).json({
        success: false,
        error: 'Phone, Document and inboxId are required'
      });
    }
    
    // Verify agent has access to this inbox
    const agentInboxIds = await getAgentInboxIds(agentId);
    if (!agentInboxIds.includes(inboxId)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta caixa de entrada'
      });
    }
    
    // Get inbox details
    const inbox = await getInboxDetails(inboxId);
    if (!inbox || !inbox.wuzapi_token || !inbox.wuzapi_connected) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada não configurada ou não conectada'
      });
    }
    
    // Get owner's user ID for quota consumption
    const ownerId = await getAccountOwnerId(accountId);
    if (!ownerId) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de conta inválida'
      });
    }
    
    // Check owner's quota
    const dailyQuotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 1);
    if (!dailyQuotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        message: 'O limite diário de mensagens foi atingido.'
      });
    }
    
    // Validate phone
    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, inbox.wuzapi_token);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone inválido',
          message: phoneValidation.error
        });
      }
      validatedPhone = phoneValidation.validatedPhone;
    }
    
    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/document`, {
      Phone: validatedPhone,
      Document,
      FileName: FileName || 'document',
      Caption: Caption || ''
    }, {
      headers: {
        'token': inbox.wuzapi_token,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Increment owner's quota
    await quotaService.incrementUsage(ownerId, 'max_messages_per_day', 1);
    await quotaService.incrementUsage(ownerId, 'max_messages_per_month', 1);
    
    logger.info('Agent sent document message', {
      agentId,
      accountId,
      ownerId,
      inboxId,
      phone: Phone.substring(0, 8) + '...'
    });
    
    res.json({
      success: true,
      message: 'Documento enviado com sucesso',
      data: response.data
    });
    
  } catch (error) {
    logger.error('Failed to send agent document message', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/messaging/send/audio
 * Send an audio message using owner's quota
 */
router.post('/send/audio', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { Phone, Audio, inboxId } = req.body;
    
    if (!Phone || !Audio || !inboxId) {
      return res.status(400).json({
        success: false,
        error: 'Phone, Audio and inboxId are required'
      });
    }
    
    // Verify agent has access to this inbox
    const agentInboxIds = await getAgentInboxIds(agentId);
    if (!agentInboxIds.includes(inboxId)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta caixa de entrada'
      });
    }
    
    // Get inbox details
    const inbox = await getInboxDetails(inboxId);
    if (!inbox || !inbox.wuzapi_token || !inbox.wuzapi_connected) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada não configurada ou não conectada'
      });
    }
    
    // Get owner's user ID for quota consumption
    const ownerId = await getAccountOwnerId(accountId);
    if (!ownerId) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de conta inválida'
      });
    }
    
    // Check owner's quota
    const dailyQuotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 1);
    if (!dailyQuotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        message: 'O limite diário de mensagens foi atingido.'
      });
    }
    
    // Validate phone
    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, inbox.wuzapi_token);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone inválido',
          message: phoneValidation.error
        });
      }
      validatedPhone = phoneValidation.validatedPhone;
    }
    
    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/audio`, {
      Phone: validatedPhone,
      Audio
    }, {
      headers: {
        'token': inbox.wuzapi_token,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Increment owner's quota
    await quotaService.incrementUsage(ownerId, 'max_messages_per_day', 1);
    await quotaService.incrementUsage(ownerId, 'max_messages_per_month', 1);
    
    logger.info('Agent sent audio message', {
      agentId,
      accountId,
      ownerId,
      inboxId,
      phone: Phone.substring(0, 8) + '...'
    });
    
    res.json({
      success: true,
      message: 'Áudio enviado com sucesso',
      data: response.data
    });
    
  } catch (error) {
    logger.error('Failed to send agent audio message', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Quota Info Routes ====================

/**
 * GET /api/agent/messaging/quota
 * Get owner's quota info for the agent to display
 */
router.get('/quota', requireAgentAuth(null), async (req, res) => {
  try {
    const accountId = req.account.id;
    
    // Get owner's user ID
    const ownerId = await getAccountOwnerId(accountId);
    if (!ownerId) {
      return res.status(500).json({
        success: false,
        error: 'Configuração de conta inválida'
      });
    }
    
    // Get quota info
    const dailyQuota = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 0);
    const monthlyQuota = await quotaService.checkQuota(ownerId, 'max_messages_per_month', 0);
    
    res.json({
      success: true,
      data: {
        daily: {
          limit: dailyQuota.limit,
          used: dailyQuota.usage,
          remaining: dailyQuota.remaining
        },
        monthly: {
          limit: monthlyQuota.limit,
          used: monthlyQuota.usage,
          remaining: monthlyQuota.remaining
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get agent quota info', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Template Routes ====================

const AgentTemplateService = require('../services/AgentTemplateService');
const AgentCampaignService = require('../services/AgentCampaignService');
const AgentCampaignScheduler = require('../services/AgentCampaignScheduler');

// Services initialized without db parameter (use SupabaseService internally)
const templateService = new AgentTemplateService();
const campaignService = new AgentCampaignService();
const campaignScheduler = new AgentCampaignScheduler();

/**
 * GET /api/agent/messaging/templates
 * List agent's templates
 * Requirements: 8.1
 */
router.get('/templates', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const templates = await templateService.listTemplates(req.agent.id, req.account.id);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to list agent templates', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/messaging/templates
 * Create a new template
 * Requirements: 8.2
 */
router.post('/templates', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { name, content, config } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content are required' });
    }
    
    const template = await templateService.createTemplate(req.agent.id, req.account.id, {
      name,
      content,
      config
    });
    
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to create agent template', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/templates/:id
 * Get a single template
 * Requirements: 8.1
 */
router.get('/templates/:id', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const template = await templateService.getTemplate(req.agent.id, req.params.id);
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to get agent template', {
      error: error.message,
      agentId: req.agent?.id,
      templateId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agent/messaging/templates/:id
 * Update a template
 * Requirements: 8.3
 */
router.put('/templates/:id', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { name, content, config } = req.body;
    
    const template = await templateService.updateTemplate(req.agent.id, req.params.id, {
      name,
      content,
      config
    });
    
    res.json({ success: true, data: template });
  } catch (error) {
    if (error.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error('Failed to update agent template', {
      error: error.message,
      agentId: req.agent?.id,
      templateId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/messaging/templates/:id
 * Delete a template
 * Requirements: 8.4
 */
router.delete('/templates/:id', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    await templateService.deleteTemplate(req.agent.id, req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    if (error.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error('Failed to delete agent template', {
      error: error.message,
      agentId: req.agent?.id,
      templateId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Campaign Routes ====================

/**
 * POST /api/agent/messaging/campaigns
 * Create a new campaign
 * Requirements: 2.1, 2.3, 2.4, 2.5, 9.1
 */
router.post('/campaigns', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { name, inboxId, messages, contacts, humanization, schedule } = req.body;
    
    if (!name || !inboxId || !contacts || contacts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, inboxId, and contacts are required' 
      });
    }
    
    // Verify agent has access to inbox
    const agentInboxIds = await getAgentInboxIds(req.agent.id);
    if (!agentInboxIds.includes(inboxId)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this inbox' 
      });
    }
    
    // Check owner quota
    const ownerId = await getAccountOwnerId(req.account.id);
    if (!ownerId) {
      return res.status(500).json({ success: false, error: 'Invalid account configuration' });
    }
    
    const quotaCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', contacts.length);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        message: `Insufficient quota. Need ${contacts.length}, have ${quotaCheck.remaining}`
      });
    }
    
    const campaign = await campaignService.createCampaign(req.agent.id, req.account.id, {
      name,
      inboxId,
      messages,
      contacts,
      humanization,
      schedule
    });
    
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Failed to create agent campaign', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/campaigns
 * List agent's campaigns
 * Requirements: 6.1
 */
router.get('/campaigns', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { status, startDate, endDate, limit } = req.query;
    
    const campaigns = await campaignService.listCampaigns(req.agent.id, req.account.id, {
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined
    });
    
    res.json({ success: true, data: campaigns });
  } catch (error) {
    logger.error('Failed to list agent campaigns', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/campaigns/:id
 * Get campaign details
 * Requirements: 6.2
 */
router.get('/campaigns/:id', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.agent.id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    // Include contacts
    const contacts = await campaignService.getCampaignContacts(req.params.id);
    
    res.json({ 
      success: true, 
      data: { ...campaign, contacts } 
    });
  } catch (error) {
    logger.error('Failed to get agent campaign', {
      error: error.message,
      agentId: req.agent?.id,
      campaignId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agent/messaging/campaigns/:id/start
 * Start a campaign
 */
router.post('/campaigns/:id/start', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.agent.id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    // Get inbox details
    const inbox = await getInboxDetails(campaign.inboxId);
    if (!inbox || !inbox.wuzapi_token) {
      return res.status(400).json({ success: false, error: 'Inbox not configured' });
    }
    
    // Get owner ID
    const ownerId = await getAccountOwnerId(req.account.id);
    
    // Start campaign execution in background
    campaignScheduler.executeCampaign(req.agent.id, req.params.id, ownerId, inbox)
      .catch(err => logger.error('Campaign execution error', { error: err.message }));
    
    res.json({ success: true, message: 'Campaign started' });
  } catch (error) {
    logger.error('Failed to start agent campaign', {
      error: error.message,
      agentId: req.agent?.id,
      campaignId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agent/messaging/campaigns/:id/pause
 * Pause a running campaign
 * Requirements: 6.3
 */
router.put('/campaigns/:id/pause', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    campaignScheduler.stopCampaign(req.params.id);
    const campaign = await campaignService.pauseCampaign(req.agent.id, req.params.id);
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Only running')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Failed to pause agent campaign', {
      error: error.message,
      agentId: req.agent?.id,
      campaignId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agent/messaging/campaigns/:id/resume
 * Resume a paused campaign
 * Requirements: 6.4
 */
router.put('/campaigns/:id/resume', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const campaign = await campaignService.resumeCampaign(req.agent.id, req.params.id);
    
    // Get inbox and owner for execution
    const inbox = await getInboxDetails(campaign.inboxId);
    const ownerId = await getAccountOwnerId(req.account.id);
    
    // Resume execution in background
    campaignScheduler.executeCampaign(req.agent.id, req.params.id, ownerId, inbox)
      .catch(err => logger.error('Campaign resume error', { error: err.message }));
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Only paused')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Failed to resume agent campaign', {
      error: error.message,
      agentId: req.agent?.id,
      campaignId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agent/messaging/campaigns/:id/cancel
 * Cancel a campaign
 * Requirements: 6.5
 */
router.put('/campaigns/:id/cancel', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    campaignScheduler.stopCampaign(req.params.id);
    const campaign = await campaignService.cancelCampaign(req.agent.id, req.params.id);
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('already')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Failed to cancel agent campaign', {
      error: error.message,
      agentId: req.agent?.id,
      campaignId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Report Routes ====================

/**
 * GET /api/agent/messaging/reports
 * List completed campaigns as reports
 * Requirements: 7.1, 7.3
 */
router.get('/reports', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const campaigns = await campaignService.listCampaigns(req.agent.id, req.account.id, {
      status: 'completed',
      startDate,
      endDate
    });
    
    // Add summary statistics
    const reports = campaigns.map(campaign => ({
      ...campaign,
      deliveryRate: campaign.totalContacts > 0 
        ? Math.round((campaign.sentCount / campaign.totalContacts) * 100) 
        : 0
    }));
    
    res.json({ success: true, data: reports });
  } catch (error) {
    logger.error('Failed to list agent reports', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/reports/:id
 * Get report details
 * Requirements: 7.2
 */
router.get('/reports/:id', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.agent.id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    
    const contacts = await campaignService.getCampaignContacts(req.params.id);
    
    const report = {
      ...campaign,
      deliveryRate: campaign.totalContacts > 0 
        ? Math.round((campaign.sentCount / campaign.totalContacts) * 100) 
        : 0,
      contacts
    };
    
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to get agent report', {
      error: error.message,
      agentId: req.agent?.id,
      reportId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/reports/:id/export
 * Export report as CSV
 * Requirements: 7.4
 */
router.get('/reports/:id/export', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.agent.id, req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    
    const contacts = await campaignService.getCampaignContacts(req.params.id);
    
    // Generate CSV
    const headers = ['Phone', 'Name', 'Status', 'Sent At', 'Error'];
    const rows = contacts.map(c => [
      c.phone,
      c.name || '',
      c.status,
      c.sentAt || '',
      c.errorMessage || ''
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report-${campaign.id}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Failed to export agent report', {
      error: error.message,
      agentId: req.agent?.id,
      reportId: req.params.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Draft Routes ====================

/**
 * POST /api/agent/messaging/drafts
 * Save a draft
 * Requirements: 12.1
 */
router.post('/drafts', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { data } = req.body;
    const now = new Date().toISOString();
    
    // Check if draft exists
    const { data: existing, error: findError } = await SupabaseService.queryAsAdmin('agent_drafts', (query) =>
      query.select('id').eq('agent_id', req.agent.id).eq('account_id', req.account.id)
    );
    
    if (!findError && existing && existing.length > 0) {
      await SupabaseService.update('agent_drafts', existing[0].id, {
        data: JSON.stringify(data),
        updated_at: now
      });
    } else {
      const { v4: uuidv4 } = require('uuid');
      await SupabaseService.insert('agent_drafts', {
        id: uuidv4(),
        agent_id: req.agent.id,
        account_id: req.account.id,
        data: JSON.stringify(data),
        created_at: now,
        updated_at: now
      });
    }
    
    res.json({ success: true, message: 'Draft saved' });
  } catch (error) {
    logger.error('Failed to save agent draft', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/messaging/drafts
 * Get draft
 * Requirements: 12.2, 12.3
 */
router.get('/drafts', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    const { data: rows, error } = await SupabaseService.queryAsAdmin('agent_drafts', (query) =>
      query.select('data, updated_at').eq('agent_id', req.agent.id).eq('account_id', req.account.id)
    );
    
    if (error || !rows || rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    
    let data = null;
    try {
      data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    } catch (e) {
      data = null;
    }
    
    res.json({ 
      success: true, 
      data: {
        data,
        updatedAt: rows[0].updated_at
      }
    });
  } catch (error) {
    logger.error('Failed to get agent draft', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/messaging/drafts
 * Clear draft
 * Requirements: 12.4
 */
router.delete('/drafts', requireAgentAuth(null), requirePermission('messages:send'), async (req, res) => {
  try {
    await SupabaseService.queryAsAdmin('agent_drafts', (query) =>
      query.delete().eq('agent_id', req.agent.id).eq('account_id', req.account.id)
    );
    
    res.json({ success: true, message: 'Draft cleared' });
  } catch (error) {
    logger.error('Failed to clear agent draft', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
