/**
 * Session Mapping Service
 * 
 * Maps WUZAPI session IDs to user tokens for webhook processing.
 * Maintains an in-memory cache for fast lookups with database persistence.
 */

const { logger } = require('../utils/logger');

class SessionMappingService {
  constructor(db) {
    this.db = db;
    this.cache = new Map(); // sessionId -> { token, instanceName, jid }
  }

  /**
   * Register or update a session mapping
   * @param {string} sessionId - WUZAPI session ID (userID from webhook)
   * @param {string} userToken - User's authentication token
   * @param {Object} metadata - Additional metadata (instanceName, jid)
   */
  async registerMapping(sessionId, userToken, metadata = {}) {
    if (!sessionId || !userToken) {
      logger.warn('SessionMappingService: Invalid parameters', { sessionId, userToken });
      return;
    }

    const { instanceName, jid } = metadata;

    try {
      // Update cache
      this.cache.set(sessionId, { token: userToken, instanceName, jid });

      // Persist to database (upsert)
      await this.db.query(`
        INSERT INTO session_token_mapping (session_id, user_token, instance_name, jid, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(session_id) DO UPDATE SET
          user_token = excluded.user_token,
          instance_name = excluded.instance_name,
          jid = excluded.jid,
          updated_at = datetime('now')
      `, [sessionId, userToken, instanceName || null, jid || null]);

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

    // Query database
    try {
      const { rows } = await this.db.query(
        'SELECT user_token FROM session_token_mapping WHERE session_id = ?',
        [sessionId]
      );

      if (rows.length > 0) {
        const token = rows[0].user_token;
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
      const { rows } = await this.db.query(
        'SELECT session_id, user_token, instance_name, jid FROM session_token_mapping'
      );

      for (const row of rows) {
        this.cache.set(row.session_id, {
          token: row.user_token,
          instanceName: row.instance_name,
          jid: row.jid
        });
      }

      logger.info('Session mapping cache loaded', { count: rows.length });
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

function getSessionMappingService(db) {
  if (!instance && db) {
    instance = new SessionMappingService(db);
  }
  return instance;
}

module.exports = { SessionMappingService, getSessionMappingService };
