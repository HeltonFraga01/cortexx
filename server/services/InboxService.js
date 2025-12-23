/**
 * InboxService - Service for managing inboxes in multi-user system
 * 
 * Handles inbox CRUD operations and agent assignment.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');
const wuzapiClient = require('../utils/wuzapiClient');
const SupabaseService = require('./SupabaseService');

class InboxService {
  constructor(auditService = null) {
    // db parameter removed - uses SupabaseService directly
    this.supabase = SupabaseService;
    this.auditService = auditService || new MultiUserAuditService();
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  // ==================== INBOX CRUD ====================

  /**
   * Count inboxes for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of inboxes
   */
  async countInboxes(accountId) {
    try {
      const { count, error } = await this.supabase.count('inboxes', { account_id: accountId });
      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('Failed to count inboxes', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Generate a unique WUZAPI token
   * @param {string} inboxName - Inbox name for token prefix
   * @returns {string} Generated token
   */
  generateWuzapiToken(inboxName) {
    const sanitizedName = inboxName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const randomCode = `${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`.toUpperCase();
    return `${sanitizedName}${randomCode}`;
  }

  /**
   * Create a WUZAPI user for a WhatsApp inbox
   * @param {string} inboxName - Inbox name
   * @param {string} token - WUZAPI token
   * @param {Object} options - Additional options (webhook, events, etc.)
   * @returns {Promise<Object>} WUZAPI user data
   */
  async createWuzapiUser(inboxName, token, options = {}) {
    try {
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (!adminToken) {
        throw new Error('WUZAPI_ADMIN_TOKEN não configurado');
      }

      const userData = {
        name: inboxName,
        token: token,
        webhook: options.webhook || '',
        events: options.events || 'Message',
        history: options.history || 0
      };

      const result = await wuzapiClient.createUser(userData, adminToken);
      
      if (!result.success) {
        throw new Error(result.error || 'Falha ao criar usuário WUZAPI');
      }

      logger.info('WUZAPI user created for inbox', { inboxName, token: token.substring(0, 8) + '...' });
      return result.data;
    } catch (error) {
      logger.error('Failed to create WUZAPI user', { error: error.message, inboxName });
      throw error;
    }
  }

  /**
   * Delete a WUZAPI user
   * @param {string} wuzapiUserId - WUZAPI user ID or token
   * @returns {Promise<void>}
   */
  async deleteWuzapiUser(wuzapiUserId) {
    try {
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (!adminToken) {
        logger.warn('WUZAPI_ADMIN_TOKEN não configurado, não foi possível deletar usuário WUZAPI');
        return;
      }

      const result = await wuzapiClient.deleteUserFull(wuzapiUserId, adminToken);
      
      if (!result.success) {
        logger.warn('Failed to delete WUZAPI user', { wuzapiUserId, error: result.error });
      } else {
        logger.info('WUZAPI user deleted', { wuzapiUserId });
      }
    } catch (error) {
      logger.error('Error deleting WUZAPI user', { error: error.message, wuzapiUserId });
      // Don't throw - this is a cleanup operation
    }
  }

  /**
   * Create a new inbox
   * @param {string} accountId - Account ID
   * @param {Object} data - Inbox data
   * @param {string} data.name - Inbox name
   * @param {string} [data.description] - Inbox description
   * @param {string} [data.channelType] - Channel type (default: 'whatsapp')
   * @param {string} [data.phoneNumber] - Phone number for WhatsApp inboxes
   * @param {boolean} [data.enableAutoAssignment] - Enable auto assignment
   * @param {Object} [data.autoAssignmentConfig] - Auto assignment config
   * @param {boolean} [data.greetingEnabled] - Enable greeting
   * @param {string} [data.greetingMessage] - Greeting message
   * @param {number} [data.maxInboxes] - Max inboxes allowed (for quota check)
   * @param {Object} [data.wuzapiConfig] - WUZAPI configuration (webhook, events)
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object>} Created inbox
   */
  async createInbox(accountId, data, tenantId = null) {
    try {
      // Validate account belongs to tenant if tenantId is provided
      if (tenantId) {
        const account = await this.validateAccountTenant(accountId, tenantId);
        if (!account) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      // Check quota if maxInboxes is provided
      if (data.maxInboxes !== undefined && data.maxInboxes !== null) {
        const currentCount = await this.countInboxes(accountId);
        if (currentCount >= data.maxInboxes) {
          const error = new Error('QUOTA_EXCEEDED');
          error.code = 'QUOTA_EXCEEDED';
          error.details = { current: currentCount, max: data.maxInboxes };
          throw error;
        }
      }

      const id = this.generateId();
      const now = new Date().toISOString();
      const channelType = data.channelType || 'whatsapp';
      
      // Use provided wuzapiToken/wuzapiUserId or create new ones for WhatsApp channels
      let wuzapiToken = data.wuzapiToken || null;
      let wuzapiUserId = data.wuzapiUserId || null;

      // Create WUZAPI user for WhatsApp channels if not already provided
      if (channelType === 'whatsapp' && !wuzapiToken) {
        wuzapiToken = this.generateWuzapiToken(data.name);
        
        try {
          const wuzapiUser = await this.createWuzapiUser(data.name, wuzapiToken, data.wuzapiConfig || {});
          wuzapiUserId = wuzapiUser?.id || wuzapiToken;
        } catch (wuzapiError) {
          logger.error('Failed to create WUZAPI user, inbox creation aborted', { 
            error: wuzapiError.message, 
            accountId, 
            inboxName: data.name 
          });
          throw new Error(`Falha ao criar conexão WhatsApp: ${wuzapiError.message}`);
        }
      }

      // Extract maxConversationsPerAgent from config for dedicated column
      const maxConversationsPerAgent = data.autoAssignmentConfig?.maxConversationsPerAgent ?? null;

      const inboxData = {
        id,
        account_id: accountId,
        name: data.name,
        description: data.description || null,
        channel_type: channelType,
        phone_number: data.phoneNumber || null,
        enable_auto_assignment: data.enableAutoAssignment !== false,
        auto_assignment_config: data.autoAssignmentConfig || {},
        max_conversations_per_agent: maxConversationsPerAgent,
        greeting_enabled: data.greetingEnabled || false,
        greeting_message: data.greetingMessage || null,
        wuzapi_token: wuzapiToken,
        wuzapi_user_id: wuzapiUserId,
        wuzapi_connected: false,
        created_at: now,
        updated_at: now
      };

      const { error: insertError } = await this.supabase.queryAsAdmin('inboxes', (query) =>
        query.insert(inboxData)
      );

      if (insertError) {
        throw insertError;
      }

      logger.info('Inbox created', { 
        inboxId: id, 
        accountId, 
        name: data.name, 
        channelType,
        hasWuzapi: !!wuzapiToken 
      });

      // Audit log
      await this.auditService.logAction({
        accountId,
        agentId: data.createdBy || null,
        action: ACTION_TYPES.INBOX_CREATED,
        resourceType: RESOURCE_TYPES.INBOX,
        resourceId: id,
        details: { name: data.name, channelType, hasWuzapi: !!wuzapiToken }
      });

      return this._getInboxByIdInternal(id);
    } catch (error) {
      logger.error('Failed to create inbox', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get inbox by ID (internal method without tenant validation)
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<Object|null>} Inbox or null
   */
  async _getInboxByIdInternal(inboxId) {
    try {
      const { data, error } = await this.supabase.getById('inboxes', inboxId);

      if (error || !data) {
        return null;
      }

      return this.formatInbox(data);
    } catch (error) {
      logger.error('Failed to get inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Get inbox by ID
   * @param {string} inboxId - Inbox ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object|null>} Inbox or null
   */
  async getInboxById(inboxId, tenantId = null) {
    try {
      const inbox = await this._getInboxByIdInternal(inboxId);
      
      if (!inbox) {
        return null;
      }

      // Validate inbox belongs to tenant if tenantId is provided
      if (tenantId) {
        const account = await this.validateAccountTenant(inbox.accountId, tenantId);
        if (!account) {
          logger.warn('Cross-tenant inbox access attempt', {
            inboxId,
            requestTenantId: tenantId,
            accountId: inbox.accountId
          });
          return null;
        }
      }

      return inbox;
    } catch (error) {
      logger.error('Failed to get inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * List inboxes for an account
   * @param {string} accountId - Account ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object[]>} List of inboxes
   */
  async listInboxes(accountId, tenantId = null) {
    try {
      // Validate account belongs to tenant if tenantId is provided
      if (tenantId) {
        const account = await this.validateAccountTenant(accountId, tenantId);
        if (!account) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      const { data, error } = await this.supabase.getMany('inboxes', { account_id: accountId }, {
        orderBy: 'name',
        ascending: true
      });
      if (error) throw error;
      return (data || []).map(row => this.formatInbox(row));
    } catch (error) {
      logger.error('Failed to list inboxes', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List inboxes with member count
   * @param {string} accountId - Account ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object[]>} List of inboxes with member count
   */
  async listInboxesWithStats(accountId, tenantId = null) {
    try {
      // Validate account belongs to tenant if tenantId is provided
      if (tenantId) {
        const account = await this.validateAccountTenant(accountId, tenantId);
        if (!account) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      // First get all inboxes for the account
      const { data: inboxes, error: inboxError } = await this.supabase.getMany('inboxes', { account_id: accountId }, {
        orderBy: 'name',
        ascending: true
      });
      
      if (inboxError) throw inboxError;
      if (!inboxes || inboxes.length === 0) return [];

      // Get member counts for each inbox
      const inboxesWithStats = await Promise.all(inboxes.map(async (inbox) => {
        const { count, error: countError } = await this.supabase.count('inbox_members', { inbox_id: inbox.id });
        return {
          ...this.formatInbox(inbox),
          memberCount: countError ? 0 : (count || 0)
        };
      }));

      return inboxesWithStats;
    } catch (error) {
      logger.error('Failed to list inboxes with stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update an inbox
   * @param {string} inboxId - Inbox ID
   * @param {Object} data - Update data
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object>} Updated inbox
   */
  async updateInbox(inboxId, data, tenantId = null) {
    try {
      // Validate inbox belongs to tenant if tenantId is provided
      if (tenantId) {
        const inbox = await this._getInboxByIdInternal(inboxId);
        if (!inbox) {
          throw new Error('Inbox not found');
        }
        
        const account = await this.validateAccountTenant(inbox.accountId, tenantId);
        if (!account) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      const updateData = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.phoneNumber !== undefined) {
        updateData.phone_number = data.phoneNumber;
      }

      if (data.enableAutoAssignment !== undefined) {
        updateData.enable_auto_assignment = data.enableAutoAssignment;
      }

      if (data.autoAssignmentConfig !== undefined) {
        updateData.auto_assignment_config = data.autoAssignmentConfig;
        
        // Also update the dedicated column for max_conversations_per_agent
        if (data.autoAssignmentConfig.maxConversationsPerAgent !== undefined) {
          updateData.max_conversations_per_agent = data.autoAssignmentConfig.maxConversationsPerAgent;
        }
      }

      if (data.greetingEnabled !== undefined) {
        updateData.greeting_enabled = data.greetingEnabled;
      }

      if (data.greetingMessage !== undefined) {
        updateData.greeting_message = data.greetingMessage;
      }

      if (Object.keys(updateData).length === 0) {
        return this._getInboxByIdInternal(inboxId);
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await this.supabase.update('inboxes', inboxId, updateData);
      if (error) throw error;

      logger.info('Inbox updated', { inboxId });

      return this._getInboxByIdInternal(inboxId);
    } catch (error) {
      logger.error('Failed to update inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Delete an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} [deletedBy] - Agent ID who deleted the inbox
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<void>}
   */
  async deleteInbox(inboxId, deletedBy = null, tenantId = null) {
    try {
      const inbox = await this.getInboxById(inboxId, tenantId);
      
      // Delete WUZAPI user if exists
      if (inbox?.wuzapiUserId || inbox?.wuzapiToken) {
        await this.deleteWuzapiUser(inbox.wuzapiUserId || inbox.wuzapiToken);
      }
      
      // Members will be deleted via CASCADE
      const { error } = await this.supabase.delete('inboxes', inboxId);
      if (error) throw error;
      
      logger.info('Inbox deleted', { inboxId, hadWuzapi: !!(inbox?.wuzapiToken) });

      // Audit log
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          agentId: deletedBy,
          action: ACTION_TYPES.INBOX_DELETED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { name: inbox.name, hadWuzapi: !!(inbox.wuzapiToken) }
        });
      }
    } catch (error) {
      logger.error('Failed to delete inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  // ==================== AGENT ASSIGNMENT ====================

  /**
   * Assign an agent to an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} agentId - Agent ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object>} Created membership
   */
  async assignAgent(inboxId, agentId, tenantId = null) {
    try {
      // Validate inbox belongs to tenant if tenantId is provided
      if (tenantId) {
        const inbox = await this.getInboxById(inboxId, tenantId);
        if (!inbox) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      const id = this.generateId();
      const now = new Date().toISOString();

      const memberData = {
        id,
        inbox_id: inboxId,
        agent_id: agentId,
        created_at: now
      };

      const { error } = await this.supabase.queryAsAdmin('inbox_members', (query) =>
        query.insert(memberData)
      );

      if (error) {
        if (error.code === 'DUPLICATE_KEY' || error.message?.includes('duplicate')) {
          throw new Error('AGENT_ALREADY_IN_INBOX');
        }
        throw error;
      }

      logger.info('Agent assigned to inbox', { inboxId, agentId });

      // Audit log
      const inbox = await this._getInboxByIdInternal(inboxId);
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          action: ACTION_TYPES.INBOX_AGENT_ASSIGNED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { agentId }
        });
      }

      return { id, inboxId, agentId, createdAt: now };
    } catch (error) {
      if (error.message === 'AGENT_ALREADY_IN_INBOX') {
        throw error;
      }
      logger.error('Failed to assign agent to inbox', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Assign multiple agents to an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string[]} agentIds - Agent IDs
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<void>}
   */
  async assignAgents(inboxId, agentIds, tenantId = null) {
    try {
      for (const agentId of agentIds) {
        try {
          await this.assignAgent(inboxId, agentId, tenantId);
        } catch (error) {
          if (error.message !== 'AGENT_ALREADY_IN_INBOX') {
            throw error;
          }
          // Skip if already assigned
        }
      }
      logger.info('Agents assigned to inbox', { inboxId, count: agentIds.length });
    } catch (error) {
      logger.error('Failed to assign agents to inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Remove an agent from an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} agentId - Agent ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<void>}
   */
  async removeAgent(inboxId, agentId, tenantId = null) {
    try {
      const inbox = await this.getInboxById(inboxId, tenantId);
      
      const { error } = await this.supabase.queryAsAdmin('inbox_members', (query) =>
        query.delete().eq('inbox_id', inboxId).eq('agent_id', agentId)
      );
      
      if (error) throw error;
      
      logger.info('Agent removed from inbox', { inboxId, agentId });

      // Audit log
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          action: ACTION_TYPES.INBOX_AGENT_REMOVED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { agentId }
        });
      }
    } catch (error) {
      logger.error('Failed to remove agent from inbox', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Get inbox members
   * @param {string} inboxId - Inbox ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object[]>} List of members with agent info
   */
  async getInboxMembers(inboxId, tenantId = null) {
    try {
      // Validate inbox belongs to tenant if tenantId is provided
      if (tenantId) {
        const inbox = await this.getInboxById(inboxId, tenantId);
        if (!inbox) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      // Get inbox members with agent details using a join
      const { data, error } = await this.supabase.queryAsAdmin('inbox_members', (query) =>
        query
          .select(`
            created_at,
            agents (
              id,
              email,
              name,
              avatar_url,
              role,
              availability,
              status
            )
          `)
          .eq('inbox_id', inboxId)
      );

      if (error) throw error;

      return (data || [])
        .filter(row => row.agents) // Filter out any null agents
        .map(row => ({
          id: row.agents.id,
          email: row.agents.email,
          name: row.agents.name,
          avatarUrl: row.agents.avatar_url,
          role: row.agents.role,
          availability: row.agents.availability,
          status: row.agents.status,
          assignedAt: row.created_at
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (error) {
      logger.error('Failed to get inbox members', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Check if an agent has access to an inbox
   * @param {string} agentId - Agent ID
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<boolean>} True if agent has access
   */
  async checkAccess(agentId, inboxId) {
    try {
      logger.debug('Checking inbox access', { agentId, inboxId });
      const { count, error } = await this.supabase.count('inbox_members', { 
        inbox_id: inboxId, 
        agent_id: agentId 
      });
      logger.debug('Inbox access count result', { agentId, inboxId, count, error: error?.message });
      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      logger.error('Failed to check inbox access', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Get inboxes for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of inboxes
   */
  async listAgentInboxes(agentId) {
    try {
      // Get inbox IDs for this agent
      const { data: memberships, error: memberError } = await this.supabase.getMany('inbox_members', { agent_id: agentId });
      if (memberError) throw memberError;
      
      if (!memberships || memberships.length === 0) return [];

      const inboxIds = memberships.map(m => m.inbox_id);
      
      // Get inbox details
      const { data: inboxes, error: inboxError } = await this.supabase.queryAsAdmin('inboxes', (query) =>
        query.select('*').in('id', inboxIds).order('name')
      );
      
      if (inboxError) throw inboxError;
      
      return (inboxes || []).map(row => this.formatInbox(row));
    } catch (error) {
      logger.error('Failed to get agent inboxes', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== AUTO ASSIGNMENT ====================

  /**
   * Get available agents for auto assignment in an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @returns {Promise<Object[]>} List of available agents
   */
  async getAvailableAgentsForAssignment(inboxId, tenantId = null) {
    try {
      // Validate inbox belongs to tenant if tenantId is provided
      if (tenantId) {
        const inbox = await this.getInboxById(inboxId, tenantId);
        if (!inbox) {
          const error = new Error('CROSS_TENANT_ACCESS');
          error.code = 'CROSS_TENANT_ACCESS';
          throw error;
        }
      }
      // Get inbox members with agent details
      const { data, error } = await this.supabase.queryAsAdmin('inbox_members', (query) =>
        query
          .select(`
            agents (
              id,
              name,
              availability,
              status
            )
          `)
          .eq('inbox_id', inboxId)
      );

      if (error) throw error;

      // Filter for active and online agents
      return (data || [])
        .filter(row => row.agents && row.agents.status === 'active' && row.agents.availability === 'online')
        .map(row => ({
          id: row.agents.id,
          name: row.agents.name,
          availability: row.agents.availability
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (error) {
      logger.error('Failed to get available agents', { error: error.message, inboxId });
      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Validate that an account belongs to the specified tenant
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} Account if valid, null if cross-tenant access
   */
  async validateAccountTenant(accountId, tenantId) {
    try {
      const { data: account, error } = await this.supabase.getById('accounts', accountId);
      
      if (error || !account) {
        return null;
      }

      if (account.tenant_id !== tenantId) {
        logger.warn('Cross-tenant inbox access attempt', {
          accountId,
          requestTenantId: tenantId,
          accountTenantId: account.tenant_id
        });
        return null;
      }

      return account;
    } catch (error) {
      logger.error('Failed to validate account tenant', { 
        error: error.message, 
        accountId, 
        tenantId 
      });
      return null;
    }
  }

  /**
   * Format inbox row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted inbox
   */
  formatInbox(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      channelType: row.channel_type,
      phoneNumber: row.phone_number,
      enableAutoAssignment: row.enable_auto_assignment === true || row.enable_auto_assignment === 1,
      autoAssignmentConfig: this.parseJSON(row.auto_assignment_config, {}),
      greetingEnabled: row.greeting_enabled === true || row.greeting_enabled === 1,
      greetingMessage: row.greeting_message,
      wuzapiToken: row.wuzapi_token,
      wuzapiUserId: row.wuzapi_user_id,
      wuzapiConnected: row.wuzapi_connected === true || row.wuzapi_connected === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Safely parse JSON string
   * @param {string} jsonString - JSON string
   * @param {*} defaultValue - Default value if parsing fails
   * @returns {*} Parsed value or default
   */
  parseJSON(jsonString, defaultValue = {}) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

module.exports = InboxService;
