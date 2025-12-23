/**
 * BotService - Service for managing agent bots
 * 
 * Handles bot lifecycle, configuration, and message forwarding
 * 
 * Requirements: 17.1-17.6, 18.1-18.4, 19.1-19.3
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const crypto = require('crypto')
const axios = require('axios')
const { logger } = require('../utils/logger')
const { toBoolean } = require('../utils/responseTransformer')
const SupabaseService = require('./SupabaseService')
const QuotaService = require('./QuotaService')

class BotService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
    this.quotaService = new QuotaService()
  }

  /**
   * Check if user can create more bots based on quota
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { allowed: boolean, current: number, limit: number }
   */
  async checkBotQuota(userId) {
    const current = await this.countBots(userId);
    const limit = await this.getMaxBots(userId);
    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /**
   * Count bots for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of bots
   */
  async countBots(userId) {
    const { count, error } = await SupabaseService.count('agent_bots', { user_id: userId });
    if (error) {
      logger.error('Failed to count bots', { error: error.message, userId });
      return 0;
    }
    return count || 0;
  }

  /**
   * Get max_bots limit from user's plan
   * @param {string} userId - User ID
   * @returns {Promise<number>} Max bots allowed
   */
  async getMaxBots(userId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('user_subscriptions', (query) =>
        query.select('plans!inner(max_bots)')
          .eq('user_id', userId)
          .in('status', ['trial', 'active'])
          .limit(1)
      );
      
      if (error || !data || data.length === 0) {
        return 3; // Default to 3 if no subscription
      }
      
      return data[0]?.plans?.max_bots || 3;
    } catch (error) {
      logger.error('Failed to get max bots quota', { error: error.message, userId });
      return 3; // Default fallback
    }
  }

  // ==================== Bot Usage Quota Methods ====================

  /**
   * Check if bot can process a message based on call quotas
   * Checks daily limit first, then monthly
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { allowed, quotaType, usage, limit, remaining, resetsAt }
   * 
   * Requirements: 1.4, 1.5
   */
  async checkBotCallQuota(userId) {
    try {
      // Check daily limit first
      const dailyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY
      );
      
      if (!dailyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY,
          usage: dailyCheck.usage,
          limit: dailyCheck.limit,
          remaining: dailyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      // Check monthly limit
      const monthlyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH
      );
      
      if (!monthlyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH,
          usage: monthlyCheck.usage,
          limit: monthlyCheck.limit,
          remaining: monthlyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      return {
        allowed: true,
        quotaType: null,
        usage: dailyCheck.usage,
        limit: dailyCheck.limit,
        remaining: dailyCheck.remaining
      };
    } catch (error) {
      logger.error('Failed to check bot call quota', { error: error.message, userId });
      // Allow on error to prevent blocking
      return { allowed: true, quotaType: null, usage: 0, limit: 0, remaining: 0 };
    }
  }

  /**
   * Check if bot can send a message based on message quotas
   * Checks daily limit first, then monthly
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { allowed, quotaType, usage, limit, remaining, resetsAt }
   * 
   * Requirements: 2.4, 2.5
   */
  async checkBotMessageQuota(userId) {
    try {
      // Check daily limit first
      const dailyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY
      );
      
      if (!dailyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY,
          usage: dailyCheck.usage,
          limit: dailyCheck.limit,
          remaining: dailyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      // Check monthly limit
      const monthlyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH
      );
      
      if (!monthlyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH,
          usage: monthlyCheck.usage,
          limit: monthlyCheck.limit,
          remaining: monthlyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      return {
        allowed: true,
        quotaType: null,
        usage: dailyCheck.usage,
        limit: dailyCheck.limit,
        remaining: dailyCheck.remaining
      };
    } catch (error) {
      logger.error('Failed to check bot message quota', { error: error.message, userId });
      // Allow on error to prevent blocking
      return { allowed: true, quotaType: null, usage: 0, limit: 0, remaining: 0 };
    }
  }

  /**
   * Check if bot can use tokens based on token quotas
   * Checks daily limit first, then monthly
   * @param {string} userId - User ID
   * @param {number} [tokensNeeded=0] - Estimated tokens needed for pre-check
   * @returns {Promise<Object>} { allowed, quotaType, usage, limit, remaining, resetsAt }
   * 
   * Requirements: 3.4, 3.5
   */
  async checkBotTokenQuota(userId, tokensNeeded = 0) {
    try {
      // Check daily limit first
      const dailyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY,
        tokensNeeded
      );
      
      if (!dailyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY,
          usage: dailyCheck.usage,
          limit: dailyCheck.limit,
          remaining: dailyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      // Check monthly limit
      const monthlyCheck = await this.quotaService.checkQuota(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH,
        tokensNeeded
      );
      
      if (!monthlyCheck.allowed) {
        const resetsAt = this.quotaService.getPeriodEnd(
          QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH, 
          new Date()
        );
        return {
          allowed: false,
          quotaType: QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH,
          usage: monthlyCheck.usage,
          limit: monthlyCheck.limit,
          remaining: monthlyCheck.remaining,
          resetsAt: resetsAt.toISOString()
        };
      }

      return {
        allowed: true,
        quotaType: null,
        usage: dailyCheck.usage,
        limit: dailyCheck.limit,
        remaining: dailyCheck.remaining
      };
    } catch (error) {
      logger.error('Failed to check bot token quota', { error: error.message, userId });
      // Allow on error to prevent blocking
      return { allowed: true, quotaType: null, usage: 0, limit: 0, remaining: 0 };
    }
  }

  /**
   * Track token usage from bot webhook response
   * Increments both daily and monthly token counters
   * @param {string} userId - User ID
   * @param {number} tokensUsed - Tokens consumed
   * @returns {Promise<void>}
   * 
   * Requirements: 3.3, 3.6
   */
  async trackBotTokenUsage(userId, tokensUsed) {
    if (!tokensUsed || tokensUsed <= 0) {
      return;
    }

    try {
      // Increment daily counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY, 
        tokensUsed
      );

      // Increment monthly counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH, 
        tokensUsed
      );

      logger.debug('Bot token usage tracked', { userId, tokensUsed });
    } catch (error) {
      logger.error('Failed to track bot token usage', { error: error.message, userId, tokensUsed });
    }
  }

  /**
   * Increment bot call usage counters (daily and monthly)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   * 
   * Requirements: 1.3
   */
  async incrementBotCallUsage(userId) {
    try {
      // Increment daily counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY
      );

      // Increment monthly counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH
      );

      logger.debug('Bot call usage incremented', { userId });
    } catch (error) {
      logger.error('Failed to increment bot call usage', { error: error.message, userId });
    }
  }

  /**
   * Increment bot message usage counters (daily and monthly)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   * 
   * Requirements: 2.6
   */
  async incrementBotMessageUsage(userId) {
    try {
      // Increment daily counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY
      );

      // Increment monthly counter
      await this.quotaService.incrementUsage(
        userId, 
        QuotaService.QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH
      );

      logger.debug('Bot message usage incremented', { userId });
    } catch (error) {
      logger.error('Failed to increment bot message usage', { error: error.message, userId });
    }
  }

  /**
   * Create a new bot
   * @param {number} userId - User ID
   * @param {Object} data - Bot configuration
   * @returns {Promise<Object>} Created bot
   * 
   * Requirements: 17.2, 17.3
   */
  async createBot(userId, data) {
    // Check quota before creating bot
    const quotaCheck = await this.checkBotQuota(userId);
    if (!quotaCheck.allowed) {
      const error = new Error(`QUOTA_EXCEEDED: Cannot create bot. Current: ${quotaCheck.current}, Limit: ${quotaCheck.limit}. Please upgrade your plan to add more bots.`);
      error.code = 'QUOTA_EXCEEDED';
      error.details = { current: quotaCheck.current, limit: quotaCheck.limit };
      throw error;
    }

    const { name, description = '', avatarUrl = null, outgoingUrl, includeHistory = false } = data

    if (!name) {
      throw new Error('Bot name is required')
    }

    if (!outgoingUrl) {
      throw new Error('Outgoing webhook URL is required')
    }

    // Validate URL format
    try {
      new URL(outgoingUrl)
    } catch {
      throw new Error('Invalid outgoing webhook URL format')
    }

    // Generate unique access token
    const accessToken = this.generateAccessToken()

    // Get the next priority (max + 1) for this user
    const { data: priorityData, error: priorityError } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('priority').eq('user_id', userId).order('priority', { ascending: false }).limit(1)
    );
    const nextPriority = (priorityData && priorityData.length > 0) ? (priorityData[0].priority || 0) + 1 : 1;

    // Check if this is the first bot (should be default)
    const botCount = await this.countBots(userId);
    const isFirstBot = botCount === 0;
    const isDefault = isFirstBot;
    const priority = isFirstBot ? 1 : nextPriority;

    const { data: newBot, error: insertError } = await SupabaseService.insert('agent_bots', {
      user_id: userId,
      name,
      description,
      avatar_url: avatarUrl,
      outgoing_url: outgoingUrl,
      access_token: accessToken,
      status: 'active',
      priority,
      is_default: isDefault,
      include_history: includeHistory
    });

    if (insertError) {
      logger.error('Failed to create bot', { error: insertError.message, userId });
      throw insertError;
    }

    logger.info('Bot created', { botId: newBot.id, userId, name });

    return this.transformBot(newBot);
  }

  /**
   * Update a bot
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated bot
   * 
   * Requirements: 17.2
   */
  async updateBot(botId, userId, data) {
    const { name, description, avatarUrl, outgoingUrl, includeHistory } = data

    // Verify ownership
    const existingBot = await this.getBotById(botId, userId)
    if (!existingBot) {
      throw new Error('Bot not found or unauthorized')
    }

    // Validate URL if provided
    if (outgoingUrl) {
      try {
        new URL(outgoingUrl)
      } catch {
        throw new Error('Invalid outgoing webhook URL format')
      }
    }

    const updates = {}

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (outgoingUrl !== undefined) updates.outgoing_url = outgoingUrl;
    if (includeHistory !== undefined) updates.include_history = includeHistory;

    if (Object.keys(updates).length === 0) {
      return existingBot
    }

    const { data: updatedBot, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update(updates).eq('id', botId).eq('user_id', userId).select().single()
    );

    if (error) {
      logger.error('Failed to update bot', { error: error.message, botId, userId });
      throw error;
    }

    logger.info('Bot updated', { botId, userId })

    return this.transformBot(updatedBot);
  }

  /**
   * Pause a bot
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated bot
   * 
   * Requirements: 18.1
   */
  async pauseBot(botId, userId) {
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    const { data: updatedBot, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ status: 'paused' }).eq('id', botId).eq('user_id', userId).select().single()
    );

    if (error) {
      logger.error('Failed to pause bot', { error: error.message, botId, userId });
      throw error;
    }

    logger.info('Bot paused', { botId, userId })

    return this.transformBot(updatedBot);
  }

  /**
   * Resume a bot
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated bot
   * 
   * Requirements: 18.3
   */
  async resumeBot(botId, userId) {
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    const { data: updatedBot, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ status: 'active' }).eq('id', botId).eq('user_id', userId).select().single()
    );

    if (error) {
      logger.error('Failed to resume bot', { error: error.message, botId, userId });
      throw error;
    }

    logger.info('Bot resumed', { botId, userId })

    return this.transformBot(updatedBot);
  }

  /**
   * Delete a bot
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * 
   * Requirements: 17.6, 3.4
   */
  async deleteBot(botId, userId) {
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    const wasDefault = bot.isDefault

    // Remove bot from all conversations first
    await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.update({ assigned_bot_id: null }).eq('assigned_bot_id', botId)
    );

    // Delete the bot
    const { error: deleteError } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.delete().eq('id', botId).eq('user_id', userId)
    );

    if (deleteError) {
      logger.error('Failed to delete bot', { error: deleteError.message, botId, userId });
      throw deleteError;
    }

    // If deleted bot was default, promote next bot in priority order
    if (wasDefault) {
      const { data: nextBots } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
        query.select('id').eq('user_id', userId).order('priority', { ascending: true }).order('created_at', { ascending: false }).limit(1)
      );
      
      if (nextBots && nextBots.length > 0) {
        await SupabaseService.queryAsAdmin('agent_bots', (query) =>
          query.update({ is_default: true, priority: 1 }).eq('id', nextBots[0].id)
        );
        logger.info('Next bot promoted to default', { newDefaultBotId: nextBots[0].id, userId })
      }
    }

    logger.info('Bot deleted', { botId, userId, wasDefault })
  }

  /**
   * Forward a message to a bot's webhook
   * @param {number} botId - Bot ID
   * @param {Object} message - Message to forward
   * @param {Object} conversation - Conversation context
   * @param {Object} options - Additional options (rawEvent, userToken)
   * @returns {Promise<Object>} Bot response
   * 
   * Requirements: 17.4, 17.5
   */
  async forwardToBot(botId, message, conversation, options = {}) {
    const { data: bots, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('*').eq('id', botId)
    );

    if (error || !bots || bots.length === 0) {
      throw new Error('Bot not found')
    }

    const bot = bots[0]

    // Check if bot is active (Property 13: Bot status enforcement)
    if (bot.status !== 'active') {
      logger.debug('Bot is not active, skipping forward', { botId, status: bot.status })
      return { action: 'ignore', reason: 'bot_paused' }
    }

    // Get conversation labels
    let labels = []
    try {
      const { data: labelsData } = await SupabaseService.queryAsAdmin('labels', (query) =>
        query.select('id, name, color')
          .in('id', SupabaseService.adminClient.from('conversation_labels').select('label_id').eq('conversation_id', conversation.id))
      );
      // Fallback: get labels via join
      const { data: labelJoinData } = await SupabaseService.queryAsAdmin('conversation_labels', (query) =>
        query.select('labels(id, name, color)').eq('conversation_id', conversation.id)
      );
      labels = labelJoinData?.map(l => l.labels).filter(Boolean) || [];
    } catch (e) {
      // Labels table might not exist
    }

    // Get recent message history (last 10 messages) only if enabled
    let recentMessages = []
    if (bot.include_history) {
      try {
        const { data: historyData } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
          query.select('id, message_id, direction, message_type, content, media_url, media_mime_type, media_filename, status, created_at')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(10)
        );
        recentMessages = (historyData || []).reverse() // Oldest first
      } catch (e) {
        // Ignore history errors
      }
    }

    // Extract phone number from JID
    const phone = conversation.contact_jid?.replace('@s.whatsapp.net', '').replace('@g.us', '') || ''
    const isGroup = conversation.contact_jid?.includes('@g.us') || false

    // Prepare comprehensive webhook payload
    const payload = {
      event: 'message.received',
      timestamp: new Date().toISOString(),
      
      // Bot information
      bot: {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        accessToken: bot.access_token
      },
      
      // Contact information
      contact: {
        jid: conversation.contact_jid,
        phone: phone,
        name: conversation.contact_name || phone,
        avatarUrl: conversation.contact_avatar_url,
        isGroup: isGroup
      },
      
      // Conversation context
      conversation: {
        id: conversation.id,
        status: conversation.status,
        unreadCount: conversation.unread_count || 0,
        labels: labels,
        createdAt: conversation.created_at,
        lastMessageAt: conversation.last_message_at
      },
      
      // Current message
      message: {
        id: message.id,
        messageId: message.message_id,
        direction: message.direction || 'incoming',
        type: message.message_type,
        content: message.content,
        media: message.media_url ? {
          url: message.media_url,
          mimeType: message.media_mime_type,
          filename: message.media_filename
        } : null,
        replyTo: message.reply_to_message_id || null,
        status: message.status,
        timestamp: message.created_at || message.timestamp
      },
      
      // Message history for context (only if enabled in bot settings)
      ...(bot.include_history && recentMessages.length > 0 ? {
        history: recentMessages.map(m => ({
          id: m.id,
          messageId: m.message_id,
          direction: m.direction,
          type: m.message_type,
          content: m.content,
          mediaUrl: m.media_url,
          status: m.status,
          timestamp: m.created_at
        }))
      } : {}),
      
      // Raw WUZAPI event (if available)
      rawEvent: options.rawEvent || null,
      
      // User token for API calls
      userToken: options.userToken || null
    }

    try {
      const response = await axios.post(bot.outgoing_url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Token': bot.access_token,
          'X-Bot-Id': bot.id.toString(),
          'X-Conversation-Id': conversation.id.toString(),
          'X-Contact-Phone': phone
        },
        timeout: 10000
      })

      const botResponse = response.data

      logger.info('Message forwarded to bot', { 
        botId, 
        messageId: message.id,
        responseAction: botResponse?.action 
      })

      // Handle bot response
      return this.handleBotResponse(botResponse, conversation)
    } catch (error) {
      logger.error('Failed to forward message to bot', { 
        botId, 
        error: error.message 
      })

      // Return ignore action on error
      return { action: 'ignore', reason: 'webhook_error', error: error.message }
    }
  }

  /**
   * Handle bot response
   * @param {Object} response - Bot response
   * @param {Object} conversation - Conversation context
   * @returns {Object} Processed response
   */
  handleBotResponse(response, conversation) {
    if (!response || !response.action) {
      return { action: 'ignore' }
    }

    switch (response.action) {
      case 'reply':
        return {
          action: 'reply',
          content: response.content,
          messageType: response.messageType || 'text'
        }

      case 'handoff':
        return {
          action: 'handoff',
          reason: response.reason || 'Bot requested handoff'
        }

      case 'ignore':
      default:
        return { action: 'ignore' }
    }
  }

  /**
   * Assign a bot to a conversation
   * @param {number} conversationId - Conversation ID
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated conversation
   * 
   * Requirements: 19.1, 19.2
   */
  async assignBotToConversation(conversationId, botId, userId) {
    // Verify bot belongs to user (Property 14: Bot assignment scope)
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    // Verify conversation belongs to user
    const { data: convData, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.select('*').eq('id', conversationId).eq('user_id', userId).single()
    );
    
    if (convError || !convData) {
      throw new Error('Conversation not found or unauthorized')
    }

    // Assign bot
    const { data: updatedConv, error: updateError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.update({ assigned_bot_id: botId }).eq('id', conversationId).select().single()
    );

    if (updateError) {
      logger.error('Failed to assign bot to conversation', { error: updateError.message, conversationId, botId });
      throw updateError;
    }

    logger.info('Bot assigned to conversation', { conversationId, botId, userId })

    return updatedConv;
  }

  /**
   * Remove bot from a conversation
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated conversation
   * 
   * Requirements: 19.3
   */
  async removeBotFromConversation(conversationId, userId) {
    // Verify conversation belongs to user
    const { data: convData, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.select('*').eq('id', conversationId).eq('user_id', userId).single()
    );
    
    if (convError || !convData) {
      throw new Error('Conversation not found or unauthorized')
    }

    const { data: updatedConv, error: updateError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.update({ assigned_bot_id: null }).eq('id', conversationId).select().single()
    );

    if (updateError) {
      logger.error('Failed to remove bot from conversation', { error: updateError.message, conversationId });
      throw updateError;
    }

    logger.info('Bot removed from conversation', { conversationId, userId })

    return updatedConv;
  }

  // ==================== Helper Methods ====================

  /**
   * Transform bot row from snake_case to camelCase
   * @param {Object} row - Database row
   * @returns {Object} Transformed bot object
   */
  transformBot(row) {
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      avatarUrl: row.avatar_url,
      outgoingUrl: row.outgoing_url,
      accessToken: row.access_token,
      status: row.status,
      priority: row.priority ?? 999,
      isDefault: toBoolean(row.is_default),
      includeHistory: toBoolean(row.include_history),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      assignedConversations: row.assigned_conversations
    }
  }

  /**
   * Get the highest priority active bot for a user
   * Used for auto-assignment to new conversations
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Bot or null if no active bots
   * 
   * Requirements: 1.1, 1.3
   */
  async getHighestPriorityActiveBot(userId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
    );
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return this.transformBot(data[0]);
  }

  /**
   * Set a bot as the default bot for a user
   * @param {number} botId - Bot ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated bot
   * 
   * Requirements: 3.1, 3.2
   */
  async setDefaultBot(botId, userId) {
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    // Remove default status from all user's bots
    await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ is_default: false }).eq('user_id', userId)
    );

    // Set this bot as default with priority 1
    await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ is_default: true, priority: 1 }).eq('id', botId).eq('user_id', userId)
    );

    // Reorder other bots' priorities (shift by 1)
    const { data: otherBots } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('id, priority').eq('user_id', userId).neq('id', botId).gte('priority', 1)
    );
    
    if (otherBots && otherBots.length > 0) {
      for (const otherBot of otherBots) {
        await SupabaseService.queryAsAdmin('agent_bots', (query) =>
          query.update({ priority: (otherBot.priority || 0) + 1 }).eq('id', otherBot.id)
        );
      }
    }

    logger.info('Bot set as default', { botId, userId })

    return this.getBotById(botId, userId)
  }

  /**
   * Update priorities for multiple bots
   * @param {string} userId - User ID
   * @param {Array<{id: number, priority: number}>} priorities - Array of bot priorities
   * @returns {Promise<void>}
   * 
   * Requirements: 4.1, 4.2, 4.3
   */
  async updatePriorities(userId, priorities) {
    if (!Array.isArray(priorities) || priorities.length === 0) {
      throw new Error('Priorities array is required')
    }

    // Verify all bots belong to user
    const botIds = priorities.map(p => p.id)
    const { data: userBots, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('id').eq('user_id', userId).in('id', botIds)
    );

    if (error || !userBots || userBots.length !== botIds.length) {
      throw new Error('One or more bots not found or unauthorized')
    }

    // Update priorities
    for (const { id, priority } of priorities) {
      await SupabaseService.queryAsAdmin('agent_bots', (query) =>
        query.update({ priority }).eq('id', id).eq('user_id', userId)
      );
    }

    // Set is_default for priority 1 bot, remove from others
    await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ is_default: false }).eq('user_id', userId)
    );
    await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ is_default: true }).eq('user_id', userId).eq('priority', 1)
    );

    logger.info('Bot priorities updated', { userId, count: priorities.length })
  }

  /**
   * Get bot by ID
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Bot or null
   */
  async getBotById(botId, userId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('*').eq('id', botId).eq('user_id', userId).single()
    );
    
    if (error || !data) {
      return null;
    }
    
    return this.transformBot(data);
  }

  /**
   * Get all bots for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Bots ordered by priority
   */
  async getBots(userId) {
    // Get bots with conversation count
    const { data: bots, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.select('*').eq('user_id', userId).order('priority', { ascending: true }).order('created_at', { ascending: false })
    );
    
    if (error || !bots) {
      logger.error('Failed to get bots', { error: error?.message, userId });
      return [];
    }
    
    // Get conversation counts for each bot
    const botsWithCounts = await Promise.all(bots.map(async (bot) => {
      const { count } = await SupabaseService.count('conversations', { assigned_bot_id: bot.id });
      return { ...bot, assigned_conversations: count || 0 };
    }));
    
    return botsWithCounts.map(row => this.transformBot(row));
  }

  /**
   * Generate unique access token
   * @returns {string} Access token
   */
  generateAccessToken() {
    return `bot_${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * Regenerate access token for a bot
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated bot with new token
   */
  async regenerateAccessToken(botId, userId) {
    const bot = await this.getBotById(botId, userId)
    if (!bot) {
      throw new Error('Bot not found or unauthorized')
    }

    const newToken = this.generateAccessToken()

    const { data: updatedBot, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
      query.update({ access_token: newToken }).eq('id', botId).eq('user_id', userId).select().single()
    );

    if (error) {
      logger.error('Failed to regenerate bot access token', { error: error.message, botId, userId });
      throw error;
    }

    logger.info('Bot access token regenerated', { botId, userId })

    return this.transformBot(updatedBot);
  }
}

module.exports = BotService
