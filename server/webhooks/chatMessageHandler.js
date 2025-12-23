/**
 * Chat Message Webhook Handler
 * 
 * Processes incoming webhook events from WUZAPI for chat functionality:
 * - Message events (incoming messages)
 * - ReadReceipt events (message read confirmations)
 * - ChatPresence events (typing indicators)
 * 
 * Requirements: 11.1, 11.2, 11.3
 */

const { logger } = require('../utils/logger')
const { toBoolean } = require('../utils/responseTransformer')
const ChatService = require('../services/ChatService')
const { mediaProcessorService } = require('../services/MediaProcessorService')
const OutgoingWebhookService = require('../services/OutgoingWebhookService')
const BotService = require('../services/BotService')
const GroupNameResolver = require('../services/GroupNameResolver')
const { resolveLidToPhone } = require('../utils/phoneUtils')
const SupabaseService = require('../services/SupabaseService')

/**
 * Convert timestamp to Brazil timezone (America/Sao_Paulo)
 * @param {string|number} timestamp - UTC timestamp (ISO string or Unix timestamp)
 * @returns {string} ISO timestamp string in Brazil timezone
 */
function toBrazilTimestamp(timestamp) {
  let date
  if (typeof timestamp === 'number') {
    // Unix timestamp (seconds or milliseconds)
    date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000)
  } else if (timestamp) {
    date = new Date(timestamp)
  } else {
    date = new Date()
  }

  // Use Intl.DateTimeFormat to get Brazil time components
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value || '00'

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/**
 * Check if a group name is invalid and needs to be fetched from WUZAPI
 * Requirements: 1.5, 3.3, 3.4 (group-name-display-fix)
 * 
 * @param {string|null} name - The group name to validate
 * @returns {boolean} True if the name is invalid and needs to be fetched
 */
function isInvalidGroupName(name) {
  // Null or empty name is invalid (Requirement 3.4)
  if (!name || name.trim().length === 0) {
    return true
  }
  
  // Name is only digits - likely a JID without @g.us (Requirement 3.3)
  if (/^\d+$/.test(name)) {
    return true
  }
  
  // Name contains @g.us - it's a raw JID (Requirement 3.3)
  if (name.includes('@g.us')) {
    return true
  }
  
  // Name starts with "Grupo " followed by digits - it's a previous fallback
  if (/^Grupo \d+/.test(name)) {
    return true
  }
  
  return false
}

/**
 * Check if a message should be silently ignored (system messages)
 * Requirements: 1.1, 1.2 (unsupported-message-types)
 * 
 * These are WhatsApp protocol messages that should not be stored or displayed:
 * - senderKeyDistributionMessage: Encryption key distribution for groups
 * - messageContextInfo only: Metadata without actual content
 * 
 * @param {Object} messageContent - The message content from WUZAPI
 * @returns {boolean} True if the message should be ignored
 */
function shouldIgnoreMessage(messageContent) {
  if (!messageContent) {
    return true
  }
  
  const keys = Object.keys(messageContent)
  
  // Filter out metadata keys that don't represent actual content
  const contentKeys = keys.filter(k => 
    k !== 'messageContextInfo' && 
    k !== 'MessageContextInfo'
  )
  
  // If only senderKeyDistributionMessage, ignore it
  if (contentKeys.length === 1 && 
      (contentKeys[0] === 'senderKeyDistributionMessage' || 
       contentKeys[0] === 'SenderKeyDistributionMessage')) {
    logger.debug('Ignoring senderKeyDistributionMessage (encryption key distribution)', {
      keys: contentKeys
    })
    return true
  }
  
  // If no content keys (only metadata), ignore it
  if (contentKeys.length === 0) {
    logger.debug('Ignoring message with only metadata (no content)', {
      originalKeys: keys
    })
    return true
  }
  
  return false
}

class ChatMessageHandler {
  constructor(chatHandler = null) {
    this.chatService = new ChatService(SupabaseService)
    this.chatHandler = chatHandler // WebSocket handler for real-time updates
    this.presenceState = new Map() // contactJid -> { state, timestamp }
    this.outgoingWebhookService = new OutgoingWebhookService()
    this.botService = new BotService()
    this.groupNameResolver = new GroupNameResolver(logger) // Group name resolution service
    
    logger.info('ChatMessageHandler initialized with GroupNameResolver', {
      hasGroupNameResolver: !!this.groupNameResolver
    })
  }

  /**
   * Set the WebSocket chat handler for real-time updates
   * @param {ChatWebSocketHandler} handler
   */
  setChatHandler(handler) {
    this.chatHandler = handler
  }

  /**
   * Route incoming webhook event to appropriate handler
   * @param {string} userToken - User token from webhook
   * @param {Object} event - Webhook event payload
   * @returns {Promise<Object>} Processing result
   */
  async handleEvent(userToken, event) {
    const { type, data, timestamp } = event

    logger.debug('Processing webhook event', { type, userToken: userToken?.substring(0, 8) })

    try {
      switch (type) {
        case 'Message':
          return await this.handleMessageEvent(userToken, data, timestamp)
        
        case 'ReadReceipt':
          return await this.handleReadReceiptEvent(userToken, data, timestamp)
        
        case 'ChatPresence':
          return await this.handleChatPresenceEvent(userToken, data, timestamp)
        
        case 'MessageStatus':
          return await this.handleMessageStatusEvent(userToken, data, timestamp)
        
        case 'GroupInfo':
          return await this.handleGroupInfoEvent(userToken, data, timestamp)
        
        case 'JoinedGroup':
          return await this.handleJoinedGroupEvent(userToken, data, timestamp)
        
        default:
          logger.debug('Unhandled webhook event type', { type })
          return { handled: false, type }
      }
    } catch (error) {
      logger.error('Error processing webhook event', { type, error: error.message })
      throw error
    }
  }

  /**
   * Handle incoming message event
   * Requirements: 11.1, 1.2
   * 
   * WUZAPI sends message events in different formats:
   * Format 1 (nested): { Info: { Id, Chat, ... }, Message: { conversation, ... } }
   * Format 2 (flat): { Id, Chat, IsFromMe, PushName, Message: { conversation, ... } }
   * 
   * @param {string} userToken - User token
   * @param {Object} data - Message data
   * @param {string} timestamp - Event timestamp
   */
  async handleMessageEvent(userToken, data, timestamp) {
    // WUZAPI can send in nested or flat format
    // Try nested first, then fall back to flat
    let messageInfo = data.Info || data.info
    let messageContent = data.Message || data.message
    
    // If no nested Info, treat data itself as messageInfo (flat format)
    if (!messageInfo && (data.Id || data.Chat || data.Sender)) {
      messageInfo = data
      // In flat format, Message is still nested
      messageContent = data.Message || data.message
    }
    
    // Log the data structure for debugging
    logger.debug('Processing message event data', {
      hasInfo: !!messageInfo,
      hasMessage: !!messageContent,
      dataKeys: Object.keys(data || {}),
      infoKeys: messageInfo ? Object.keys(messageInfo) : [],
      messageKeys: messageContent ? Object.keys(messageContent) : []
    })

    if (!messageInfo) {
      logger.warn('Message event missing Info field', {
        dataKeys: Object.keys(data || {})
      })
      return { handled: false, error: 'Missing Info field in message data' }
    }

    // Extract message details - WUZAPI uses PascalCase
    // WUZAPI sends Chat field for the contact JID (not RemoteJid)
    const chatJid = messageInfo.Chat || messageInfo.chat || messageInfo.RemoteJid || messageInfo.remoteJid
    const senderJid = messageInfo.Sender || messageInfo.sender
    // WUZAPI sends SenderAlt/RecipientAlt with real phone when Chat is @lid
    const senderAlt = messageInfo.SenderAlt || messageInfo.senderAlt
    const recipientAlt = messageInfo.RecipientAlt || messageInfo.recipientAlt
    
    let messageId = messageInfo.Id || messageInfo.id || messageInfo.MessageId || messageInfo.messageId || messageInfo.ID
    const fromMe = messageInfo.FromMe || messageInfo.fromMe || messageInfo.IsFromMe || false

    // Log extracted values for debugging
    logger.debug('Extracted message info', {
      chatJid: chatJid?.substring(0, 20),
      senderJid: senderJid?.substring(0, 20),
      senderAlt: senderAlt?.substring(0, 20),
      recipientAlt: recipientAlt?.substring(0, 20),
      messageId,
      fromMe,
      infoKeys: Object.keys(messageInfo || {})
    })

    // Determine contactJid - handle @lid (Linked Device ID) using Alt fields
    let contactJid
    if (chatJid && chatJid.endsWith('@lid')) {
      // When Chat is @lid, use SenderAlt or RecipientAlt for the real phone number
      const altPhone = senderAlt || recipientAlt
      
      logger.info('Detected @lid contact, using Alt fields', {
        lidJid: chatJid,
        senderAlt,
        recipientAlt,
        selectedAlt: altPhone
      })
      
      if (altPhone) {
        // Alt fields come as phone number (e.g., "+5531994975641"), normalize to JID
        let normalizedPhone = altPhone
          .replace(/^\+/, '') // Remove leading +
          .replace(/@s\.whatsapp\.net$/i, '')
          .replace(/@c\.us$/i, '')
        
        contactJid = `${normalizedPhone}@s.whatsapp.net`
        logger.info('LID resolved via Alt field', {
          originalLid: chatJid,
          altPhone,
          resolvedJid: contactJid
        })
      } else {
        // Fallback: try to resolve via API
        const lidNumber = chatJid.replace('@lid', '')
        const resolvedPhone = await resolveLidToPhone(lidNumber, userToken)
        
        if (resolvedPhone) {
          contactJid = `${resolvedPhone}@s.whatsapp.net`
          logger.info('LID resolved via API', {
            originalLid: lidNumber,
            resolvedJid: contactJid
          })
        } else if (senderJid && !senderJid.endsWith('@lid')) {
          // Last fallback: use Sender JID
          contactJid = senderJid
          logger.warn('LID resolution failed, using Sender as fallback', {
            originalLid: lidNumber,
            fallbackJid: contactJid
          })
        } else {
          logger.error('Failed to resolve LID - no Alt fields and API failed', {
            originalLid: lidNumber,
            senderJid
          })
          contactJid = chatJid // Keep original as last resort
        }
      }
    } else {
      // Normal case: use Chat or Sender
      contactJid = chatJid || senderJid
    }

    // Generate messageId if not present (fallback)
    if (!messageId) {
      messageId = `wuzapi_${Date.now()}_${Math.random().toString(36).substring(7)}`
      logger.warn('Generated fallback messageId', { messageId })
    }

    // Note: We now store ALL messages (incoming and outgoing from WhatsApp)
    // Messages sent via the system API are tracked separately with pending status
    // This ensures messages sent directly from WhatsApp are also visible in the chat

    if (!contactJid) {
      logger.warn('Message event missing contact JID', {
        infoKeys: Object.keys(messageInfo || {})
      })
      return { handled: false, error: 'Missing contact JID' }
    }

    // Get user ID from token
    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      logger.warn('User not found for token', { userToken: userToken?.substring(0, 8) })
      return { handled: false, error: 'User not found' }
    }

    // Extract participant info for group messages
    // Group JIDs end with @g.us, individual chats end with @s.whatsapp.net
    const isGroupMessage = contactJid && contactJid.endsWith('@g.us')
    let participantJid = null
    let participantName = null
    let contactName = null
    let nameResolution = null
    
    if (isGroupMessage) {
      // Log all messageInfo fields for debugging group messages
      logger.info('Group message detected', {
        groupJid: contactJid,
        allKeys: Object.keys(messageInfo),
        messageInfoPreview: JSON.stringify(messageInfo).substring(0, 500)
      })
      
      // For group messages, extract the participant (sender) info
      // WUZAPI sends Participant field for group messages
      participantJid = messageInfo.Participant || messageInfo.participant || senderJid
      
      // Get participant's push name - may be in different locations
      participantName = messageInfo.PushName || messageInfo.pushName || null
      
      // If no push name, format the phone number from participant JID
      if (!participantName && participantJid) {
        participantName = this.formatParticipantDisplay(participantJid, null)
      }
      
      // Use GroupNameResolver to get the best available group name
      // Priority: webhook (if valid) > database (if valid) > API > fallback
      // Requirements: 1.1, 1.2, 1.5, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2
      logger.debug('Starting group name resolution from message event', {
        groupJid: contactJid,
        hasWebhookData: !!messageInfo,
        webhookDataKeys: messageInfo ? Object.keys(messageInfo) : []
      })
      
      const nameResolution = await this.groupNameResolver.resolveGroupName(
        contactJid,
        messageInfo, // webhook data
        userToken,
        userId
      )
      
      contactName = nameResolution.name
      
      // Detailed logging of name resolution result
      logger.info('Group name resolved from message event', {
        groupJid: contactJid,
        resolvedName: contactName,
        source: nameResolution.source,
        updated: nameResolution.updated,
        previousName: nameResolution.previousName,
        nameChanged: nameResolution.previousName && 
          nameResolution.previousName.trim().toLowerCase() !== contactName.trim().toLowerCase(),
        timestamp: nameResolution.timestamp,
        participantJid,
        participantName,
        fromMe
      })
      
      // Log comparison details if name was updated
      if (nameResolution.updated && nameResolution.previousName) {
        logger.info('Group name comparison details', {
          groupJid: contactJid,
          oldName: nameResolution.previousName,
          newName: contactName,
          oldNameLength: nameResolution.previousName.length,
          newNameLength: contactName.length,
          source: nameResolution.source
        })
      }
    } else {
      // For individual chats, use PushName
      contactName = messageInfo.PushName || messageInfo.pushName || contactJid?.split('@')[0]
    }
    
    // Get or create conversation
    const conversation = await this.chatService.getOrCreateConversation(userId, contactJid, {
      name: contactName
    })
    
    // Broadcast name update via WebSocket if the name was updated
    // Requirements: 3.5
    if (isGroupMessage && nameResolution && nameResolution.updated && this.chatHandler) {
      const broadcastData = {
        id: conversation.id,
        contact_name: contactName,
        name_source: nameResolution.source,
        name_updated_at: nameResolution.timestamp
      }
      
      this.chatHandler.broadcastConversationUpdate(broadcastData)
      
      logger.info('Broadcasted group name update via WebSocket', {
        conversationId: conversation.id,
        groupJid: contactJid,
        name: contactName,
        source: nameResolution.source,
        previousName: nameResolution.previousName,
        broadcastData
      })
    } else if (isGroupMessage && nameResolution && !nameResolution.updated) {
      logger.debug('Group name not updated, skipping WebSocket broadcast', {
        conversationId: conversation.id,
        groupJid: contactJid,
        name: contactName,
        previousName: nameResolution.previousName,
        reason: 'Name unchanged or no previous name'
      })
    }

    // Parse message content
    const parsedMessage = this.parseMessageContent(messageContent)
    
    // Check if this is a system message that should be ignored
    // Requirements: 1.1, 1.2 (unsupported-message-types)
    if (parsedMessage.shouldIgnore) {
      logger.debug('Ignoring system message', { 
        type: parsedMessage.type,
        conversationId: conversation?.id 
      })
      return { handled: true, ignored: true, reason: 'system_message' }
    }
    
    // Handle protocol messages (edit/delete)
    // Requirements: 2.1, 3.1 (unsupported-message-types)
    if (parsedMessage.type === 'protocol_edit' && parsedMessage.targetMessageId) {
      return await this.handleMessageEdit(conversation.id, parsedMessage.targetMessageId, parsedMessage.content)
    }
    
    if (parsedMessage.type === 'protocol_delete' && parsedMessage.targetMessageId) {
      return await this.handleMessageDelete(conversation.id, parsedMessage.targetMessageId)
    }
    
    // Determine message direction
    const messageDirection = fromMe ? 'outgoing' : 'incoming'
    logger.debug('Message direction determined', { 
      messageId, 
      fromMe, 
      direction: messageDirection 
    })

    // Log media metadata for debugging
    if (parsedMessage.type !== 'text' && parsedMessage.type !== 'system') {
      logger.info('Media message parsed', {
        type: parsedMessage.type,
        hasMediaUrl: !!parsedMessage.mediaUrl,
        hasMediaMetadata: !!parsedMessage.mediaMetadata,
        mediaMimeType: parsedMessage.mediaMimeType,
        mediaMetadataKeys: parsedMessage.mediaMetadata ? Object.keys(parsedMessage.mediaMetadata) : []
      })
    }

    // Process media and upload to S3 if enabled
    let finalMediaUrl = parsedMessage.mediaUrl
    let s3Data = null
    
    if (parsedMessage.type !== 'text' && parsedMessage.mediaMetadata && mediaProcessorService.isEnabled()) {
      try {
        s3Data = await mediaProcessorService.processIncomingMedia({
          userToken,
          userId,
          mediaMetadata: parsedMessage.mediaMetadata,
          mediaType: parsedMessage.type,
          mediaMimeType: parsedMessage.mediaMimeType,
          mediaFilename: parsedMessage.mediaFilename
        })
        
        if (s3Data && s3Data.s3Url) {
          finalMediaUrl = s3Data.s3Url
          logger.info('Media uploaded to S3', {
            conversationId: conversation.id,
            s3Key: s3Data.s3Key,
            mediaType: parsedMessage.type
          })
        }
      } catch (s3Error) {
        logger.error('Failed to upload media to S3, using original URL', {
          error: s3Error.message,
          conversationId: conversation.id
        })
      }
    }

    // Extract reply context if this is a reply message
    let replyToMessageId = null
    const messageContextInfo = messageContent?.messageContextInfo || messageContent?.MessageContextInfo
    if (messageContextInfo) {
      const quotedMessageId = messageContextInfo.StanzaId || messageContextInfo.stanzaId
      if (quotedMessageId) {
        // Find the original message by WUZAPI message ID
        const { data: replyRows, error: replyError } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
          query.select('id').eq('conversation_id', conversation.id).eq('message_id', quotedMessageId)
        )
        const rows = replyRows || []
        if (rows.length > 0) {
          replyToMessageId = rows[0].id
          logger.debug('Reply context found', { 
            quotedMessageId, 
            replyToMessageId,
            conversationId: conversation.id 
          })
        } else {
          logger.warn('Quoted message not found', { 
            quotedMessageId, 
            conversationId: conversation.id 
          })
        }
      }
    }

    // Determine if this outgoing message is from an external bot
    // External bot messages are outgoing (fromMe: true) but not sent via our system
    // We detect this by checking if the message_id was generated by our system
    // System-generated IDs have format: timestamp_random (e.g., "1234567890_abc123")
    // WUZAPI IDs have different formats (e.g., "3EB0..." or "BAE5...")
    const isSystemGeneratedId = messageId && /^\d+_[a-z0-9]+$/.test(messageId)
    const isExternalBot = messageDirection === 'outgoing' && !isSystemGeneratedId
    
    if (isExternalBot) {
      logger.info('Detected external bot message', {
        messageId,
        conversationId: conversation.id,
        direction: messageDirection
      })
    }

    // Store the message - include mediaMetadata, reply context, direction, and participant info!
    // For external bot messages, set isExternalBot flag so sender_type is set to 'bot'
    // Requirements: 2.2, 3.2, 4.1, 6.1 (unsupported-message-types) - include special message fields
    const message = await this.chatService.storeIncomingMessage(conversation.id, {
      messageId,
      type: parsedMessage.type,
      content: parsedMessage.content,
      mediaUrl: finalMediaUrl,
      mediaMimeType: parsedMessage.mediaMimeType,
      mediaFilename: parsedMessage.mediaFilename,
      mediaMetadata: parsedMessage.mediaMetadata,
      replyToMessageId,
      direction: messageDirection,
      timestamp: toBrazilTimestamp(timestamp),
      // Group message participant info
      participantJid: isGroupMessage ? participantJid : null,
      participantName: isGroupMessage ? participantName : null,
      // External bot detection (Requirements: 1.1, 3.1)
      isExternalBot,
      // Special message type fields (Requirements: 2.2, 3.2, 4.1, 6.1)
      isEdited: parsedMessage.isEdited || false,
      isDeleted: parsedMessage.isDeleted || false,
      pollData: parsedMessage.pollData || null,
      interactiveData: parsedMessage.interactiveData || null
    })

    // Broadcast via WebSocket
    // Requirements: 3.1 (websocket-data-transformation-fix) - use toBoolean for consistent boolean conversion
    if (this.chatHandler) {
      this.chatHandler.broadcastNewMessage(conversation.id, message, { 
        isMuted: toBoolean(conversation.is_muted)
      })
      this.chatHandler.broadcastConversationUpdate({
        ...conversation,
        last_message_at: new Date().toISOString(),
        last_message_preview: parsedMessage.content || '[Media]',
        unread_count: (conversation.unread_count || 0) + 1
      })
    }

    logger.info('Incoming message processed', { 
      conversationId: conversation.id, 
      messageId,
      type: parsedMessage.type,
      contactJid: contactJid?.substring(0, 10) + '...'
    })

    // Send outgoing webhook event for message received/sent
    // Use WUZAPI-compatible format so existing flows work seamlessly
    try {
      const eventType = messageDirection === 'incoming' ? 'message.received' : 'message.sent'
      
      // Build WUZAPI-compatible payload
      const wuzapiPayload = {
        type: 'Message',
        event: data, // Original WUZAPI event data (Info, Message, etc.)
        userID: userId,
        instanceName: userId,
        token: userId,
        timestamp: toBrazilTimestamp(timestamp)
      }
      
      await this.outgoingWebhookService.sendWebhookEvent(userId, eventType, wuzapiPayload)
    } catch (webhookError) {
      // Don't fail the message processing if webhook fails
      logger.error('Failed to send outgoing webhook', { 
        error: webhookError.message,
        conversationId: conversation.id 
      })
    }

    // Forward to assigned bot if this is an incoming message
    // Requirements: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3
    if (messageDirection === 'incoming' && conversation.assigned_bot_id) {
      try {
        // Check bot call quota before forwarding
        const callQuotaCheck = await this.botService.checkBotCallQuota(userId)
        
        if (!callQuotaCheck.allowed) {
          logger.warn('Bot call quota exceeded, skipping bot processing', {
            userId,
            conversationId: conversation.id,
            botId: conversation.assigned_bot_id,
            quotaType: callQuotaCheck.quotaType,
            usage: callQuotaCheck.usage,
            limit: callQuotaCheck.limit
          })
          
          // Return with quota exceeded info - message is already stored
          return { 
            handled: true, 
            conversationId: conversation.id, 
            messageId: message.id,
            botSkipped: true,
            quotaExceeded: {
              quotaType: callQuotaCheck.quotaType,
              usage: callQuotaCheck.usage,
              limit: callQuotaCheck.limit,
              remaining: callQuotaCheck.remaining,
              resetsAt: callQuotaCheck.resetsAt
            }
          }
        }
        
        logger.info('Forwarding message to assigned bot', {
          conversationId: conversation.id,
          botId: conversation.assigned_bot_id,
          messageId: message.id
        })
        
        // Increment bot call counter after quota check passes
        await this.botService.incrementBotCallUsage(userId)
        
        const botResponse = await this.botService.forwardToBot(
          conversation.assigned_bot_id,
          message,
          conversation,
          {
            rawEvent: data, // Original WUZAPI event data
            userToken: userId // User token for API calls
          }
        )
        
        // Track token usage if reported in bot response
        if (botResponse && botResponse.tokensUsed) {
          await this.botService.trackBotTokenUsage(userId, botResponse.tokensUsed)
        }
        
        // Handle bot response (e.g., send reply)
        if (botResponse && botResponse.action === 'reply' && botResponse.content) {
          // Check bot message quota before sending reply
          const msgQuotaCheck = await this.botService.checkBotMessageQuota(userId)
          
          if (msgQuotaCheck.allowed) {
            await this.handleBotReply(userId, conversation, botResponse)
            // Increment bot message counter after successful reply
            await this.botService.incrementBotMessageUsage(userId)
          } else {
            logger.warn('Bot message quota exceeded, skipping reply', {
              userId,
              conversationId: conversation.id,
              quotaType: msgQuotaCheck.quotaType,
              usage: msgQuotaCheck.usage,
              limit: msgQuotaCheck.limit
            })
          }
        }
        
        logger.info('Bot response received', {
          conversationId: conversation.id,
          botId: conversation.assigned_bot_id,
          action: botResponse?.action,
          tokensUsed: botResponse?.tokensUsed
        })
      } catch (botError) {
        // Don't fail the message processing if bot fails
        logger.error('Failed to forward message to bot', {
          error: botError.message,
          conversationId: conversation.id,
          botId: conversation.assigned_bot_id
        })
      }
    }

    return { 
      handled: true, 
      conversationId: conversation.id, 
      messageId: message.id 
    }
  }
  
  /**
   * Handle bot reply by sending message via WUZAPI
   * @param {string} userToken - User token for WUZAPI
   * @param {Object} conversation - Conversation object
   * @param {Object} botResponse - Bot response with action and content
   */
  async handleBotReply(userToken, conversation, botResponse) {
    const axios = require('axios')
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    // Extract phone from JID
    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '')
    
    try {
      if (botResponse.messageType === 'text' || !botResponse.messageType) {
        await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
          Phone: phone,
          Body: botResponse.content
        }, {
          headers: {
            'token': userToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
      }
      // Add support for other message types as needed
      
      logger.info('Bot reply sent', {
        conversationId: conversation.id,
        phone,
        messageType: botResponse.messageType || 'text'
      })
    } catch (error) {
      logger.error('Failed to send bot reply', {
        error: error.message,
        conversationId: conversation.id,
        phone
      })
    }
  }

  /**
   * Handle message edit protocol message
   * Requirements: 2.1, 2.2, 2.4 (unsupported-message-types)
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} targetMessageId - WUZAPI message ID of the message to edit
   * @param {string} newContent - New message content
   * @returns {Promise<Object>} Processing result
   */
  async handleMessageEdit(conversationId, targetMessageId, newContent) {
    try {
      // Find the original message by WUZAPI message ID
      const { data: editRows, error: editError } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.select('id, content').eq('conversation_id', conversationId).eq('message_id', targetMessageId)
      )
      const rows = editRows || []
      
      if (rows.length > 0) {
        const originalMessage = rows[0]
        
        // Update the message content and mark as edited
        await SupabaseService.update('chat_messages', originalMessage.id, {
          content: newContent,
          is_edited: true
        })
        
        logger.info('Message edited', {
          conversationId,
          messageId: originalMessage.id,
          targetMessageId,
          oldContent: originalMessage.content?.substring(0, 50),
          newContent: newContent?.substring(0, 50)
        })
        
        // Broadcast via WebSocket
        if (this.chatHandler) {
          this.chatHandler.broadcastMessageUpdate(conversationId, {
            id: originalMessage.id,
            content: newContent,
            is_edited: true
          })
        }
        
        return { handled: true, edited: true, messageId: originalMessage.id }
      } else {
        // Original message not found - log warning
        logger.warn('Edit target message not found', {
          conversationId,
          targetMessageId
        })
        return { handled: true, edited: false, reason: 'target_not_found' }
      }
    } catch (error) {
      logger.error('Failed to handle message edit', {
        error: error.message,
        conversationId,
        targetMessageId
      })
      return { handled: false, error: error.message }
    }
  }

  /**
   * Handle message delete protocol message
   * Requirements: 3.1, 3.2, 3.3 (unsupported-message-types)
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} targetMessageId - WUZAPI message ID of the message to delete
   * @returns {Promise<Object>} Processing result
   */
  async handleMessageDelete(conversationId, targetMessageId) {
    try {
      // Find the original message by WUZAPI message ID
      const { data: deleteRows, error: deleteError } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.select('id, content').eq('conversation_id', conversationId).eq('message_id', targetMessageId)
      )
      const rows = deleteRows || []
      
      if (rows.length > 0) {
        const originalMessage = rows[0]
        
        // Mark the message as deleted and update content
        await SupabaseService.update('chat_messages', originalMessage.id, {
          content: '🚫 Esta mensagem foi apagada',
          is_deleted: true
        })
        
        logger.info('Message deleted', {
          conversationId,
          messageId: originalMessage.id,
          targetMessageId
        })
        
        // Broadcast via WebSocket
        if (this.chatHandler) {
          this.chatHandler.broadcastMessageUpdate(conversationId, {
            id: originalMessage.id,
            content: '🚫 Esta mensagem foi apagada',
            is_deleted: true
          })
        }
        
        return { handled: true, deleted: true, messageId: originalMessage.id }
      } else {
        // Original message not found - log warning
        logger.warn('Delete target message not found', {
          conversationId,
          targetMessageId
        })
        return { handled: true, deleted: false, reason: 'target_not_found' }
      }
    } catch (error) {
      logger.error('Failed to handle message delete', {
        error: error.message,
        conversationId,
        targetMessageId
      })
      return { handled: false, error: error.message }
    }
  }

  /**
   * Handle read receipt event
   * Requirements: 11.2, 4.2
   * 
   * @param {string} userToken - User token
   * @param {Object} data - Read receipt data
   * @param {string} timestamp - Event timestamp
   */
  async handleReadReceiptEvent(userToken, data, timestamp) {
    logger.debug('ReadReceipt event received', { 
      data, 
      userToken: userToken?.substring(0, 8),
      dataKeys: Object.keys(data || {})
    })
    
    const { MessageIds, Chat, Timestamp } = data

    if (!MessageIds || MessageIds.length === 0) {
      logger.warn('ReadReceipt missing MessageIds', { data })
      return { handled: false, error: 'No message IDs in read receipt' }
    }

    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      return { handled: false, error: 'User not found' }
    }

    // Update each message status
    for (const wuzapiMessageId of MessageIds) {
      try {
        // Find message by WUZAPI message ID - need to join with conversations
        // First get conversations for this user
        const { data: convData } = await SupabaseService.queryAsAdmin('conversations', (query) =>
          query.select('id').eq('user_id', userId)
        )
        const convIds = (convData || []).map(c => c.id)
        
        if (convIds.length === 0) continue
        
        // Then find the message
        const { data: msgData } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
          query.select('id, conversation_id').eq('message_id', wuzapiMessageId).in('conversation_id', convIds)
        )
        const rows = msgData || []
        
        if (rows.length > 0) {
          const message = rows[0]
          
          // Update message status
          await SupabaseService.update('chat_messages', message.id, { status: 'read' })

          // Broadcast via WebSocket
          if (this.chatHandler) {
            this.chatHandler.broadcastMessageStatusUpdate(
              message.conversation_id,
              message.id,
              'read',
              Timestamp || timestamp
            )
          }
        }
      } catch (error) {
        logger.error('Error updating read receipt', { wuzapiMessageId, error: error.message })
      }
    }

    logger.info('Read receipts processed', { count: MessageIds.length })

    return { handled: true, count: MessageIds.length }
  }

  /**
   * Handle chat presence event (typing indicators)
   * Requirements: 11.3, 4.4, 4.5, 15.1, 15.2
   * 
   * @param {string} userToken - User token
   * @param {Object} data - Presence data
   * @param {string} timestamp - Event timestamp
   */
  async handleChatPresenceEvent(userToken, data, timestamp) {
    const { Chat, State } = data
    const contactJid = Chat

    // Map WUZAPI presence states
    const presenceMap = {
      'composing': 'composing',
      'paused': 'paused',
      'recording': 'recording',
      'available': 'available',
      'unavailable': 'unavailable'
    }

    const state = presenceMap[State] || 'available'

    // Store presence state
    this.presenceState.set(contactJid, {
      state,
      timestamp: timestamp || new Date().toISOString()
    })

    // Find conversation for this contact
    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      return { handled: false, error: 'User not found' }
    }

    const { data: presenceConvData } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('user_id', userId).eq('contact_jid', contactJid)
    )
    const rows = presenceConvData || []

    if (rows.length > 0) {
      const conversationId = rows[0].id

      // Broadcast presence via WebSocket
      if (this.chatHandler) {
        const room = `conversation:${conversationId}`
        this.chatHandler.io.of('/chat').to(room).emit('contact_presence', {
          conversationId,
          contactJid,
          state,
          timestamp
        })
      }
    }

    logger.debug('Presence event processed', { contactJid, state })

    return { handled: true, contactJid, state }
  }

  /**
   * Handle message status update event
   * @param {string} userToken - User token
   * @param {Object} data - Status data
   * @param {string} timestamp - Event timestamp
   */
  async handleMessageStatusEvent(userToken, data, timestamp) {
    logger.debug('MessageStatus event received', { 
      data, 
      userToken: userToken?.substring(0, 8),
      dataKeys: Object.keys(data || {})
    })
    
    const { MessageId, Status } = data

    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      return { handled: false, error: 'User not found' }
    }

    // Map WUZAPI status to our status
    const statusMap = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed'
    }

    const status = statusMap[Status] || Status

    // Find and update message - need to join with conversations
    // First get conversations for this user
    const { data: statusConvData } = await SupabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('user_id', userId)
    )
    const statusConvIds = (statusConvData || []).map(c => c.id)
    
    let rows = []
    if (statusConvIds.length > 0) {
      const { data: statusMsgData } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.select('id, conversation_id').eq('message_id', MessageId).in('conversation_id', statusConvIds)
      )
      rows = statusMsgData || []
    }

    if (rows.length > 0) {
      const message = rows[0]
      
      await SupabaseService.update('chat_messages', message.id, { status })

      // Broadcast via WebSocket
      if (this.chatHandler) {
        this.chatHandler.broadcastMessageStatusUpdate(
          message.conversation_id,
          message.id,
          status,
          timestamp
        )
      }

      logger.info('Message status updated', { messageId: message.id, status })
      return { handled: true, messageId: message.id, status }
    }

    return { handled: false, error: 'Message not found' }
  }

  /**
   * Handle GroupInfo event - updates group information including name
   * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.5
   * 
   * WUZAPI sends GroupInfo events when group information is updated.
   * Structure: { GroupJID, Name, Subject, ... } or { data: { GroupJID, Name, ... } }
   * 
   * @param {string} userToken - User token
   * @param {Object} data - GroupInfo data
   * @param {string} timestamp - Event timestamp
   * @returns {Promise<Object>} Processing result
   */
  async handleGroupInfoEvent(userToken, data, timestamp) {
    logger.info('GroupInfo event received', {
      userToken: userToken?.substring(0, 8),
      dataKeys: Object.keys(data || {}),
      dataPreview: JSON.stringify(data).substring(0, 500)
    })

    // Extract GroupJID from various possible locations
    const groupJid = data.GroupJID || data.GroupJid || data.groupJID || data.groupJid || 
                     data.data?.GroupJID || data.data?.GroupJid || null

    if (!groupJid) {
      logger.warn('GroupInfo event missing GroupJID', {
        dataKeys: Object.keys(data || {}),
        dataStructure: JSON.stringify(data).substring(0, 300)
      })
      return { handled: false, error: 'Missing GroupJID in GroupInfo event' }
    }

    // Validate it's a group JID
    if (!groupJid.endsWith('@g.us')) {
      logger.warn('GroupInfo event with invalid GroupJID format', { groupJid })
      return { handled: false, error: 'Invalid GroupJID format' }
    }

    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      logger.warn('User not found for token in GroupInfo event', { 
        userToken: userToken?.substring(0, 8) 
      })
      return { handled: false, error: 'User not found' }
    }

    logger.info('Processing GroupInfo event for group', {
      groupJid,
      userId: userId?.substring(0, 8) + '...',
      timestamp,
      dataStructure: JSON.stringify(data).substring(0, 300)
    })

    // Use GroupNameResolver to extract and update group name
    // Pass the entire data object as webhookData to allow extraction from nested structures
    logger.debug('Starting group name resolution from GroupInfo event', {
      groupJid,
      hasWebhookData: !!data,
      webhookDataKeys: data ? Object.keys(data) : []
    })
    
    const nameResolution = await this.groupNameResolver.resolveGroupName(
      groupJid,
      data, // webhook data - may contain Name, GroupName, Subject, etc.
      userToken,
      userId
    )

    logger.info('GroupInfo name resolution completed', {
      groupJid,
      resolvedName: nameResolution.name,
      source: nameResolution.source,
      updated: nameResolution.updated,
      previousName: nameResolution.previousName,
      nameChanged: nameResolution.previousName && 
        nameResolution.previousName.trim().toLowerCase() !== nameResolution.name.trim().toLowerCase(),
      timestamp: nameResolution.timestamp
    })
    
    // Log comparison details if name was updated
    if (nameResolution.updated && nameResolution.previousName) {
      logger.info('GroupInfo name comparison details', {
        groupJid,
        oldName: nameResolution.previousName,
        newName: nameResolution.name,
        oldNameLength: nameResolution.previousName.length,
        newNameLength: nameResolution.name.length,
        source: nameResolution.source
      })
    }

    // Get or create conversation to ensure it exists
    const conversation = await this.chatService.getOrCreateConversation(userId, groupJid, {
      name: nameResolution.name
    })

    // Broadcast name update via WebSocket if the name was updated
    if (nameResolution.updated && this.chatHandler) {
      const broadcastData = {
        id: conversation.id,
        contact_name: nameResolution.name,
        name_source: nameResolution.source,
        name_updated_at: nameResolution.timestamp
      }
      
      this.chatHandler.broadcastConversationUpdate(broadcastData)

      logger.info('Broadcasted GroupInfo name update via WebSocket', {
        conversationId: conversation.id,
        groupJid,
        name: nameResolution.name,
        source: nameResolution.source,
        previousName: nameResolution.previousName,
        broadcastData
      })
    } else if (!nameResolution.updated) {
      logger.debug('GroupInfo name not updated, skipping WebSocket broadcast', {
        conversationId: conversation.id,
        groupJid,
        name: nameResolution.name,
        previousName: nameResolution.previousName,
        reason: 'Name unchanged or no previous name'
      })
    }

    return {
      handled: true,
      groupJid,
      conversationId: conversation.id,
      name: nameResolution.name,
      updated: nameResolution.updated
    }
  }

  /**
   * Handle JoinedGroup event - when user joins a group
   * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2
   * 
   * WUZAPI sends JoinedGroup events when the user joins a group.
   * Structure: { GroupJID, GroupName, ... } or { data: { GroupJID, GroupName, ... } }
   * 
   * @param {string} userToken - User token
   * @param {Object} data - JoinedGroup data
   * @param {string} timestamp - Event timestamp
   * @returns {Promise<Object>} Processing result
   */
  async handleJoinedGroupEvent(userToken, data, timestamp) {
    logger.info('JoinedGroup event received', {
      userToken: userToken?.substring(0, 8),
      dataKeys: Object.keys(data || {}),
      dataPreview: JSON.stringify(data).substring(0, 500)
    })

    // Extract GroupJID from various possible locations
    const groupJid = data.GroupJID || data.GroupJid || data.groupJID || data.groupJid || 
                     data.data?.GroupJID || data.data?.GroupJid || null

    if (!groupJid) {
      logger.warn('JoinedGroup event missing GroupJID', {
        dataKeys: Object.keys(data || {}),
        dataStructure: JSON.stringify(data).substring(0, 300)
      })
      return { handled: false, error: 'Missing GroupJID in JoinedGroup event' }
    }

    // Validate it's a group JID
    if (!groupJid.endsWith('@g.us')) {
      logger.warn('JoinedGroup event with invalid GroupJID format', { groupJid })
      return { handled: false, error: 'Invalid GroupJID format' }
    }

    const userId = await this.getUserIdFromToken(userToken)
    if (!userId) {
      logger.warn('User not found for token in JoinedGroup event', { 
        userToken: userToken?.substring(0, 8) 
      })
      return { handled: false, error: 'User not found' }
    }

    logger.info('Processing JoinedGroup event for group', {
      groupJid,
      userId: userId?.substring(0, 8) + '...',
      timestamp,
      dataStructure: JSON.stringify(data).substring(0, 300)
    })

    // Use GroupNameResolver to extract and update group name
    // Pass the entire data object as webhookData to allow extraction from nested structures
    logger.debug('Starting group name resolution from JoinedGroup event', {
      groupJid,
      hasWebhookData: !!data,
      webhookDataKeys: data ? Object.keys(data) : []
    })
    
    const nameResolution = await this.groupNameResolver.resolveGroupName(
      groupJid,
      data, // webhook data - may contain GroupName, Name, Subject, etc.
      userToken,
      userId
    )

    logger.info('JoinedGroup name resolution completed', {
      groupJid,
      resolvedName: nameResolution.name,
      source: nameResolution.source,
      updated: nameResolution.updated,
      previousName: nameResolution.previousName,
      nameChanged: nameResolution.previousName && 
        nameResolution.previousName.trim().toLowerCase() !== nameResolution.name.trim().toLowerCase(),
      timestamp: nameResolution.timestamp
    })
    
    // Log comparison details if name was updated
    if (nameResolution.updated && nameResolution.previousName) {
      logger.info('JoinedGroup name comparison details', {
        groupJid,
        oldName: nameResolution.previousName,
        newName: nameResolution.name,
        oldNameLength: nameResolution.previousName.length,
        newNameLength: nameResolution.name.length,
        source: nameResolution.source
      })
    }

    // Get or create conversation to ensure it exists
    const conversation = await this.chatService.getOrCreateConversation(userId, groupJid, {
      name: nameResolution.name
    })

    // Broadcast name update via WebSocket if the name was updated
    if (nameResolution.updated && this.chatHandler) {
      const broadcastData = {
        id: conversation.id,
        contact_name: nameResolution.name,
        name_source: nameResolution.source,
        name_updated_at: nameResolution.timestamp
      }
      
      this.chatHandler.broadcastConversationUpdate(broadcastData)

      logger.info('Broadcasted JoinedGroup name update via WebSocket', {
        conversationId: conversation.id,
        groupJid,
        name: nameResolution.name,
        source: nameResolution.source,
        previousName: nameResolution.previousName,
        broadcastData
      })
    } else if (!nameResolution.updated) {
      logger.debug('JoinedGroup name not updated, skipping WebSocket broadcast', {
        conversationId: conversation.id,
        groupJid,
        name: nameResolution.name,
        previousName: nameResolution.previousName,
        reason: 'Name unchanged or no previous name'
      })
    }

    return {
      handled: true,
      groupJid,
      conversationId: conversation.id,
      name: nameResolution.name,
      updated: nameResolution.updated
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get user ID from token
   * Note: This system uses WUZAPI tokens directly as user identifiers
   * There is no local users table - the token IS the userId
   * @param {string} token - User token
   * @returns {Promise<string>} User ID (same as token)
   */
  async getUserIdFromToken(token) {
    // Token is used directly as userId since there's no local users table
    return token
  }

  /**
   * Parse message content from WUZAPI format
   * Supports both PascalCase and camelCase field names
   * Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.3 (unsupported-message-types)
   * @param {Object} messageContent - WUZAPI message content
   * @returns {Object} Parsed message data
   */
  parseMessageContent(messageContent) {
    if (!messageContent) {
      return { type: 'text', content: '' }
    }

    // Check if this is a system message that should be ignored
    // Requirements: 1.1, 1.2 (unsupported-message-types)
    if (shouldIgnoreMessage(messageContent)) {
      return { type: 'system', content: '', shouldIgnore: true }
    }

    // Log raw message content for debugging media issues
    const msgKeys = Object.keys(messageContent).filter(k => k !== 'messageContextInfo')
    if (msgKeys.length > 0 && !messageContent.Conversation && !messageContent.conversation) {
      logger.debug('Raw message content for media', {
        keys: msgKeys,
        content: JSON.stringify(messageContent).substring(0, 500)
      })
    }

    // Protocol message (edit, delete, etc.)
    // Requirements: 2.1, 3.1 (unsupported-message-types)
    const protocolMsg = messageContent.ProtocolMessage || messageContent.protocolMessage
    if (protocolMsg) {
      return this.parseProtocolMessage(protocolMsg)
    }

    // Poll creation message
    // Requirements: 4.1, 4.2 (unsupported-message-types)
    const pollCreationMsg = messageContent.PollCreationMessage || messageContent.pollCreationMessage
    if (pollCreationMsg) {
      return this.parsePollMessage(pollCreationMsg)
    }

    // Poll update message (vote)
    const pollUpdateMsg = messageContent.PollUpdateMessage || messageContent.pollUpdateMessage
    if (pollUpdateMsg) {
      return {
        type: 'poll_vote',
        content: '📊 Voto em enquete'
      }
    }

    // View once message
    // Requirements: 5.1, 5.2 (unsupported-message-types)
    const viewOnceMsg = messageContent.ViewOnceMessage || messageContent.viewOnceMessage ||
                        messageContent.ViewOnceMessageV2 || messageContent.viewOnceMessageV2 ||
                        messageContent.ViewOnceMessageV2Extension || messageContent.viewOnceMessageV2Extension
    if (viewOnceMsg) {
      return this.parseViewOnceMessage(viewOnceMsg)
    }

    // Buttons message
    // Requirements: 6.1 (unsupported-message-types)
    const buttonsMsg = messageContent.ButtonsMessage || messageContent.buttonsMessage
    if (buttonsMsg) {
      return this.parseButtonsMessage(buttonsMsg)
    }

    // Buttons response message
    // Requirements: 6.2 (unsupported-message-types)
    const buttonsResponseMsg = messageContent.ButtonsResponseMessage || messageContent.buttonsResponseMessage
    if (buttonsResponseMsg) {
      return this.parseButtonsResponseMessage(buttonsResponseMsg)
    }

    // List message
    // Requirements: 6.3 (unsupported-message-types)
    const listMsg = messageContent.ListMessage || messageContent.listMessage
    if (listMsg) {
      return this.parseListMessage(listMsg)
    }

    // List response message
    // Requirements: 6.4 (unsupported-message-types)
    const listResponseMsg = messageContent.ListResponseMessage || messageContent.listResponseMessage
    if (listResponseMsg) {
      return this.parseListResponseMessage(listResponseMsg)
    }

    // Template message
    // Requirements: 7.1, 7.2, 7.3 (unsupported-message-types)
    const templateMsg = messageContent.TemplateMessage || messageContent.templateMessage
    if (templateMsg) {
      return this.parseTemplateMessage(templateMsg)
    }

    // Encrypted comment message (channels/newsletters)
    // Requirements: 8.1, 8.2 (unsupported-message-types)
    const encCommentMsg = messageContent.EncCommentMessage || messageContent.encCommentMessage
    if (encCommentMsg) {
      return {
        type: 'channel_comment',
        content: '💬 Comentário em canal'
      }
    }

    // Edited message wrapper
    const editedMsg = messageContent.EditedMessage || messageContent.editedMessage
    if (editedMsg) {
      const innerMessage = editedMsg.Message || editedMsg.message
      if (innerMessage) {
        const parsed = this.parseMessageContent(innerMessage)
        parsed.isEdited = true
        return parsed
      }
    }

    // Text message (support both cases)
    const conversation = messageContent.Conversation || messageContent.conversation
    if (conversation) {
      return { type: 'text', content: conversation }
    }

    // Extended text message
    const extendedText = messageContent.ExtendedTextMessage || messageContent.extendedTextMessage
    if (extendedText) {
      return { 
        type: 'text', 
        content: extendedText.Text || extendedText.text || ''
      }
    }

    // Image message
    const imageMsg = messageContent.ImageMessage || messageContent.imageMessage
    if (imageMsg) {
      return {
        type: 'image',
        content: imageMsg.Caption || imageMsg.caption || '',
        mediaUrl: imageMsg.Url || imageMsg.url || null,
        mediaMimeType: imageMsg.Mimetype || imageMsg.mimetype,
        mediaMetadata: this.extractMediaMetadata(imageMsg)
      }
    }

    // Video message
    const videoMsg = messageContent.VideoMessage || messageContent.videoMessage
    if (videoMsg) {
      return {
        type: 'video',
        content: videoMsg.Caption || videoMsg.caption || '',
        mediaUrl: videoMsg.Url || videoMsg.url || null,
        mediaMimeType: videoMsg.Mimetype || videoMsg.mimetype,
        mediaMetadata: this.extractMediaMetadata(videoMsg)
      }
    }

    // Audio message
    const audioMsg = messageContent.AudioMessage || messageContent.audioMessage
    if (audioMsg) {
      return {
        type: 'audio',
        content: '',
        mediaUrl: audioMsg.Url || audioMsg.url || null,
        mediaMimeType: audioMsg.Mimetype || audioMsg.mimetype,
        mediaMetadata: this.extractMediaMetadata(audioMsg)
      }
    }

    // Document message
    const docMsg = messageContent.DocumentMessage || messageContent.documentMessage
    if (docMsg) {
      return {
        type: 'document',
        content: docMsg.Caption || docMsg.caption || '',
        mediaUrl: docMsg.Url || docMsg.url || null,
        mediaMimeType: docMsg.Mimetype || docMsg.mimetype,
        mediaFilename: docMsg.FileName || docMsg.fileName,
        mediaMetadata: this.extractMediaMetadata(docMsg)
      }
    }

    // Location message
    const locMsg = messageContent.LocationMessage || messageContent.locationMessage
    if (locMsg) {
      return {
        type: 'location',
        content: JSON.stringify({
          latitude: locMsg.DegreesLatitude || locMsg.degreesLatitude,
          longitude: locMsg.DegreesLongitude || locMsg.degreesLongitude,
          name: locMsg.Name || locMsg.name || ''
        })
      }
    }

    // Contact message
    const contactMsg = messageContent.ContactMessage || messageContent.contactMessage
    if (contactMsg) {
      return {
        type: 'contact',
        content: contactMsg.Vcard || contactMsg.vcard
      }
    }

    // Sticker message
    const stickerMsg = messageContent.StickerMessage || messageContent.stickerMessage
    if (stickerMsg) {
      logger.info('Sticker message parsed', {
        hasUrl: !!(stickerMsg.Url || stickerMsg.url),
        hasMediaKey: !!(stickerMsg.MediaKey || stickerMsg.mediaKey),
        keys: Object.keys(stickerMsg)
      })
      return {
        type: 'sticker',
        content: '',
        mediaUrl: stickerMsg.Url || stickerMsg.url,
        mediaMimeType: 'image/webp',
        mediaMetadata: this.extractMediaMetadata(stickerMsg)
      }
    }

    // Reaction message
    const reactionMsg = messageContent.ReactionMessage || messageContent.reactionMessage
    if (reactionMsg) {
      return {
        type: 'reaction',
        content: reactionMsg.Text || reactionMsg.text,
        reactionKey: reactionMsg.Key || reactionMsg.key
      }
    }

    // Unknown type - log keys for debugging but don't fail
    // Filter out messageContextInfo which is metadata, not content
    // Unknown type - return identifiable fallback
    // Requirements: 9.3 (unsupported-message-types)
    const contentKeys = Object.keys(messageContent).filter(k => k !== 'messageContextInfo' && k !== 'MessageContextInfo')
    if (contentKeys.length > 0) {
      logger.warn('Unknown message type', { 
        keys: contentKeys,
        fullContent: JSON.stringify(messageContent).substring(0, 1000)
      })
      // Return a user-friendly message with the type name
      const typeName = contentKeys[0].replace(/Message$/i, '').replace(/([A-Z])/g, ' $1').trim()
      return { 
        type: 'unknown', 
        content: `📩 ${typeName}`,
        originalType: contentKeys[0]
      }
    }
    return { type: 'text', content: '' }
  }

  /**
   * Parse protocol message (edit, delete, etc.)
   * Requirements: 2.1, 3.1 (unsupported-message-types)
   * @param {Object} protocolMsg - Protocol message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseProtocolMessage(protocolMsg) {
    const type = protocolMsg.Type || protocolMsg.type
    const key = protocolMsg.Key || protocolMsg.key
    
    // Type 0 = REVOKE (delete)
    if (type === 0) {
      const targetMessageId = key?.ID || key?.id
      logger.info('Protocol message: REVOKE (delete)', { targetMessageId })
      return {
        type: 'protocol_delete',
        content: '🚫 Esta mensagem foi apagada',
        targetMessageId,
        isDeleted: true
      }
    }
    
    // Type 14 = MESSAGE_EDIT
    if (type === 14) {
      const targetMessageId = key?.ID || key?.id
      const editedMessage = protocolMsg.EditedMessage || protocolMsg.editedMessage
      let newContent = ''
      
      if (editedMessage) {
        const conversation = editedMessage.Conversation || editedMessage.conversation
        const extendedText = editedMessage.ExtendedTextMessage || editedMessage.extendedTextMessage
        newContent = conversation || extendedText?.Text || extendedText?.text || ''
      }
      
      logger.info('Protocol message: MESSAGE_EDIT', { targetMessageId, newContent: newContent.substring(0, 50) })
      return {
        type: 'protocol_edit',
        content: newContent,
        targetMessageId,
        isEdited: true
      }
    }
    
    // Other protocol types - ignore silently
    logger.debug('Protocol message: unknown type', { type })
    return { type: 'system', content: '', shouldIgnore: true }
  }

  /**
   * Parse poll creation message
   * Requirements: 4.1, 4.2 (unsupported-message-types)
   * @param {Object} pollMsg - Poll creation message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parsePollMessage(pollMsg) {
    const question = pollMsg.Name || pollMsg.name || 'Enquete'
    const options = pollMsg.Options || pollMsg.options || []
    
    // Format options as numbered list
    const optionsList = options.map((opt, i) => {
      const text = opt.OptionName || opt.optionName || opt
      return `${i + 1}. ${text}`
    }).join('\n')
    
    const content = `📊 ${question}\n\n${optionsList}`
    
    return {
      type: 'poll',
      content,
      pollData: {
        question,
        options: options.map(opt => opt.OptionName || opt.optionName || opt),
        selectableCount: pollMsg.SelectableOptionsCount || pollMsg.selectableOptionsCount || 1
      }
    }
  }

  /**
   * Parse view-once message
   * Requirements: 5.1, 5.2 (unsupported-message-types)
   * @param {Object} viewOnceMsg - View-once message wrapper from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseViewOnceMessage(viewOnceMsg) {
    const innerMessage = viewOnceMsg.Message || viewOnceMsg.message
    
    if (innerMessage) {
      // Check what type of media is inside
      if (innerMessage.ImageMessage || innerMessage.imageMessage) {
        return {
          type: 'view_once',
          content: '📷 Foto de visualização única',
          mediaType: 'image'
        }
      }
      if (innerMessage.VideoMessage || innerMessage.videoMessage) {
        return {
          type: 'view_once',
          content: '🎥 Vídeo de visualização única',
          mediaType: 'video'
        }
      }
      if (innerMessage.AudioMessage || innerMessage.audioMessage) {
        return {
          type: 'view_once',
          content: '🎵 Áudio de visualização única',
          mediaType: 'audio'
        }
      }
    }
    
    return {
      type: 'view_once',
      content: '⏱️ Mídia de visualização única'
    }
  }

  /**
   * Parse buttons message
   * Requirements: 6.1 (unsupported-message-types)
   * @param {Object} buttonsMsg - Buttons message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseButtonsMessage(buttonsMsg) {
    const text = buttonsMsg.ContentText || buttonsMsg.contentText || 
                 buttonsMsg.Text || buttonsMsg.text || ''
    const buttons = buttonsMsg.Buttons || buttonsMsg.buttons || []
    
    const buttonLabels = buttons.map(btn => {
      const buttonText = btn.ButtonText || btn.buttonText
      return `🔘 ${buttonText?.DisplayText || buttonText?.displayText || btn.ButtonId || btn.buttonId || 'Botão'}`
    }).join('\n')
    
    const content = text + (buttonLabels ? `\n\n${buttonLabels}` : '')
    
    return {
      type: 'interactive',
      content,
      interactiveData: {
        type: 'buttons',
        text,
        buttons: buttons.map(btn => ({
          id: btn.ButtonId || btn.buttonId,
          text: btn.ButtonText?.DisplayText || btn.buttonText?.displayText || ''
        }))
      }
    }
  }

  /**
   * Parse buttons response message
   * Requirements: 6.2 (unsupported-message-types)
   * @param {Object} responseMsg - Buttons response message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseButtonsResponseMessage(responseMsg) {
    const selectedId = responseMsg.SelectedButtonId || responseMsg.selectedButtonId
    const selectedText = responseMsg.SelectedDisplayText || responseMsg.selectedDisplayText || selectedId
    
    return {
      type: 'interactive',
      content: `🔘 ${selectedText}`,
      interactiveData: {
        type: 'buttons_response',
        selectedId,
        selectedTitle: selectedText
      }
    }
  }

  /**
   * Parse list message
   * Requirements: 6.3 (unsupported-message-types)
   * @param {Object} listMsg - List message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseListMessage(listMsg) {
    const title = listMsg.Title || listMsg.title || ''
    const description = listMsg.Description || listMsg.description || ''
    const buttonText = listMsg.ButtonText || listMsg.buttonText || 'Ver opções'
    const sections = listMsg.Sections || listMsg.sections || []
    
    let content = title
    if (description) content += `\n${description}`
    content += `\n\n📋 ${buttonText}`
    
    // Add section titles
    sections.forEach(section => {
      const sectionTitle = section.Title || section.title
      if (sectionTitle) {
        content += `\n• ${sectionTitle}`
      }
    })
    
    return {
      type: 'interactive',
      content,
      interactiveData: {
        type: 'list',
        text: `${title}\n${description}`.trim(),
        buttonText,
        sections: sections.map(section => ({
          title: section.Title || section.title,
          rows: (section.Rows || section.rows || []).map(row => ({
            id: row.RowId || row.rowId,
            title: row.Title || row.title,
            description: row.Description || row.description
          }))
        }))
      }
    }
  }

  /**
   * Parse list response message
   * Requirements: 6.4 (unsupported-message-types)
   * @param {Object} responseMsg - List response message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseListResponseMessage(responseMsg) {
    const singleSelectReply = responseMsg.SingleSelectReply || responseMsg.singleSelectReply
    const selectedRowId = singleSelectReply?.SelectedRowId || singleSelectReply?.selectedRowId
    const title = responseMsg.Title || responseMsg.title || selectedRowId
    
    return {
      type: 'interactive',
      content: `📋 ${title}`,
      interactiveData: {
        type: 'list_response',
        selectedId: selectedRowId,
        selectedTitle: title
      }
    }
  }

  /**
   * Parse template message
   * Requirements: 7.1, 7.2, 7.3 (unsupported-message-types)
   * @param {Object} templateMsg - Template message from WUZAPI
   * @returns {Object} Parsed message data
   */
  parseTemplateMessage(templateMsg) {
    // Try to get hydrated template content
    const hydratedTemplate = templateMsg.HydratedTemplate || templateMsg.hydratedTemplate ||
                            templateMsg.HydratedFourRowTemplate || templateMsg.hydratedFourRowTemplate
    
    if (hydratedTemplate) {
      const title = hydratedTemplate.HydratedTitleText || hydratedTemplate.hydratedTitleText || ''
      const body = hydratedTemplate.HydratedContentText || hydratedTemplate.hydratedContentText || ''
      const footer = hydratedTemplate.HydratedFooterText || hydratedTemplate.hydratedFooterText || ''
      const buttons = hydratedTemplate.HydratedButtons || hydratedTemplate.hydratedButtons || []
      
      let content = ''
      if (title) content += `*${title}*\n`
      if (body) content += body
      if (footer) content += `\n\n_${footer}_`
      
      // Add button labels
      if (buttons.length > 0) {
        const buttonLabels = buttons.map(btn => {
          const quickReply = btn.QuickReplyButton || btn.quickReplyButton
          const urlButton = btn.UrlButton || btn.urlButton
          const callButton = btn.CallButton || btn.callButton
          
          if (quickReply) return `🔘 ${quickReply.DisplayText || quickReply.displayText}`
          if (urlButton) return `🔗 ${urlButton.DisplayText || urlButton.displayText}`
          if (callButton) return `📞 ${callButton.DisplayText || callButton.displayText}`
          return '🔘 Botão'
        }).join('\n')
        content += `\n\n${buttonLabels}`
      }
      
      return {
        type: 'template',
        content: content.trim() || '📄 Mensagem de template'
      }
    }
    
    // Fallback for other template formats
    return {
      type: 'template',
      content: '📄 Mensagem de template'
    }
  }

  /**
   * Get presence state for a contact
   * @param {string} contactJid - Contact JID
   * @returns {Object|null} Presence state
   */
  getPresenceState(contactJid) {
    return this.presenceState.get(contactJid) || null
  }

  /**
   * Format participant display name for group messages
   * Requirements: 1.3, 1.4, 1.5, 3.4
   * 
   * @param {string|null} participantJid - Participant JID (e.g., "5547924166626@s.whatsapp.net")
   * @param {string|null} pushName - Participant's push name from WhatsApp
   * @returns {string} Formatted display name
   */
  formatParticipantDisplay(participantJid, pushName) {
    // If PushName exists, use it (Requirement 1.3)
    if (pushName && pushName.trim().length > 0) {
      return pushName.trim()
    }
    
    // If no participant JID, return unknown (Requirement 1.5)
    if (!participantJid) {
      return 'Participante desconhecido'
    }
    
    // Extract phone number from JID and format (Requirement 1.4)
    // JID format: "5547924166626@s.whatsapp.net"
    const phoneMatch = participantJid.match(/^(\d+)@/)
    if (!phoneMatch) {
      return 'Participante desconhecido'
    }
    
    const phone = phoneMatch[1]
    
    // Format Brazilian phone numbers: +55 XX XXXXX-XXXX or +55 XX XXXX-XXXX
    if (phone.startsWith('55') && phone.length >= 12) {
      const countryCode = phone.substring(0, 2)
      const areaCode = phone.substring(2, 4)
      const rest = phone.substring(4)
      
      // Format based on length (9 or 8 digit numbers)
      if (rest.length === 9) {
        return `+${countryCode} ${areaCode} ${rest.substring(0, 5)}-${rest.substring(5)}`
      } else if (rest.length === 8) {
        return `+${countryCode} ${areaCode} ${rest.substring(0, 4)}-${rest.substring(4)}`
      }
    }
    
    // For other formats, just add + prefix
    return `+${phone}`
  }

  /**
   * Extract media metadata for WUZAPI download endpoints
   * @param {Object} mediaMsg - Media message object from WUZAPI
   * @returns {Object|null} Media metadata for download
   */
  extractMediaMetadata(mediaMsg) {
    if (!mediaMsg) return null

    // Log raw media message for debugging
    logger.debug('Extracting media metadata', {
      keys: Object.keys(mediaMsg),
      hasUrl: !!(mediaMsg.Url || mediaMsg.url),
      hasMediaKey: !!(mediaMsg.MediaKey || mediaMsg.mediaKey),
      hasDirectPath: !!(mediaMsg.DirectPath || mediaMsg.directPath)
    })

    // WUZAPI sends these fields for media download
    const metadata = {
      url: mediaMsg.Url || mediaMsg.url || null,
      mediaKey: mediaMsg.MediaKey || mediaMsg.mediaKey || null,
      mimetype: mediaMsg.Mimetype || mediaMsg.mimetype || null,
      fileSha256: mediaMsg.FileSHA256 || mediaMsg.fileSHA256 || null,
      fileLength: mediaMsg.FileLength || mediaMsg.fileLength || null,
      fileEncSha256: mediaMsg.FileEncSHA256 || mediaMsg.fileEncSHA256 || null,
      directPath: mediaMsg.DirectPath || mediaMsg.directPath || null,
      seconds: mediaMsg.Seconds || mediaMsg.seconds || null, // For audio/video duration
      ptt: mediaMsg.Ptt || mediaMsg.ptt || false, // Push-to-talk (voice message)
      // Additional fields that might be useful
      height: mediaMsg.Height || mediaMsg.height || null,
      width: mediaMsg.Width || mediaMsg.width || null,
      jpegThumbnail: mediaMsg.JpegThumbnail || mediaMsg.jpegThumbnail || null
    }

    // Return metadata if we have at least some useful fields
    // WUZAPI might send different combinations depending on the media type
    const hasUsefulData = metadata.url || metadata.mediaKey || metadata.directPath || metadata.jpegThumbnail
    
    if (hasUsefulData) {
      logger.debug('Media metadata extracted', {
        hasUrl: !!metadata.url,
        hasMediaKey: !!metadata.mediaKey,
        hasDirectPath: !!metadata.directPath,
        hasThumbnail: !!metadata.jpegThumbnail
      })
      return metadata
    }

    logger.warn('No useful media metadata found', { keys: Object.keys(mediaMsg) })
    return null
  }

  /**
   * Format a fallback group name from JID
   * Requirements: 1.4 (group-name-display-fix)
   * 
   * @param {string} groupJid - Group JID (e.g., "120363043775639115@g.us")
   * @returns {string} Formatted fallback name (e.g., "Grupo 12036304...")
   */
  formatFallbackGroupName(groupJid) {
    const groupNumber = groupJid.split('@')[0]
    const truncatedNumber = groupNumber.length > 8 
      ? groupNumber.substring(0, 8) + '...' 
      : groupNumber
    return `Grupo ${truncatedNumber}`
  }

  /**
   * Fetch group name from WUZAPI
   * Requirements: 1.1, 1.3, 1.4 (group-name-display-fix)
   * 
   * @param {string} groupJid - Group JID (e.g., "120363043775639115@g.us")
   * @param {string} userToken - User token for WUZAPI authentication
   * @returns {Promise<string>} Group name or formatted fallback
   */
  async fetchGroupName(groupJid, userToken) {
    const axios = require('axios')
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    try {
      // WUZAPI /group/info uses GET with GroupJID in JSON body
      // According to WUZAPI API docs: curl -s -X GET -H 'Token: ...' -H 'Content-Type: application/json' --data '{"GroupJID":"...@g.us"}' /group/info
      logger.info('Fetching group name from WUZAPI', { groupJid, wuzapiBaseUrl })
      
      const response = await axios({
        method: 'GET',
        url: `${wuzapiBaseUrl}/group/info`,
        headers: { 
          'Token': userToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: { GroupJID: groupJid },
        timeout: 10000
      })
      
      logger.info('WUZAPI /group/info response', {
        groupJid,
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        responsePreview: JSON.stringify(response.data).substring(0, 300)
      })
      
      if (response.data && response.data.data && response.data.data.Name) {
        const groupName = response.data.data.Name
        
        // Validate that the returned name is not invalid
        if (!isInvalidGroupName(groupName)) {
          logger.info('Group name fetched from WUZAPI', {
            groupJid,
            groupName
          })
          return groupName
        }
        
        logger.warn('WUZAPI returned invalid group name', { 
          groupJid,
          returnedName: groupName
        })
      }
      
      // Fallback to formatted name if no valid name found
      logger.warn('Group name not found in WUZAPI response', { 
        groupJid,
        responseData: JSON.stringify(response.data).substring(0, 200)
      })
      return this.formatFallbackGroupName(groupJid)
    } catch (error) {
      logger.error('Failed to fetch group name from WUZAPI', {
        groupJid,
        error: error.message,
        status: error.response?.status
      })
      // Fallback to formatted name
      return this.formatFallbackGroupName(groupJid)
    }
  }
}

module.exports = ChatMessageHandler
