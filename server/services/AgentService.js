/**
 * AgentServiceSupabase - Service for managing agents using Supabase
 * Task 12.2: Refactor AgentService.js to use SupabaseService
 * 
 * Handles agent CRUD operations, invitation management, and authentication.
 * 
 * Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 6.1, 6.2
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const supabaseService = require('./SupabaseService');

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
   * @param {string} accountId - Account ID (UUID)
   * @param {Object} data - Invitation data
   * @param {string} createdBy - Agent ID who created the invitation
   * @param {string} [sessionTenantId] - Tenant ID from session for validation
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created invitation with token
   */
  async createInvitation(accountId, data, createdBy, sessionTenantId = null, token = null) {
    try {
      // Validate that the account belongs to the session's tenant
      if (sessionTenantId) {
        const { data: account, error: accountError } = await supabaseService.getById('accounts', accountId, token);
        if (accountError) {
          throw accountError;
        }
        if (!account) {
          throw new Error('Account not found');
        }
        if (account.tenant_id !== sessionTenantId) {
          logger.warn('Cross-tenant agent invitation attempt', {
            accountId,
            accountTenantId: account.tenant_id,
            sessionTenantId,
            createdBy
          });
          throw new Error('Account does not belong to your tenant');
        }
      }

      const invitationToken = this.generateInvitationToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_MS);

      const invitationData = {
        account_id: accountId,
        email: data.email || null,
        token: invitationToken,
        role: data.role || 'agent',
        custom_role_id: data.customRoleId || null,
        expires_at: expiresAt.toISOString(),
        created_by: createdBy
      };

      const { data: invitation, error } = await supabaseService.insert('agent_invitations', invitationData, token);

      if (error) {
        throw error;
      }

      logger.info('Invitation created', { 
        invitationId: invitation.id, 
        accountId, 
        tenantId: sessionTenantId,
        role: data.role || 'agent' 
      });

      return this.formatInvitation(invitation);
    } catch (error) {
      logger.error('Failed to create invitation', { 
        error: error.message, 
        accountId,
        tenantId: sessionTenantId
      });
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
      const { data: invitations, error } = await supabaseService.getMany(
        'agent_invitations',
        { token },
        { limit: 1 }
      );

      if (error) {
        throw error;
      }

      if (!invitations || invitations.length === 0) {
        return null;
      }

      return this.formatInvitation(invitations[0]);
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
   * @param {string} invitationId - Invitation ID (UUID)
   * @returns {Promise<void>}
   */
  async markInvitationUsed(invitationId) {
    await supabaseService.update('agent_invitations', invitationId, {
      used_at: new Date().toISOString()
    });
  }

  // ==================== AGENT CRUD ====================

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Agent or null
   */
  async getAgentById(agentId, token = null) {
    try {
      const { data: agent, error } = await supabaseService.getById('agents', agentId, token);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return agent ? this.formatAgent(agent) : null;
    } catch (error) {
      logger.error('Failed to get agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Get agent by email within an account
   * @param {string} accountId - Account ID (UUID)
   * @param {string} email - Agent email
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Agent or null
   */
  async getAgentByEmail(accountId, email, token = null) {
    try {
      const { data: agents, error } = await supabaseService.getMany(
        'agents',
        { account_id: accountId, email },
        { limit: 1 },
        token
      );

      if (error) {
        throw error;
      }

      if (!agents || agents.length === 0) {
        return null;
      }

      return this.formatAgent(agents[0]);
    } catch (error) {
      logger.error('Failed to get agent by email', { error: error.message, accountId, email });
      throw error;
    }
  }

  /**
   * Get agent with password hash for authentication (admin query)
   * @param {string} accountId - Account ID (UUID)
   * @param {string} email - Agent email
   * @returns {Promise<Object|null>} Agent with password hash or null
   */
  async getAgentForAuth(accountId, email) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .eq('email', email)
        .single();

      const { data: agent, error } = await supabaseService.queryAsAdmin('agents', queryFn);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return {
        ...this.formatAgent(agent),
        passwordHash: agent.password_hash,
        failedLoginAttempts: agent.failed_login_attempts,
        lockedUntil: agent.locked_until
      };
    } catch (error) {
      logger.error('Failed to get agent for auth', { error: error.message, accountId, email });
      throw error;
    }
  }

  /**
   * Get agent by email only (searches across all accounts)
   * @param {string} email - Agent email
   * @param {string} [tenantId] - Optional tenant ID to filter by
   * @returns {Promise<Object|null>} Agent with password hash and account info or null
   */
  async getAgentByEmailOnly(email, tenantId = null) {
    try {
      const queryFn = (query) => {
        let q = query
          .select(`
            *,
            accounts!inner(name, status, tenant_id)
          `)
          .eq('email', email)
          .eq('status', 'active')
          .eq('accounts.status', 'active');
        
        // Filter by tenant if provided
        if (tenantId) {
          q = q.eq('accounts.tenant_id', tenantId);
        }
        
        return q.limit(1).single();
      };

      const { data: agent, error } = await supabaseService.queryAsAdmin('agents', queryFn);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return {
        ...this.formatAgent(agent),
        passwordHash: agent.password_hash,
        failedLoginAttempts: agent.failed_login_attempts,
        lockedUntil: agent.locked_until,
        accountName: agent.accounts?.name,
        accountStatus: agent.accounts?.status,
        tenantId: agent.accounts?.tenant_id
      };
    } catch (error) {
      logger.error('Failed to get agent by email only', { error: error.message, email, tenantId });
      throw error;
    }
  }

  /**
   * List agents for an account
   * @param {string} accountId - Account ID (UUID)
   * @param {Object} [filters] - Optional filters
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object[]>} List of agents
   */
  async listAgents(accountId, filters = {}, token = null) {
    try {
      const queryFn = (query) => {
        let q = query.select('*').eq('account_id', accountId);

        if (filters.status) {
          q = q.eq('status', filters.status);
        }

        if (filters.role) {
          q = q.eq('role', filters.role);
        }

        if (filters.availability) {
          q = q.eq('availability', filters.availability);
        }

        q = q.order('created_at', { ascending: false });

        if (filters.limit) {
          q = q.limit(filters.limit);
        }

        if (filters.offset) {
          q = q.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        return q;
      };

      const { data: agents, error } = token
        ? await supabaseService.queryAsUser(token, 'agents', queryFn)
        : await supabaseService.queryAsAdmin('agents', queryFn);

      if (error) {
        throw error;
      }

      return (agents || []).map(row => this.formatAgent(row));
    } catch (error) {
      logger.error('Failed to list agents', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create agent directly with credentials
   * @param {string} accountId - Account ID (UUID)
   * @param {Object} data - Agent data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created agent
   */
  async createAgentDirect(accountId, data, token = null) {
    try {
      // Check if email already exists in account
      const existingAgent = await this.getAgentByEmail(accountId, data.email, token);
      if (existingAgent) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      const passwordHash = await this.hashPassword(data.password);

      const agentData = {
        account_id: accountId,
        email: data.email,
        password_hash: passwordHash,
        name: data.name,
        avatar_url: data.avatarUrl || null,
        role: data.role || 'agent',
        custom_role_id: data.customRoleId || null,
        availability: 'offline',
        status: 'active'
      };

      const { data: agent, error } = await supabaseService.insert('agents', agentData, token);

      if (error) {
        throw error;
      }

      logger.info('Agent created directly', { agentId: agent.id, accountId });

      return this.formatAgent(agent);
    } catch (error) {
      logger.error('Failed to create agent directly', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update agent
   * @param {string} agentId - Agent ID (UUID)
   * @param {Object} data - Update data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(agentId, data, token = null) {
    try {
      const agent = await this.getAgentById(agentId, token);
      if (!agent) {
        throw new Error('AGENT_NOT_FOUND');
      }

      const updates = {};

      if (data.name !== undefined) {
        updates.name = data.name;
      }

      if (data.avatarUrl !== undefined) {
        updates.avatar_url = data.avatarUrl;
      }

      if (data.availability !== undefined) {
        updates.availability = data.availability;
      }

      if (Object.keys(updates).length === 0) {
        return agent;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedAgent, error } = await supabaseService.update('agents', agentId, updates, token);

      if (error) {
        throw error;
      }

      logger.info('Agent updated', { agentId });

      return this.formatAgent(updatedAgent);
    } catch (error) {
      logger.error('Failed to update agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Update agent role
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} role - New role
   * @param {string} [customRoleId] - Custom role ID (optional)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgentRole(agentId, role, customRoleId = null, token = null) {
    try {
      const { data: agent, error } = await supabaseService.update(
        'agents',
        agentId,
        {
          role,
          custom_role_id: customRoleId,
          updated_at: new Date().toISOString()
        },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Agent role updated', { agentId, role, customRoleId });

      return this.formatAgent(agent);
    } catch (error) {
      logger.error('Failed to update agent role', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Update agent availability
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} availability - New availability status
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated agent
   */
  async updateAvailability(agentId, availability, token = null) {
    try {
      const now = new Date().toISOString();
      const { data: agent, error } = await supabaseService.update(
        'agents',
        agentId,
        {
          availability,
          last_activity_at: now,
          updated_at: now
        },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Agent availability updated', { agentId, availability });

      return this.formatAgent(agent);
    } catch (error) {
      logger.error('Failed to update availability', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Deactivate agent
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deactivateAgent(agentId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'agents',
        agentId,
        {
          status: 'inactive',
          availability: 'offline',
          updated_at: new Date().toISOString()
        },
        token
      );

      if (error) {
        throw error;
      }

      // Invalidate all sessions for this agent
      await this.invalidateAgentSessions(agentId);

      logger.info('Agent deactivated', { agentId });
    } catch (error) {
      logger.error('Failed to deactivate agent', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Delete agent (hard delete)
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deleteAgent(agentId, token = null) {
    try {
      const { error } = await supabaseService.delete('agents', agentId, token);

      if (error) {
        throw error;
      }

      logger.info('Agent deleted', { agentId });
    } catch (error) {
      logger.error('Failed to delete agent', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /**
   * Update agent password
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} newPassword - New password
   * @param {boolean} [invalidateSessions=true] - Whether to invalidate other sessions
   * @returns {Promise<void>}
   */
  async updatePassword(agentId, newPassword, invalidateSessions = true) {
    try {
      const passwordHash = await this.hashPassword(newPassword);

      const { error } = await supabaseService.update('agents', agentId, {
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      if (invalidateSessions) {
        await this.invalidateAgentSessions(agentId);
      }

      logger.info('Agent password updated', { agentId });
    } catch (error) {
      logger.error('Failed to update password', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== LOGIN ATTEMPT TRACKING ====================

  /**
   * Check if agent is locked due to failed login attempts
   * @param {string} agentId - Agent ID (UUID)
   * @returns {Promise<boolean>} True if agent is locked
   */
  async isAgentLocked(agentId) {
    try {
      const queryFn = (query) => query
        .select('locked_until')
        .eq('id', agentId)
        .single();

      const { data: result, error } = await supabaseService.queryAsAdmin('agents', queryFn);

      if (error) {
        logger.error('Failed to check agent lock status', { error: error.message, agentId });
        return false; // Fail open to allow login attempt
      }

      if (!result?.locked_until) {
        return false;
      }

      const lockedUntil = new Date(result.locked_until);
      const isLocked = lockedUntil > new Date();

      if (!isLocked) {
        // Lock has expired, reset it
        await this.resetFailedLogins(agentId);
      }

      return isLocked;
    } catch (error) {
      logger.error('Failed to check agent lock status', { error: error.message, agentId });
      return false; // Fail open to allow login attempt
    }
  }

  /**
   * Record failed login attempt
   * @param {string} agentId - Agent ID (UUID)
   * @returns {Promise<Object>} Updated attempt info
   */
  async recordFailedLogin(agentId) {
    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('AGENT_NOT_FOUND');
      }

      const queryFn = (query) => query
        .select('failed_login_attempts')
        .eq('id', agentId)
        .single();

      const { data: result, error: fetchError } = await supabaseService.queryAsAdmin('agents', queryFn);

      if (fetchError) {
        throw fetchError;
      }

      const currentAttempts = result?.failed_login_attempts || 0;
      const newAttempts = currentAttempts + 1;

      // Lock account after 5 failed attempts for 15 minutes
      let lockedUntil = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      const { error: updateError } = await supabaseService.update('agents', agentId, {
        failed_login_attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString()
      });

      if (updateError) {
        throw updateError;
      }

      logger.warn('Failed login attempt recorded', { agentId, attempts: newAttempts, locked: !!lockedUntil });

      return { attempts: newAttempts, lockedUntil };
    } catch (error) {
      logger.error('Failed to record failed login', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Reset failed login attempts
   * @param {string} agentId - Agent ID (UUID)
   * @returns {Promise<void>}
   */
  async resetFailedLogins(agentId) {
    try {
      const { error } = await supabaseService.update('agents', agentId, {
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to reset failed logins', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Invalidate all sessions for an agent
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [exceptSessionId] - Session ID to keep active
   * @returns {Promise<void>}
   */
  async invalidateAgentSessions(agentId, exceptSessionId = null) {
    try {
      const queryFn = (query) => {
        let q = query.delete().eq('agent_id', agentId);
        if (exceptSessionId) {
          q = q.neq('id', exceptSessionId);
        }
        return q;
      };

      await supabaseService.queryAsAdmin('agent_sessions', queryFn);

      logger.info('Agent sessions invalidated', { agentId, exceptSessionId });
    } catch (error) {
      logger.error('Failed to invalidate sessions', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== PERMISSIONS ====================

  /**
   * Get permissions for an agent
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<string[]>} List of permissions
   */
  async getAgentPermissions(agentId, token = null) {
    try {
      const agent = await this.getAgentById(agentId, token);
      if (!agent) {
        return [];
      }

      // If agent has a custom role, get those permissions
      if (agent.customRoleId) {
        const { data: customRole, error } = await supabaseService.getById('custom_roles', agent.customRoleId, token);

        if (!error && customRole) {
          return customRole.permissions || [];
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
   * @param {string} accountId - Account ID (UUID)
   * @param {Object} [filters] - Optional filters
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<number>} Agent count
   */
  async countAgents(accountId, filters = {}, token = null) {
    try {
      const filterObj = { account_id: accountId };
      if (filters.status) {
        filterObj.status = filters.status;
      }

      const { count, error } = await supabaseService.count('agents', filterObj, token);

      if (error) {
        throw error;
      }

      return count || 0;
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
      userId: row.user_id,
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
}

module.exports = AgentService;
