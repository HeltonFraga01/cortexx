/**
 * UserSessionService - Service for managing independent user sessions
 * 
 * Handles session creation, validation, and management for user authentication.
 * 
 * Requirements: 2.1, 2.4, 7.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const supabaseService = require('./SupabaseService');

// Session expiration time (24 hours in milliseconds)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

class UserSessionService {
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
   * Create a new session for a user
   * @param {Object} data - Session data
   * @param {string} data.userId - User ID
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

      const sessionData = {
        id,
        user_id: data.userId,
        session_token: token,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString()
      };

      const { error } = await supabaseService.insert('user_sessions', sessionData);

      if (error) {
        throw error;
      }

      logger.info('User session created', { sessionId: id, userId: data.userId });

      return {
        id,
        userId: data.userId,
        token,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        lastActivityAt: now.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create user session', { error: error.message, userId: data.userId });
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
      const queryFn = (query) => query
        .select('*')
        .eq('session_token', token)
        .single();

      const { data: session, error } = await supabaseService.queryAsAdmin('user_sessions', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return session ? this.formatSession(session) : null;
    } catch (error) {
      logger.error('Failed to get user session', { error: error.message });
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
      const { data: session, error } = await supabaseService.getById('user_sessions', sessionId);

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return session ? this.formatSession(session) : null;
    } catch (error) {
      logger.error('Failed to get user session by ID', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Validate a session token
   * @param {string} token - Session token
   * @returns {Promise<Object>} Validation result with session data
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
      await supabaseService.update('user_sessions', sessionId, {
        last_activity_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update last activity', { error: error.message, sessionId });
      // Don't throw - this is not critical
    }
  }

  /**
   * Extend session expiration
   * @param {string} sessionId - Session ID
   * @param {number} [extensionMs] - Extension time in milliseconds
   * @returns {Promise<Object>} Updated session
   */
  async extendSession(sessionId, extensionMs = SESSION_EXPIRY_MS) {
    try {
      const newExpiresAt = new Date(Date.now() + extensionMs);
      
      await supabaseService.update('user_sessions', sessionId, {
        expires_at: newExpiresAt.toISOString(),
        last_activity_at: new Date().toISOString()
      });

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
      await supabaseService.delete('user_sessions', sessionId);
      logger.info('User session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete user session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Delete all sessions for a user
   * @param {string} userId - User ID
   * @param {string} [exceptSessionId] - Session ID to keep (optional)
   * @returns {Promise<void>}
   */
  async deleteUserSessions(userId, exceptSessionId = null) {
    try {
      const queryFn = (query) => {
        let q = query.delete().eq('user_id', userId);
        if (exceptSessionId) {
          q = q.neq('id', exceptSessionId);
        }
        return q;
      };

      const { error } = await supabaseService.queryAsAdmin('user_sessions', queryFn);

      if (error) {
        throw error;
      }

      logger.info('User sessions deleted', { userId, exceptSessionId });
    } catch (error) {
      logger.error('Failed to delete user sessions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} List of sessions
   */
  async getUserSessions(userId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      const { data: sessions, error } = await supabaseService.queryAsAdmin('user_sessions', queryFn);

      if (error) {
        throw error;
      }

      return (sessions || []).map(s => this.formatSession(s));
    } catch (error) {
      logger.error('Failed to get user sessions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<void>}
   */
  async cleanupExpiredSessions() {
    try {
      const queryFn = (query) => query
        .delete()
        .lt('expires_at', new Date().toISOString());

      const { error } = await supabaseService.queryAsAdmin('user_sessions', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Expired user sessions cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup expired user sessions', { error: error.message });
      throw error;
    }
  }

  /**
   * Format session from database row
   * @param {Object} row - Database row
   * @returns {Object} Formatted session
   */
  formatSession(row) {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.session_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at
    };
  }
}

module.exports = new UserSessionService();
