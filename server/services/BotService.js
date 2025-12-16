/**
 * BotService - Service for managing agent bots
 * 
 * Handles bot lifecycle, configuration, and message forwarding
 * 
 * Requirements: 17.1-17.6, 18.1-18.4, 19.1-19.3
 */

const crypto = require('crypto')
const axios = require('axios')
const { logger } = require('../utils/logger')
const { toBoolean } = require('../utils/responseTransformer')
const QuotaService = require('./QuotaService')

class BotService {
  constructor(db) {
    this.db = db
    this.quotaService = new QuotaService(db)
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
    const { rows } = await this.db.query(
      'SELECT COUNT(*) as count FROM agent_bots WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.count || 0;
  }

  /**
   * Get max_bots limit from user's plan
   * @param {string} userId - User ID
   * @returns {Promise<number>} Max bots allowed
   */
  async getMaxBots(userId) {
    try {
      const { rows } = await this.db.query(
        `SELECT p.max_bots FROM user_subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ? AND s.status IN ('trial', 'active')
         LIMIT 1`,
        [userId]
      );
      return rows[0]?.max_bots || 3; // Default to 3 if no subscription
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
    const { rows: priorityRows } = await this.db.query(
      'SELECT COALESCE(MAX(priority), 0) + 1 as next_priority FROM agent_bots WHERE user_id = ?',
      [userId]
    )
    const nextPriority = priorityRows[0]?.next_priority || 1

    // Check if this is the first bot (should be default)
    const { rows: countRows } = await this.db.query(
      'SELECT COUNT(*) as count FROM agent_bots WHERE user_id = ?',
      [userId]
    )
    const isFirstBot = countRows[0]?.count === 0
    const isDefault = isFirstBot ? 1 : 0
    const priority = isFirstBot ? 1 : nextPriority

    const sql = `
      INSERT INTO agent_bots (
        user_id, name, description, avatar_url, outgoing_url, 
        access_token, status, priority, is_default, include_history, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, datetime('now'), datetime('now'))
    `

    const { lastID } = await this.db.query(sql, [
      userId,
      name,
      description,
      avatarUrl,
      outgoingUrl,
      accessToken,
      priority,
      isDefault,
      includeHistory ? 1 : 0
    ])

    const bot = await this.getBotById(lastID, userId)

    logger.info('Bot created', { botId: lastID, userId, name })

    return bot
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

    const updates = []
    const params = []

    if (name !== undefined) {
      updates.push('name = ?')
      params.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?')
      params.push(avatarUrl)
    }
    if (outgoingUrl !== undefined) {
      updates.push('outgoing_url = ?')
      params.push(outgoingUrl)
    }
    if (includeHistory !== undefined) {
      updates.push('include_history = ?')
      params.push(includeHistory ? 1 : 0)
    }

    if (updates.length === 0) {
      return existingBot
    }

    updates.push("updated_at = datetime('now')")
    params.push(botId, userId)

    const sql = `
      UPDATE agent_bots SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `

    await this.db.query(sql, params)

    const bot = await this.getBotById(botId, userId)

    logger.info('Bot updated', { botId, userId })

    return bot
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

    const sql = `
      UPDATE agent_bots 
      SET status = 'paused', updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `

    await this.db.query(sql, [botId, userId])

    logger.info('Bot paused', { botId, userId })

    return this.getBotById(botId, userId)
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

    const sql = `
      UPDATE agent_bots 
      SET status = 'active', updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `

    await this.db.query(sql, [botId, userId])

    logger.info('Bot resumed', { botId, userId })

    return this.getBotById(botId, userId)
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
    await this.db.query(
      'UPDATE conversations SET assigned_bot_id = NULL WHERE assigned_bot_id = ?',
      [botId]
    )

    // Delete the bot
    await this.db.query(
      'DELETE FROM agent_bots WHERE id = ? AND user_id = ?',
      [botId, userId]
    )

    // If deleted bot was default, promote next bot in priority order
    if (wasDefault) {
      const { rows } = await this.db.query(
        `SELECT id FROM agent_bots 
         WHERE user_id = ? 
         ORDER BY priority ASC, created_at DESC 
         LIMIT 1`,
        [userId]
      )
      
      if (rows.length > 0) {
        await this.db.query(
          'UPDATE agent_bots SET is_default = 1, priority = 1 WHERE id = ?',
          [rows[0].id]
        )
        logger.info('Next bot promoted to default', { newDefaultBotId: rows[0].id, userId })
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
    const sql = 'SELECT * FROM agent_bots WHERE id = ?'
    const { rows } = await this.db.query(sql, [botId])

    if (rows.length === 0) {
      throw new Error('Bot not found')
    }

    const bot = rows[0]

    // Check if bot is active (Property 13: Bot status enforcement)
    if (bot.status !== 'active') {
      logger.debug('Bot is not active, skipping forward', { botId, status: bot.status })
      return { action: 'ignore', reason: 'bot_paused' }
    }

    // Get conversation labels
    let labels = []
    try {
      const labelsResult = await this.db.query(`
        SELECT l.id, l.name, l.color 
        FROM labels l
        JOIN conversation_labels cl ON l.id = cl.label_id
        WHERE cl.conversation_id = ?
      `, [conversation.id])
      labels = labelsResult.rows || []
    } catch (e) {
      // Labels table might not exist
    }

    // Get recent message history (last 10 messages) only if enabled
    let recentMessages = []
    if (bot.include_history) {
      try {
        const historyResult = await this.db.query(`
          SELECT id, message_id, direction, message_type, content, media_url, 
                 media_mime_type, media_filename, status, created_at
          FROM chat_messages 
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 10
        `, [conversation.id])
        recentMessages = (historyResult.rows || []).reverse() // Oldest first
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
    const convSql = 'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
    const { rows: convRows } = await this.db.query(convSql, [conversationId, userId])
    
    if (convRows.length === 0) {
      throw new Error('Conversation not found or unauthorized')
    }

    // Assign bot
    const sql = `
      UPDATE conversations 
      SET assigned_bot_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `

    await this.db.query(sql, [botId, conversationId])

    logger.info('Bot assigned to conversation', { conversationId, botId, userId })

    // Return updated conversation
    const { rows } = await this.db.query(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    )

    return rows[0]
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
    const convSql = 'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
    const { rows: convRows } = await this.db.query(convSql, [conversationId, userId])
    
    if (convRows.length === 0) {
      throw new Error('Conversation not found or unauthorized')
    }

    const sql = `
      UPDATE conversations 
      SET assigned_bot_id = NULL, updated_at = datetime('now')
      WHERE id = ?
    `

    await this.db.query(sql, [conversationId])

    logger.info('Bot removed from conversation', { conversationId, userId })

    const { rows } = await this.db.query(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    )

    return rows[0]
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
    const sql = `
      SELECT * FROM agent_bots 
      WHERE user_id = ? AND status = 'active'
      ORDER BY priority ASC, created_at DESC
      LIMIT 1
    `
    const { rows } = await this.db.query(sql, [userId])
    return this.transformBot(rows[0])
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
    await this.db.query(
      'UPDATE agent_bots SET is_default = 0 WHERE user_id = ?',
      [userId]
    )

    // Set this bot as default with priority 1
    await this.db.query(
      `UPDATE agent_bots 
       SET is_default = 1, priority = 1, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [botId, userId]
    )

    // Reorder other bots' priorities (shift by 1)
    await this.db.query(
      `UPDATE agent_bots 
       SET priority = priority + 1, updated_at = datetime('now')
       WHERE user_id = ? AND id != ? AND priority >= 1`,
      [userId, botId]
    )

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
    const { rows } = await this.db.query(
      `SELECT id FROM agent_bots WHERE user_id = ? AND id IN (${botIds.map(() => '?').join(',')})`,
      [userId, ...botIds]
    )

    if (rows.length !== botIds.length) {
      throw new Error('One or more bots not found or unauthorized')
    }

    // Update priorities
    for (const { id, priority } of priorities) {
      await this.db.query(
        `UPDATE agent_bots 
         SET priority = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
        [priority, id, userId]
      )
    }

    // Set is_default for priority 1 bot, remove from others
    await this.db.query(
      'UPDATE agent_bots SET is_default = 0 WHERE user_id = ?',
      [userId]
    )
    await this.db.query(
      'UPDATE agent_bots SET is_default = 1 WHERE user_id = ? AND priority = 1',
      [userId]
    )

    logger.info('Bot priorities updated', { userId, count: priorities.length })
  }

  /**
   * Get bot by ID
   * @param {number} botId - Bot ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Bot or null
   */
  async getBotById(botId, userId) {
    const sql = 'SELECT * FROM agent_bots WHERE id = ? AND user_id = ?'
    const { rows } = await this.db.query(sql, [botId, userId])
    return this.transformBot(rows[0])
  }

  /**
   * Get all bots for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Bots ordered by priority
   */
  async getBots(userId) {
    const sql = `
      SELECT ab.*, 
             COUNT(c.id) as assigned_conversations
      FROM agent_bots ab
      LEFT JOIN conversations c ON ab.id = c.assigned_bot_id
      WHERE ab.user_id = ?
      GROUP BY ab.id
      ORDER BY ab.priority ASC, ab.created_at DESC
    `
    const { rows } = await this.db.query(sql, [userId])
    return rows.map(row => this.transformBot(row))
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

    const sql = `
      UPDATE agent_bots 
      SET access_token = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `

    await this.db.query(sql, [newToken, botId, userId])

    logger.info('Bot access token regenerated', { botId, userId })

    return this.getBotById(botId, userId)
  }
}

module.exports = BotService
