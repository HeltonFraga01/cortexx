/**
 * AccountServiceSupabase - Service for managing accounts using Supabase
 * Task 12.1: Refactor AccountService.js to use SupabaseService
 * 
 * Handles CRUD operations for accounts including creation, retrieval,
 * update, and deactivation using Supabase as the database backend.
 * 
 * Requirements: 1.1, 1.2, 1.4, 6.1, 6.2
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Default account settings
const DEFAULT_SETTINGS = {
  maxAgents: 10,
  maxInboxes: 5,
  maxTeams: 5,
  features: ['messaging', 'webhooks', 'contacts']
};

class AccountService {
  /**
   * Create a new account
   * @param {string} tenantId - Tenant UUID (required for multi-tenancy)
   * @param {Object} data - Account creation data
   * @param {string} data.name - Account name
   * @param {string} data.ownerUserId - Owner user ID (from Supabase Auth)
   * @param {string} data.wuzapiToken - WUZAPI token for this account
   * @param {string} [data.timezone] - Timezone (default: America/Sao_Paulo)
   * @param {string} [data.locale] - Locale (default: pt-BR)
   * @param {Object} [data.settings] - Custom settings
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created account
   */
  async createAccount(tenantId, data, token = null) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required for account creation');
      }

      const settings = {
        ...DEFAULT_SETTINGS,
        ...(data.settings || {})
      };

      const accountData = {
        name: data.name,
        owner_user_id: data.ownerUserId,
        wuzapi_token: data.wuzapiToken,
        tenant_id: tenantId,
        timezone: data.timezone || 'America/Sao_Paulo',
        locale: data.locale || 'pt-BR',
        status: 'active',
        settings: settings
      };

      const { data: account, error } = await supabaseService.insert('accounts', accountData, token);

      if (error) {
        throw error;
      }

      logger.info('Account created', { 
        accountId: account.id, 
        name: data.name, 
        tenantId 
      });

      return this.formatAccount(account);
    } catch (error) {
      logger.error('Failed to create account', { 
        error: error.message, 
        data: { name: data.name, tenantId } 
      });
      throw error;
    }
  }

  /**
   * Get account by ID with tenant validation
   * @param {string} accountId - Account ID (UUID)
   * @param {string} [tenantId] - Tenant ID for validation (optional)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Account or null if not found
   */
  async getAccountById(accountId, tenantId = null, token = null) {
    try {
      const { data: account, error } = await supabaseService.getById('accounts', accountId, token);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      if (!account) {
        return null;
      }

      // Validate tenant ownership if tenantId is provided
      if (tenantId && account.tenant_id !== tenantId) {
        logger.warn('Cross-tenant account access attempt', {
          accountId,
          requestTenantId: tenantId,
          accountTenantId: account.tenant_id
        });
        return null; // Return null instead of throwing to prevent information disclosure
      }

      return this.formatAccount(account);
    } catch (error) {
      logger.error('Failed to get account', { error: error.message, accountId, tenantId });
      throw error;
    }
  }

  /**
   * Get account by owner user ID
   * @param {string} ownerUserId - Owner user ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Account or null if not found
   */
  async getAccountByOwnerUserId(ownerUserId, token = null) {
    try {
      const { data: accounts, error } = await supabaseService.getMany(
        'accounts',
        { owner_user_id: ownerUserId },
        { limit: 1 },
        token
      );

      if (error) {
        throw error;
      }

      if (!accounts || accounts.length === 0) {
        return null;
      }

      return this.formatAccount(accounts[0]);
    } catch (error) {
      logger.error('Failed to get account by owner', { error: error.message, ownerUserId });
      throw error;
    }
  }

  /**
   * Update account
   * @param {string} accountId - Account ID (UUID)
   * @param {Object} data - Update data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated account
   */
  async updateAccount(accountId, data, token = null) {
    try {
      const account = await this.getAccountById(accountId, token);
      if (!account) {
        throw new Error('Account not found');
      }

      const updates = {};

      if (data.name !== undefined) {
        updates.name = data.name;
      }

      if (data.timezone !== undefined) {
        updates.timezone = data.timezone;
      }

      if (data.locale !== undefined) {
        updates.locale = data.locale;
      }

      if (data.settings !== undefined) {
        updates.settings = { ...account.settings, ...data.settings };
      }

      if (data.wuzapiToken !== undefined) {
        updates.wuzapi_token = data.wuzapiToken;
      }

      if (Object.keys(updates).length === 0) {
        return account;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedAccount, error } = await supabaseService.update('accounts', accountId, updates, token);

      if (error) {
        throw error;
      }

      logger.info('Account updated', { accountId });

      return this.formatAccount(updatedAccount);
    } catch (error) {
      logger.error('Failed to update account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Deactivate account (sets status to inactive)
   * @param {string} accountId - Account ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deactivateAccount(accountId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'accounts',
        accountId,
        { status: 'inactive', updated_at: new Date().toISOString() },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Account deactivated', { accountId });
    } catch (error) {
      logger.error('Failed to deactivate account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Activate account (sets status to active)
   * @param {string} accountId - Account ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async activateAccount(accountId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'accounts',
        accountId,
        { status: 'active', updated_at: new Date().toISOString() },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Account activated', { accountId });
    } catch (error) {
      logger.error('Failed to activate account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Delete account (cascade deletes all related data via FK constraints)
   * @param {string} accountId - Account ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deleteAccount(accountId, token = null) {
    try {
      const { error } = await supabaseService.delete('accounts', accountId, token);

      if (error) {
        throw error;
      }

      logger.info('Account deleted', { accountId });
    } catch (error) {
      logger.error('Failed to delete account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get account statistics
   * @param {string} accountId - Account ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Account statistics
   */
  async getAccountStats(accountId, token = null) {
    try {
      const [agentsResult, teamsResult, inboxesResult] = await Promise.all([
        supabaseService.count('agents', { account_id: accountId, status: 'active' }, token),
        supabaseService.count('teams', { account_id: accountId }, token),
        supabaseService.count('inboxes', { account_id: accountId }, token)
      ]);

      return {
        activeAgents: agentsResult.count || 0,
        totalTeams: teamsResult.count || 0,
        totalInboxes: inboxesResult.count || 0
      };
    } catch (error) {
      logger.error('Failed to get account stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List accounts with tenant filtering
   * @param {string} [tenantId] - Tenant ID to filter by (required for tenant-scoped queries)
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.status] - Filter by status
   * @param {number} [filters.limit] - Limit results
   * @param {number} [filters.offset] - Offset for pagination
   * @returns {Promise<Object[]>} List of accounts
   */
  async listAccounts(tenantId = null, filters = {}) {
    try {
      const queryFn = (query) => {
        let q = query.select('*');

        // Filter by tenant if provided
        if (tenantId) {
          q = q.eq('tenant_id', tenantId);
        }

        if (filters.status) {
          q = q.eq('status', filters.status);
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

      const { data: accounts, error } = await supabaseService.queryAsAdmin('accounts', queryFn);

      if (error) {
        throw error;
      }

      return (accounts || []).map(row => this.formatAccount(row));
    } catch (error) {
      logger.error('Failed to list accounts', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Format account row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted account
   */
  formatAccount(row) {
    return {
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      wuzapiToken: row.wuzapi_token,
      tenantId: row.tenant_id,
      timezone: row.timezone,
      locale: row.locale,
      status: row.status,
      settings: row.settings || DEFAULT_SETTINGS,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = AccountService;
