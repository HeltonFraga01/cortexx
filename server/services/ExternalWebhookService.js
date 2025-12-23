/**
 * ExternalWebhookService
 * 
 * Handles delivery of webhook events to external URLs configured by users
 * 
 * Requirements: REQ-2.3 (chat-api-realtime-migration)
 */

const crypto = require('crypto')
const axios = require('axios')
const { logger } = require('../utils/logger')
const SupabaseService = require('./SupabaseService')

class ExternalWebhookService {
  constructor() {
    this.deliveryQueue = []
    this.isProcessing = false
  }

  /**
   * Generate HMAC signature for webhook payload
   * @param {string} secret - The webhook secret
   * @param {Object} payload - The payload to sign
   * @returns {string} The HMAC signature
   */
  generateSignature(secret, payload) {
    const payloadString = JSON.stringify(payload)
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex')
  }

  /**
   * Get active webhooks for an account that subscribe to a specific event
   * @param {string} accountId - The account ID
   * @param {string} eventType - The event type (e.g., 'message.received')
   * @returns {Promise<Array>} Active webhooks
   */
  async getWebhooksForEvent(accountId, eventType) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('chat_external_webhooks', (query) =>
        query
          .select('*')
          .eq('account_id', accountId)
          .eq('is_active', true)
          .contains('events', [eventType])
      )

      if (error) {
        logger.error('Failed to get webhooks for event', {
          error: error.message,
          accountId,
          eventType
        })
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Error getting webhooks for event', {
        error: error.message,
        accountId,
        eventType
      })
      return []
    }
  }

  /**
   * Deliver a webhook event to a single endpoint
   * @param {Object} webhook - The webhook configuration
   * @param {string} eventType - The event type
   * @param {Object} payload - The event payload
   * @returns {Promise<Object>} Delivery result
   */
  async deliverWebhook(webhook, eventType, payload) {
    const startTime = Date.now()
    const deliveryId = crypto.randomUUID()

    const webhookPayload = {
      id: deliveryId,
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery': deliveryId,
      'X-Webhook-Timestamp': webhookPayload.timestamp
    }

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = this.generateSignature(webhook.secret, webhookPayload)
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    let lastError = null
    let attempt = 0

    // Retry loop
    while (attempt < webhook.retry_count) {
      attempt++

      try {
        const response = await axios.post(webhook.url, webhookPayload, {
          headers,
          timeout: webhook.timeout_ms || 5000,
          validateStatus: (status) => status >= 200 && status < 300
        })

        const duration = Date.now() - startTime

        logger.info('Webhook delivered successfully', {
          webhookId: webhook.id,
          url: webhook.url,
          eventType,
          deliveryId,
          attempt,
          duration,
          status: response.status
        })

        // Update webhook stats
        await this.updateWebhookSuccess(webhook.id)

        return {
          success: true,
          deliveryId,
          attempt,
          duration,
          status: response.status
        }
      } catch (error) {
        lastError = error
        const duration = Date.now() - startTime

        logger.warn('Webhook delivery attempt failed', {
          webhookId: webhook.id,
          url: webhook.url,
          eventType,
          deliveryId,
          attempt,
          maxRetries: webhook.retry_count,
          duration,
          error: error.message,
          status: error.response?.status
        })

        // Wait before retry (exponential backoff)
        if (attempt < webhook.retry_count) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    const duration = Date.now() - startTime

    logger.error('Webhook delivery failed after all retries', {
      webhookId: webhook.id,
      url: webhook.url,
      eventType,
      deliveryId,
      attempts: attempt,
      duration,
      error: lastError?.message
    })

    // Update webhook failure stats
    await this.updateWebhookFailure(webhook.id, lastError?.message)

    return {
      success: false,
      deliveryId,
      attempts: attempt,
      duration,
      error: lastError?.message
    }
  }

  /**
   * Update webhook success stats
   * @param {string} webhookId - The webhook ID
   */
  async updateWebhookSuccess(webhookId) {
    try {
      await SupabaseService.update('chat_external_webhooks', webhookId, {
        last_triggered_at: new Date().toISOString(),
        failure_count: 0,
        last_error: null
      })
    } catch (error) {
      logger.error('Failed to update webhook success stats', {
        error: error.message,
        webhookId
      })
    }
  }

  /**
   * Update webhook failure stats
   * @param {string} webhookId - The webhook ID
   * @param {string} errorMessage - The error message
   */
  async updateWebhookFailure(webhookId, errorMessage) {
    try {
      // Get current failure count
      const { data: webhook } = await SupabaseService.queryAsAdmin('chat_external_webhooks', (query) =>
        query.select('failure_count').eq('id', webhookId).single()
      )

      const newFailureCount = (webhook?.failure_count || 0) + 1

      // Disable webhook if too many failures (e.g., 10 consecutive failures)
      const shouldDisable = newFailureCount >= 10

      await SupabaseService.update('chat_external_webhooks', webhookId, {
        last_triggered_at: new Date().toISOString(),
        failure_count: newFailureCount,
        last_error: errorMessage,
        is_active: !shouldDisable
      })

      if (shouldDisable) {
        logger.warn('Webhook disabled due to too many failures', {
          webhookId,
          failureCount: newFailureCount
        })
      }
    } catch (error) {
      logger.error('Failed to update webhook failure stats', {
        error: error.message,
        webhookId
      })
    }
  }

  /**
   * Send an event to all subscribed webhooks for an account
   * @param {string} accountId - The account ID
   * @param {string} eventType - The event type
   * @param {Object} payload - The event payload
   * @returns {Promise<Array>} Delivery results
   */
  async sendEvent(accountId, eventType, payload) {
    try {
      const webhooks = await this.getWebhooksForEvent(accountId, eventType)

      if (webhooks.length === 0) {
        logger.debug('No webhooks configured for event', {
          accountId,
          eventType
        })
        return []
      }

      logger.info('Sending event to external webhooks', {
        accountId,
        eventType,
        webhookCount: webhooks.length
      })

      // Deliver to all webhooks in parallel
      const results = await Promise.all(
        webhooks.map(webhook => this.deliverWebhook(webhook, eventType, payload))
      )

      return results
    } catch (error) {
      logger.error('Failed to send event to webhooks', {
        error: error.message,
        accountId,
        eventType
      })
      return []
    }
  }

  /**
   * Create a new webhook configuration
   * @param {string} accountId - The account ID
   * @param {Object} config - Webhook configuration
   * @returns {Promise<Object>} Created webhook
   */
  async createWebhook(accountId, config) {
    try {
      const { url, secret, events, retryCount = 3, timeoutMs = 5000 } = config

      if (!url) {
        throw new Error('Webhook URL is required')
      }

      if (!events || events.length === 0) {
        throw new Error('At least one event type is required')
      }

      const webhookData = {
        account_id: accountId,
        url,
        secret: secret || null,
        events,
        retry_count: retryCount,
        timeout_ms: timeoutMs,
        is_active: true
      }

      const { data, error } = await SupabaseService.insert('chat_external_webhooks', webhookData)

      if (error) throw error

      logger.info('External webhook created', {
        webhookId: data.id,
        accountId,
        url,
        events
      })

      return data
    } catch (error) {
      logger.error('Failed to create external webhook', {
        error: error.message,
        accountId
      })
      throw error
    }
  }

  /**
   * Update a webhook configuration
   * @param {string} webhookId - The webhook ID
   * @param {string} accountId - The account ID (for authorization)
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated webhook
   */
  async updateWebhook(webhookId, accountId, updates) {
    try {
      const allowedFields = ['url', 'secret', 'events', 'is_active', 'retry_count', 'timeout_ms']
      const filteredUpdates = {}

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid updates provided')
      }

      filteredUpdates.updated_at = new Date().toISOString()

      // Reset failure count if re-enabling
      if (filteredUpdates.is_active === true) {
        filteredUpdates.failure_count = 0
        filteredUpdates.last_error = null
      }

      const { data, error } = await SupabaseService.queryAsAdmin('chat_external_webhooks', (query) =>
        query
          .update(filteredUpdates)
          .eq('id', webhookId)
          .eq('account_id', accountId)
          .select()
          .single()
      )

      if (error) throw error

      logger.info('External webhook updated', {
        webhookId,
        accountId,
        updates: Object.keys(filteredUpdates)
      })

      return data
    } catch (error) {
      logger.error('Failed to update external webhook', {
        error: error.message,
        webhookId,
        accountId
      })
      throw error
    }
  }

  /**
   * Delete a webhook
   * @param {string} webhookId - The webhook ID
   * @param {string} accountId - The account ID (for authorization)
   * @returns {Promise<void>}
   */
  async deleteWebhook(webhookId, accountId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('chat_external_webhooks', (query) =>
        query
          .delete()
          .eq('id', webhookId)
          .eq('account_id', accountId)
      )

      if (error) throw error

      logger.info('External webhook deleted', {
        webhookId,
        accountId
      })
    } catch (error) {
      logger.error('Failed to delete external webhook', {
        error: error.message,
        webhookId,
        accountId
      })
      throw error
    }
  }

  /**
   * List webhooks for an account
   * @param {string} accountId - The account ID
   * @returns {Promise<Array>} Webhooks
   */
  async listWebhooks(accountId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('chat_external_webhooks', (query) =>
        query
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
      )

      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('Failed to list external webhooks', {
        error: error.message,
        accountId
      })
      throw error
    }
  }
}

module.exports = new ExternalWebhookService()
