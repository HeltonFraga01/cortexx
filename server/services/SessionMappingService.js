/**
 * Session Mapping Service
 * 
 * Maps WUZAPI session IDs to user tokens for webhook processing.
 * Maintains an in-memory cache for fast lookups with database persistence.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class SessionMappingService {
  constructor() {
    this.cache = new Map(); // sessionId -> { token, instanceName, jid }
  }

  /**
   * Register or update a session mapping
   * @param {string} sessionId - WUZAPI session ID (userID from webhook)
   * @param {string} userToken - User's authentication token
   * @param {Object} metadata - Additional metadata (instanceName, jid, accountId, wuzapiToken)
   */
  async registerMapping(sessionId, userToken, metadata = {}) {
    if (!sessionId || !userToken) {
      logger.warn('SessionMappingService: Invalid parameters', { sessionId, userToken });
      return;
    }

    const { instanceName, jid, accountId, wuzapiToken } = metadata;

    try {
      // Update cache
      this.cache.set(sessionId, { token: userToken, instanceName, jid });

      // Get account_id from token if not provided
      let resolvedAccountId = accountId;
      let resolvedWuzapiToken = wuzapiToken || userToken;
      
      if (!resolvedAccountId) {
        // Try to get account from token
        const { data: account } = await SupabaseService.queryAsAdmin('accounts', (query) =>
          query.select('id, token').eq('token', userToken).single()
        );
        if (account) {
          resolvedAccountId = account.id;
          resolvedWuzapiToken = account.token;
        }
      }

      // If we still don't have account_id, skip database persistence but keep cache
      if (!resolvedAccountId) {
        logger.debug('Session mapping cached only (no account found)', {
          sessionId: sessionId.substring(0, 10) + '...'
        });
        return;
      }

      // Persist to database (upsert) using Supabase
      // Table requires: wuzapi_token (NOT NULL), account_id (NOT NULL)
      const { error } = await SupabaseService.queryAsAdmin('session_token_mapping', (query) =>
        query.upsert({
          session_id: sessionId,
          user_token: userToken,
          wuzapi_token: resolvedWuzapiToken,
          account_id: resolvedAccountId,
          instance_name: instanceName || null,
          jid: jid || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' })
      );

      if (error) {
        throw error;
      }

      logger.info('Session mapping registered', {
        sessionId: sessionId.substring(0, 10) + '...',
        token: userToken.substring(0, 10) + '...',
        instanceName
      });
    } catch (error) {
      logger.error('Failed to register session mapping', {
        error: error.message,
        sessionId: sessionId.substring(0, 10)
      });
    }
  }

  /**
   * Get user token from session ID
   * @param {string} sessionId - WUZAPI session ID
   * @returns {Promise<string|null>} User token or null if not found
   */
  async getTokenFromSessionId(sessionId) {
    if (!sessionId) return null;

    // Check cache first
    const cached = this.cache.get(sessionId);
    if (cached) {
      return cached.token;
    }

    // Query database using Supabase
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('session_token_mapping', (query) =>
        query.select('user_token').eq('session_id', sessionId).single()
      );

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected when not found
        throw error;
      }

      if (data) {
        const token = data.user_token;
        // Update cache
        this.cache.set(sessionId, { token });
        return token;
      }
    } catch (error) {
      logger.error('Failed to get token from session ID', {
        error: error.message,
        sessionId: sessionId.substring(0, 10)
      });
    }

    return null;
  }

  /**
   * Load all mappings from database into cache
   */
  async loadCache() {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('session_token_mapping', (query) =>
        query.select('session_id, user_token, instance_name, jid')
      );

      if (error) {
        throw error;
      }

      for (const row of (data || [])) {
        this.cache.set(row.session_id, {
          token: row.user_token,
          instanceName: row.instance_name,
          jid: row.jid
        });
      }

      logger.info('Session mapping cache loaded', { count: (data || []).length });
    } catch (error) {
      // Table might not exist yet
      logger.warn('Failed to load session mapping cache', { error: error.message });
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Singleton instance
let instance = null;

function getSessionMappingService() {
  if (!instance) {
    instance = new SessionMappingService();
  }
  return instance;
}

module.exports = { SessionMappingService, getSessionMappingService };
