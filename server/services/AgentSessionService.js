/**
 * AgentSessionService - Service for managing agent sessions
 * 
 * Handles session creation, validation, and management for agent authentication.
 * 
 * Requirements: 2.10, 6.1, 6.3
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Session expiration time (24 hours in milliseconds)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

class AgentSessionService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate a unique session ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Generate a secure session token
   * @returns {string} Secure random token
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session for an agent
   * @param {Object} data - Session data
   * @param {string} data.agentId - Agent ID
   * @param {string} data.accountId - Account ID
   * @param {string} [data.ipAddress] - Client IP address
   * @param {string} [data.userAgent] - Client user agent
   * @returns {Promise<Object>} Created session
   */
  async createSession(data) {
    try {
      const id = this.generateId();
      const token = this.generateSessionToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

      const sql = `
        INSERT INTO agent_sessions (id, agent_id, account_id, token, ip_address, user_agent, expires_at, created_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        data.agentId,
        data.accountId,
        token,
        data.ipAddress || null,
        data.userAgent || null,
        expiresAt.toISOString(),
        now.toISOString(),
        now.toISOString()
      ]);

      logger.info('Agent session created', { sessionId: id, agentId: data.agentId });

      return {
        id,
        agentId: data.agentId,
        accountId: data.accountId,
        token,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        lastActivityAt: now.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create session', { error: error.message, agentId: data.agentId });
      throw error;
    }
  }

  /**
   * Get session by token
   * @param {string} token - Session token
   * @returns {Promise<Object|null>} Session or null
   */
  async getSessionByToken(token) {
    try {
      const sql = 'SELECT * FROM agent_sessions WHERE token = ?';
      const result = await this.db.query(sql, [token]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatSession(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get session', { error: error.message });
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session or null
   */
  async getSessionById(sessionId) {
    try {
      const sql = 'SELECT * FROM agent_sessions WHERE id = ?';
      const result = await this.db.query(sql, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatSession(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get session by ID', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Validate a session token
   * @param {string} token - Session token
   * @returns {Promise<Object>} Validation result with session and agent data
   */
  async validateSession(token) {
    const session = await this.getSessionByToken(token);

    if (!session) {
      return { valid: false, error: 'SESSION_NOT_FOUND' };
    }

    if (new Date(session.expiresAt) < new Date()) {
      // Clean up expired session
      await this.deleteSession(session.id);
      return { valid: false, error: 'SESSION_EXPIRED' };
    }

    // Update last activity
    await this.updateLastActivity(session.id);

    return { valid: true, session };
  }

  /**
   * Update session last activity timestamp
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async updateLastActivity(sessionId) {
    try {
      const sql = 'UPDATE agent_sessions SET last_activity_at = ? WHERE id = ?';
      await this.db.query(sql, [new Date().toISOString(), sessionId]);
    } catch (error) {
      logger.error('Failed to update last activity', { error: error.message, sessionId });
      // Don't throw - this is not critical
    }
  }

  /**
   * Extend session expiration
   * @param {string} sessionId - Session ID
   * @param {number} [extensionMs] - Extension time in milliseconds (default: SESSION_EXPIRY_MS)
   * @returns {Promise<Object>} Updated session
   */
  async extendSession(sessionId, extensionMs = SESSION_EXPIRY_MS) {
    try {
      const newExpiresAt = new Date(Date.now() + extensionMs);
      
      const sql = 'UPDATE agent_sessions SET expires_at = ?, last_activity_at = ? WHERE id = ?';
      await this.db.query(sql, [newExpiresAt.toISOString(), new Date().toISOString(), sessionId]);

      return this.getSessionById(sessionId);
    } catch (error) {
      logger.error('Failed to extend session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Delete a session (logout)
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    try {
      const sql = 'DELETE FROM agent_sessions WHERE id = ?';
      await this.db.query(sql, [sessionId]);
      logger.info('Session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Delete session by token
   * @param {string} token - Session token
   * @returns {Promise<void>}
   */
  async deleteSessionByToken(token) {
    try {
      const sql = 'DELETE FROM agent_sessions WHERE token = ?';
      await this.db.query(sql, [token]);
      logger.info('Session deleted by token');
    } catch (error) {
      logger.error('Failed to delete session by token', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete all sessions for an agent
   * @param {string} agentId - Agent ID
   * @param {string} [exceptSessionId] - Session ID to keep
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteAgentSessions(agentId, exceptSessionId = null) {
    try {
      let sql = 'DELETE FROM agent_sessions WHERE agent_id = ?';
      const params = [agentId];

      if (exceptSessionId) {
        sql += ' AND id != ?';
        params.push(exceptSessionId);
      }

      const result = await this.db.query(sql, params);
      logger.info('Agent sessions deleted', { agentId, count: result.rowCount, exceptSessionId });
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to delete agent sessions', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Delete all sessions for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteAccountSessions(accountId) {
    try {
      const sql = 'DELETE FROM agent_sessions WHERE account_id = ?';
      const result = await this.db.query(sql, [accountId]);
      logger.info('Account sessions deleted', { accountId, count: result.rowCount });
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to delete account sessions', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List sessions for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of sessions
   */
  async listAgentSessions(agentId) {
    try {
      const sql = 'SELECT * FROM agent_sessions WHERE agent_id = ? ORDER BY created_at DESC';
      const result = await this.db.query(sql, [agentId]);
      return result.rows.map(row => this.formatSession(row));
    } catch (error) {
      logger.error('Failed to list agent sessions', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of deleted sessions
   */
  async cleanupExpiredSessions() {
    try {
      const sql = 'DELETE FROM agent_sessions WHERE expires_at < ?';
      const result = await this.db.query(sql, [new Date().toISOString()]);
      
      if (result.rowCount > 0) {
        logger.info('Expired sessions cleaned up', { count: result.rowCount });
      }
      
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get session count for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<number>} Session count
   */
  async getSessionCount(agentId) {
    try {
      const sql = 'SELECT COUNT(*) as count FROM agent_sessions WHERE agent_id = ? AND expires_at > ?';
      const result = await this.db.query(sql, [agentId, new Date().toISOString()]);
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to get session count', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Format session row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted session
   */
  formatSession(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      accountId: row.account_id,
      token: row.token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at
    };
  }
}

module.exports = AgentSessionService;
