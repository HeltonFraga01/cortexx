/**
 * WuzapiAdapter - Provider adapter for WUZAPI WhatsApp API
 * 
 * Implements the ProviderAdapter interface for WUZAPI.
 * Uses the existing wuzapiClient for HTTP communication.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5 (wuzapi-status-source-of-truth spec)
 */

const ProviderAdapter = require('./ProviderAdapter');
const { 
  ProviderUnavailableError, 
  InvalidTokenError, 
  ProviderTimeoutError,
  RateLimitedError 
} = require('./errors');
const wuzapiClient = require('../../utils/wuzapiClient');
const { logger } = require('../../utils/logger');

class WuzapiAdapter extends ProviderAdapter {
  /**
   * Provider type identifier
   * @type {string}
   * @readonly
   */
  get providerType() {
    return 'wuzapi';
  }

  /**
   * Get connection status from WUZAPI
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<import('./ProviderAdapter').ProviderStatus>}
   */
  async getStatus(inbox) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      logger.warn('WuzapiAdapter.getStatus: No token configured', { inboxId: inbox.id });
      return {
        connected: false,
        loggedIn: false,
        error: 'Token não configurado'
      };
    }

    try {
      const response = await wuzapiClient.get('/session/status', {
        headers: { 'token': config.token }
      });

      if (!response.success) {
        return this._handleErrorResponse(response, inbox.id);
      }

      // WUZAPI response structure: { code, data: { connected, loggedIn, jid, ... }, success }
      // wuzapiClient wraps it: { success, status, data: <wuzapi response> }
      const wuzapiResponse = response.data;
      const data = wuzapiResponse?.data || wuzapiResponse;
      
      logger.debug('WuzapiAdapter.getStatus raw response', {
        inboxId: inbox.id,
        wuzapiSuccess: wuzapiResponse?.success,
        connected: data?.connected,
        loggedIn: data?.loggedIn,
        hasJid: !!data?.jid
      });
      
      return {
        connected: data?.connected === true,
        loggedIn: data?.loggedIn === true,
        qrCode: data?.qrcode || undefined
      };
    } catch (error) {
      logger.error('WuzapiAdapter.getStatus failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Initiate connection to WUZAPI
   * @param {Object} inbox - Inbox object with provider_config
   * @param {import('./ProviderAdapter').ConnectOptions} [options]
   */
  async connect(inbox, options = {}) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      const response = await wuzapiClient.post('/session/connect', {
        Subscribe: options.subscribe || ['Message'],
        Immediate: options.immediate ?? false
      }, {
        headers: { 'token': config.token }
      });

      if (!response.success) {
        const error = this._handleErrorResponse(response, inbox.id);
        throw new ProviderUnavailableError(this.providerType, new Error(error.error));
      }

      logger.info('WuzapiAdapter.connect successful', { inboxId: inbox.id });
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof InvalidTokenError) {
        throw error;
      }
      logger.error('WuzapiAdapter.connect failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Disconnect from WUZAPI (keeps session)
   * @param {Object} inbox - Inbox object with provider_config
   */
  async disconnect(inbox) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      const response = await wuzapiClient.post('/session/disconnect', {}, {
        headers: { 'token': config.token }
      });

      if (!response.success) {
        logger.warn('WuzapiAdapter.disconnect returned error', {
          inboxId: inbox.id,
          error: response.error
        });
      }

      logger.info('WuzapiAdapter.disconnect successful', { inboxId: inbox.id });
    } catch (error) {
      logger.error('WuzapiAdapter.disconnect failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Logout from WUZAPI (clears session)
   * @param {Object} inbox - Inbox object with provider_config
   */
  async logout(inbox) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      const response = await wuzapiClient.post('/session/logout', {}, {
        headers: { 'token': config.token }
      });

      if (!response.success) {
        logger.warn('WuzapiAdapter.logout returned error', {
          inboxId: inbox.id,
          error: response.error
        });
      }

      logger.info('WuzapiAdapter.logout successful', { inboxId: inbox.id });
    } catch (error) {
      logger.error('WuzapiAdapter.logout failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Send a message through WUZAPI
   * @param {Object} inbox - Inbox object with provider_config
   * @param {import('./ProviderAdapter').OutgoingMessage} message
   * @returns {Promise<import('./ProviderAdapter').MessageResult>}
   */
  async sendMessage(inbox, message) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      // Format phone number for WUZAPI (add @s.whatsapp.net if needed)
      const phone = this._formatPhoneNumber(message.to);
      
      const payload = {
        Phone: phone,
        Body: message.text || ''
      };

      const response = await wuzapiClient.post('/chat/send/text', payload, {
        headers: { 'token': config.token }
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Falha ao enviar mensagem'
        };
      }

      return {
        success: true,
        messageId: response.data?.Id || response.data?.id
      };
    } catch (error) {
      logger.error('WuzapiAdapter.sendMessage failed', {
        inboxId: inbox.id,
        to: message.to,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Configure webhook for WUZAPI
   * @param {Object} inbox - Inbox object with provider_config
   * @param {string} url - Webhook URL
   * @param {string[]} events - Events to receive
   */
  async setWebhook(inbox, url, events) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      // WUZAPI API: POST /webhook with Token header
      const response = await wuzapiClient.post('/webhook', {
        webhookURL: url,
        Subscribe: events
      }, {
        headers: { 'Token': config.token }
      });

      if (!response.success) {
        throw new ProviderUnavailableError(this.providerType, new Error(response.error));
      }

      logger.info('WuzapiAdapter.setWebhook successful', { 
        inboxId: inbox.id, 
        url,
        events 
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        throw error;
      }
      logger.error('WuzapiAdapter.setWebhook failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Get current webhook configuration from WUZAPI
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<import('./ProviderAdapter').WebhookConfig>}
   */
  async getWebhook(inbox) {
    const config = this.getConfig(inbox);
    
    if (!config.token) {
      throw new InvalidTokenError(this.providerType);
    }

    try {
      // WUZAPI API: GET /webhook with Token header
      const response = await wuzapiClient.get('/webhook', {
        headers: { 'Token': config.token }
      });

      if (!response.success) {
        return {
          url: '',
          events: [],
          status: 'error'
        };
      }

      // WUZAPI returns: { code: 200, data: { subscribe: [...], webhook: "..." }, success: true }
      const data = response.data?.data || response.data || {};
      return {
        url: data.webhook || '',
        events: data.subscribe || [],
        status: data.webhook ? 'active' : 'inactive'
      };
    } catch (error) {
      logger.error('WuzapiAdapter.getWebhook failed', {
        inboxId: inbox.id,
        error: error.message
      });
      throw this._mapError(error);
    }
  }

  /**
   * Handle error response from WUZAPI
   * @param {Object} response - WUZAPI response
   * @param {string} inboxId - Inbox ID for logging
   * @returns {import('./ProviderAdapter').ProviderStatus}
   * @private
   */
  _handleErrorResponse(response, inboxId) {
    const status = response.status;
    const errorMessage = response.error || 'Erro desconhecido';

    logger.warn('WuzapiAdapter received error response', {
      inboxId,
      status,
      error: errorMessage
    });

    // Map HTTP status to appropriate response
    if (status === 401 || status === 403) {
      return {
        connected: false,
        loggedIn: false,
        error: 'Token inválido ou expirado'
      };
    }

    if (status === 429) {
      return {
        connected: false,
        loggedIn: false,
        error: 'Muitas requisições, tente novamente'
      };
    }

    return {
      connected: false,
      loggedIn: false,
      error: errorMessage
    };
  }

  /**
   * Map error to provider-specific error
   * @param {Error} error - Original error
   * @returns {Error} Mapped error
   * @private
   */
  _mapError(error) {
    if (error.code === 'TIMEOUT' || error.code === 'ECONNABORTED') {
      return new ProviderTimeoutError(this.providerType, 30000);
    }

    if (error.code === 'CONNECTION_ERROR' || error.code === 'ECONNREFUSED') {
      return new ProviderUnavailableError(this.providerType, error);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return new InvalidTokenError(this.providerType);
    }

    if (error.response?.status === 429) {
      return new RateLimitedError(this.providerType);
    }

    return new ProviderUnavailableError(this.providerType, error);
  }

  /**
   * Format phone number for WUZAPI
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone number
   * @private
   */
  _formatPhoneNumber(phone) {
    // Remove non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // WUZAPI expects just the number without @s.whatsapp.net
    return cleaned;
  }
}

module.exports = WuzapiAdapter;
