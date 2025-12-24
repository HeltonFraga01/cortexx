/**
 * InboxStatusService - Centralized service for inbox connection status
 * 
 * This service is the SINGLE source of truth for inbox connection status.
 * It ALWAYS queries the Provider API and NEVER returns cached data as authoritative.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4 (wuzapi-status-source-of-truth spec)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const { ProviderAdapterFactory } = require('./providers');
const {
  ProviderUnavailableError,
  InvalidTokenError,
  ProviderTimeoutError,
  RateLimitedError
} = require('./providers/errors');

/**
 * @typedef {Object} InboxStatusResult
 * @property {boolean} success - Whether status was retrieved successfully
 * @property {string} inboxId - Inbox ID
 * @property {Object} status - Status object
 * @property {boolean} status.connected - TCP connection established
 * @property {boolean} status.loggedIn - Authenticated and can send messages
 * @property {string} [status.qrCode] - QR code for authentication
 * @property {'provider'|'error'} source - Source of status data
 * @property {string} [error] - Error message (if failed)
 * @property {string} [code] - Error code (if failed)
 * @property {string} [cachedAt] - Timestamp when cache was updated
 */

class InboxStatusService {
  constructor() {
    this.supabase = SupabaseService;
  }

  /**
   * Get inbox status from Provider API
   * This is the ONLY way to get authoritative status - NEVER use cached data
   * 
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<InboxStatusResult>}
   */
  async getStatus(inboxId) {
    try {
      // Get inbox from database
      const inbox = await this._getInbox(inboxId);
      
      if (!inbox) {
        return {
          success: false,
          inboxId,
          status: { connected: false, loggedIn: false },
          source: 'error',
          error: 'Inbox não encontrada',
          code: 'INBOX_NOT_FOUND'
        };
      }

      // Get appropriate adapter for this inbox's provider
      const adapter = ProviderAdapterFactory.getAdapterForInbox(inbox);

      try {
        // ALWAYS query the Provider - this is the source of truth
        const status = await adapter.getStatus(inbox);

        // Update cache in Supabase (non-blocking)
        this._updateStatusCache(inboxId, status).catch(err => {
          logger.warn('Failed to update status cache', {
            inboxId,
            error: err.message
          });
        });

        const cachedAt = new Date().toISOString();

        logger.debug('InboxStatusService.getStatus success', {
          inboxId,
          connected: status.connected,
          loggedIn: status.loggedIn,
          hasQrCode: !!status.qrCode
        });

        return {
          success: true,
          inboxId,
          status: {
            connected: status.connected,
            loggedIn: status.loggedIn,
            qrCode: status.qrCode
          },
          source: 'provider',
          cachedAt
        };
      } catch (providerError) {
        // Provider unavailable - return error, NEVER use cache as authoritative
        logger.error('Provider unavailable', {
          inboxId,
          provider: inbox.provider_type || 'wuzapi',
          error: providerError.message,
          code: providerError.code
        });

        return {
          success: false,
          inboxId,
          status: { connected: false, loggedIn: false },
          source: 'error',
          error: this._mapProviderError(providerError),
          code: providerError.code || 'PROVIDER_ERROR'
        };
      }
    } catch (error) {
      logger.error('InboxStatusService.getStatus failed', {
        inboxId,
        error: error.message
      });

      return {
        success: false,
        inboxId,
        status: { connected: false, loggedIn: false },
        source: 'error',
        error: 'Erro interno ao consultar status',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get status for multiple inboxes in parallel
   * @param {string[]} inboxIds - Array of inbox IDs
   * @returns {Promise<Map<string, InboxStatusResult>>}
   */
  async getMultipleStatus(inboxIds) {
    const results = await Promise.all(
      inboxIds.map(id => this.getStatus(id))
    );

    return new Map(results.map((result, index) => [inboxIds[index], result]));
  }

  /**
   * Get inbox from database
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<Object|null>}
   * @private
   */
  async _getInbox(inboxId) {
    try {
      const { data, error } = await this.supabase.getById('inboxes', inboxId);
      
      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get inbox', {
        inboxId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update status cache in Supabase
   * This is for optimization only - NEVER use as source of truth
   * 
   * @param {string} inboxId - Inbox ID
   * @param {Object} status - Status from provider
   * @private
   */
  async _updateStatusCache(inboxId, status) {
    try {
      await this.supabase.update('inboxes', inboxId, {
        wuzapi_connected: status.loggedIn,
        status_cached_at: new Date().toISOString()
      });

      logger.debug('Status cache updated', {
        inboxId,
        loggedIn: status.loggedIn
      });
    } catch (error) {
      // Log but don't throw - cache update is not critical
      logger.warn('Failed to update status cache', {
        inboxId,
        error: error.message
      });
    }
  }

  /**
   * Map provider error to user-friendly message
   * @param {Error} error - Provider error
   * @returns {string} User-friendly error message
   * @private
   */
  _mapProviderError(error) {
    if (error instanceof ProviderTimeoutError) {
      return 'Tempo limite excedido ao conectar com o provedor';
    }

    if (error instanceof ProviderUnavailableError) {
      return 'Não foi possível conectar com o provedor';
    }

    if (error instanceof InvalidTokenError) {
      return 'Token de autenticação inválido';
    }

    if (error instanceof RateLimitedError) {
      return 'Muitas requisições, tente novamente em alguns segundos';
    }

    // Map by error code
    const errorMap = {
      'TIMEOUT': 'Tempo limite excedido ao conectar com o provedor',
      'CONNECTION_ERROR': 'Não foi possível conectar com o provedor',
      'INVALID_TOKEN': 'Token de autenticação inválido',
      'RATE_LIMITED': 'Muitas requisições, tente novamente em alguns segundos',
      'PROVIDER_UNAVAILABLE': 'Provedor indisponível'
    };

    return errorMap[error.code] || 'Erro ao consultar status do provedor';
  }

  /**
   * Check if cached status is stale (> 60 seconds old)
   * Note: This is informational only - we ALWAYS query the provider
   * 
   * @param {Object} inbox - Inbox object with status_cached_at
   * @returns {boolean} True if cache is stale
   */
  isCacheStale(inbox) {
    if (!inbox.status_cached_at) {
      return true;
    }

    const cachedAt = new Date(inbox.status_cached_at);
    const now = new Date();
    const ageMs = now.getTime() - cachedAt.getTime();
    
    // Cache is stale if older than 60 seconds
    return ageMs > 60000;
  }
}

// Export singleton instance
module.exports = new InboxStatusService();
