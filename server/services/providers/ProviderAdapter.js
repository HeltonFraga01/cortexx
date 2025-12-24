/**
 * ProviderAdapter - Base class and interface for provider adapters
 * 
 * All provider adapters (WUZAPI, Evolution, WattsMill, etc.) must extend this class
 * and implement all required methods.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 (wuzapi-status-source-of-truth spec)
 */

const { MethodNotSupportedError } = require('./errors');

/**
 * @typedef {Object} ProviderStatus
 * @property {boolean} connected - TCP connection established
 * @property {boolean} loggedIn - Authenticated and can send messages
 * @property {string} [qrCode] - QR code for authentication (if needed)
 * @property {string} [error] - Error message (if any)
 */

/**
 * @typedef {Object} ConnectOptions
 * @property {string[]} [subscribe] - Events to subscribe to
 * @property {boolean} [immediate] - Connect immediately
 */

/**
 * @typedef {Object} OutgoingMessage
 * @property {string} to - Recipient phone number or JID
 * @property {string} [text] - Text message content
 * @property {Object} [media] - Media attachment
 * @property {string} [template] - Template name
 * @property {Object} [templateParams] - Template parameters
 */

/**
 * @typedef {Object} MessageResult
 * @property {boolean} success - Whether message was sent
 * @property {string} [messageId] - Message ID from provider
 * @property {string} [error] - Error message (if failed)
 */

/**
 * @typedef {Object} WebhookConfig
 * @property {string} url - Webhook URL
 * @property {string[]} events - Events to receive
 * @property {string} [status] - Webhook status
 */

/**
 * Base class for provider adapters
 * @abstract
 */
class ProviderAdapter {
  /**
   * Provider type identifier
   * @type {string}
   * @readonly
   */
  get providerType() {
    throw new Error('providerType must be implemented by subclass');
  }

  /**
   * Get connection status from provider
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<ProviderStatus>} Provider status
   * @abstract
   */
  async getStatus(inbox) {
    throw new MethodNotSupportedError(this.providerType, 'getStatus');
  }

  /**
   * Initiate connection to provider
   * @param {Object} inbox - Inbox object with provider_config
   * @param {ConnectOptions} [options] - Connection options
   * @returns {Promise<void>}
   * @abstract
   */
  async connect(inbox, options = {}) {
    throw new MethodNotSupportedError(this.providerType, 'connect');
  }

  /**
   * Disconnect from provider (keeps session)
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<void>}
   * @abstract
   */
  async disconnect(inbox) {
    throw new MethodNotSupportedError(this.providerType, 'disconnect');
  }

  /**
   * Logout from provider (clears session)
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<void>}
   * @abstract
   */
  async logout(inbox) {
    throw new MethodNotSupportedError(this.providerType, 'logout');
  }

  /**
   * Send a message through provider
   * @param {Object} inbox - Inbox object with provider_config
   * @param {OutgoingMessage} message - Message to send
   * @returns {Promise<MessageResult>}
   * @abstract
   */
  async sendMessage(inbox, message) {
    throw new MethodNotSupportedError(this.providerType, 'sendMessage');
  }

  /**
   * Configure webhook for provider
   * @param {Object} inbox - Inbox object with provider_config
   * @param {string} url - Webhook URL
   * @param {string[]} events - Events to receive
   * @returns {Promise<void>}
   * @abstract
   */
  async setWebhook(inbox, url, events) {
    throw new MethodNotSupportedError(this.providerType, 'setWebhook');
  }

  /**
   * Get current webhook configuration
   * @param {Object} inbox - Inbox object with provider_config
   * @returns {Promise<WebhookConfig>}
   * @abstract
   */
  async getWebhook(inbox) {
    throw new MethodNotSupportedError(this.providerType, 'getWebhook');
  }

  /**
   * Extract provider config from inbox
   * @param {Object} inbox - Inbox object
   * @returns {Object} Provider-specific config
   * @protected
   */
  getConfig(inbox) {
    // Support both new provider_config and legacy wuzapi_token fields
    if (inbox.provider_config && Object.keys(inbox.provider_config).length > 0) {
      return inbox.provider_config;
    }
    
    // Fallback to legacy fields for backward compatibility
    if (inbox.wuzapiToken || inbox.wuzapi_token) {
      return {
        token: inbox.wuzapiToken || inbox.wuzapi_token,
        userId: inbox.wuzapiUserId || inbox.wuzapi_user_id
      };
    }
    
    return {};
  }
}

module.exports = ProviderAdapter;
