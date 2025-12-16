/**
 * AgentService - Service for managing agents in multi-user system
 * 
 * Handles agent CRUD operations, invitation management, and authentication.
 * 
 * Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Invitation expiration time (48 hours in milliseconds)
const INVITATION_EXPIRY_MS = 48 * 60 * 60 * 1000;

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS = {
  owner: ['*'],
  administrator: [
    'conversations:view', 'conversations:create', 'conversations:assign', 'conversations:manage', 'conversations:delete',
    'messages:send', 'messages:delete',
    'contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete',
    'agents:view', 'agents:create', 'agents:edit',
    'teams:view', 'teams:manage',
    'inboxes:view', 'inboxes:manage',
    'reports:view',
    'settings:view', 'settings:edit',
    'webhooks:manage'
  ],
  agent: [
    'conversations:view', 'conversations:create', 'conversations:assign', 'conversations:manage',
    'messages:send',
    'contacts:view', 'contacts:create', 'contacts:edit',
    'teams:view',
    'inboxes:view',
    'reports:view'
  ],
  viewer: [
    'conversations:view',
    'contacts:view',
    'teams:view',
    'inboxes:view',
    'reports:view'
  ]
};

class AgentService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Generate a secure invitation token
   * @returns {string} Secure random token
   */
  generateInvitationToken() {
    return crypto.randomUUID();
  }

  /**
   * Hash a password using crypto
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Stored hash
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  // ==================== INVITATION MANAGEMENT ====================

  /**
   * Create an invitation for a new agent
   * @param {string} accountId - Account ID
   * @param {Object} data - Invitation data
   * @param {string} [data.email] - Optional email for the invitation
   * @param {string} [data.role] - Role for the new agent (default: 'agent')
   * @param {string} [data.customRoleId] - Custom role ID (optional)
   * @param {string} createdBy - Agent ID who created the invitation
   * @returns {Promise<Object>} Created invitation with token
   */
  async createInvitation(accountId, data, createdBy) {
    try {
      const id = this.generateId();
      const token = this.generateInvitationToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_MS);

      const sql = `
        INSERT INTO agent_invitations (id, account_id, email, token, role, custom_role_id, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        accountId,
        data.email || null,
        token,
        data.role || 'agent',
        data.customRoleId || null,
        expiresAt.toISOString(),
        createdBy,
        now.toISOString()
      ]);

      logger.info('Invitation created', { invitationId: id, accountId, role: data.role || 'agent' });

      return {
        id,
        accountId,
        email: data.email || null,
        token,
        role: data.role || 'agent',
        customRoleId: data.customRoleId || null,
        expiresAt: expiresAt.toISOString(),
        createdBy,
        createdAt: now.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create invitation', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get invitation by token
   * @param {string} token - Invitation token
   * @returns {Promise<Object|null>} Invitation or null if not found
   */
  async getInvitationByToken(token) {
    try {
      const sql = 'SELECT * FROM agent_invitations WHERE token = ?';
      const result = await this.db.query(sql, [token]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatInvitation(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get invitation', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate an invitation token
   * @param {string} token - Invitation token
   * @returns {Promise<Object>} Validation result with invitation data
   */
  async validateInvitation(token) {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      return { valid: false, error: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.usedAt) {
      return { valid: false, error: 'INVITATION_ALREADY_USED' };
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return { valid: false, error: 'INVITATION_EXPIRED' };
    }

    return { valid: true, invitation };
  }

  /**
   * Mark invitation as used
   * @param {string} invitationId - Invitation ID
   * @returns {Promise<void>}
   */
  async markInvitationUsed(invitationId) {
    const sql = 'UPDATE agent_invitations SET used_at = ? WHERE id = ?';
    await this.db.query(sql, [new Date().toISOString(), invitationId]);
  }

  /**
   * List invitations for an account
   * @param {string} accountId - Account ID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object[]>} List of invitations
   */
  async listInvitations(accountId, filters = {}) {
    try {
      let sql = 'SELECT * FROM agent_invitations WHERE account_id = ?';
      const params = [accountId];

      if (filters.status === 'pending') {
        sql += ' AND used_at IS NULL AND expires_at > ?';
        params.push(new Date().toISOString());
      } else if (filters.status === 'used') {
        sql += ' AND used_at IS NOT NULL';
      } else if (filters.status === 'expired') {
        sql += ' AND used_at IS NULL AND expires_at <= ?';
        params.push(new Date().toISOString());
      }

      sql += ' ORDER BY created_at DESC';

      const result = await this.db.query(sql, params);
      return result.rows.map(row => this.formatInvitation(row));
    } catch (error) {
      logger.error('Failed to list invitations', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Delete an invitation
   * @param {string} invitationId - Invitation ID
   * @returns {Promise<void>}
   */
  async deleteInvitation(invitationId) {
    const sql = 'DELETE FROM agent_invitations WHERE id = ?';
    await this.db.query(sql, [invitationId]);
    logger.info('Invitation deleted', { invitationId });
  }

  // ==================== AGENT REGISTRATION ====================

  /**
   * Complete registration via invitation link
   * @param {string} token - Invitation token
   * @param {Object} data - Registration data
   * @param {string} data.email - Agent email
   * @param {string} data.password - Agent password
   * @param {string} data.name - Agent name
   * @param {string} [data.avatarUrl] - Avatar URL
   * @returns {Promise<Object>} Created agent
   */
  async completeRegistration(token, data) {
    try {
      // Validate invitation
      const validation = await this.validateInvitation(token);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { invitation } = validation;

      // Check if email already exists in account
      const existingAgent = await this.getAgentByEmail(invitation.accountId, data.email);
      if (existingAgent) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      // Create agent
      const agent = await this.createAgentInternal({
        accountId: invitation.accountId,
        email: data.email,
        password: data.password,
        name: data.name,
        avatarUrl: data.avatarUrl,
        role: invitation.role,
        customRoleId: invitation.customRoleId,
        status: 'active'
      });

      // Mark invitation as used
      await this.markInvitationUsed(invitation.id);

      logger.info('Agent registered via invitation', { 
        agentId: agent.id, 
        accountId: invitation.accountId,
        invitationId: invitation.id 
      });

      return agent;
    } catch (error) {
      logger.error('Failed to complete registration', { error: error.message, token });
      throw error;
    }
  }

  /**
   * Get the max_agents quota for an account from their subscription plan
   * @param {string} accountId - Account ID (user_id in subscriptions)
   * @returns {Promise<number>} Max agents allowed
   */
  async getMaxAgentsQuota(accountId) {
    try {
      const result = await this.db.query(
        `SELECT p.max_agents FROM user_subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ? AND s.status IN ('trial', 'active')
         LIMIT 1`,
        [accountId]
      );
      
      if (result.rows.length === 0) {
        return 1; // Default to 1 if no subscription found
      }
      
      return result.rows[0].max_agents || 1;
    } catch (error) {
      logger.error('Failed to get max agents quota', { error: error.message, accountId });
      return 1;
    }
  }

  /**
   * Check if account can create more agents based on quota
   * @param {string} accountId - Account ID
   * @returns {Promise<{allowed: boolean, current: number, limit: number}>}
   */
  async checkAgentQuota(accountId) {
    const currentCount = await this.countAgents(accountId);
    const maxAgents = await this.getMaxAgentsQuota(accountId);
    
    return {
      allowed: currentCount < maxAgents,
      current: currentCount,
      limit: maxAgents
    };
  }

  /**
   * Create agent directly with credentials (by owner/admin)
   * @param {string} accountId - Account ID
   * @param {Object} data - Agent data
   * @param {string} data.email - Agent email
   * @param {string} data.password - Agent password
   * @param {string} data.name - Agent name
   * @param {string} [data.role] - Role (default: 'agent')
   * @param {string} [data.avatarUrl] - Avatar URL
   * @param {string} [data.customRoleId] - Custom role ID
   * @param {boolean} [data.skipQuotaCheck] - Skip quota check (for system operations)
   * @returns {Promise<Object>} Created agent
   */
  async createAgentDirect(accountId, data) {
    try {
      // Check agent quota unless explicitly skipped
      if (!data.skipQuotaCheck) {
        const quotaCheck = await this.checkAgentQuota(accountId);
        if (!quotaCheck.allowed) {
          throw new Error(`QUOTA_EXCEEDED: Cannot create agent. Current: ${quotaCheck.current}, Limit: ${quotaCheck.limit}. Please upgrade your plan to add more agents.`);
        }
      }

      // Check if email already exists in account
      const existingAgent = await this.getAgentByEmail(accountId, data.email);
      if (existingAgent) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      const agent = await this.createAgentInternal({
        accountId,
        email: data.email,
        password: data.password,
        name: data.name,
        avatarUrl: data.avatarUrl,
        role: data.role || 'agent',
        customRoleId: data.customRoleId,
        status: 'active'
      });

      logger.info('Agent created directly', { agentId: agent.id, accountId });

      return agent;
    } catch (error) {
      logger.error('Failed to create agent directly', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Internal method to create an agent
   * @private
   */
  async createAgentInternal(data) {
    const id = this.generateId();
    const now = new Date().toISOString();
    const passwordHash = await this.hashPassword(data.password);

    const sql = `
      INSERT INTO agents (
        id, account_id, email, password_hash, name, avatar_url, 
        role, custom_role_id, availability, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(sql, [
      id,
      data.accountId,
      data.email,
      passwordHash,
      data.name,
      data.avatarUrl || null,
      data.role,
      data.customRoleId || null,
      'offline',
      data.status,
      now,
      now
    ]);

    return this.getAgentById(id);
  }

  // ==================== AGENT CRUD ====================

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Agent or null
   */
  async getAgentById(agentId) {
    try {
      const sql = 'SELECT * FROM agents WHERE id = ?';
      const result = await this.db.query(sql, [agentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatAgent(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Get agent by email within an account
   * @param {string} accountId - Account ID
   * @param {string} email - Agent email
   * @returns {Promise<Object|null>} Agent or null
   */
  async getAgentByEmail(accountId, email) {
    try {
      const sql = 'SELECT * FROM agents WHERE account_id = ? AND email = ?';
      const result = await this.db.query(sql, [accountId, email]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatAgent(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get agent by email', { error: error.message, accountId, email });
      throw error;
    }
  }

  /**
   * Get agent with password hash for authentication
   * @param {string} accountId - Account ID
   * @param {string} email - Agent email
   * @returns {Promise<Object|null>} Agent with password hash or null
   */
  async getAgentForAuth(accountId, email) {
    try {
      const sql = 'SELECT * FROM agents WHERE account_id = ? AND email = ?';
      const result = await this.db.query(sql, [accountId, email]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ...this.formatAgent(row),
        passwordHash: row.password_hash,
        failedLoginAttempts: row.failed_login_attempts,
        lockedUntil: row.locked_until
      };
    } catch (error) {
      logger.error('Failed to get agent for auth', { error: error.message, accountId, email });
      throw error;
    }
  }

  /**
   * Get agent by email only (searches across all accounts)
   * Used for simplified login where user only provides email
   * @param {string} email - Agent email
   * @returns {Promise<Object|null>} Agent with password hash and account info or null
   */
  async getAgentByEmailOnly(email) {
    try {
      const sql = `
        SELECT a.*, acc.name as account_name, acc.status as account_status
        FROM agents a
        JOIN accounts acc ON a.account_id = acc.id
        WHERE a.email = ? AND a.status = 'active' AND acc.status = 'active'
        LIMIT 1
      `;
      const result = await this.db.query(sql, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ...this.formatAgent(row),
        passwordHash: row.password_hash,
        failedLoginAttempts: row.failed_login_attempts,
        lockedUntil: row.locked_until,
        accountName: row.account_name,
        accountStatus: row.account_status
      };
    } catch (error) {
      logger.error('Failed to get agent by email only', { error: error.message, email });
      throw error;
    }
  }

  /**
   * List agents for an account
   * @param {string} accountId - Account ID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object[]>} List of agents
   */
  async listAgents(accountId, filters = {}) {
    try {
      let sql = 'SELECT * FROM agents WHERE account_id = ?';
      const params = [accountId];

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.role) {
        sql += ' AND role = ?';
        params.push(filters.role);
      }

      if (filters.availability) {
        sql += ' AND availability = ?';
        params.push(filters.availability);
      }

      sql += ' ORDER BY created_at DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }

      const result = await this.db.query(sql, params);
      return result.rows.map(row => this.formatAgent(row));
    } catch (error) {
      logger.error('Failed to list agents', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update agent
   * @param {string} agentId - Agent ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(agentId, data) {
    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('AGENT_NOT_FOUND');
      }

      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.avatarUrl !== undefined) {
        updates.push('avatar_url = ?');
        params.push(data.avatarUrl);
      }

      if (data.availability !== undefined) {
        updates.push('availability = ?');
        params.push(data.availability);
      }

      if (updates.length === 0) {
        return agent;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(agentId);

      const sql = `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Agent updated', { agentId });

      return this.getAgentById(agentId);
    } catch (error) {
      logger.error('Failed to update agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Update agent role
   * @param {string} agentId - Agent ID
   * @param {string} role - New role
   * @param {string} [customRoleId] - Custom role ID (optional)
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgentRole(agentId, role, customRoleId = null) {
    try {
      const sql = `
        UPDATE agents 
        SET role = ?, custom_role_id = ?, updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [role, customRoleId, new Date().toISOString(), agentId]);

      logger.info('Agent role updated', { agentId, role, customRoleId });

      return this.getAgentById(agentId);
    } catch (error) {
      logger.error('Failed to update agent role', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Update agent availability
   * @param {string} agentId - Agent ID
   * @param {string} availability - New availability status
   * @returns {Promise<Object>} Updated agent
   */
  async updateAvailability(agentId, availability) {
    try {
      const sql = `
        UPDATE agents 
        SET availability = ?, last_activity_at = ?, updated_at = ? 
        WHERE id = ?
      `;
      
      const now = new Date().toISOString();
      await this.db.query(sql, [availability, now, now, agentId]);

      logger.info('Agent availability updated', { agentId, availability });

      return this.getAgentById(agentId);
    } catch (error) {
      logger.error('Failed to update availability', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Update agent profile (name and avatar)
   * @param {string} agentId - Agent ID
   * @param {Object} data - Profile data
   * @param {string} [data.name] - New name
   * @param {string|null} [data.avatarUrl] - New avatar URL
   * @returns {Promise<Object>} Updated agent
   */
  async updateProfile(agentId, data) {
    try {
      const updates = [];
      const params = [];
      
      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }
      
      if (data.avatarUrl !== undefined) {
        updates.push('avatar_url = ?');
        params.push(data.avatarUrl);
      }
      
      if (updates.length === 0) {
        return this.getAgentById(agentId);
      }
      
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(agentId);
      
      const sql = `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Agent profile updated', { agentId, updates: Object.keys(data) });

      return this.getAgentById(agentId);
    } catch (error) {
      logger.error('Failed to update profile', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Deactivate agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async deactivateAgent(agentId) {
    try {
      // Update agent status
      const sql = `
        UPDATE agents 
        SET status = 'inactive', availability = 'offline', updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [new Date().toISOString(), agentId]);

      // Invalidate all sessions for this agent
      await this.invalidateAgentSessions(agentId);

      logger.info('Agent deactivated', { agentId });
    } catch (error) {
      logger.error('Failed to deactivate agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Activate agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async activateAgent(agentId) {
    try {
      const sql = `
        UPDATE agents 
        SET status = 'active', updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [new Date().toISOString(), agentId]);

      logger.info('Agent activated', { agentId });
    } catch (error) {
      logger.error('Failed to activate agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Delete agent (hard delete)
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async deleteAgent(agentId) {
    try {
      const sql = 'DELETE FROM agents WHERE id = ?';
      await this.db.query(sql, [agentId]);

      logger.info('Agent deleted', { agentId });
    } catch (error) {
      logger.error('Failed to delete agent', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /**
   * Update agent password
   * @param {string} agentId - Agent ID
   * @param {string} newPassword - New password
   * @param {boolean} [invalidateSessions=true] - Whether to invalidate other sessions
   * @param {string} [currentSessionId] - Current session to keep active
   * @returns {Promise<void>}
   */
  async updatePassword(agentId, newPassword, invalidateSessions = true, currentSessionId = null) {
    try {
      const passwordHash = await this.hashPassword(newPassword);
      
      const sql = `
        UPDATE agents 
        SET password_hash = ?, updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [passwordHash, new Date().toISOString(), agentId]);

      // Invalidate other sessions if requested
      if (invalidateSessions) {
        await this.invalidateAgentSessions(agentId, currentSessionId);
      }

      logger.info('Agent password updated', { agentId });
    } catch (error) {
      logger.error('Failed to update password', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== LOGIN ATTEMPT TRACKING ====================

  /**
   * Record failed login attempt
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Updated attempt info
   */
  async recordFailedLogin(agentId) {
    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('AGENT_NOT_FOUND');
      }

      const result = await this.db.query(
        'SELECT failed_login_attempts FROM agents WHERE id = ?',
        [agentId]
      );
      
      const currentAttempts = result.rows[0]?.failed_login_attempts || 0;
      const newAttempts = currentAttempts + 1;
      
      // Lock account after 5 failed attempts for 15 minutes
      let lockedUntil = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      const sql = `
        UPDATE agents 
        SET failed_login_attempts = ?, locked_until = ?, updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [newAttempts, lockedUntil, new Date().toISOString(), agentId]);

      logger.warn('Failed login attempt recorded', { agentId, attempts: newAttempts, locked: !!lockedUntil });

      return { attempts: newAttempts, lockedUntil };
    } catch (error) {
      logger.error('Failed to record failed login', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Reset failed login attempts
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async resetFailedLogins(agentId) {
    try {
      const sql = `
        UPDATE agents 
        SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [new Date().toISOString(), agentId]);
    } catch (error) {
      logger.error('Failed to reset failed logins', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Check if agent is locked
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} True if locked
   */
  async isAgentLocked(agentId) {
    try {
      const result = await this.db.query(
        'SELECT locked_until FROM agents WHERE id = ?',
        [agentId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }

      const lockedUntil = result.rows[0].locked_until;
      if (!lockedUntil) {
        return false;
      }

      return new Date(lockedUntil) > new Date();
    } catch (error) {
      logger.error('Failed to check agent lock status', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Invalidate all sessions for an agent
   * @param {string} agentId - Agent ID
   * @param {string} [exceptSessionId] - Session ID to keep active
   * @returns {Promise<void>}
   */
  async invalidateAgentSessions(agentId, exceptSessionId = null) {
    try {
      let sql = 'DELETE FROM agent_sessions WHERE agent_id = ?';
      const params = [agentId];

      if (exceptSessionId) {
        sql += ' AND id != ?';
        params.push(exceptSessionId);
      }

      await this.db.query(sql, params);

      logger.info('Agent sessions invalidated', { agentId, exceptSessionId });
    } catch (error) {
      logger.error('Failed to invalidate sessions', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== PERMISSIONS ====================

  /**
   * Get permissions for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<string[]>} List of permissions
   */
  async getAgentPermissions(agentId) {
    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        return [];
      }

      // If agent has a custom role, get those permissions
      if (agent.customRoleId) {
        const result = await this.db.query(
          'SELECT permissions FROM custom_roles WHERE id = ?',
          [agent.customRoleId]
        );
        
        if (result.rows.length > 0) {
          return JSON.parse(result.rows[0].permissions || '[]');
        }
      }

      // Otherwise, use default role permissions
      return DEFAULT_ROLE_PERMISSIONS[agent.role] || [];
    } catch (error) {
      logger.error('Failed to get agent permissions', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Get agent count for an account
   * @param {string} accountId - Account ID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<number>} Agent count
   */
  async getAgentCount(accountId, filters = {}) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM agents WHERE account_id = ?';
      const params = [accountId];

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      const result = await this.db.query(sql, params);
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to get agent count', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== FORMATTERS ====================

  /**
   * Format agent row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted agent
   */
  formatAgent(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      role: row.role,
      customRoleId: row.custom_role_id,
      availability: row.availability,
      status: row.status,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format invitation row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted invitation
   */
  formatInvitation(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      email: row.email,
      token: row.token,
      role: row.role,
      customRoleId: row.custom_role_id,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  }

  // ==================== COUNT METHODS ====================

  /**
   * Count active agents for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of active agents
   */
  async countAgents(accountId) {
    try {
      const result = await this.db.query(
        "SELECT COUNT(*) as count FROM agents WHERE account_id = ? AND status = 'active'",
        [accountId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count agents', { error: error.message, accountId });
      return 0;
    }
  }
}

module.exports = AgentService;
