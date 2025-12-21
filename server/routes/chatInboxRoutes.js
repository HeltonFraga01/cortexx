/**
 * Chat Inbox Routes
 * 
 * Handles conversation management, message retrieval, labels, and canned responses
 * for the chat interface.
 */

const express = require('express')
const axios = require('axios')
const router = express.Router()
const { logger } = require('../utils/logger')
const ChatService = require('../services/ChatService')
const QuotaService = require('../services/QuotaService')
const { validatePhoneWithAPI } = require('../services/PhoneValidationService')
const supabaseService = require('../services/SupabaseService')

// Middleware to verify user token
const verifyUserToken = async (req, res, next) => {
  let userToken = null
  
  const authHeader = req.headers.authorization
  const tokenHeader = req.headers.token
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7)
  } else if (tokenHeader) {
    userToken = tokenHeader
  } else if (req.session?.userToken) {
    userToken = req.session.userToken
  }
  
  if (!userToken) {
    return res.status(401).json({
      success: false,
      error: 'Token não fornecido',
      message: 'Header Authorization com Bearer token, header token ou sessão ativa é obrigatório'
    })
  }
  
  req.userToken = userToken
  next()
}

// ==================== Conversation Routes ====================

/**
 * GET /api/chat/inbox/conversations
 * List conversations with filtering and pagination
 * Requirements: 10.1, 10.2
 */
router.get('/conversations', verifyUserToken, async (req, res) => {
  try {
    const { status, hasUnread, assignedBotId, labelId, search, inboxId, limit = 50, offset = 0 } = req.query
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    const filters = {}
    if (status) filters.status = status
    if (hasUnread === 'true') filters.hasUnread = true
    if (assignedBotId) filters.assignedBotId = assignedBotId
    if (labelId) filters.labelId = labelId
    if (search) filters.search = search
    if (inboxId) filters.inboxId = parseInt(inboxId, 10)

    const result = await chatService.getConversations(req.userToken, filters, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    })

    res.json({
      success: true,
      data: result.conversations,
      pagination: {
        total: result.total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: result.total > parseInt(offset, 10) + result.conversations.length
      }
    })
  } catch (error) {
    logger.error('Error fetching conversations', { error: error.message, userToken: req.userToken?.substring(0, 8) })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/start
 * Start or get existing conversation with a phone number
 */
router.post('/conversations/start', verifyUserToken, async (req, res) => {
  try {
    const { phone, name, avatarUrl } = req.body
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    // Normalize phone number - remove non-digits and ensure it has country code
    let normalizedPhone = phone.replace(/\D/g, '')
    
    // Create JID format for WhatsApp
    const contactJid = `${normalizedPhone}@s.whatsapp.net`

    const chatService = new ChatService()
    const conversation = await chatService.getOrCreateConversation(
      req.userToken,
      contactJid,
      { name, avatarUrl }
    )

    logger.info('Conversation started/retrieved', { 
      userToken: req.userToken?.substring(0, 8),
      phone: normalizedPhone,
      conversationId: conversation.id
    })

    res.json({ success: true, data: conversation })
  } catch (error) {
    logger.error('Error starting conversation', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/conversations/:id
 * Get single conversation with labels
 */
router.get('/conversations/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    res.json({ success: true, data: conversation })
  } catch (error) {
    logger.error('Error fetching conversation', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/chat/inbox/conversations/:id
 * Update conversation (status, assigned bot, etc.)
 */
router.patch('/conversations/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { status, assignedBotId, isMuted } = req.body
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    const updates = {}
    if (status) updates.status = status
    if (assignedBotId !== undefined) updates.assignedBotId = assignedBotId
    if (isMuted !== undefined) updates.isMuted = isMuted

    const conversation = await chatService.updateConversation(req.userToken, id, updates)

    // Broadcast update via WebSocket
    const chatHandler = req.app.locals.chatHandler
    if (chatHandler && typeof chatHandler.broadcastConversationUpdate === 'function') {
      try {
        chatHandler.broadcastConversationUpdate(conversation)
        logger.debug('WebSocket conversation update broadcast sent', { conversationId: id })
      } catch (wsError) {
        logger.warn('WebSocket broadcast failed for conversation update', {
          error: wsError.message,
          conversationId: id,
          userToken: req.userToken?.substring(0, 8)
        })
      }
    } else {
      logger.warn('WebSocket handler unavailable for conversation update broadcast', {
        conversationId: id,
        hasHandler: !!chatHandler,
        hasMethod: chatHandler ? typeof chatHandler.broadcastConversationUpdate === 'function' : false
      })
    }

    res.json({ success: true, data: conversation })
  } catch (error) {
    logger.error('Error updating conversation', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/conversations
 * Delete ALL conversations for the authenticated user
 */
router.delete('/conversations', verifyUserToken, async (req, res) => {
  try {
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const result = await chatService.deleteAllConversations(req.userToken, req.userToken)

    res.json({ success: true, message: `${result.deleted} conversas excluídas com sucesso`, deleted: result.deleted })
  } catch (error) {
    logger.error('Error deleting all conversations', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/conversations/:id
 * Delete conversation and all its messages from local database
 */
router.delete('/conversations/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.deleteConversation(req.userToken, id, req.userToken)

    res.json({ success: true, message: 'Conversa excluída com sucesso' })
  } catch (error) {
    logger.error('Error deleting conversation', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/conversations
 * Delete ALL conversations for the authenticated user
 */
router.delete('/conversations', verifyUserToken, async (req, res) => {
  try {
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const result = await chatService.deleteAllConversations(req.userToken, req.userToken)

    res.json({ 
      success: true, 
      message: `${result.deleted} conversas excluídas com sucesso`,
      deleted: result.deleted
    })
  } catch (error) {
    logger.error('Error deleting all conversations', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/:id/read
 * Mark conversation as read
 */
router.post('/conversations/:id/read', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.markConversationAsRead(req.userToken, id)

    res.json({ success: true, message: 'Conversation marked as read' })
  } catch (error) {
    logger.error('Error marking conversation as read', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Avatar Routes ====================

/**
 * GET /api/chat/inbox/avatar/:phone
 * Get contact avatar/profile picture from WUZAPI
 * 
 * WUZAPI endpoint: POST /user/avatar with JSON body (Phone, Preview)
 */
router.get('/avatar/:phone', verifyUserToken, async (req, res) => {
  try {
    const { phone } = req.params
    const { preview = 'true' } = req.query
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' })
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '')
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    try {
      // WUZAPI uses POST for avatar endpoint
      const response = await axios({
        method: 'POST',
        url: `${wuzapiBaseUrl}/user/avatar`,
        headers: {
          'token': req.userToken,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        data: {
          Phone: cleanPhone,
          Preview: preview === 'true'
        },
        timeout: 10000
      })
      
      // Handle response - WUZAPI may return data directly or nested
      const avatarData = response.data?.data || response.data
      
      if (avatarData && (avatarData.URL || avatarData.url)) {
        const avatarUrl = avatarData.URL || avatarData.url
        
        // Update conversation avatar if we have one
        // Using SupabaseService directly
        if (db) {
          const contactJid = `${cleanPhone}@s.whatsapp.net`
          await db.query(
            'UPDATE conversations SET contact_avatar_url = ? WHERE user_id = ? AND contact_jid = ?',
            [avatarUrl, req.userToken, contactJid]
          )
        }
        
        res.json({
          success: true,
          data: {
            url: avatarUrl,
            id: avatarData.ID || avatarData.id || '',
            type: avatarData.Type || avatarData.type || (preview === 'true' ? 'preview' : 'full'),
            directPath: avatarData.DirectPath || avatarData.directPath || ''
          }
        })
      } else {
        res.json({
          success: true,
          data: null,
          message: 'No avatar available for this contact'
        })
      }
    } catch (wuzapiError) {
      // Handle all WUZAPI errors gracefully - don't propagate 500 errors
      // WUZAPI may return 404, 500, or other errors for contacts without avatars
      logger.warn('WUZAPI avatar request failed', {
        phone: cleanPhone,
        status: wuzapiError.response?.status,
        error: wuzapiError.message
      })
      
      // Return success with null data instead of propagating error
      return res.json({
        success: true,
        data: null,
        message: 'Avatar not available'
      })
    }
  } catch (error) {
    logger.error('Error fetching avatar', { error: error.message, phone: req.params.phone })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/:id/fetch-avatar
 * Fetch and update avatar for a conversation's contact
 */
router.post('/conversations/:id/fetch-avatar', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Extract phone from JID (use camelCase since transformConversation returns camelCase)
    // Also check for snake_case version since raw DB data might use contact_jid
    const contactJid = conversation.contactJid || conversation.contact_jid
    
    if (!contactJid) {
      return res.status(400).json({ success: false, error: 'Contact JID not found in conversation' })
    }
    
    // Skip special JIDs that don't have avatars
    if (contactJid.includes('status@') || 
        contactJid.includes('@newsletter') || 
        contactJid.includes('@broadcast')) {
      return res.json({
        success: true,
        data: null,
        message: 'Special JID - no avatar available'
      })
    }
    
    // For groups, use the full JID; for contacts, extract phone number
    const phone = contactJid.includes('@g.us') 
      ? contactJid 
      : contactJid.replace('@s.whatsapp.net', '')
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    try {
      // WUZAPI uses POST for avatar endpoint
      const response = await axios({
        method: 'POST',
        url: `${wuzapiBaseUrl}/user/avatar`,
        headers: {
          'token': req.userToken,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        data: {
          Phone: phone,
          Preview: true
        },
        timeout: 10000
      })
      
      // Handle response - WUZAPI may return data directly or nested
      const avatarData = response.data?.data || response.data
      const avatarUrl = avatarData?.URL || avatarData?.url
      
      if (avatarUrl) {
        // Update conversation avatar
        await db.query(
          'UPDATE conversations SET contact_avatar_url = ? WHERE id = ?',
          [avatarUrl, id]
        )
        
        logger.info('Avatar fetched and saved', { conversationId: id, phone, hasUrl: true })
        
        res.json({
          success: true,
          data: {
            avatarUrl: avatarUrl,
            conversationId: id
          }
        })
      } else {
        res.json({
          success: true,
          data: null,
          message: 'No avatar available for this contact'
        })
      }
    } catch (wuzapiError) {
      // Handle all WUZAPI errors gracefully - don't propagate 500 errors
      // WUZAPI may return 404, 500, or other errors for contacts without avatars
      logger.warn('WUZAPI avatar request failed for conversation', {
        conversationId: id,
        phone,
        status: wuzapiError.response?.status,
        error: wuzapiError.message
      })
      
      // Return success with null data instead of propagating error
      return res.json({
        success: true,
        data: null,
        message: 'Avatar not available'
      })
    }
  } catch (error) {
    logger.error('Error fetching conversation avatar', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/:id/refresh-group-name
 * Fetch and update group name from WUZAPI for group conversations
 */
router.post('/conversations/:id/refresh-group-name', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    const contactJid = conversation.contactJid || conversation.contact_jid
    
    // Only works for group JIDs
    if (!contactJid || !contactJid.endsWith('@g.us')) {
      return res.json({
        success: true,
        data: null,
        message: 'Not a group conversation'
      })
    }
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    try {
      // WUZAPI /group/info uses GET with GroupJID in JSON body
      // According to WUZAPI API docs: curl -s -X GET -H 'Token: ...' -H 'Content-Type: application/json' --data '{"GroupJID":"...@g.us"}' /group/info
      const response = await axios({
        method: 'GET',
        url: `${wuzapiBaseUrl}/group/info`,
        headers: {
          'Token': req.userToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: { GroupJID: contactJid },
        timeout: 10000
      })
      
      const groupData = response.data?.data || response.data
      const groupName = groupData?.Name
      
      if (groupName) {
        // Update conversation name
        await db.query(
          'UPDATE conversations SET contact_name = ? WHERE id = ?',
          [groupName, id]
        )
        
        logger.info('Group name fetched and saved', { 
          conversationId: id, 
          groupJid: contactJid, 
          groupName 
        })
        
        res.json({
          success: true,
          data: {
            groupName: groupName,
            conversationId: id
          }
        })
      } else {
        res.json({
          success: true,
          data: null,
          message: 'Group name not available'
        })
      }
    } catch (wuzapiError) {
      logger.warn('WUZAPI group info request failed', {
        conversationId: id,
        groupJid: contactJid,
        status: wuzapiError.response?.status,
        error: wuzapiError.message
      })
      
      return res.json({
        success: true,
        data: null,
        message: 'Group info not available'
      })
    }
  } catch (error) {
    logger.error('Error fetching group name', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Message Routes ====================

/**
 * GET /api/chat/inbox/conversations/:id/messages
 * Get messages for a conversation with pagination
 */
router.get('/conversations/:id/messages', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 50, before, after } = req.query
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    // ID is a UUID string, not an integer
    const conversationId = id
    const result = await chatService.getMessages(conversationId, req.userToken, {
      limit: parseInt(limit, 10),
      before: before
    })

    res.json({
      success: true,
      data: {
        messages: result.messages,
        pagination: {
          hasMore: result.hasMore || false,
          oldestTimestamp: result.oldestTimestamp,
          newestTimestamp: result.newestTimestamp
        }
      }
    })
  } catch (error) {
    logger.error('Error fetching messages', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/:id/messages
 * Send a new message in a conversation
 */
router.post('/conversations/:id/messages', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { content, messageType = 'text', mediaUrl, mediaFilename, mediaMimeType, replyToMessageId } = req.body
    
    if (!content && messageType === 'text') {
      return res.status(400).json({ success: false, error: 'Content is required for text messages' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Get conversation to get the contact JID
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Get contactJid (check both camelCase and snake_case)
    const contactJid = conversation.contactJid || conversation.contact_jid
    if (!contactJid) {
      return res.status(400).json({ success: false, error: 'Contact JID not found in conversation' })
    }

    // Detectar se é um grupo (JID termina com @g.us)
    const isGroup = contactJid.endsWith('@g.us')
    
    // Extract phone number from JID (remove @s.whatsapp.net) or use JID for groups
    const phone = isGroup 
      ? contactJid 
      : contactJid.replace('@s.whatsapp.net', '')
    
    // Generate a unique message ID
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    // Create message with pending status
    const message = await chatService.createMessage(req.userToken, id, {
      direction: 'outgoing',
      messageType,
      content,
      mediaUrl,
      mediaFilename,
      mediaMimeType,
      replyToMessageId,
      status: 'pending'
    })

    // Broadcast new message via WebSocket
    const chatHandler = req.app.locals.chatHandler
    if (chatHandler && typeof chatHandler.broadcastNewMessage === 'function') {
      try {
        chatHandler.broadcastNewMessage(id, message)
        logger.debug('WebSocket new message broadcast sent', { conversationId: id, messageId: message.id })
      } catch (wsError) {
        logger.warn('WebSocket broadcast failed for new message', {
          error: wsError.message,
          conversationId: id,
          messageId: message.id,
          userToken: req.userToken?.substring(0, 8)
        })
      }
    } else {
      logger.warn('WebSocket handler unavailable for new message broadcast', {
        conversationId: id,
        messageId: message.id,
        hasHandler: !!chatHandler,
        hasMethod: chatHandler ? typeof chatHandler.broadcastNewMessage === 'function' : false
      })
    }

    let validatedPhone
    
    if (isGroup) {
      // Para grupos, usar o JID diretamente (não precisa validar com /user/check)
      validatedPhone = contactJid
      
      logger.info('Sending message to group', {
        groupJid: validatedPhone,
        conversationId: id
      })
    } else {
      // Validate phone number using WUZAPI API (same as working chatRoutes.js)
      const phoneValidation = await validatePhoneWithAPI(phone, req.userToken)
      
      if (!phoneValidation.isValid) {
        logger.warn('Invalid phone number for chat message', {
          original: phone,
          error: phoneValidation.error,
          conversationId: id
        })
        
        // Update message status to failed
        await supabaseService.update('chat_messages', message.id, { status: 'failed' })
        message.status = 'failed'
        
        return res.status(400).json({
          success: false,
          error: 'Invalid Phone Number',
          message: phoneValidation.error,
          data: message
        })
      }
      
      // Use validated phone number
      validatedPhone = phoneValidation.validatedPhone
      
      logger.debug('Phone validated for chat message', {
        original: phone,
        validated: validatedPhone,
        jid: phoneValidation.jid
      })
    }

    // Send via WUZAPI using axios directly (same pattern as working chatRoutes.js)
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    let wuzapiResponse
    let wuzapiSuccess = false
    
    try {
      if (messageType === 'text') {
        const payload = {
          Phone: validatedPhone,
          Body: content,
          Id: messageId
        }
        
        // Add reply context if replying to a message
        if (replyToMessageId) {
          payload.ContextInfo = {
            StanzaId: replyToMessageId,
            Participant: contactJid
          }
        }
        
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, payload, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        wuzapiSuccess = true
      } else if (messageType === 'image' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
          Phone: validatedPhone,
          Image: mediaUrl,
          Caption: content || ''
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        })
        wuzapiSuccess = true
      } else if (messageType === 'document' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/document`, {
          Phone: validatedPhone,
          Document: mediaUrl,
          FileName: req.body.mediaFilename || 'document'
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        })
        wuzapiSuccess = true
      } else if (messageType === 'audio' && mediaUrl) {
        // WUZAPI expects: data:audio/ogg;base64,<base64data>
        // Audio must be in Opus codec inside OGG container
        // DO NOT include "codecs=opus" in the data URL - WUZAPI doesn't expect it
        let audioData = mediaUrl
        
        if (!audioData.startsWith('data:')) {
          // If it's just base64, add the proper prefix (without codecs=opus)
          audioData = `data:audio/ogg;base64,${audioData}`
        } else {
          // Normalize any existing data URL to the format WUZAPI expects
          // Remove codecs=opus if present, and ensure correct format
          audioData = audioData.replace(/data:audio\/ogg;\s*codecs=opus;base64,/i, 'data:audio/ogg;base64,')
          audioData = audioData.replace(/data:audio\/webm;codecs=opus;base64,/i, 'data:audio/ogg;base64,')
          audioData = audioData.replace(/data:audio\/webm;base64,/i, 'data:audio/ogg;base64,')
        }
        
        logger.debug('Sending audio to WUZAPI', {
          phone: validatedPhone,
          audioPrefix: audioData.substring(0, 50),
          audioLength: audioData.length
        })
        
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/audio`, {
          Phone: validatedPhone,
          Audio: audioData
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        })
        wuzapiSuccess = true
      } else if (messageType === 'video' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/video`, {
          Phone: validatedPhone,
          Video: mediaUrl,
          Caption: content || ''
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        })
        wuzapiSuccess = true
      } else if (messageType === 'location') {
        const locationData = JSON.parse(content)
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/location`, {
          Phone: validatedPhone,
          Latitude: locationData.latitude,
          Longitude: locationData.longitude,
          Name: locationData.name || ''
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        wuzapiSuccess = true
      } else if (messageType === 'contact') {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/contact`, {
          Phone: validatedPhone,
          Vcard: content,
          Name: req.body.contactName || 'Contact'
        }, {
          headers: {
            'token': req.userToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        wuzapiSuccess = true
      }
    } catch (wuzapiError) {
      logger.error('WUZAPI request failed', {
        conversationId: id,
        phone: validatedPhone,
        messageType,
        error: wuzapiError.message,
        status: wuzapiError.response?.status
      })
      wuzapiSuccess = false
    }

    // Update message status based on WUZAPI response
    const newStatus = wuzapiSuccess ? 'sent' : 'failed'
    
    // Update message status in database
    await supabaseService.update('chat_messages', message.id, { status: newStatus })
    
    // Update the message object to return
    message.status = newStatus
    
    if (!wuzapiSuccess) {
      logger.error('WUZAPI message send failed', { 
        conversationId: id, 
        phone: validatedPhone 
      })
    } else {
      logger.info('Message sent via WUZAPI', { 
        conversationId: id, 
        messageId: wuzapiResponse?.data?.Id,
        phone: validatedPhone 
      })

      // Track message quota usage for multi-tenant architecture
      // Requirements: 12.4 - Increment account's message quota on send
      try {
        const chatService = new ChatService()
        const accountId = await chatService.getAccountIdFromToken(req.userToken)
        
        if (accountId) {
          // Get account owner user ID for quota tracking
          const { data: account, error: accountError } = await supabaseService.getById('accounts', accountId)
          
          if (!accountError && account?.owner_user_id) {
            // Get db from app.locals for QuotaService
            const db = req.app?.locals?.db;
            if (db) {
              const quotaService = new QuotaService(db)
              
              // Increment daily and monthly message quotas
              await quotaService.incrementUsage(account.owner_user_id, 'max_messages_per_day', 1)
              await quotaService.incrementUsage(account.owner_user_id, 'max_messages_per_month', 1)
              
              logger.debug('Message quota incremented', {
                accountId,
                ownerId: account.owner_user_id,
                conversationId: id
              })
            } else {
              logger.warn('Database not available for quota tracking', { accountId })
            }
          } else {
            logger.warn('Could not find account owner for quota tracking', { accountId })
          }
        } else {
          logger.warn('Could not resolve account ID from token for quota tracking', { 
            tokenPrefix: req.userToken?.substring(0, 8) 
          })
        }
      } catch (quotaError) {
        // Don't fail the message send if quota tracking fails
        logger.error('Failed to track message quota', { 
          error: quotaError.message,
          conversationId: id 
        })
      }
    }

    res.status(201).json({ success: true, data: message })
  } catch (error) {
    logger.error('Error sending message', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})


// ==================== Label Routes ====================

/**
 * GET /api/chat/inbox/labels
 * Get all labels for the user
 */
router.get('/labels', verifyUserToken, async (req, res) => {
  try {
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const labels = await chatService.getLabels(req.userToken)

    res.json({ success: true, data: labels })
  } catch (error) {
    logger.error('Error fetching labels', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/labels
 * Create a new label
 */
router.post('/labels', verifyUserToken, async (req, res) => {
  try {
    const { name, color } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const label = await chatService.createLabel(req.userToken, { name, color })

    res.status(201).json({ success: true, data: label })
  } catch (error) {
    logger.error('Error creating label', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/chat/inbox/labels/:id
 * Update a label
 */
router.put('/labels/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { name, color } = req.body

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const label = await chatService.updateLabel(req.userToken, id, { name, color })

    res.json({ success: true, data: label })
  } catch (error) {
    logger.error('Error updating label', { error: error.message, labelId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/labels/:id
 * Delete a label
 */
router.delete('/labels/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.deleteLabel(req.userToken, id)

    res.json({ success: true, message: 'Label deleted' })
  } catch (error) {
    logger.error('Error deleting label', { error: error.message, labelId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/conversations/:id/labels
 * Assign a label to a conversation
 */
router.post('/conversations/:id/labels', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { labelId } = req.body
    
    if (!labelId) {
      return res.status(400).json({ success: false, error: 'labelId is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.assignLabel(req.userToken, id, labelId)

    res.json({ success: true, message: 'Label assigned' })
  } catch (error) {
    logger.error('Error assigning label', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/conversations/:id/labels/:labelId
 * Remove a label from a conversation
 */
router.delete('/conversations/:id/labels/:labelId', verifyUserToken, async (req, res) => {
  try {
    const { id, labelId } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.removeLabel(req.userToken, id, labelId)

    res.json({ success: true, message: 'Label removed' })
  } catch (error) {
    logger.error('Error removing label', { error: error.message, conversationId: req.params.id, labelId: req.params.labelId })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Canned Response Routes ====================

/**
 * GET /api/chat/inbox/canned-responses
 * Get all canned responses for the user
 */
router.get('/canned-responses', verifyUserToken, async (req, res) => {
  try {
    const { search } = req.query

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const responses = await chatService.getCannedResponses(req.userToken, { search })

    res.json({ success: true, data: responses })
  } catch (error) {
    logger.error('Error fetching canned responses', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/canned-responses
 * Create a new canned response
 */
router.post('/canned-responses', verifyUserToken, async (req, res) => {
  try {
    const { shortcut, content } = req.body
    
    if (!shortcut || !content) {
      return res.status(400).json({ success: false, error: 'Shortcut and content are required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const response = await chatService.createCannedResponse(req.userToken, { shortcut, content })

    res.status(201).json({ success: true, data: response })
  } catch (error) {
    logger.error('Error creating canned response', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/chat/inbox/canned-responses/:id
 * Update a canned response
 */
router.put('/canned-responses/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { shortcut, content } = req.body

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const response = await chatService.updateCannedResponse(req.userToken, id, { shortcut, content })

    res.json({ success: true, data: response })
  } catch (error) {
    logger.error('Error updating canned response', { error: error.message, responseId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/canned-responses/:id
 * Delete a canned response
 */
router.delete('/canned-responses/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    await chatService.deleteCannedResponse(req.userToken, id)

    res.json({ success: true, message: 'Canned response deleted' })
  } catch (error) {
    logger.error('Error deleting canned response', { error: error.message, responseId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Private Notes Routes ====================

/**
 * POST /api/chat/inbox/conversations/:id/notes
 * Add a private note to a conversation
 */
router.post('/conversations/:id/notes', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Use token directly as userId (no local users table)
    const note = await chatService.addPrivateNote(req.userToken, id, content)

    res.status(201).json({ success: true, data: note })
  } catch (error) {
    logger.error('Error adding private note', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/conversations/:id/notes
 * Get private notes for a conversation
 */
router.get('/conversations/:id/notes', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Use token directly as userId (no local users table)
    const notes = await chatService.getPrivateNotes(id, req.userToken)

    res.json({ success: true, data: notes })
  } catch (error) {
    logger.error('Error fetching private notes', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Bot Assignment Routes ====================

/**
 * POST /api/chat/inbox/conversations/:id/assign-bot
 * Assign or remove a bot from a conversation
 */
router.post('/conversations/:id/assign-bot', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { botId } = req.body

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Update conversation with bot assignment
    const conversation = await chatService.updateConversation(req.userToken, id, {
      assignedBotId: botId || null
    })

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Broadcast update via WebSocket
    const chatHandler = req.app.locals.chatHandler
    if (chatHandler && typeof chatHandler.broadcastConversationUpdate === 'function') {
      try {
        chatHandler.broadcastConversationUpdate(conversation)
        logger.debug('WebSocket conversation update broadcast sent for bot assignment', { conversationId: id })
      } catch (wsError) {
        logger.warn('WebSocket broadcast failed for bot assignment', {
          error: wsError.message,
          conversationId: id,
          userToken: req.userToken?.substring(0, 8)
        })
      }
    } else {
      logger.warn('WebSocket handler unavailable for bot assignment broadcast', {
        conversationId: id,
        hasHandler: !!chatHandler,
        hasMethod: chatHandler ? typeof chatHandler.broadcastConversationUpdate === 'function' : false
      })
    }

    res.json({ success: true, data: conversation })
  } catch (error) {
    logger.error('Error assigning bot', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Reaction Routes ====================

/**
 * POST /api/chat/inbox/messages/:messageId/react
 * Add or toggle a reaction on a message
 */
router.post('/messages/:messageId/react', verifyUserToken, async (req, res) => {
  try {
    const { messageId } = req.params
    const { emoji } = req.body
    
    if (!emoji) {
      return res.status(400).json({ success: false, error: 'Emoji is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Use token directly as userId (no local users table)
    const reaction = await chatService.addReaction(
      req.userToken, 
      parseInt(messageId, 10), 
      emoji, 
      req.userToken
    )

    // Broadcast reaction via WebSocket
    const chatHandler = req.app.locals.chatHandler
    if (chatHandler && !reaction.removed && typeof chatHandler.broadcastReaction === 'function') {
      try {
        chatHandler.broadcastReaction(reaction)
        logger.debug('WebSocket reaction broadcast sent', { messageId, emoji })
      } catch (wsError) {
        logger.warn('WebSocket broadcast failed for reaction', {
          error: wsError.message,
          messageId,
          emoji,
          userToken: req.userToken?.substring(0, 8)
        })
      }
    } else {
      logger.warn('WebSocket handler unavailable for reaction broadcast', {
        messageId,
        emoji,
        reactionRemoved: reaction.removed,
        hasHandler: !!chatHandler,
        hasMethod: chatHandler ? typeof chatHandler.broadcastReaction === 'function' : false
      })
    }

    res.json({ success: true, data: reaction })
  } catch (error) {
    logger.error('Error adding reaction', { error: error.message, messageId: req.params.messageId })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Search Routes ====================

/**
 * GET /api/chat/inbox/search
 * Search messages across all conversations
 */
router.get('/search', verifyUserToken, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query
    
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const results = await chatService.searchMessages(req.userToken, q, { limit: parseInt(limit, 10) })

    res.json({ success: true, data: results })
  } catch (error) {
    logger.error('Error searching messages', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/conversations/search
 * Search conversations by contact name or phone
 */
router.get('/conversations/search', verifyUserToken, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query
    
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Use token directly as userId (no local users table)
    const results = await chatService.searchConversations(req.userToken, q, { limit: parseInt(limit, 10) })

    res.json({ success: true, data: results })
  } catch (error) {
    logger.error('Error searching conversations', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/conversations/:id/messages/search
 * Search messages within a specific conversation
 */
router.get('/conversations/:id/messages/search', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { q, limit = 50 } = req.query
    
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    
    // Use token directly as userId (no local users table)
    // Note: This calls the class method searchMessages(conversationId, userId, query, options)
    const results = await chatService.searchMessagesInConversation(
      id, 
      req.userToken, 
      q, 
      { limit: parseInt(limit, 10) }
    )

    res.json({ success: true, data: results })
  } catch (error) {
    logger.error('Error searching messages in conversation', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Webhook Configuration Routes ====================

/**
 * GET /api/chat/inbox/webhook/status
 * Get current webhook configuration status from WUZAPI
 */
router.get('/webhook/status', verifyUserToken, async (req, res) => {
  try {
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    const response = await axios.get(`${wuzapiBaseUrl}/webhook`, {
      headers: {
        'token': req.userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })
    
    const webhookData = response.data?.data || response.data
    
    res.json({
      success: true,
      data: {
        webhook: webhookData.webhook || '',
        events: webhookData.events || [],
        subscribe: webhookData.subscribe || [],
        isConfigured: !!webhookData.webhook
      }
    })
  } catch (error) {
    logger.error('Error fetching webhook status', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/webhook/configure
 * Configure webhook to receive messages for chat inbox
 * 
 * WUZAPI API:
 * - POST /webhook: Sets webhook (webhook, events)
 * - PUT /webhook: Updates webhook (webhook, events, Active)
 */
router.post('/webhook/configure', verifyUserToken, async (req, res) => {
  try {
    const { webhookUrl } = req.body
    
    // Debug log - what URL was received from frontend
    logger.info('Webhook configure request received', {
      receivedUrl: webhookUrl,
      envWebhookBaseUrl: process.env.WEBHOOK_BASE_URL,
      envViteApiBaseUrl: process.env.VITE_API_BASE_URL
    })
    
    // Use provided URL or construct from environment
    const baseUrl = webhookUrl || process.env.WEBHOOK_BASE_URL || process.env.VITE_API_BASE_URL
    
    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL is required. Set WEBHOOK_BASE_URL environment variable or provide webhookUrl in request body.'
      })
    }
    
    // Construct the full webhook URL
    // Ensure we don't double-add the path if it's already there
    let fullWebhookUrl = baseUrl
    if (!baseUrl.endsWith('/api/webhook/events')) {
      fullWebhookUrl = `${baseUrl}/api/webhook/events`
    }
    
    logger.info('Webhook URL constructed', {
      baseUrl,
      fullWebhookUrl
    })
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    // Configure webhook with WUZAPI using POST method
    // WUZAPI POST /webhook expects: WebhookURL (URL), events (array of strings)
    // Note: Field name is WebhookURL (PascalCase), not webhook (lowercase)
    // Using 'All' to subscribe to all 50+ event types
    const response = await axios.post(`${wuzapiBaseUrl}/webhook`, {
      WebhookURL: fullWebhookUrl,
      events: ['All']
    }, {
      headers: {
        'token': req.userToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })
    
    logger.info('Webhook configured for chat inbox', {
      userToken: req.userToken?.substring(0, 8),
      webhookUrl: fullWebhookUrl,
      wuzapiResponse: response.data
    })
    
    res.json({
      success: true,
      data: {
        webhookUrl: fullWebhookUrl,
        response: response.data
      },
      message: 'Webhook configurado com sucesso. Mensagens recebidas serão processadas automaticamente.'
    })
  } catch (error) {
    logger.error('Error configuring webhook', { 
      error: error.message,
      response: error.response?.data 
    })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Message Delete Route ====================

/**
 * DELETE /api/chat/inbox/messages/:messageId
 * Delete a message from the database
 * Requirements: Message deletion for user chat
 */
router.delete('/messages/:messageId', verifyUserToken, async (req, res) => {
  try {
    const { messageId } = req.params
    
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    // Get the message to verify ownership
    const { data: message, error: fetchError } = await supabaseService.getById('chat_messages', messageId)
    
    if (fetchError || !message) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada' })
    }

    // Get the conversation to verify user ownership
    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, message.conversation_id, req.userToken)
    
    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Acesso negado' })
    }

    // Delete the message
    const { error: deleteError } = await supabaseService.delete('chat_messages', messageId)
    
    if (deleteError) {
      logger.error('Error deleting message', { 
        error: deleteError.message, 
        messageId,
        userToken: req.userToken?.substring(0, 8)
      })
      return res.status(500).json({ success: false, error: 'Erro ao excluir mensagem' })
    }

    logger.info('Message deleted', { 
      messageId, 
      conversationId: message.conversation_id,
      userToken: req.userToken?.substring(0, 8)
    })

    // Broadcast message deletion via WebSocket using broadcastMessageUpdate
    const chatHandler = req.app.locals.chatHandler
    if (chatHandler && typeof chatHandler.broadcastMessageUpdate === 'function') {
      try {
        chatHandler.broadcastMessageUpdate(message.conversation_id, {
          id: messageId,
          content: '🚫 Esta mensagem foi apagada',
          is_edited: false,
          is_deleted: true
        })
        logger.debug('WebSocket message deletion broadcast sent', { 
          messageId, 
          conversationId: message.conversation_id 
        })
      } catch (wsError) {
        // Log WebSocket error but don't fail the deletion operation
        logger.warn('WebSocket broadcast failed for message deletion', {
          error: wsError.message,
          messageId,
          conversationId: message.conversation_id,
          userToken: req.userToken?.substring(0, 8)
        })
      }
    } else {
      logger.warn('WebSocket handler unavailable for message deletion broadcast', {
        messageId,
        conversationId: message.conversation_id,
        hasHandler: !!chatHandler,
        hasMethod: chatHandler ? typeof chatHandler.broadcastMessageUpdate === 'function' : false
      })
    }

    res.json({ success: true, message: 'Mensagem excluída com sucesso' })
  } catch (error) {
    logger.error('Error deleting message', { error: error.message, messageId: req.params.messageId })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Media Download Routes ====================

/**
 * GET /api/chat/inbox/messages/:messageId/media
 * Download media for a message using WUZAPI download endpoints
 * 
 * WUZAPI download endpoints require encrypted media parameters:
 * - Url: Full URL to encrypted media (or constructed from directPath)
 * - MediaKey: Base64 encoded media key
 * - Mimetype: MIME type of the media
 * - FileSHA256: Base64 encoded SHA256 hash of decrypted file
 * - FileLength: Size of the decrypted file
 * - FileEncSHA256: Base64 encoded SHA256 hash of encrypted file (optional)
 * 
 * WUZAPI endpoints:
 * - POST /chat/downloadimage - Download image
 * - POST /chat/downloadaudio - Download audio
 * - POST /chat/downloadvideo - Download video
 * - POST /chat/downloaddocument - Download document
 */
router.get('/messages/:messageId/media', verifyUserToken, async (req, res) => {
  try {
    const { messageId } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    // Get message with media metadata
    const { rows } = await db.query(`
      SELECT m.*, c.user_id, c.contact_jid
      FROM chat_messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ? AND c.user_id = ?
    `, [messageId, req.userToken])

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' })
    }

    const message = rows[0]

    // Check if it's a media message
    if (!['image', 'audio', 'video', 'document', 'sticker'].includes(message.message_type)) {
      return res.status(400).json({ success: false, error: 'Message is not a media message' })
    }

    // If we already have a direct URL (cached), return it
    if (message.media_url && message.media_url.startsWith('http')) {
      return res.json({
        success: true,
        data: {
          url: message.media_url,
          mimeType: message.media_mime_type,
          filename: message.media_filename
        }
      })
    }

    // For outgoing messages, media_url contains the original base64 data
    if (message.direction === 'outgoing' && message.media_url) {
      logger.debug('Outgoing message media found', {
        messageId,
        hasMediaUrl: !!message.media_url,
        mediaUrlLength: message.media_url?.length,
        startsWithData: message.media_url?.startsWith('data:'),
        mediaMimeType: message.media_mime_type
      })
      const mediaUrl = message.media_url
      
      // Check if it's already a data URL
      if (mediaUrl.startsWith('data:')) {
        return res.json({
          success: true,
          data: {
            base64: mediaUrl,
            mimeType: message.media_mime_type || mediaUrl.split(';')[0].split(':')[1],
            filename: message.media_filename
          }
        })
      }
      
      // Check if it's raw base64 (no data: prefix)
      if (mediaUrl.length > 100 && !mediaUrl.startsWith('http') && !mediaUrl.includes('/')) {
        const mimeType = message.media_mime_type || 'application/octet-stream'
        return res.json({
          success: true,
          data: {
            base64: `data:${mimeType};base64,${mediaUrl}`,
            mimeType: mimeType,
            filename: message.media_filename
          }
        })
      }
    } else if (message.direction === 'outgoing') {
      // Outgoing message without media_url - this shouldn't happen for new messages
      logger.warn('Outgoing media message without media_url', {
        messageId,
        messageType: message.message_type,
        hasMediaUrl: !!message.media_url,
        mediaMimeType: message.media_mime_type
      })
    }

    // Parse media metadata
    let mediaMetadata = null
    if (message.media_metadata) {
      try {
        mediaMetadata = typeof message.media_metadata === 'string' 
          ? JSON.parse(message.media_metadata) 
          : message.media_metadata
      } catch (e) {
        logger.warn('Failed to parse media metadata', { messageId, error: e.message })
      }
    }

    // Check if we have the required metadata for WUZAPI download
    if (!mediaMetadata || !mediaMetadata.mediaKey) {
      // Fallback 1: If we have a thumbnail, return that
      if (mediaMetadata?.jpegThumbnail) {
        logger.info('Returning thumbnail as fallback', { messageId })
        return res.json({
          success: true,
          data: {
            thumbnail: mediaMetadata.jpegThumbnail,
            mimeType: 'image/jpeg',
            filename: message.media_filename,
            isThumbnail: true
          }
        })
      }
      
      // Fallback 2: If we have a URL in metadata, try to return it
      if (mediaMetadata?.url) {
        logger.info('Returning media URL from metadata (no mediaKey)', {
          messageId,
          messageType: message.message_type
        })
        return res.json({
          success: true,
          data: {
            url: mediaMetadata.url,
            mimeType: mediaMetadata.mimetype || message.media_mime_type,
            filename: message.media_filename
          }
        })
      }
      
      // Fallback 2b: If we have directPath, construct URL
      if (mediaMetadata?.directPath) {
        const constructedUrl = `https://mmg.whatsapp.net${mediaMetadata.directPath}`
        logger.info('Returning constructed media URL from directPath', {
          messageId,
          messageType: message.message_type
        })
        return res.json({
          success: true,
          data: {
            url: constructedUrl,
            mimeType: mediaMetadata.mimetype || message.media_mime_type,
            filename: message.media_filename
          }
        })
      }
      
      // Fallback 3: If message has media_url stored directly, return it
      // This handles S3 URLs or other cached media
      if (message.media_url && message.media_url.startsWith('http')) {
        logger.info('Returning cached media URL from message', {
          messageId,
          messageType: message.message_type,
          isS3: message.media_url.includes('s3.')
        })
        return res.json({
          success: true,
          data: {
            url: message.media_url,
            mimeType: message.media_mime_type,
            filename: message.media_filename
          }
        })
      }
      
      logger.warn('No media metadata available for download', {
        messageId,
        messageType: message.message_type,
        hasMetadata: !!mediaMetadata,
        metadataKeys: mediaMetadata ? Object.keys(mediaMetadata) : [],
        hasMediaUrl: !!message.media_url,
        mediaUrlType: message.media_url?.substring(0, 50)
      })
      
      // Final fallback: Return a placeholder response so frontend doesn't show error
      // This allows the UI to gracefully handle old messages without metadata
      return res.json({
        success: true,
        data: {
          error: 'Media metadata not available',
          message: 'This message was received before media metadata was being saved. The media may not be available for download.'
        }
      })
    }

    // Try to download from WUZAPI using the appropriate endpoint
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    // Map message type to WUZAPI endpoint
    const endpointMap = {
      'image': '/chat/downloadimage',
      'audio': '/chat/downloadaudio',
      'video': '/chat/downloadvideo',
      'document': '/chat/downloaddocument',
      'sticker': '/chat/downloadimage' // Stickers use image endpoint
    }

    const endpoint = endpointMap[message.message_type]
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Unsupported media type' })
    }

    // Build download request payload with encrypted media parameters
    // WUZAPI requires: Url, MediaKey, Mimetype, FileSHA256, FileLength
    // If url is null but directPath exists, construct the URL
    let mediaUrl = mediaMetadata.url
    if (!mediaUrl && mediaMetadata.directPath) {
      // WhatsApp media CDN base URL
      mediaUrl = `https://mmg.whatsapp.net${mediaMetadata.directPath}`
    }

    const downloadPayload = {
      Url: mediaUrl,
      MediaKey: mediaMetadata.mediaKey,
      Mimetype: mediaMetadata.mimetype || message.media_mime_type,
      FileSHA256: mediaMetadata.fileSha256,
      FileLength: mediaMetadata.fileLength,
      FileEncSHA256: mediaMetadata.fileEncSha256
    }

    logger.info('Downloading media from WUZAPI', {
      messageId,
      messageType: message.message_type,
      endpoint,
      hasUrl: !!downloadPayload.Url,
      hasMediaKey: !!downloadPayload.MediaKey,
      fileLength: downloadPayload.FileLength
    })

    try {
      const response = await axios.post(`${wuzapiBaseUrl}${endpoint}`, downloadPayload, {
        headers: {
          'token': req.userToken,
          'Content-Type': 'application/json'
        },
        timeout: 60000, // 60 seconds for media download
        responseType: 'json'
      })

      // WUZAPI returns the media data as base64
      if (response.data && response.data.success !== false) {
        // Check if response contains base64 data
        const mediaData = response.data.Data || response.data.data
        
        if (mediaData) {
          const mimeType = mediaMetadata.mimetype || message.media_mime_type || 'application/octet-stream'
          
          // Handle different response formats
          let base64Data
          if (typeof mediaData === 'string') {
            // String - check if already has data: prefix
            base64Data = mediaData.startsWith('data:') ? mediaData : `data:${mimeType};base64,${mediaData}`
          } else if (Buffer.isBuffer(mediaData)) {
            // Buffer - convert to base64
            base64Data = `data:${mimeType};base64,${mediaData.toString('base64')}`
          } else if (typeof mediaData === 'object') {
            // Object - might have nested data
            const nestedData = mediaData.Data || mediaData.data || mediaData.base64
            if (nestedData && typeof nestedData === 'string') {
              base64Data = nestedData.startsWith('data:') ? nestedData : `data:${mimeType};base64,${nestedData}`
            }
          }
          
          if (base64Data) {
            logger.info('Media downloaded successfully', { messageId, mimeType })
            
            return res.json({
              success: true,
              data: {
                base64: base64Data,
                mimeType: mimeType,
                filename: message.media_filename
              }
            })
          }
          
          // Log what we received for debugging
          logger.warn('Unexpected media data format', { 
            messageId, 
            dataType: typeof mediaData,
            isBuffer: Buffer.isBuffer(mediaData),
            keys: typeof mediaData === 'object' ? Object.keys(mediaData) : null
          })
        }
      }

      // No data in response
      logger.warn('WUZAPI returned empty media data', { messageId, response: response.data })
      
      return res.status(404).json({
        success: false,
        error: 'Media not available',
        message: 'WUZAPI returned empty response'
      })
    } catch (wuzapiError) {
      logger.error('WUZAPI media download failed', {
        messageId,
        error: wuzapiError.message,
        status: wuzapiError.response?.status,
        data: wuzapiError.response?.data
      })
      
      // Return thumbnail if available as fallback
      if (mediaMetadata?.jpegThumbnail) {
        return res.json({
          success: true,
          data: {
            thumbnail: `data:image/jpeg;base64,${mediaMetadata.jpegThumbnail}`,
            mimeType: 'image/jpeg',
            isThumbnail: true,
            error: 'Full media not available, showing thumbnail'
          }
        })
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to download media',
        details: wuzapiError.response?.data?.message || wuzapiError.message
      })
    }
  } catch (error) {
    logger.error('Error downloading media', { error: error.message, messageId: req.params.messageId })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Contact Attributes Routes ====================

/**
 * GET /api/chat/inbox/contacts/:jid/attributes
 * Get all attributes for a contact
 */
router.get('/contacts/:jid/attributes', verifyUserToken, async (req, res) => {
  try {
    const { jid } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const result = await db.query(
      'SELECT id, name, value, created_at, updated_at FROM contact_attributes WHERE user_id = ? AND contact_jid = ? ORDER BY name ASC',
      [userId, decodeURIComponent(jid)]
    )

    res.json({ success: true, data: result.rows || [] })
  } catch (error) {
    logger.error('Error fetching contact attributes', { error: error.message, jid: req.params.jid })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/contacts/:jid/attributes
 * Create a new attribute for a contact
 */
router.post('/contacts/:jid/attributes', verifyUserToken, async (req, res) => {
  try {
    const { jid } = req.params
    const { name, value } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Attribute name is required' })
    }
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Attribute value is required' })
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, error: 'Attribute name must be 100 characters or less' })
    }
    if (value.length > 1000) {
      return res.status(400).json({ success: false, error: 'Attribute value must be 1000 characters or less' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Check if attribute already exists
    const existing = await db.query(
      'SELECT id FROM contact_attributes WHERE user_id = ? AND contact_jid = ? AND name = ?',
      [userId, decodedJid, name.trim()]
    )
    
    if (existing.rows && existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Attribute with this name already exists' })
    }

    const result = await db.query(
      'INSERT INTO contact_attributes (user_id, contact_jid, name, value) VALUES (?, ?, ?, ?)',
      [userId, decodedJid, name.trim(), value.trim()]
    )

    const newAttribute = {
      id: result.lastInsertRowid,
      name: name.trim(),
      value: value.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    logger.info('Contact attribute created', { userId, jid: decodedJid, name: name.trim() })
    res.status(201).json({ success: true, data: newAttribute })
  } catch (error) {
    logger.error('Error creating contact attribute', { error: error.message, jid: req.params.jid })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/chat/inbox/contacts/:jid/attributes/:id
 * Update an attribute value
 */
router.put('/contacts/:jid/attributes/:id', verifyUserToken, async (req, res) => {
  try {
    const { jid, id } = req.params
    const { value } = req.body
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Attribute value is required' })
    }
    if (value.length > 1000) {
      return res.status(400).json({ success: false, error: 'Attribute value must be 1000 characters or less' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Verify attribute belongs to user
    const existing = await db.query(
      'SELECT id, name FROM contact_attributes WHERE id = ? AND user_id = ? AND contact_jid = ?',
      [id, userId, decodedJid]
    )
    
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    await db.query(
      'UPDATE contact_attributes SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [value.trim(), id]
    )

    const updated = {
      id: id,
      name: existing.rows[0].name,
      value: value.trim(),
      updated_at: new Date().toISOString()
    }

    logger.info('Contact attribute updated', { userId, attributeId: id })
    res.json({ success: true, data: updated })
  } catch (error) {
    logger.error('Error updating contact attribute', { error: error.message, attributeId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/contacts/:jid/attributes/:id
 * Delete an attribute
 */
router.delete('/contacts/:jid/attributes/:id', verifyUserToken, async (req, res) => {
  try {
    const { jid, id } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Verify attribute belongs to user
    const existing = await db.query(
      'SELECT id FROM contact_attributes WHERE id = ? AND user_id = ? AND contact_jid = ?',
      [id, userId, decodedJid]
    )
    
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    await db.query('DELETE FROM contact_attributes WHERE id = ?', [id])

    logger.info('Contact attribute deleted', { userId, attributeId: id })
    res.json({ success: true, message: 'Attribute deleted' })
  } catch (error) {
    logger.error('Error deleting contact attribute', { error: error.message, attributeId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Contact Notes Routes ====================

/**
 * GET /api/chat/inbox/contacts/:jid/notes
 * Get all notes for a contact (reverse chronological order)
 */
router.get('/contacts/:jid/notes', verifyUserToken, async (req, res) => {
  try {
    const { jid } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const result = await db.query(
      'SELECT id, content, created_at FROM contact_notes WHERE user_id = ? AND contact_jid = ? ORDER BY created_at DESC',
      [userId, decodeURIComponent(jid)]
    )

    res.json({ success: true, data: result.rows || [] })
  } catch (error) {
    logger.error('Error fetching contact notes', { error: error.message, jid: req.params.jid })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/contacts/:jid/notes
 * Create a new note for a contact
 */
router.post('/contacts/:jid/notes', verifyUserToken, async (req, res) => {
  try {
    const { jid } = req.params
    const { content } = req.body
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Note content is required' })
    }
    if (content.length > 5000) {
      return res.status(400).json({ success: false, error: 'Note content must be 5000 characters or less' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)

    const result = await db.query(
      'INSERT INTO contact_notes (user_id, contact_jid, content) VALUES (?, ?, ?)',
      [userId, decodedJid, content.trim()]
    )

    const newNote = {
      id: result.lastInsertRowid,
      content: content.trim(),
      created_at: new Date().toISOString()
    }

    logger.info('Contact note created', { userId, jid: decodedJid })
    res.status(201).json({ success: true, data: newNote })
  } catch (error) {
    logger.error('Error creating contact note', { error: error.message, jid: req.params.jid })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/chat/inbox/contacts/:jid/notes/:id
 * Delete a note
 */
router.delete('/contacts/:jid/notes/:id', verifyUserToken, async (req, res) => {
  try {
    const { jid, id } = req.params

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Verify note belongs to user
    const existing = await db.query(
      'SELECT id FROM contact_notes WHERE id = ? AND user_id = ? AND contact_jid = ?',
      [id, userId, decodedJid]
    )
    
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Note not found' })
    }

    await db.query('DELETE FROM contact_notes WHERE id = ?', [id])

    logger.info('Contact note deleted', { userId, noteId: id })
    res.json({ success: true, message: 'Note deleted' })
  } catch (error) {
    logger.error('Error deleting contact note', { error: error.message, noteId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Conversation Info Routes ====================

/**
 * GET /api/chat/inbox/conversations/:id/info
 * Get conversation metadata and statistics
 */
router.get('/conversations/:id/info', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Get message count
    const messageCountResult = await db.query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = ?',
      [id]
    )
    const messageCount = messageCountResult.rows?.[0]?.count || 0

    // Get first and last message timestamps
    const timestampsResult = await db.query(
      'SELECT MIN(timestamp) as first_message, MAX(timestamp) as last_message FROM chat_messages WHERE conversation_id = ?',
      [id]
    )
    const timestamps = timestampsResult.rows?.[0] || {}

    // Calculate duration in minutes
    let durationMinutes = 0
    if (timestamps.first_message && timestamps.last_message) {
      const firstDate = new Date(timestamps.first_message)
      const lastDate = new Date(timestamps.last_message)
      durationMinutes = Math.round((lastDate - firstDate) / (1000 * 60))
    }

    // Get label assignments with timestamps
    const labelsResult = await db.query(
      `SELECT l.id as label_id, l.name as label_name, cl.created_at as assigned_at
       FROM conversation_labels cl
       JOIN labels l ON cl.label_id = l.id
       WHERE cl.conversation_id = ?
       ORDER BY cl.created_at DESC`,
      [id]
    )

    const info = {
      created_at: conversation.createdAt,
      last_activity_at: timestamps.last_message || conversation.updatedAt,
      message_count: messageCount,
      duration_minutes: durationMinutes,
      bot_assigned_at: conversation.assignedBotId ? conversation.updatedAt : null,
      label_assignments: (labelsResult.rows || []).map(row => ({
        label_id: row.label_id,
        label_name: row.label_name,
        assigned_at: row.assigned_at
      }))
    }

    res.json({ success: true, data: info })
  } catch (error) {
    logger.error('Error fetching conversation info', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/contacts/:jid/conversations
 * Get previous conversations with a contact
 */
router.get('/contacts/:jid/conversations', verifyUserToken, async (req, res) => {
  try {
    const { jid } = req.params
    const { excludeId } = req.query
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    let query = `
      SELECT c.id, c.status, c.created_at, c.updated_at, c.last_message_preview,
             (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.user_id = ? AND c.contact_jid = ?
    `
    const params = [userId, decodedJid]
    
    if (excludeId) {
      query += ' AND c.id != ?'
      params.push(excludeId)
    }
    
    query += ' ORDER BY c.created_at DESC LIMIT 20'

    const result = await db.query(query, params)

    const conversations = (result.rows || []).map(row => ({
      id: row.id,
      status: row.status,
      message_count: row.message_count,
      last_message_preview: row.last_message_preview,
      created_at: row.created_at,
      resolved_at: row.status === 'resolved' ? row.updated_at : null
    }))

    res.json({ success: true, data: conversations })
  } catch (error) {
    logger.error('Error fetching previous conversations', { error: error.message, jid: req.params.jid })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Group Participants Routes ====================

/**
 * GET /api/chat/inbox/conversations/:id/participants
 * Get group participants (only for group conversations)
 */
router.get('/conversations/:id/participants', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversation(req.userToken, id, req.userToken)
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    const contactJid = conversation.contactJid || conversation.contact_jid
    
    // Only works for group JIDs
    if (!contactJid || !contactJid.endsWith('@g.us')) {
      return res.json({ success: true, data: [], message: 'Not a group conversation' })
    }
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    try {
      // WUZAPI /group/info uses GET with GroupJID in JSON body
      // According to WUZAPI API docs: curl -s -X GET -H 'Token: ...' -H 'Content-Type: application/json' --data '{"GroupJID":"...@g.us"}' /group/info
      const response = await axios({
        method: 'GET',
        url: `${wuzapiBaseUrl}/group/info`,
        headers: {
          'Token': req.userToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: { GroupJID: contactJid },
        timeout: 10000
      })
      
      const groupData = response.data?.data || response.data
      const participants = groupData?.Participants || []
      
      const formattedParticipants = participants.map(p => ({
        jid: p.JID,
        name: p.JID?.replace('@s.whatsapp.net', '') || '',
        is_admin: p.IsAdmin || false,
        is_super_admin: p.IsSuperAdmin || false,
        avatar_url: null // Would need separate API call per participant
      }))
      
      res.json({ success: true, data: formattedParticipants })
    } catch (wuzapiError) {
      logger.warn('WUZAPI group info request failed', {
        conversationId: id,
        groupJid: contactJid,
        status: wuzapiError.response?.status,
        error: wuzapiError.message
      })
      
      return res.json({ success: true, data: [], message: 'Group info not available' })
    }
  } catch (error) {
    logger.error('Error fetching group participants', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== Macros Routes ====================

/**
 * GET /api/chat/inbox/macros
 * Get all macros for the user
 */
router.get('/macros', verifyUserToken, async (req, res) => {
  try {
    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    // Get macros with their actions
    const macrosResult = await db.query(
      'SELECT id, name, description, created_at, updated_at FROM macros WHERE user_id = ? ORDER BY name ASC',
      [userId]
    )

    const macros = []
    for (const macro of (macrosResult.rows || [])) {
      const actionsResult = await db.query(
        'SELECT id, action_type, params, action_order FROM macro_actions WHERE macro_id = ? ORDER BY action_order ASC',
        [macro.id]
      )
      
      macros.push({
        ...macro,
        actions: (actionsResult.rows || []).map(a => ({
          id: a.id,
          type: a.action_type,
          params: JSON.parse(a.params || '{}'),
          order: a.action_order
        }))
      })
    }

    res.json({ success: true, data: macros })
  } catch (error) {
    logger.error('Error fetching macros', { error: error.message })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/chat/inbox/macros/:id/execute
 * Execute a macro on a conversation
 */
router.post('/macros/:id/execute', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { conversationId } = req.body
    
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId is required' })
    }

    // Using SupabaseService directly
    if (!supabaseService) {
      return res.status(500).json({ success: false, error: 'Database not available' })
    }

    const chatService = new ChatService()
    const userId = await chatService.getUserIdFromToken(req.userToken)
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid user token' })
    }

    // Get macro
    const macroResult = await db.query(
      'SELECT id, name FROM macros WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (!macroResult.rows || macroResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Macro not found' })
    }

    // Get macro actions
    const actionsResult = await db.query(
      'SELECT action_type, params FROM macro_actions WHERE macro_id = ? ORDER BY action_order ASC',
      [id]
    )

    const actions = actionsResult.rows || []
    const results = []

    // Execute actions sequentially
    for (const action of actions) {
      const params = JSON.parse(action.params || '{}')
      
      try {
        switch (action.action_type) {
          case 'change_status':
            await chatService.updateConversation(req.userToken, conversationId, { status: params.status })
            results.push({ action: 'change_status', success: true })
            break
            
          case 'assign_bot':
            await chatService.updateConversation(req.userToken, conversationId, { assignedBotId: params.botId })
            results.push({ action: 'assign_bot', success: true })
            break
            
          case 'add_label':
            await chatService.assignLabel(req.userToken, conversationId, params.labelId)
            results.push({ action: 'add_label', success: true })
            break
            
          case 'send_message':
            // Get conversation to get contact JID
            const conversation = await chatService.getConversation(req.userToken, conversationId, req.userToken)
            if (conversation) {
              const convContactJid = conversation.contactJid || conversation.contact_jid
              const phone = convContactJid ? convContactJid.replace('@s.whatsapp.net', '') : ''
              const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
              
              await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
                Phone: phone,
                Body: params.message
              }, {
                headers: { 'token': req.userToken, 'Content-Type': 'application/json' },
                timeout: 15000
              })
              results.push({ action: 'send_message', success: true })
            }
            break
            
          default:
            results.push({ action: action.action_type, success: false, error: 'Unknown action type' })
        }
      } catch (actionError) {
        logger.error('Macro action failed', { macroId: id, action: action.action_type, error: actionError.message })
        results.push({ action: action.action_type, success: false, error: actionError.message })
      }
    }

    logger.info('Macro executed', { macroId: id, conversationId, results })
    res.json({ success: true, data: { macro: macroResult.rows[0].name, results } })
  } catch (error) {
    logger.error('Error executing macro', { error: error.message, macroId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/chat/inbox/test-group-info/:groupJid
 * Test endpoint to verify WUZAPI /group/info API is working
 */
router.get('/test-group-info/:groupJid', verifyUserToken, async (req, res) => {
  try {
    const { groupJid } = req.params
    const userToken = req.userToken
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
    
    logger.info('Testing WUZAPI /group/info', {
      groupJid,
      wuzapiBaseUrl,
      tokenPreview: userToken?.substring(0, 8) + '...'
    })
    
    // WUZAPI /group/info uses GET with GroupJID in JSON body
    // According to WUZAPI API docs: curl -s -X GET -H 'Token: ...' -H 'Content-Type: application/json' --data '{"GroupJID":"...@g.us"}' /group/info
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
    
    logger.info('WUZAPI /group/info test response', {
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : [],
      nestedDataKeys: response.data?.data ? Object.keys(response.data.data) : [],
      groupName: response.data?.data?.Name || response.data?.Name || 'NOT FOUND'
    })
    
    res.json({
      success: true,
      data: {
        groupJid,
        wuzapiResponse: response.data,
        extractedName: response.data?.data?.Name || response.data?.Name || null
      }
    })
  } catch (error) {
    logger.error('WUZAPI /group/info test failed', {
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data
    })
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      wuzapiError: error.response?.data
    })
  }
})

module.exports = router
