/**
 * Chat API v1 Routes
 * 
 * External REST API for chat integration
 * 
 * Requirements: REQ-2.1, REQ-2.2 (chat-api-realtime-migration)
 */

const router = require('express').Router()
const { logger } = require('../../../utils/logger')
const { apiKeyAuth } = require('../../../middleware/apiKeyAuth')
const ChatService = require('../../../services/ChatService')
const SupabaseService = require('../../../services/SupabaseService')

const chatService = new ChatService()

// ==================== CONVERSATIONS ====================

/**
 * GET /api/v1/chat/conversations
 * List conversations with pagination
 * Scope: conversations:read
 */
router.get('/conversations', apiKeyAuth(['conversations:read']), async (req, res) => {
  try {
    const { limit = 20, cursor, status, hasUnread, search, inboxId } = req.query
    
    const result = await chatService.getConversations(
      req.accountId,
      {
        status,
        hasUnread: hasUnread === 'true',
        search,
        inboxId
      },
      {
        limit: parseInt(limit, 10),
        cursor
      }
    )
    
    res.json({
      success: true,
      data: result.conversations,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error('API v1: Failed to list conversations', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/chat/conversations'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/chat/conversations/:id
 * Get a single conversation
 * Scope: conversations:read
 */
router.get('/conversations/:id', apiKeyAuth(['conversations:read']), async (req, res) => {
  try {
    const conversation = await chatService.getConversationById(
      req.params.id,
      req.accountId
    )
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    
    res.json({
      success: true,
      data: conversation
    })
  } catch (error) {
    logger.error('API v1: Failed to get conversation', {
      error: error.message,
      accountId: req.accountId,
      conversationId: req.params.id,
      endpoint: '/api/v1/chat/conversations/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/v1/chat/conversations/:id
 * Update conversation (status, assigned agent, etc.)
 * Scope: conversations:write
 */
router.patch('/conversations/:id', apiKeyAuth(['conversations:write']), async (req, res) => {
  try {
    const { status, assignedAgentId, assignedBotId, isMuted } = req.body
    
    // Verify ownership
    const conversation = await chatService.getConversationById(
      req.params.id,
      req.accountId
    )
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    
    const updates = {}
    if (status !== undefined) updates.status = status
    if (assignedAgentId !== undefined) updates.assigned_agent_id = assignedAgentId
    if (assignedBotId !== undefined) updates.assigned_bot_id = assignedBotId
    if (isMuted !== undefined) updates.is_muted = isMuted
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }
    
    updates.updated_at = new Date().toISOString()
    
    const { data, error } = await SupabaseService.update(
      'conversations',
      req.params.id,
      updates
    )
    
    if (error) throw error
    
    res.json({
      success: true,
      data: chatService.formatConversation(data)
    })
  } catch (error) {
    logger.error('API v1: Failed to update conversation', {
      error: error.message,
      accountId: req.accountId,
      conversationId: req.params.id,
      endpoint: '/api/v1/chat/conversations/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

// ==================== MESSAGES ====================

/**
 * GET /api/v1/chat/conversations/:id/messages
 * List messages in a conversation with pagination
 * Scope: messages:read
 */
router.get('/conversations/:id/messages', apiKeyAuth(['messages:read']), async (req, res) => {
  try {
    const { limit = 50, cursor } = req.query
    
    const result = await chatService.getMessages(
      req.params.id,
      req.accountId,
      {
        limit: parseInt(limit, 10),
        cursor
      }
    )
    
    res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination
    })
  } catch (error) {
    logger.error('API v1: Failed to list messages', {
      error: error.message,
      accountId: req.accountId,
      conversationId: req.params.id,
      endpoint: '/api/v1/chat/conversations/:id/messages'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/chat/conversations/:id/messages
 * Send a message to a conversation
 * Scope: messages:write
 */
router.post('/conversations/:id/messages', apiKeyAuth(['messages:write']), async (req, res) => {
  try {
    const { content, messageType = 'text', replyToMessageId } = req.body
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' })
    }
    
    // Get conversation to verify ownership and get contact info
    const conversation = await chatService.getConversationById(
      req.params.id,
      req.accountId
    )
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    
    // Get user token for WUZAPI
    const { data: account, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
      query.select('wuzapi_token').eq('id', req.accountId).single()
    )
    
    if (accountError || !account?.wuzapi_token) {
      return res.status(400).json({ error: 'Account not configured for messaging' })
    }
    
    // Send message
    const message = await chatService.sendMessage(
      req.accountId,
      req.params.id,
      content,
      account.wuzapi_token,
      { replyToMessageId }
    )
    
    res.status(201).json({
      success: true,
      data: chatService.formatMessage(message)
    })
  } catch (error) {
    logger.error('API v1: Failed to send message', {
      error: error.message,
      accountId: req.accountId,
      conversationId: req.params.id,
      endpoint: '/api/v1/chat/conversations/:id/messages'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/chat/conversations/:id/read
 * Mark conversation as read
 * Scope: messages:write
 */
router.post('/conversations/:id/read', apiKeyAuth(['messages:write']), async (req, res) => {
  try {
    // Get user token for WUZAPI
    const { data: account, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
      query.select('wuzapi_token').eq('id', req.accountId).single()
    )
    
    if (accountError || !account?.wuzapi_token) {
      return res.status(400).json({ error: 'Account not configured' })
    }
    
    await chatService.markAsRead(
      req.params.id,
      req.accountId,
      account.wuzapi_token
    )
    
    res.json({
      success: true,
      message: 'Conversation marked as read'
    })
  } catch (error) {
    logger.error('API v1: Failed to mark as read', {
      error: error.message,
      accountId: req.accountId,
      conversationId: req.params.id,
      endpoint: '/api/v1/chat/conversations/:id/read'
    })
    res.status(500).json({ error: error.message })
  }
})

// ==================== SEARCH ====================

/**
 * GET /api/v1/chat/search/conversations
 * Search conversations
 * Scope: conversations:read
 */
router.get('/search/conversations', apiKeyAuth(['conversations:read']), async (req, res) => {
  try {
    const { q, limit = 20 } = req.query
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }
    
    const results = await chatService.searchConversations(
      req.accountId,
      q,
      { limit: parseInt(limit, 10) }
    )
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('API v1: Failed to search conversations', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/chat/search/conversations'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/chat/search/messages
 * Search messages in a conversation
 * Scope: messages:read
 */
router.get('/search/messages', apiKeyAuth(['messages:read']), async (req, res) => {
  try {
    const { q, conversationId, limit = 50 } = req.query
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }
    
    const results = await chatService.searchMessages(
      conversationId,
      req.accountId,
      q,
      { limit: parseInt(limit, 10) }
    )
    
    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    logger.error('API v1: Failed to search messages', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/chat/search/messages'
    })
    res.status(500).json({ error: error.message })
  }
})

// ==================== LABELS ====================

/**
 * GET /api/v1/chat/labels
 * List all labels
 * Scope: conversations:read
 */
router.get('/labels', apiKeyAuth(['conversations:read']), async (req, res) => {
  try {
    const labels = await chatService.getLabels(req.accountId)
    
    res.json({
      success: true,
      data: labels
    })
  } catch (error) {
    logger.error('API v1: Failed to list labels', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/chat/labels'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/chat/labels
 * Create a label
 * Scope: conversations:write
 */
router.post('/labels', apiKeyAuth(['conversations:write']), async (req, res) => {
  try {
    const { name, color } = req.body
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Label name is required' })
    }
    
    const label = await chatService.createLabel(req.accountId, { name, color })
    
    res.status(201).json({
      success: true,
      data: label
    })
  } catch (error) {
    logger.error('API v1: Failed to create label', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/chat/labels'
    })
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
