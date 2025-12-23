/**
 * API Key Authentication Middleware
 * 
 * Validates API keys for external Chat API access
 * 
 * Requirements: REQ-2.4 (chat-api-realtime-migration)
 */

const crypto = require('crypto')
const { logger } = require('../utils/logger')
const SupabaseService = require('../services/SupabaseService')

// In-memory rate limit store (for single-instance architecture)
const rateLimitStore = new Map()

/**
 * Hash an API key using SHA-256
 * @param {string} apiKey - The raw API key
 * @returns {string} The hashed key
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * Generate a new API key
 * @returns {{ key: string, hash: string, prefix: string }}
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const key = `chat_sk_${randomBytes}`
  const hash = hashApiKey(key)
  const prefix = key.substring(0, 12) // "chat_sk_xxxx"
  
  return { key, hash, prefix }
}

/**
 * Check rate limit for an API key
 * @param {string} keyId - The API key ID
 * @param {number} limit - Requests per minute limit
 * @returns {{ allowed: boolean, remaining: number, resetAt: Date }}
 */
function checkRateLimit(keyId, limit) {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  
  let record = rateLimitStore.get(keyId)
  
  if (!record || now > record.resetAt) {
    // Start new window
    record = {
      count: 0,
      resetAt: now + windowMs
    }
  }
  
  record.count++
  rateLimitStore.set(keyId, record)
  
  const remaining = Math.max(0, limit - record.count)
  const allowed = record.count <= limit
  
  return {
    allowed,
    remaining,
    resetAt: new Date(record.resetAt)
  }
}

/**
 * API Key Authentication Middleware
 * 
 * Validates the API key from the Authorization header or X-API-Key header
 * Sets req.apiKey with the validated key data
 * Sets req.accountId with the account ID
 * 
 * @param {string[]} requiredScopes - Required scopes for this endpoint
 * @returns {Function} Express middleware
 */
function apiKeyAuth(requiredScopes = []) {
  return async (req, res, next) => {
    try {
      // Extract API key from headers
      const authHeader = req.headers.authorization
      const apiKeyHeader = req.headers['x-api-key']
      
      let apiKey = null
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7)
      } else if (apiKeyHeader) {
        apiKey = apiKeyHeader
      }
      
      if (!apiKey) {
        logger.warn('API key missing', { 
          endpoint: req.path,
          ip: req.ip 
        })
        return res.status(401).json({ 
          error: 'API key required',
          code: 'API_KEY_MISSING'
        })
      }
      
      // Validate API key format
      if (!apiKey.startsWith('chat_sk_')) {
        logger.warn('Invalid API key format', { 
          endpoint: req.path,
          prefix: apiKey.substring(0, 8)
        })
        return res.status(401).json({ 
          error: 'Invalid API key format',
          code: 'API_KEY_INVALID_FORMAT'
        })
      }
      
      // Hash the key and look it up
      const keyHash = hashApiKey(apiKey)
      
      const { data: keyData, error } = await SupabaseService.queryAsAdmin('chat_api_keys', (query) =>
        query
          .select('*')
          .eq('key_hash', keyHash)
          .eq('is_active', true)
          .single()
      )
      
      if (error || !keyData) {
        logger.warn('API key not found or inactive', { 
          endpoint: req.path,
          prefix: apiKey.substring(0, 12)
        })
        return res.status(401).json({ 
          error: 'Invalid or inactive API key',
          code: 'API_KEY_INVALID'
        })
      }
      
      // Check expiration
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        logger.warn('API key expired', { 
          endpoint: req.path,
          keyId: keyData.id,
          expiredAt: keyData.expires_at
        })
        return res.status(401).json({ 
          error: 'API key has expired',
          code: 'API_KEY_EXPIRED'
        })
      }
      
      // Check required scopes
      const keyScopes = keyData.scopes || []
      const missingScopes = requiredScopes.filter(scope => !keyScopes.includes(scope))
      
      if (missingScopes.length > 0) {
        logger.warn('API key missing required scopes', { 
          endpoint: req.path,
          keyId: keyData.id,
          requiredScopes,
          keyScopes,
          missingScopes
        })
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_SCOPES',
          missingScopes
        })
      }
      
      // Check rate limit
      const rateLimit = checkRateLimit(keyData.id, keyData.rate_limit_per_minute)
      
      // Set rate limit headers
      res.set('X-RateLimit-Limit', keyData.rate_limit_per_minute)
      res.set('X-RateLimit-Remaining', rateLimit.remaining)
      res.set('X-RateLimit-Reset', rateLimit.resetAt.toISOString())
      
      if (!rateLimit.allowed) {
        logger.warn('API key rate limit exceeded', { 
          endpoint: req.path,
          keyId: keyData.id,
          limit: keyData.rate_limit_per_minute
        })
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((rateLimit.resetAt - new Date()) / 1000)
        })
      }
      
      // Update last_used_at (fire and forget)
      SupabaseService.update('chat_api_keys', keyData.id, {
        last_used_at: new Date().toISOString()
      }).catch(err => {
        logger.error('Failed to update API key last_used_at', { 
          error: err.message,
          keyId: keyData.id
        })
      })
      
      // Set request context
      req.apiKey = {
        id: keyData.id,
        name: keyData.name,
        scopes: keyScopes,
        rateLimit: keyData.rate_limit_per_minute
      }
      req.accountId = keyData.account_id
      
      logger.debug('API key authenticated', { 
        endpoint: req.path,
        keyId: keyData.id,
        accountId: keyData.account_id
      })
      
      next()
    } catch (error) {
      logger.error('API key authentication error', { 
        error: error.message,
        endpoint: req.path
      })
      return res.status(500).json({ 
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      })
    }
  }
}

module.exports = {
  apiKeyAuth,
  generateApiKey,
  hashApiKey
}
