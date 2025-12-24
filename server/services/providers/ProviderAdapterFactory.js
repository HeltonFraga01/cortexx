/**
 * ProviderAdapterFactory - Factory for creating and managing provider adapters
 * 
 * Centralizes adapter registration and retrieval.
 * Supports multiple providers (WUZAPI, Evolution, WattsMill, etc.)
 * 
 * Requirements: 1.3, 1.4 (wuzapi-status-source-of-truth spec)
 */

const { logger } = require('../../utils/logger');

class ProviderAdapterFactory {
  /**
   * Map of registered adapters by provider type
   * @type {Map<string, import('./ProviderAdapter')>}
   * @private
   */
  static adapters = new Map();

  /**
   * Whether the factory has been initialized
   * @type {boolean}
   * @private
   */
  static initialized = false;

  /**
   * Register a provider adapter
   * @param {import('./ProviderAdapter')} adapter - Adapter instance
   */
  static register(adapter) {
    const providerType = adapter.providerType;
    
    if (this.adapters.has(providerType)) {
      logger.warn('ProviderAdapterFactory: Overwriting existing adapter', { providerType });
    }

    this.adapters.set(providerType, adapter);
    logger.info('ProviderAdapterFactory: Adapter registered', { providerType });
  }

  /**
   * Get adapter by provider type
   * @param {string} providerType - Provider type (wuzapi, evolution, wattsmill)
   * @returns {import('./ProviderAdapter')} Provider adapter
   * @throws {Error} If adapter not found
   */
  static getAdapter(providerType) {
    // Ensure factory is initialized
    this._ensureInitialized();

    const adapter = this.adapters.get(providerType);
    
    if (!adapter) {
      const availableTypes = Array.from(this.adapters.keys()).join(', ');
      throw new Error(
        `Provider adapter not found: '${providerType}'. Available: ${availableTypes || 'none'}`
      );
    }

    return adapter;
  }

  /**
   * Get adapter for a specific inbox
   * @param {Object} inbox - Inbox object with provider_type field
   * @returns {import('./ProviderAdapter')} Provider adapter
   * @throws {Error} If adapter not found
   */
  static getAdapterForInbox(inbox) {
    // Support both camelCase and snake_case
    const providerType = inbox.providerType || inbox.provider_type || 'wuzapi';
    return this.getAdapter(providerType);
  }

  /**
   * Check if an adapter is registered for a provider type
   * @param {string} providerType - Provider type
   * @returns {boolean} True if adapter is registered
   */
  static hasAdapter(providerType) {
    this._ensureInitialized();
    return this.adapters.has(providerType);
  }

  /**
   * Get all registered provider types
   * @returns {string[]} List of provider types
   */
  static getRegisteredTypes() {
    this._ensureInitialized();
    return Array.from(this.adapters.keys());
  }

  /**
   * Ensure factory is initialized with default adapters
   * @private
   */
  static _ensureInitialized() {
    if (this.initialized) {
      return;
    }

    // Register default adapters
    try {
      const WuzapiAdapter = require('./WuzapiAdapter');
      this.register(new WuzapiAdapter());
    } catch (error) {
      logger.error('ProviderAdapterFactory: Failed to register WuzapiAdapter', {
        error: error.message
      });
    }

    // Future adapters can be registered here:
    // const EvolutionAdapter = require('./EvolutionAdapter');
    // this.register(new EvolutionAdapter());
    
    // const WattsMillAdapter = require('./WattsMillAdapter');
    // this.register(new WattsMillAdapter());

    this.initialized = true;
    logger.info('ProviderAdapterFactory: Initialized', {
      adapters: Array.from(this.adapters.keys())
    });
  }

  /**
   * Reset factory (for testing)
   */
  static reset() {
    this.adapters.clear();
    this.initialized = false;
  }
}

module.exports = ProviderAdapterFactory;
