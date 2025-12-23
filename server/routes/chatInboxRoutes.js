/**
 * Chat Inbox Routes
 * 
 * Handles conversation management, message retrieval, labels, and canned responses
 * for the chat interface.
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * instead of using a simple token from headers/session.
 * 
 * Requirements: 3.1, 3.2, 3.3 (Use wuzapiToken from Session_Context for chat operations)
 */

const express = require('express')
const axios = require('axios')
const router = express.Router()
const { logger } = require('../utils/logger')
const ChatService = require('../services/ChatService')
const QuotaService = require('../services/QuotaService')
const { validatePhoneWithAPI } = require('../services/PhoneValidationService')
const supabaseService = require('../services/SupabaseService')
const { validateSupabaseToken } = require('../middleware/supabaseAuth')
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware')

/**
 * Middleware to verify user token using InboxContext
 * Uses the token from the active inbox instead of account
 * 
 * Flow:
 * 1. Validates Supabase JWT
 * 2. Loads inbox context (via inboxContextMiddleware)
 * 3. Uses wuzapiToken from active inbox
 * 4. Fallback to header 'token' (legacy) or session
 */
const verifyUserToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  
  // If JWT present, use inboxContextMiddleware to get token from correct inbox
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Validate Supabase JWT
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      
      // Load inbox context
      await new Promise((resolve, reject) => {
        inboxContextMiddleware({ required: false, useCache: true })(req, res, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      
      // If we have context, use the token from active inbox
      if (req.context?.wuzapiToken) {
        req.userToken = req.context.wuzapiToken
        req.userId = req.user?.id
        req.inboxId = req.context.inboxId
        req.accountId = req.context.accountId
        
        logger.debug('WUZAPI token obtained from inbox context (chatInbox)', {
          userId: req.userId?.substring(0, 8) + '...',
          inboxId: req.inboxId?.substring(0, 8) + '...',
          hasToken: true
        })
        
        return next()
      }
      
      // If no context but has user, log warning
      if (req.user?.id) {
        logger.warn('No inbox context available for user (chatInbox)', {
          userId: req.user.id.substring(0, 8) + '...',
          path: req.path
        })
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed, trying other methods (chatInbox)', { 
        error: error.message,
        path: req.path
      })
    }
  }
  
  // Fallback: Try to get token from header 'token' (legacy)
  const tokenHeader = req.headers.token
  if (tokenHeader) {
    req.userToken = tokenHeader
    return next()
  }
  
  // Fallback: Token from session
  if (req.session?.userToken) {
    req.userToken = req.session.userToken
    return next()
  }
  
  // No token found
  return res.status(401).json({
    success: false,
    error: 'Token não fornecido',
    message: 'Header Authorization com Bearer token, header token ou sessão ativa é obrigatório'
  })
}

// ==================== Conversation Routes ====================

/**
 * GET /api/chat/inbox/conversations
 * List conversations with filtering and pagination
 * Supports both single inboxId and array of inboxIds for multi-select
 * Requirements: 10.1, 10.2, unified-inbox-selector
 */
router.get('/conversations', verifyUserToken, async (req, res) => {
  try {
    const { status, hasUnread, assignedBotId, labelId, search, inboxId, inboxIds, limit = 50, offset = 0 } = req.query
    
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
    
    // Support both single inboxId and array of inboxIds
    if (inboxIds) {
      // Parse inboxIds - can be comma-separated string or JSON array
      let parsedInboxIds
      try {
        parsedInboxIds = typeof inboxIds === 'string' 
          ? (inboxIds.startsWith('[') ? JSON.parse(inboxIds) : inboxIds.split(','))
          : inboxIds
        filters.inboxIds = parsedInboxIds.map(id => typeof id === 'string' ? id : String(id))
      } catch {
        // If parsing fails, treat as single value
        filters.inboxIds = [inboxIds]
      }
    } else if (inboxId) {
      filters.inboxId = parseInt(inboxId, 10)
    }

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

    // Use accountId from middleware context (already resolved) instead of token lookup
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversationById(id, accountId)

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

    // Use accountId from middleware context (already resolved) instead of userToken
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      logger.warn('No accountId available for delete all conversations', {
        hasContext: !!req.context,
        hasUserToken: !!req.userToken
      })
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const chatService = new ChatService()
    const result = await chatService.deleteAllConversations(accountId, null)

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

    // Use accountId from middleware context (already resolved) instead of userToken
    // This fixes the "Conversation not found or unauthorized" error when user has multiple inboxes
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      logger.warn('No accountId available for delete conversation', {
        conversationId: id,
        hasContext: !!req.context,
        hasUserToken: !!req.userToken
      })
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    logger.debug('Deleting conversation', {
      conversationId: id,
      accountId: accountId?.substring(0, 8) + '...',
      inboxId: req.inboxId?.substring(0, 8) + '...'
    })

    const chatService = new ChatService()
    // Pass accountId directly instead of userToken to avoid token lookup issues
    await chatService.deleteConversation(accountId, id, null)

    res.json({ success: true, message: 'Conversa excluída com sucesso' })
  } catch (error) {
    logger.error('Error deleting conversation', { error: error.message, conversationId: req.params.id })
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
        const accountId = req.accountId || req.context?.accountId
        if (accountId) {
          const contactJid = `${cleanPhone}@s.whatsapp.net`
          try {
            await supabaseService.queryAsAdmin('conversations', (query) =>
              query.update({ contact_avatar_url: avatarUrl, updated_at: new Date().toISOString() })
                .eq('account_id', accountId)
                .eq('contact_jid', contactJid)
            )
          } catch (updateError) {
            logger.warn('Failed to update conversation avatar', { error: updateError.message })
          }
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

    // Use accountId from middleware context (already resolved) instead of token lookup
    // This avoids the "Record not found" error when getAccountIdFromToken fails
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      logger.warn('No accountId available for fetch-avatar', {
        conversationId: id,
        hasContext: !!req.context,
        hasUserToken: !!req.userToken
      })
      // Return gracefully - avatar fetch is optional
      return res.json({
        success: true,
        data: null,
        message: 'Account context not available'
      })
    }

    const chatService = new ChatService()
    // Pass accountId directly instead of userToken to avoid token lookup
    const conversation = await chatService.getConversationById(id, accountId)
    
    if (!conversation) {
      // Return gracefully instead of 404 - avatar fetch is optional
      return res.json({
        success: true,
        data: null,
        message: 'Conversation not found'
      })
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
        // Update conversation avatar using SupabaseService
        try {
          await supabaseService.update('conversations', id, {
            contact_avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
        } catch (updateError) {
          logger.warn('Failed to update conversation avatar', { error: updateError.message, conversationId: id })
        }
        
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

    // Use accountId from middleware context (already resolved) instead of token lookup
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.json({
        success: true,
        data: null,
        message: 'Account context not available'
      })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversationById(id, accountId)
    
    if (!conversation) {
      return res.json({
        success: true,
        data: null,
        message: 'Conversation not found'
      })
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
        // Update conversation name using SupabaseService
        try {
          await supabaseService.update('conversations', id, {
            contact_name: groupName,
            updated_at: new Date().toISOString()
          })
        } catch (updateError) {
          logger.warn('Failed to update conversation name', { error: updateError.message, conversationId: id })
        }
        
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

    // Use accountId from middleware context (already resolved) instead of token lookup
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const chatService = new ChatService()
    
    // Get conversation to get the contact JID - use accountId directly
    const conversation = await chatService.getConversationById(id, accountId)
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // =================================================================================
    // CRITICAL FIX: Use WUZAPI token from conversation's inbox, NOT from active inbox
    // When user has "Todas as Caixas" selected, req.userToken may be from a different inbox
    // than the one the conversation belongs to. We must use the conversation's inbox token.
    // =================================================================================
    let wuzapiTokenToUse = req.userToken // Default to active inbox token
    const conversationInboxId = conversation.inboxId || conversation.inbox_id
    
    if (conversationInboxId) {
      // Get the WUZAPI token from the conversation's inbox
      const { data: conversationInbox, error: inboxError } = await supabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('wuzapi_token, name').eq('id', conversationInboxId).single()
      )
      
      if (!inboxError && conversationInbox?.wuzapi_token) {
        wuzapiTokenToUse = conversationInbox.wuzapi_token
        
        // Log if we're using a different token than the active inbox
        if (wuzapiTokenToUse !== req.userToken) {
          logger.info('Using conversation inbox token instead of active inbox token', {
            conversationId: id,
            conversationInboxId,
            conversationInboxName: conversationInbox.name,
            activeInboxId: req.inboxId,
            tokenPrefix: wuzapiTokenToUse?.substring(0, 15) + '...'
          })
        }
      } else {
        logger.warn('Could not get WUZAPI token from conversation inbox, using active inbox token', {
          conversationId: id,
          conversationInboxId,
          error: inboxError?.message
        })
      }
    } else {
      logger.warn('Conversation has no inbox_id, using active inbox token', {
        conversationId: id,
        activeInboxId: req.inboxId
      })
    }
    // =================================================================================

    // =================================================================================
    // CRITICAL: Quota Enforcement Check
    // Before sending, verify if the account owner has sufficient quota
    // =================================================================================
    try {
      // Use accountId from context instead of looking it up again
      if (accountId) {
        // Get Account Owner
        // We need the owner_user_id because quotas are assigned to the owner (subscription holder)
        const { data: account, error: accountError } = await supabaseService.queryAsAdmin('accounts', (query) => 
          query.select('owner_user_id').eq('id', accountId).single()
        )
        
        if (!accountError && account?.owner_user_id) {
          const ownerId = account.owner_user_id
          const quotaService = new QuotaService()
          
          // 3. Check Daily Quota
          const dailyCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_day', 1)
          if (!dailyCheck.allowed) {
            logger.warn('Daily message quota exceeded', { ownerId, accountId, usage: dailyCheck.usage, limit: dailyCheck.limit })
            return res.status(429).json({ 
              success: false, 
              error: 'Daily message limit reached',
              message: 'Você atingiu seu limite diário de mensagens. Faça um upgrade no seu plano ou aguarde até amanhã.',
              limit: dailyCheck.limit,
              usage: dailyCheck.usage
            })
          }
          
          // 4. Check Monthly Quota
          const monthlyCheck = await quotaService.checkQuota(ownerId, 'max_messages_per_month', 1)
          if (!monthlyCheck.allowed) {
            logger.warn('Monthly message quota exceeded', { ownerId, accountId, usage: monthlyCheck.usage, limit: monthlyCheck.limit })
            return res.status(429).json({ 
              success: false, 
              error: 'Monthly message limit reached',
              message: 'Você atingiu seu limite mensal de mensagens. Faça um upgrade no seu plano.',
              limit: monthlyCheck.limit,
              usage: monthlyCheck.usage
            })
          }
          
          logger.debug('Quota check passed for message send', { ownerId })
        } else {
          logger.warn('Database connection unavailable for quota check', { accountId })
          // Fail safe: If we can't check usage, we probably shouldn't block, 
          // OR we should block to prevent abuse. 
          // Better to block if system is unstable, but here we proceed with warning.
        }
      }
    } catch (quotaError) {
      logger.error('Error checking message quota', { error: quotaError.message, conversationId: id })
      // Proceed with caution or return error? 
      // Safe failure: Allow message if check fails due to system error, but log it.
    }
    // =================================================================================

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
      // Use the conversation's inbox token for validation
      const phoneValidation = await validatePhoneWithAPI(phone, wuzapiTokenToUse)
      
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
    
    // Log token being used for WUZAPI call
    logger.info('Preparing WUZAPI message send', {
      conversationId: id,
      phone: validatedPhone,
      messageType,
      tokenPrefix: wuzapiTokenToUse?.substring(0, 15) + '...',
      conversationInboxId,
      activeInboxId: req.inboxId,
      accountId: req.accountId,
      wuzapiBaseUrl
    })
    
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
        
        logger.debug('Sending text message to WUZAPI', { payload, url: `${wuzapiBaseUrl}/chat/send/text` })
        
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, payload, {
          headers: {
            'token': wuzapiTokenToUse,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        
        logger.info('WUZAPI response received', { 
          status: wuzapiResponse.status, 
          data: wuzapiResponse.data,
          conversationId: id
        })
        
        wuzapiSuccess = true
      } else if (messageType === 'image' && mediaUrl) {
        wuzapiResponse = await axios.post(`${wuzapiBaseUrl}/chat/send/image`, {
          Phone: validatedPhone,
          Image: mediaUrl,
          Caption: content || ''
        }, {
          headers: {
            'token': wuzapiTokenToUse,
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
            'token': wuzapiTokenToUse,
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
            'token': wuzapiTokenToUse,
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
            'token': wuzapiTokenToUse,
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
            'token': wuzapiTokenToUse,
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
            'token': wuzapiTokenToUse,
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
        phone: validatedPhone,
        tokenPrefix: wuzapiTokenToUse?.substring(0, 15) + '...'
      })

      // Track message quota usage for multi-tenant architecture
      // Requirements: 12.4 - Increment account's message quota on send
      try {
        // Use accountId from context (already resolved above)
        if (accountId) {
          // Get account owner user ID for quota tracking
          const { data: account, error: accountError } = await supabaseService.getById('accounts', accountId)
          
          if (!accountError && account?.owner_user_id) {
            const quotaService = new QuotaService()
            
            // Increment daily and monthly message quotas
            await quotaService.incrementUsage(account.owner_user_id, 'max_messages_per_day', 1)
            await quotaService.incrementUsage(account.owner_user_id, 'max_messages_per_month', 1)
            
            logger.debug('Message quota incremented', {
              accountId,
              ownerId: account.owner_user_id,
              conversationId: id
            })
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

    // Get accountId from middleware context
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    // Get message with media metadata using Supabase
    // First get the message
    const { data: message, error: messageError } = await supabaseService.queryAsAdmin('chat_messages', (query) =>
      query.select('*, conversations!inner(account_id, contact_jid, inbox_id)')
        .eq('id', messageId)
        .single()
    )

    if (messageError || !message) {
      logger.debug('Message not found for media download', { messageId, error: messageError?.message })
      return res.status(404).json({ success: false, error: 'Message not found' })
    }

    // Verify the message belongs to the user's account
    if (message.conversations?.account_id !== accountId) {
      logger.warn('Unauthorized media access attempt', { messageId, accountId, messageAccountId: message.conversations?.account_id })
      return res.status(404).json({ success: false, error: 'Message not found' })
    }

    // Get the WUZAPI token from the conversation's inbox for media download
    let wuzapiTokenForMedia = req.userToken
    const conversationInboxId = message.conversations?.inbox_id
    
    if (conversationInboxId) {
      const { data: inbox } = await supabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('wuzapi_token').eq('id', conversationInboxId).single()
      )
      if (inbox?.wuzapi_token) {
        wuzapiTokenForMedia = inbox.wuzapi_token
      }
    }

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
          'token': wuzapiTokenForMedia,
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
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      // No conversation found - return empty attributes
      return res.json({ success: true, data: [] })
    }
    
    const conversationId = conversations[0].id
    
    // Get attributes for this conversation
    const { data: attributes, error: attrError } = await supabaseService.queryAsAdmin('contact_attributes', (query) =>
      query.select('id, attribute_key, attribute_value, created_at, updated_at')
        .eq('conversation_id', conversationId)
        .order('attribute_key', { ascending: true })
    )
    
    if (attrError) {
      throw attrError
    }
    
    // Map to expected format (name/value instead of attribute_key/attribute_value)
    const mappedAttributes = (attributes || []).map(attr => ({
      id: attr.id,
      name: attr.attribute_key,
      value: attr.attribute_value,
      created_at: attr.created_at,
      updated_at: attr.updated_at
    }))

    res.json({ success: true, data: mappedAttributes })
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
    const accountId = req.accountId || req.context?.accountId
    
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

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found for this contact' })
    }
    
    const conversationId = conversations[0].id
    
    // Check if attribute already exists
    const { data: existing, error: existError } = await supabaseService.queryAsAdmin('contact_attributes', (query) =>
      query.select('id').eq('conversation_id', conversationId).eq('attribute_key', name.trim())
    )
    
    if (!existError && existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Attribute with this name already exists' })
    }

    // Insert new attribute
    const { data: newAttr, error: insertError } = await supabaseService.insert('contact_attributes', {
      conversation_id: conversationId,
      attribute_key: name.trim(),
      attribute_value: value.trim()
    })

    if (insertError) {
      throw insertError
    }

    const newAttribute = {
      id: newAttr.id,
      name: newAttr.attribute_key,
      value: newAttr.attribute_value,
      created_at: newAttr.created_at,
      updated_at: newAttr.updated_at
    }

    logger.info('Contact attribute created', { accountId, jid: decodedJid, name: name.trim() })
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
    const accountId = req.accountId || req.context?.accountId
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Attribute value is required' })
    }
    if (value.length > 1000) {
      return res.status(400).json({ success: false, error: 'Attribute value must be 1000 characters or less' })
    }

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }
    
    const conversationId = conversations[0].id
    
    // Verify attribute belongs to this conversation
    const { data: existing, error: existError } = await supabaseService.queryAsAdmin('contact_attributes', (query) =>
      query.select('id, attribute_key').eq('id', id).eq('conversation_id', conversationId)
    )
    
    if (existError || !existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    // Update attribute
    const { data: updated, error: updateError } = await supabaseService.update('contact_attributes', id, {
      attribute_value: value.trim(),
      updated_at: new Date().toISOString()
    })

    if (updateError) {
      throw updateError
    }

    const result = {
      id: updated.id,
      name: updated.attribute_key,
      value: updated.attribute_value,
      updated_at: updated.updated_at
    }

    logger.info('Contact attribute updated', { accountId, attributeId: id })
    res.json({ success: true, data: result })
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
    const accountId = req.accountId || req.context?.accountId

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }
    
    const conversationId = conversations[0].id
    
    // Verify attribute belongs to this conversation
    const { data: existing, error: existError } = await supabaseService.queryAsAdmin('contact_attributes', (query) =>
      query.select('id').eq('id', id).eq('conversation_id', conversationId)
    )
    
    if (existError || !existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Attribute not found' })
    }

    // Delete attribute
    const { error: deleteError } = await supabaseService.delete('contact_attributes', id)
    
    if (deleteError) {
      throw deleteError
    }

    logger.info('Contact attribute deleted', { accountId, attributeId: id })
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
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      // No conversation found - return empty notes
      return res.json({ success: true, data: [] })
    }
    
    const conversationId = conversations[0].id
    
    // Get notes for this conversation
    const { data: notes, error: notesError } = await supabaseService.queryAsAdmin('contact_notes', (query) =>
      query.select('id, content, agent_id, created_at, updated_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
    )
    
    if (notesError) {
      throw notesError
    }

    res.json({ success: true, data: notes || [] })
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
    const accountId = req.accountId || req.context?.accountId
    const agentId = req.userId // The user creating the note
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Note content is required' })
    }
    if (content.length > 5000) {
      return res.status(400).json({ success: false, error: 'Note content must be 5000 characters or less' })
    }

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found for this contact' })
    }
    
    const conversationId = conversations[0].id

    // Insert new note
    const { data: newNote, error: insertError } = await supabaseService.insert('contact_notes', {
      conversation_id: conversationId,
      agent_id: agentId || null,
      content: content.trim()
    })

    if (insertError) {
      throw insertError
    }

    logger.info('Contact note created', { accountId, jid: decodedJid })
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
    const accountId = req.accountId || req.context?.accountId

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Find conversation by contact_jid and account_id
    const { data: conversations, error: convError } = await supabaseService.queryAsAdmin('conversations', (query) =>
      query.select('id').eq('account_id', accountId).eq('contact_jid', decodedJid).limit(1)
    )
    
    if (convError || !conversations || conversations.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }
    
    const conversationId = conversations[0].id
    
    // Verify note belongs to this conversation
    const { data: existing, error: existError } = await supabaseService.queryAsAdmin('contact_notes', (query) =>
      query.select('id').eq('id', id).eq('conversation_id', conversationId)
    )
    
    if (existError || !existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Note not found' })
    }

    // Delete note
    const { error: deleteError } = await supabaseService.delete('contact_notes', id)
    
    if (deleteError) {
      throw deleteError
    }

    logger.info('Contact note deleted', { accountId, noteId: id })
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
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const chatService = new ChatService()
    const conversation = await chatService.getConversationById(id, accountId)
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Get message count using SupabaseService
    const { count: messageCount, error: countError } = await supabaseService.count('chat_messages', { conversation_id: id })
    
    if (countError) {
      logger.warn('Failed to get message count', { error: countError.message, conversationId: id })
    }

    // Get first and last message timestamps
    const { data: firstMessage, error: firstError } = await supabaseService.queryAsAdmin('chat_messages', (query) =>
      query.select('timestamp').eq('conversation_id', id).order('timestamp', { ascending: true }).limit(1)
    )
    
    const { data: lastMessage, error: lastError } = await supabaseService.queryAsAdmin('chat_messages', (query) =>
      query.select('timestamp').eq('conversation_id', id).order('timestamp', { ascending: false }).limit(1)
    )
    
    const firstTimestamp = firstMessage?.[0]?.timestamp
    const lastTimestamp = lastMessage?.[0]?.timestamp

    // Calculate duration in minutes
    let durationMinutes = 0
    if (firstTimestamp && lastTimestamp) {
      const firstDate = new Date(firstTimestamp)
      const lastDate = new Date(lastTimestamp)
      durationMinutes = Math.round((lastDate - firstDate) / (1000 * 60))
    }

    // Get label assignments with timestamps
    const { data: labelAssignments, error: labelsError } = await supabaseService.queryAsAdmin('conversation_labels', (query) =>
      query.select('label_id, labels(id, name), created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
    )

    const info = {
      created_at: conversation.createdAt || conversation.created_at,
      last_activity_at: lastTimestamp || conversation.updatedAt || conversation.updated_at,
      message_count: messageCount || 0,
      duration_minutes: durationMinutes,
      bot_assigned_at: (conversation.assignedBotId || conversation.assigned_bot_id) ? (conversation.updatedAt || conversation.updated_at) : null,
      label_assignments: (labelAssignments || []).map(row => ({
        label_id: row.label_id,
        label_name: row.labels?.name,
        assigned_at: row.created_at
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

    // Get accountId from middleware context
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    const decodedJid = decodeURIComponent(jid)
    
    // Build query using Supabase
    let queryBuilder = supabaseService.adminClient
      .from('conversations')
      .select('id, status, created_at, updated_at, last_message_preview')
      .eq('account_id', accountId)
      .eq('contact_jid', decodedJid)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (excludeId) {
      queryBuilder = queryBuilder.neq('id', excludeId)
    }
    
    const { data: conversationsData, error } = await queryBuilder
    
    if (error) {
      logger.error('Error fetching previous conversations', { error: error.message, jid: decodedJid })
      return res.status(500).json({ success: false, error: error.message })
    }

    // Get message counts for each conversation
    const conversations = await Promise.all((conversationsData || []).map(async (conv) => {
      const { count } = await supabaseService.adminClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
      
      return {
        id: conv.id,
        status: conv.status,
        message_count: count || 0,
        last_message_preview: conv.last_message_preview,
        created_at: conv.created_at,
        resolved_at: conv.status === 'resolved' ? conv.updated_at : null
      }
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
 * Get all macros for the account
 */
router.get('/macros', verifyUserToken, async (req, res) => {
  try {
    const accountId = req.accountId || req.context?.accountId
    
    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    // Get macros for this account - Supabase schema uses account_id and actions as JSONB
    const { data: macros, error: macrosError } = await supabaseService.queryAsAdmin('macros', (query) =>
      query.select('id, name, actions, visibility, created_by, created_at, updated_at')
        .eq('account_id', accountId)
        .order('name', { ascending: true })
    )

    if (macrosError) {
      throw macrosError
    }

    // Transform macros to expected format
    const transformedMacros = (macros || []).map(macro => ({
      id: macro.id,
      name: macro.name,
      description: '', // Not in Supabase schema
      created_at: macro.created_at,
      updated_at: macro.updated_at,
      actions: (macro.actions || []).map((action, index) => ({
        id: `${macro.id}-${index}`,
        type: action.action_type || action.type,
        params: action.params || {},
        order: index
      }))
    }))

    res.json({ success: true, data: transformedMacros })
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
    const accountId = req.accountId || req.context?.accountId
    
    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId is required' })
    }

    if (!accountId) {
      return res.status(401).json({ success: false, error: 'Account context not available' })
    }

    // Get macro
    const { data: macros, error: macroError } = await supabaseService.queryAsAdmin('macros', (query) =>
      query.select('id, name, actions').eq('id', id).eq('account_id', accountId)
    )
    
    if (macroError || !macros || macros.length === 0) {
      return res.status(404).json({ success: false, error: 'Macro not found' })
    }

    const macro = macros[0]
    const actions = macro.actions || []
    const results = []

    const chatService = new ChatService()

    // Execute actions sequentially
    for (const action of actions) {
      const actionType = action.action_type || action.type
      const params = action.params || {}
      
      try {
        switch (actionType) {
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
