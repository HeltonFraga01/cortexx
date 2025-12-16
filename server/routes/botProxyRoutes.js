/**
 * Bot Proxy Routes
 * 
 * Provides endpoints for external bots/automations to send messages
 * through the system, ensuring messages are stored in the local history.
 * 
 * This solves the problem where messages sent directly via WUZAPI by
 * external automations don't appear in the system's chat history.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

const express = require('express');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { validatePhoneWithAPI } = require('../services/PhoneValidationService');
const ChatService = require('../services/ChatService');
const OutgoingWebhookService = require('../services/OutgoingWebhookService');
const { quotaMiddleware, incrementQuotaUsage } = require('../middleware/quotaEnforcement');

const router = express.Router();

/**
 * MIME type mapping for common media extensions
 */
const MIME_TYPES = {
  // Video
  'mp4': 'video/mp4',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mkv': 'video/x-matroska',
  // Image
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  // Audio
  'ogg': 'audio/ogg',
  'opus': 'audio/ogg',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'm4a': 'audio/mp4',
  // Document
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'txt': 'text/plain'
};

/**
 * Get MIME type from URL or filename
 * @param {string} url - URL or filename
 * @param {string} defaultType - Default MIME type if not detected
 * @returns {string} MIME type
 */
function getMimeTypeFromUrl(url, defaultType = 'application/octet-stream') {
  try {
    // Remove query string and get extension
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    return MIME_TYPES[ext] || defaultType;
  } catch {
    return defaultType;
  }
}

/**
 * Check if string is a URL (http/https)
 * @param {string} str - String to check
 * @returns {boolean} true if URL
 */
function isUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Check if string is already base64 data URL
 * @param {string} str - String to check
 * @returns {boolean} true if base64 data URL
 */
function isBase64DataUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:');
}

/**
 * Download media from URL and convert to base64 data URL
 * WUZAPI requires media in base64 embedded format (data:mime/type;base64,...)
 * 
 * @param {string} url - URL to download
 * @param {string} defaultMimeType - Default MIME type if not detected
 * @returns {Promise<string>} Base64 data URL
 */
async function downloadAndConvertToBase64(url, defaultMimeType = 'application/octet-stream') {
  try {
    logger.debug('Bot proxy: Downloading media from URL', { 
      url: url.substring(0, 100) + '...',
      defaultMimeType 
    });

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutes for large files
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WuzapiManager/1.0)'
      }
    });

    // Get MIME type from response headers or URL
    let mimeType = response.headers['content-type']?.split(';')[0]?.trim();
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = getMimeTypeFromUrl(url, defaultMimeType);
    }

    // Convert to base64
    const base64 = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    logger.debug('Bot proxy: Media converted to base64', { 
      mimeType,
      originalSize: response.data.length,
      base64Length: base64.length
    });

    return dataUrl;
  } catch (error) {
    logger.error('Bot proxy: Failed to download media from URL', {
      url: url.substring(0, 100) + '...',
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`Failed to download media: ${error.message}`);
  }
}

/**
 * Prepare media for WUZAPI - converts URL to base64 if needed
 * @param {string} media - URL or base64 data URL
 * @param {string} defaultMimeType - Default MIME type
 * @returns {Promise<string>} Base64 data URL ready for WUZAPI
 */
async function prepareMediaForWuzapi(media, defaultMimeType) {
  // Already in correct format
  if (isBase64DataUrl(media)) {
    return media;
  }

  // URL needs to be downloaded and converted
  if (isUrl(media)) {
    return await downloadAndConvertToBase64(media, defaultMimeType);
  }

  // Assume it's raw base64 without data URL prefix - add it
  return `data:${defaultMimeType};base64,${media}`;
}

/**
 * Middleware to verify user token (via header)
 * Supports: Authorization Bearer, token header
 */
const verifyUserToken = async (req, res, next) => {
  let userToken = null;
  
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  } else if (tokenHeader) {
    userToken = tokenHeader;
  }
  
  if (!userToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token não fornecido. Use header Authorization com Bearer token ou header token.'
    });
  }
  
  req.userToken = userToken;
  next();
};

/**
 * Check if identifier is a WhatsApp group JID
 * @param {string} identifier - Phone or JID
 * @returns {boolean} true if group
 */
function isGroupJid(identifier) {
  if (!identifier) return false;
  if (identifier.endsWith('@g.us')) return true;
  if (/^\d{10,15}-\d{10,13}$/.test(identifier)) return true;
  return false;
}

/**
 * POST /api/bot/send/text
 * 
 * Send a text message via bot proxy.
 * The message is forwarded to WUZAPI and stored locally with sender_type='bot'.
 * 
 * Headers:
 *   - token: User token for WUZAPI (required)
 *   - bot-id: Bot identifier for tracking (optional)
 * 
 * Body:
 *   - Phone: Recipient phone number or group JID (required)
 *   - Body: Message content (required)
 *   - skip_webhook: If true, don't dispatch outgoing webhooks (optional)
 *   - bot_name: Bot name for display (optional)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
router.post('/send/text', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Body, 
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    // Validate required parameters (Requirement 2.2)
    if (!Phone || !Body) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Body are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      // Validate phone number via WUZAPI (Requirement 2.2)
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        logger.warn('Bot proxy: Invalid phone number', {
          original: Phone,
          error: phoneValidation.error
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending message', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      skipWebhook: skip_webhook,
      isGroup
    });

    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
      Phone: validatedPhone,
      Body,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const wuzapiResult = response.data;
    
    // Extract message ID from WUZAPI response
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           wuzapiResult?.id ||
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Get database and services
    const db = req.app.locals.db;
    if (!db) {
      logger.error('Bot proxy: Database not available');
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    
    // Get or create conversation
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    // Store message locally with sender_type='bot' (Requirement 2.3)
    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: Body,
        type: 'text',
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    // Send outgoing webhook if not skipped (Requirement 2.4)
    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: {
              Id: wuzapiMessageId,
              Chat: contactJid,
              FromMe: true
            },
            Message: {
              conversation: Body
            }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        // Don't fail the request if webhook fails
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    logger.info('Bot proxy: Message sent and stored', {
      conversationId: conversation.id,
      messageId: wuzapiMessageId,
      localId: storedMessage?.id,
      botId
    });

    res.json({
      success: true,
      message: 'Mensagem enviada e registrada com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id,
        wuzapiResponse: wuzapiResult
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending message', {
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
      message: error.message
    });
  }
});

/**
 * POST /api/bot/send/image
 * 
 * Send an image message via bot proxy.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
router.post('/send/image', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Image,
      Caption = '',
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    if (!Phone || !Image) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Image are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending image', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      hasCaption: !!Caption,
      isUrl: isUrl(Image),
      isBase64: isBase64DataUrl(Image)
    });

    // WUZAPI requires image in base64 embedded format (data:image/jpeg;base64,...)
    // Convert URL to base64 if needed
    let imageData = Image;
    try {
      imageData = await prepareMediaForWuzapi(Image, 'image/jpeg');
    } catch (mediaError) {
      logger.error('Bot proxy: Failed to prepare image', {
        error: mediaError.message
      });
      return res.status(400).json({
        success: false,
        error: 'Media Processing Error',
        message: `Não foi possível processar a imagem: ${mediaError.message}`
      });
    }

    // Send via WUZAPI
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
      Phone: validatedPhone,
      Image: imageData,
      Caption,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const wuzapiResult = response.data;
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: Caption || '[Imagem]',
        type: 'image',
        mediaUrl: Image,
        mediaMimeType: 'image/jpeg',
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: { Id: wuzapiMessageId, Chat: contactJid, FromMe: true },
            Message: { imageMessage: { caption: Caption } }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Imagem enviada e registrada com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending image', {
      error: error.message,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/bot/send/audio
 * 
 * Send an audio message via bot proxy.
 */
router.post('/send/audio', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Audio,
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    if (!Phone || !Audio) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Audio are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending audio', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      isUrl: isUrl(Audio),
      isBase64: isBase64DataUrl(Audio)
    });

    // WUZAPI requires audio in base64 embedded format (data:audio/ogg;base64,...)
    // Convert URL to base64 if needed
    let audioData = Audio;
    try {
      audioData = await prepareMediaForWuzapi(Audio, 'audio/ogg');
    } catch (mediaError) {
      logger.error('Bot proxy: Failed to prepare audio', {
        error: mediaError.message
      });
      return res.status(400).json({
        success: false,
        error: 'Media Processing Error',
        message: `Não foi possível processar o áudio: ${mediaError.message}`
      });
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/audio`, {
      Phone: validatedPhone,
      Audio: audioData,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // Aumentado para upload de base64 grande
    });
    
    const wuzapiResult = response.data;
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: '[Áudio]',
        type: 'audio',
        mediaUrl: Audio,
        mediaMimeType: 'audio/ogg',
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: { Id: wuzapiMessageId, Chat: contactJid, FromMe: true },
            Message: { audioMessage: {} }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Áudio enviado e registrado com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending audio', {
      error: error.message,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/bot/send/document
 * 
 * Send a document message via bot proxy.
 */
router.post('/send/document', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Document,
      FileName = 'document',
      Caption = '',
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    if (!Phone || !Document) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Document are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending document', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      fileName: FileName,
      isUrl: isUrl(Document),
      isBase64: isBase64DataUrl(Document)
    });

    // WUZAPI requires document in base64 embedded format (data:application/octet-stream;base64,...)
    // Convert URL to base64 if needed
    let documentData = Document;
    try {
      // Try to detect MIME type from filename
      const defaultMime = getMimeTypeFromUrl(FileName || Document, 'application/octet-stream');
      documentData = await prepareMediaForWuzapi(Document, defaultMime);
    } catch (mediaError) {
      logger.error('Bot proxy: Failed to prepare document', {
        error: mediaError.message
      });
      return res.status(400).json({
        success: false,
        error: 'Media Processing Error',
        message: `Não foi possível processar o documento: ${mediaError.message}`
      });
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/document`, {
      Phone: validatedPhone,
      Document: documentData,
      FileName,
      Caption,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // Aumentado para upload de base64 grande
    });
    
    const wuzapiResult = response.data;
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: Caption || `[Documento: ${FileName}]`,
        type: 'document',
        mediaUrl: Document,
        mediaMimeType: 'application/octet-stream',
        mediaFileName: FileName,
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: { Id: wuzapiMessageId, Chat: contactJid, FromMe: true },
            Message: { documentMessage: { fileName: FileName, caption: Caption } }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Documento enviado e registrado com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending document', {
      error: error.message,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/bot/send/video
 * 
 * Send a video message via bot proxy.
 */
router.post('/send/video', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Video,
      Caption = '',
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    if (!Phone || !Video) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Video are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending video', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      hasCaption: !!Caption,
      isUrl: isUrl(Video),
      isBase64: isBase64DataUrl(Video)
    });

    // WUZAPI requires video in base64 embedded format (data:video/mp4;base64,...)
    // Convert URL to base64 if needed
    let videoData = Video;
    try {
      videoData = await prepareMediaForWuzapi(Video, 'video/mp4');
    } catch (mediaError) {
      logger.error('Bot proxy: Failed to prepare video', {
        error: mediaError.message
      });
      return res.status(400).json({
        success: false,
        error: 'Media Processing Error',
        message: `Não foi possível processar o vídeo: ${mediaError.message}`
      });
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/video`, {
      Phone: validatedPhone,
      Video: videoData,
      Caption,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // Vídeos podem demorar mais (2 min para upload de base64 grande)
    });
    
    const wuzapiResult = response.data;
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: Caption || '[Vídeo]',
        type: 'video',
        mediaUrl: Video,
        mediaMimeType: 'video/mp4',
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: { Id: wuzapiMessageId, Chat: contactJid, FromMe: true },
            Message: { videoMessage: { caption: Caption } }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Vídeo enviado e registrado com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending video', {
      error: error.message,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/bot/send/sticker
 * 
 * Send a sticker message via bot proxy.
 */
router.post('/send/sticker', verifyUserToken, quotaMiddleware.messages, quotaMiddleware.monthlyMessages, async (req, res) => {
  try {
    const userToken = req.userToken;
    const botId = req.headers['bot-id'] || null;
    const { 
      Phone, 
      Sticker,
      skip_webhook = false,
      bot_name = null,
      ...options 
    } = req.body;
    
    if (!Phone || !Sticker) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone and Sticker are required'
      });
    }

    const isGroup = isGroupJid(Phone);
    let validatedPhone;
    
    if (isGroup) {
      validatedPhone = Phone.endsWith('@g.us') ? Phone : `${Phone}@g.us`;
    } else {
      const phoneValidation = await validatePhoneWithAPI(Phone, userToken);
      
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error
        });
      }
      
      validatedPhone = phoneValidation.validatedPhone;
    }

    logger.info('Bot proxy: Sending sticker', {
      userToken: userToken.substring(0, 8) + '...',
      phone: Phone.substring(0, 8) + '...',
      botId,
      isUrl: isUrl(Sticker),
      isBase64: isBase64DataUrl(Sticker)
    });

    // WUZAPI requires sticker in base64 embedded format (data:image/webp;base64,...)
    // Convert URL to base64 if needed
    let stickerData = Sticker;
    try {
      stickerData = await prepareMediaForWuzapi(Sticker, 'image/webp');
    } catch (mediaError) {
      logger.error('Bot proxy: Failed to prepare sticker', {
        error: mediaError.message
      });
      return res.status(400).json({
        success: false,
        error: 'Media Processing Error',
        message: `Não foi possível processar o sticker: ${mediaError.message}`
      });
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    const response = await axios.post(`${wuzapiBaseUrl}/chat/send/sticker`, {
      Phone: validatedPhone,
      Sticker: stickerData,
      ...options
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // Aumentado para upload de base64 grande
    });
    
    const wuzapiResult = response.data;
    const wuzapiMessageId = wuzapiResult?.data?.Id || 
                           wuzapiResult?.Id || 
                           `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }

    const chatService = new ChatService(db);
    const contactJid = isGroup 
      ? validatedPhone 
      : `${validatedPhone}@s.whatsapp.net`;
    
    const conversation = await chatService.getOrCreateConversation(
      userToken, 
      contactJid,
      { name: bot_name || null }
    );

    const chatHandler = req.app.locals.chatHandler || null;
    
    const storedMessage = await chatService.storeBotMessage(
      conversation.id,
      {
        messageId: wuzapiMessageId,
        content: '[Sticker]',
        type: 'sticker',
        mediaUrl: Sticker,
        mediaMimeType: 'image/webp',
        botId: botId ? parseInt(botId, 10) : null,
        botName: bot_name
      },
      chatHandler
    );

    if (!skip_webhook) {
      try {
        const outgoingWebhookService = new OutgoingWebhookService(db);
        await outgoingWebhookService.sendWebhookEvent(userToken, 'message.sent', {
          type: 'Message',
          event: {
            Info: { Id: wuzapiMessageId, Chat: contactJid, FromMe: true },
            Message: { stickerMessage: {} }
          },
          userID: userToken,
          source: 'bot_proxy',
          botId
        });
      } catch (webhookError) {
        logger.error('Bot proxy: Failed to send outgoing webhook', {
          error: webhookError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Sticker enviado e registrado com sucesso',
      data: {
        messageId: wuzapiMessageId,
        localId: storedMessage?.id,
        conversationId: conversation.id
      }
    });

  } catch (error) {
    logger.error('Bot proxy: Error sending sticker', {
      error: error.message,
      userToken: req.userToken?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
