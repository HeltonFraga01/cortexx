/**
 * User Bot Test Routes
 * 
 * Handles bot testing functionality for users.
 * Allows testing bot webhooks with simulated conversations.
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 3.1, 6.4
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const TestConversationService = require('../services/TestConversationService');
const BotService = require('../services/BotService');
const QuotaService = require('../services/QuotaService');
const AutomationService = require('../services/AutomationService');
const SupabaseService = require('../services/SupabaseService');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const { resolveUserId } = require('../middleware/quotaEnforcement');

// Initialize services at module level (they use SupabaseService internally)
const testConversationService = new TestConversationService();
const botService = new BotService();
const quotaService = new QuotaService();
const automationService = new AutomationService();

// Webhook timeout in milliseconds
const WEBHOOK_TIMEOUT = 30000;

/**
 * Middleware para verificar token do usuário usando InboxContext
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
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
        return next();
      }
      
      if (req.user?.id) {
        req.userId = req.user.id;
        return next();
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for bot test', { error: error.message });
    }
  }
  
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    req.userToken = tokenHeader;
    return next();
  }
  
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: { code: 'NO_TOKEN', message: 'Token não fornecido.' }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

/**
 * Helper to get consistent userId for bot operations
 */
function getBotUserId(req) {
  const resolvedId = resolveUserId(req);
  return resolvedId || req.userToken || req.userId;
}

/**
 * POST /api/user/bots/:botId/test/start
 * Start a test chat session with a bot
 * 
 * Requirements: 1.2, 1.3, 3.1
 */
router.post('/:botId/test/start', verifyUserToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const userId = getBotUserId(req);

    // Get bot info (user's own bot or admin-assigned)
    let bot = await botService.getBotById(parseInt(botId, 10), userId);
    
    // If not found as user's bot, check if it's an admin-assigned bot template
    if (!bot) {
      // Get user's inboxes using SupabaseService
      const { data: inboxes, error: inboxError } = await SupabaseService.adminClient
        .from('inboxes')
        .select('id')
        .eq('accounts.owner_user_id', userId);
      
      if (!inboxError && inboxes && inboxes.length > 0) {
        const inboxIds = inboxes.map(i => i.id);
        const assignedBots = await automationService.getBotTemplatesForInboxes(inboxIds);
        bot = assignedBots.find(b => b.id === parseInt(botId, 10));
        
        if (bot) {
          // Transform bot template to match expected structure
          bot = {
            id: bot.id,
            name: bot.name,
            description: bot.description,
            outgoingUrl: bot.outgoingUrl,
            includeHistory: bot.includeHistory || false,
            isAdminAssigned: true
          };
        }
      }
    }

    if (!bot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bot not found or not accessible' 
      });
    }

    // Check bot call quota
    const quotaUsage = await quotaService.getBotQuotaUsage(userId);
    if (quotaUsage.botCallsDaily >= quotaUsage.maxBotCallsPerDay) {
      return res.status(429).json({
        success: false,
        error: 'Quota de chamadas de bot excedida',
        code: 'BOT_CALL_QUOTA_EXCEEDED',
        quotaUsage: {
          calls: {
            daily: quotaUsage.botCallsDaily,
            dailyLimit: quotaUsage.maxBotCallsPerDay
          }
        }
      });
    }

    // Create test conversation
    const conversation = await testConversationService.createTestConversation(
      userId,
      bot.id,
      bot.name
    );

    logger.info('Bot test session started', {
      userId,
      botId: bot.id,
      conversationId: conversation.id
    });

    res.status(201).json({
      success: true,
      data: {
        conversationId: conversation.id,
        botId: bot.id,
        botName: bot.name,
        simulatedJid: conversation.contactJid,
        includeHistory: bot.includeHistory || false,
        quotaUsage: {
          calls: {
            daily: quotaUsage.botCallsDaily,
            dailyLimit: quotaUsage.maxBotCallsPerDay
          },
          messages: {
            daily: quotaUsage.botMessagesDaily,
            dailyLimit: quotaUsage.maxBotMessagesPerDay
          },
          tokens: {
            daily: quotaUsage.botTokensDaily,
            dailyLimit: quotaUsage.maxBotTokensPerDay
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error starting bot test session', {
      error: error.message,
      botId: req.params.botId,
      userId: getBotUserId(req)
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/bots/:botId/test/message
 * Send a test message to the bot
 * 
 * Requirements: 2.1, 2.2, 3.1, 6.1, 6.2
 */
router.post('/:botId/test/message', verifyUserToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const { conversationId, message } = req.body;
    const userId = getBotUserId(req);

    if (!conversationId || !message) {
      return res.status(400).json({
        success: false,
        error: 'conversationId and message are required'
      });
    }

    // Verify test conversation belongs to user
    const conversation = await testConversationService.getTestConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Test conversation not found'
      });
    }

    // Get bot info
    let bot = await botService.getBotById(parseInt(botId, 10), userId);
    
    if (!bot) {
      // Check admin-assigned bots using SupabaseService
      const { data: inboxes, error: inboxError } = await SupabaseService.adminClient
        .from('inboxes')
        .select('id')
        .eq('accounts.owner_user_id', userId);
      
      if (!inboxError && inboxes && inboxes.length > 0) {
        const inboxIds = inboxes.map(i => i.id);
        const assignedBots = await automationService.getBotTemplatesForInboxes(inboxIds);
        const foundBot = assignedBots.find(b => b.id === parseInt(botId, 10));
        
        if (foundBot) {
          bot = {
            id: foundBot.id,
            name: foundBot.name,
            outgoingUrl: foundBot.outgoingUrl,
            includeHistory: foundBot.includeHistory || false
          };
        }
      }
    }

    if (!bot || !bot.outgoingUrl) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found or webhook URL not configured'
      });
    }

    // Check bot call quota
    const quotaUsage = await quotaService.getBotQuotaUsage(userId);
    if (quotaUsage.botCallsDaily >= quotaUsage.maxBotCallsPerDay) {
      return res.status(429).json({
        success: false,
        error: 'Quota de chamadas de bot excedida',
        code: 'BOT_CALL_QUOTA_EXCEEDED'
      });
    }

    // Save user message
    const userMessage = await testConversationService.addTestMessage(
      conversationId,
      message,
      'user'
    );

    // Get conversation labels (if any) using SupabaseService
    let labels = [];
    try {
      const { data: labelsData } = await SupabaseService.adminClient
        .from('labels')
        .select('id, name, color, conversation_labels!inner(conversation_id)')
        .eq('conversation_labels.conversation_id', conversationId);
      labels = labelsData || [];
    } catch (e) {
      // Labels table might not exist
    }

    // Get recent message history (last 10 messages) only if enabled
    let recentMessages = [];
    if (bot.includeHistory) {
      const history = await testConversationService.getTestMessages(conversationId, 10);
      // Exclude the message we just added
      recentMessages = history.filter(m => m.id !== userMessage.id).map(m => ({
        id: m.id,
        direction: m.fromMe ? 'outgoing' : 'incoming',
        type: 'text',
        content: m.text,
        timestamp: new Date(m.timestamp).toISOString()
      }));
    }

    // Extract phone number from JID
    const phone = conversation.contact_jid?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
    const isGroup = conversation.contact_jid?.includes('@g.us') || false;

    // Get bot access token if available
    let botAccessToken = bot.accessToken || bot.access_token || null;
    
    // Build comprehensive webhook payload (EXACTLY same structure as real messages from BotService.forwardToBot)
    const payload = {
      event: 'message.received',
      timestamp: new Date().toISOString(),
      
      // Bot information (same as real)
      bot: {
        id: bot.id,
        name: bot.name,
        description: bot.description || null,
        accessToken: botAccessToken
      },
      
      // Contact information (simulated but same structure)
      contact: {
        jid: conversation.contact_jid,
        phone: phone,
        name: conversation.contact_name || 'Test User',
        avatarUrl: null,
        isGroup: isGroup
      },
      
      // Conversation context (same structure as real)
      conversation: {
        id: conversationId,
        status: conversation.status || 'open',
        unreadCount: 0,
        labels: labels,
        createdAt: conversation.created_at,
        lastMessageAt: new Date().toISOString()
      },
      
      // Current message (same structure as real)
      message: {
        id: userMessage.id,
        messageId: userMessage.id,
        direction: 'incoming',
        type: 'text',
        content: message,
        media: null,
        replyTo: null,
        status: 'received',
        timestamp: new Date(userMessage.timestamp).toISOString()
      },
      
      // Message history (if enabled) - same structure as real
      ...(bot.includeHistory && recentMessages.length > 0 ? {
        history: recentMessages.map(m => ({
          id: m.id,
          messageId: m.id,
          direction: m.direction || (m.fromMe ? 'outgoing' : 'incoming'),
          type: 'text',
          content: m.content || m.text,
          mediaUrl: null,
          status: 'delivered',
          timestamp: m.timestamp
        }))
      } : {}),
      
      // Raw WUZAPI event (null for test, same as real when not available)
      rawEvent: null,
      
      // User token for API calls (same as real)
      userToken: userId,
      
      // Test indicator (optional field for bot developers)
      isTest: true
    };

    // Increment bot call usage (method is in BotService, not QuotaService)
    await botService.incrementBotCallUsage(userId);

    // Forward to bot webhook with SAME headers as real messages
    let botResponse = null;
    let webhookError = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

      const response = await fetch(bot.outgoingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Token': botAccessToken || '',
          'X-Bot-Id': bot.id.toString(),
          'X-Conversation-Id': conversationId.toString(),
          'X-Contact-Phone': phone,
          'X-Test-Message': 'true'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const responseText = await response.text();
        try {
          botResponse = JSON.parse(responseText);
        } catch (parseError) {
          // If response is not JSON, treat as text reply
          if (responseText && responseText.trim()) {
            botResponse = { reply: responseText.trim() };
          }
        }
      } else {
        const errorText = await response.text().catch(() => '');
        webhookError = `Webhook returned status ${response.status}${errorText ? `: ${errorText}` : ''}`;
      }
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        webhookError = 'Webhook timeout (30s)';
      } else {
        webhookError = fetchError.message;
      }
    }

    // Process bot response - handle multiple response formats
    let botReply = null;
    if (botResponse) {
      // Extract reply text from various response formats
      // Support: { reply: "text" }, { message: "text" }, { text: "text" }, 
      // { action: "reply", content: "text" }, { response: "text" }
      let replyText = null;
      
      if (typeof botResponse === 'string') {
        replyText = botResponse;
      } else if (botResponse.reply) {
        replyText = botResponse.reply;
      } else if (botResponse.message) {
        replyText = typeof botResponse.message === 'string' 
          ? botResponse.message 
          : botResponse.message.content || botResponse.message.text;
      } else if (botResponse.text) {
        replyText = botResponse.text;
      } else if (botResponse.content) {
        replyText = botResponse.content;
      } else if (botResponse.response) {
        replyText = botResponse.response;
      } else if (botResponse.action === 'reply' && botResponse.data) {
        replyText = botResponse.data.text || botResponse.data.content || botResponse.data.message;
      }

      // Check bot message quota before processing reply
      if (replyText) {
        if (quotaUsage.botMessagesDaily >= quotaUsage.maxBotMessagesPerDay) {
          return res.json({
            success: true,
            data: {
              userMessage,
              botReply: null,
              quotaExceeded: 'messages',
              error: 'Quota de mensagens de bot excedida'
            }
          });
        }

        botReply = await testConversationService.addTestMessage(
          conversationId,
          replyText,
          'bot'
        );

        // Increment bot message usage (method is in BotService, not QuotaService)
        await botService.incrementBotMessageUsage(userId);
      }

      // Track token usage if reported (support multiple field names)
      const tokensUsed = botResponse.tokensUsed || botResponse.tokens_used || 
                         botResponse.tokenUsage || botResponse.usage?.total_tokens;
      if (tokensUsed && typeof tokensUsed === 'number') {
        await botService.trackBotTokenUsage(userId, tokensUsed);
      }
    }

    // Get updated quota
    const updatedQuota = await quotaService.getBotQuotaUsage(userId);

    logger.info('Bot test message processed', {
      userId,
      botId,
      conversationId,
      hasReply: !!botReply,
      webhookError
    });

    res.json({
      success: true,
      data: {
        userMessage,
        botReply,
        webhookError,
        quotaUsage: {
          calls: {
            daily: updatedQuota.botCallsDaily,
            dailyLimit: updatedQuota.maxBotCallsPerDay
          },
          messages: {
            daily: updatedQuota.botMessagesDaily,
            dailyLimit: updatedQuota.maxBotMessagesPerDay
          },
          tokens: {
            daily: updatedQuota.botTokensDaily,
            dailyLimit: updatedQuota.maxBotTokensPerDay
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error processing bot test message', {
      error: error.message,
      botId: req.params.botId,
      userId: getBotUserId(req)
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/bots/:botId/test/end
 * End a test chat session
 * 
 * Requirements: 1.5
 */
router.post('/:botId/test/end', verifyUserToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = getBotUserId(req);

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    // Verify ownership
    const conversation = await testConversationService.getTestConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Test conversation not found'
      });
    }

    // Archive the conversation
    await testConversationService.archiveTestConversation(conversationId);

    logger.info('Bot test session ended', {
      userId,
      conversationId
    });

    res.json({
      success: true,
      message: 'Test session ended'
    });
  } catch (error) {
    logger.error('Error ending bot test session', {
      error: error.message,
      userId: getBotUserId(req)
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/bots/:botId/test/history
 * Clear test conversation history
 * 
 * Requirements: 6.4
 */
router.delete('/:botId/test/history', verifyUserToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = getBotUserId(req);

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    // Verify ownership
    const conversation = await testConversationService.getTestConversation(
      conversationId,
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Test conversation not found'
      });
    }

    // Clear history
    await testConversationService.clearTestHistory(conversationId);

    logger.info('Bot test history cleared', {
      userId,
      conversationId
    });

    res.json({
      success: true,
      message: 'Test history cleared'
    });
  } catch (error) {
    logger.error('Error clearing bot test history', {
      error: error.message,
      userId: getBotUserId(req)
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/bots/:botId/test/messages
 * Get messages from a test conversation
 */
router.get('/:botId/test/messages', verifyUserToken, async (req, res) => {
  try {
    const { conversationId } = req.query;
    const userId = getBotUserId(req);

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId query parameter is required'
      });
    }

    // Verify ownership
    const conversation = await testConversationService.getTestConversation(
      parseInt(conversationId, 10),
      userId
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Test conversation not found'
      });
    }

    const messages = await testConversationService.getTestMessages(
      parseInt(conversationId, 10),
      50
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    logger.error('Error getting bot test messages', {
      error: error.message,
      userId: getBotUserId(req)
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
