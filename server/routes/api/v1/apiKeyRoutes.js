/**
 * API Key Management Routes
 * 
 * CRUD operations for API keys (requires session auth, not API key auth)
 * 
 * Requirements: REQ-2.4 (chat-api-realtime-migration)
 */

const router = require('express').Router()
const { logger } = require('../../../utils/logger')
const { authenticate } = require('../../../middleware/auth')
const { generateApiKey, hashApiKey } = require('../../../middleware/apiKeyAuth')
const SupabaseService = require('../../../services/SupabaseService')

/**
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
      query
        .select('id, name, key_prefix, scopes, rate_limit_per_minute, last_used_at, expires_at, is_active, created_at')
        .eq('account_id', req.user.id)
        .order('created_at', { ascending: false })
    )
    
    if (error) throw error
    
    res.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    logger.error('Failed to list API keys', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/v1/api-keys'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, scopes, rateLimitPerMinute, expiresAt } = req.body
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' })
    }
    
    // Validate scopes
    const validScopes = [
      'conversations:read',
      'conversations:write',
      'messages:read',
      'messages:write',
      'webhooks:read',
      'webhooks:write'
    ]
    
    const requestedScopes = scopes || ['conversations:read', 'messages:read', 'messages:write']
    const invalidScopes = requestedScopes.filter(s => !validScopes.includes(s))
    
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        error: 'Invalid scopes',
        invalidScopes,
        validScopes
      })
    }
    
    // Generate API key
    const { key, hash, prefix } = generateApiKey()
    
    const keyData = {
      account_id: req.user.id,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      scopes: requestedScopes,
      rate_limit_per_minute: rateLimitPerMinute || 60,
      expires_at: expiresAt || null,
      is_active: true
    }
    
    const { data, error } = await SupabaseService.insert('chat_api_keys', keyData)
    
    if (error) throw error
    
    logger.info('API key created', {
      keyId: data.id,
      userId: req.user.id,
      name: name.trim()
    })
    
    // Return the key only once - it cannot be retrieved later
    res.status(201).json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        key: key, // Only returned on creation!
        keyPrefix: data.key_prefix,
        scopes: data.scopes,
        rateLimitPerMinute: data.rate_limit_per_minute,
        expiresAt: data.expires_at,
        createdAt: data.created_at
      },
      warning: 'Save this API key now. It cannot be retrieved later.'
    })
  } catch (error) {
    logger.error('Failed to create API key', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/v1/api-keys'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/v1/api-keys/:id
 * Update an API key (name, scopes, rate limit, active status)
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { name, scopes, rateLimitPerMinute, isActive } = req.body
    
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (scopes !== undefined) updates.scopes = scopes
    if (rateLimitPerMinute !== undefined) updates.rate_limit_per_minute = rateLimitPerMinute
    if (isActive !== undefined) updates.is_active = isActive
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }
    
    updates.updated_at = new Date().toISOString()
    
    const { data, error } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
      query
        .update(updates)
        .eq('id', req.params.id)
        .eq('account_id', req.user.id)
        .select('id, name, key_prefix, scopes, rate_limit_per_minute, last_used_at, expires_at, is_active, created_at, updated_at')
        .single()
    )
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'API key not found' })
      }
      throw error
    }
    
    logger.info('API key updated', {
      keyId: req.params.id,
      userId: req.user.id,
      updates: Object.keys(updates)
    })
    
    res.json({
      success: true,
      data
    })
  } catch (error) {
    logger.error('Failed to update API key', {
      error: error.message,
      userId: req.user?.id,
      keyId: req.params.id,
      endpoint: '/api/v1/api-keys/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/api-keys/:id
 * Delete an API key
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { error } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
      query
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', req.user.id)
    )
    
    if (error) throw error
    
    logger.info('API key deleted', {
      keyId: req.params.id,
      userId: req.user.id
    })
    
    res.json({
      success: true,
      message: 'API key deleted'
    })
  } catch (error) {
    logger.error('Failed to delete API key', {
      error: error.message,
      userId: req.user?.id,
      keyId: req.params.id,
      endpoint: '/api/v1/api-keys/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/api-keys/:id/regenerate
 * Regenerate an API key (creates new key, invalidates old one)
 */
router.post('/:id/regenerate', authenticate, async (req, res) => {
  try {
    // Get existing key
    const { data: existingKey, error: getError } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
      query
        .select('*')
        .eq('id', req.params.id)
        .eq('account_id', req.user.id)
        .single()
    )
    
    if (getError || !existingKey) {
      return res.status(404).json({ error: 'API key not found' })
    }
    
    // Generate new key
    const { key, hash, prefix } = generateApiKey()
    
    // Update with new hash
    const { data, error } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
      query
        .update({
          key_hash: hash,
          key_prefix: prefix,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .eq('account_id', req.user.id)
        .select('id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, is_active, created_at, updated_at')
        .single()
    )
    
    if (error) throw error
    
    logger.info('API key regenerated', {
      keyId: req.params.id,
      userId: req.user.id
    })
    
    res.json({
      success: true,
      data: {
        ...data,
        key // Only returned on regeneration!
      },
      warning: 'Save this API key now. It cannot be retrieved later. The old key is now invalid.'
    })
  } catch (error) {
    logger.error('Failed to regenerate API key', {
      error: error.message,
      userId: req.user?.id,
      keyId: req.params.id,
      endpoint: '/api/v1/api-keys/:id/regenerate'
    })
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
