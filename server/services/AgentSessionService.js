/**
 * AgentSessionService - Service for managing agent sessions using Supabase
 * 
 * Handles session creation, validation, and management for agent authentication.
 * 
 * Requirements: 2.10, 6.1, 6.3
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const supabaseService = require('./SupabaseService');

// Session expiration time (24 hours in milliseconds)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

class AgentSessionService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
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

      const sessionData = {
        id,
        agent_id: data.agentId,
        session_token: token,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString()
      };

      const { error } = await supabaseService.insert('agent_sessions', sessionData);

      if (error) {
        throw error;
      }

      logger.info('Agent session created', { sessionId: id, agentId: data.agentId });

      return {
        id,
        agentId: data.agentId,
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
      const queryFn = (query) => query
        .select('*')
        .eq('session_token', token)
        .single();

      const { data: session, error } = await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      return session ? this.formatSession(session) : null;
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
      const { data: session, error } = await supabaseService.getById('agent_sessions', sessionId);

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return session ? this.formatSession(session) : null;
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
      await supabaseService.update('agent_sessions', sessionId, {
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
   * @param {number} [extensionMs] - Extension time in milliseconds (default: SESSION_EXPIRY_MS)
   * @returns {Promise<Object>} Updated session
   */
  async extendSession(sessionId, extensionMs = SESSION_EXPIRY_MS) {
    try {
      const newExpiresAt = new Date(Date.now() + extensionMs);
      
      await supabaseService.update('agent_sessions', sessionId, {
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
      await supabaseService.delete('agent_sessions', sessionId);
      logger.info('Session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Delete all sessions for an agent
   * @param {string} agentId - Agent ID
   * @param {string} [exceptSessionId] - Session ID to keep (optional)
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteAgentSessions(agentId, exceptSessionId = null) {
    try {
      const queryFn = (query) => {
        let q = query.delete().eq('agent_id', agentId);
        if (exceptSessionId) {
          q = q.neq('id', exceptSessionId);
        }
        return q;
      };

      const { error } = await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Agent sessions deleted', { agentId, exceptSessionId });
      return 1; // Supabase doesn't return count for delete
    } catch (error) {
      logger.error('Failed to delete agent sessions', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Delete all sessions for an account (via agents)
   * Note: agent_sessions doesn't have account_id, so we need to get agents first
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteAccountSessions(accountId) {
    try {
      // Get all agents for this account
      const { data: agents, error: agentsError } = await supabaseService.getMany('agents', { account_id: accountId });
      
      if (agentsError) {
        throw agentsError;
      }

      if (!agents || agents.length === 0) {
        logger.info('No agents found for account', { accountId });
        return 0;
      }

      // Delete sessions for each agent
      const agentIds = agents.map(a => a.id);
      const queryFn = (query) => query.delete().in('agent_id', agentIds);

      const { error } = await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Account sessions deleted', { accountId, agentCount: agents.length });
      return 1;
    } catch (error) {
      logger.error('Failed to delete account sessions', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get all active sessions for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of sessions
   */
  async getAgentSessions(agentId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('agent_id', agentId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      const { data: sessions, error } = await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      if (error) {
        throw error;
      }

      return (sessions || []).map(s => this.formatSession(s));
    } catch (error) {
      logger.error('Failed to get agent sessions', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of deleted sessions
   */
  async cleanupExpiredSessions() {
    try {
      const queryFn = (query) => query
        .delete()
        .lt('expires_at', new Date().toISOString());

      const { error } = await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Expired sessions cleaned up');
      return 1;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error: error.message });
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
      agentId: row.agent_id,
      token: row.session_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at
    };
  }
}

module.exports = AgentSessionService;
