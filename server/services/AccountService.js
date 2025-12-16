/**
 * AccountService - Service for managing accounts in multi-user system
 * 
 * Handles CRUD operations for accounts including creation, retrieval,
 * update, and deactivation.
 * 
 * Requirements: 1.1, 1.2, 1.4
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');

// Default account settings
const DEFAULT_SETTINGS = {
  maxAgents: 10,
  maxInboxes: 5,
  maxTeams: 5,
  features: ['messaging', 'webhooks', 'contacts']
};

class AccountService {
  constructor(db, auditService = null) {
    this.db = db;
    this.auditService = auditService || new MultiUserAuditService(db);
  }

  /**
   * Generate a unique account ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Create a new account
   * @param {Object} data - Account creation data
   * @param {string} data.name - Account name
   * @param {string} data.ownerUserId - Owner user ID (from existing WUZAPI user)
   * @param {string} data.wuzapiToken - WUZAPI token for this account
   * @param {string} [data.timezone] - Timezone (default: America/Sao_Paulo)
   * @param {string} [data.locale] - Locale (default: pt-BR)
   * @param {Object} [data.settings] - Custom settings
   * @returns {Promise<Object>} Created account
   */
  async createAccount(data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();
      
      const settings = {
        ...DEFAULT_SETTINGS,
        ...(data.settings || {})
      };

      const sql = `
        INSERT INTO accounts (id, name, owner_user_id, wuzapi_token, timezone, locale, status, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        data.name,
        data.ownerUserId,
        data.wuzapiToken,
        data.timezone || 'America/Sao_Paulo',
        data.locale || 'pt-BR',
        'active',
        JSON.stringify(settings),
        now,
        now
      ]);

      logger.info('Account created', { accountId: id, name: data.name });

      // Audit log
      await this.auditService.logAction({
        accountId: id,
        agentId: data.createdBy || null,
        action: ACTION_TYPES.ACCOUNT_CREATED,
        resourceType: RESOURCE_TYPES.ACCOUNT,
        resourceId: id,
        details: { name: data.name }
      });

      return this.getAccountById(id);
    } catch (error) {
      logger.error('Failed to create account', { error: error.message, data: { name: data.name } });
      throw error;
    }
  }

  /**
   * Get account by ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>} Account or null if not found
   */
  async getAccountById(accountId) {
    try {
      const sql = 'SELECT * FROM accounts WHERE id = ?';
      const result = await this.db.query(sql, [accountId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatAccount(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get account by owner user ID
   * @param {string} ownerUserId - Owner user ID
   * @returns {Promise<Object|null>} Account or null if not found
   */
  async getAccountByOwnerUserId(ownerUserId) {
    try {
      const sql = 'SELECT * FROM accounts WHERE owner_user_id = ?';
      const result = await this.db.query(sql, [ownerUserId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatAccount(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get account by owner', { error: error.message, ownerUserId });
      throw error;
    }
  }

  /**
   * Update account
   * @param {string} accountId - Account ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated account
   */
  async updateAccount(accountId, data) {
    try {
      const account = await this.getAccountById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.timezone !== undefined) {
        updates.push('timezone = ?');
        params.push(data.timezone);
      }

      if (data.locale !== undefined) {
        updates.push('locale = ?');
        params.push(data.locale);
      }

      if (data.settings !== undefined) {
        const mergedSettings = { ...account.settings, ...data.settings };
        updates.push('settings = ?');
        params.push(JSON.stringify(mergedSettings));
      }

      if (data.wuzapiToken !== undefined) {
        updates.push('wuzapi_token = ?');
        params.push(data.wuzapiToken);
      }

      if (updates.length === 0) {
        return account;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(accountId);

      const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Account updated', { accountId });

      // Audit log
      await this.auditService.logAction({
        accountId,
        agentId: data.updatedBy || null,
        action: ACTION_TYPES.ACCOUNT_UPDATED,
        resourceType: RESOURCE_TYPES.ACCOUNT,
        resourceId: accountId,
        details: { fields: Object.keys(data).filter(k => k !== 'updatedBy') }
      });

      return this.getAccountById(accountId);
    } catch (error) {
      logger.error('Failed to update account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Deactivate account (sets status to inactive)
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async deactivateAccount(accountId) {
    try {
      const sql = `
        UPDATE accounts 
        SET status = 'inactive', updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [new Date().toISOString(), accountId]);

      logger.info('Account deactivated', { accountId });

      // Audit log
      await this.auditService.logAction({
        accountId,
        action: ACTION_TYPES.ACCOUNT_DEACTIVATED,
        resourceType: RESOURCE_TYPES.ACCOUNT,
        resourceId: accountId
      });
    } catch (error) {
      logger.error('Failed to deactivate account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Activate account (sets status to active)
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async activateAccount(accountId) {
    try {
      const sql = `
        UPDATE accounts 
        SET status = 'active', updated_at = ? 
        WHERE id = ?
      `;
      
      await this.db.query(sql, [new Date().toISOString(), accountId]);

      logger.info('Account activated', { accountId });
    } catch (error) {
      logger.error('Failed to activate account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Delete account (cascade deletes all related data)
   * @param {string} accountId - Account ID
   * @returns {Promise<void>}
   */
  async deleteAccount(accountId) {
    try {
      const sql = 'DELETE FROM accounts WHERE id = ?';
      await this.db.query(sql, [accountId]);

      logger.info('Account deleted', { accountId });
    } catch (error) {
      logger.error('Failed to delete account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get account statistics
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Account statistics
   */
  async getAccountStats(accountId) {
    try {
      const agentsResult = await this.db.query(
        'SELECT COUNT(*) as count FROM agents WHERE account_id = ? AND status = ?',
        [accountId, 'active']
      );

      const teamsResult = await this.db.query(
        'SELECT COUNT(*) as count FROM teams WHERE account_id = ?',
        [accountId]
      );

      const inboxesResult = await this.db.query(
        'SELECT COUNT(*) as count FROM inboxes WHERE account_id = ?',
        [accountId]
      );

      return {
        activeAgents: agentsResult.rows[0]?.count || 0,
        totalTeams: teamsResult.rows[0]?.count || 0,
        totalInboxes: inboxesResult.rows[0]?.count || 0
      };
    } catch (error) {
      logger.error('Failed to get account stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List all accounts (admin only)
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.status] - Filter by status
   * @param {number} [filters.limit] - Limit results
   * @param {number} [filters.offset] - Offset for pagination
   * @returns {Promise<Object[]>} List of accounts
   */
  async listAccounts(filters = {}) {
    try {
      let sql = 'SELECT * FROM accounts';
      const params = [];
      const conditions = [];

      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
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

      return result.rows.map(row => this.formatAccount(row));
    } catch (error) {
      logger.error('Failed to list accounts', { error: error.message });
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
      timezone: row.timezone,
      locale: row.locale,
      status: row.status,
      settings: this.parseJSON(row.settings, DEFAULT_SETTINGS),
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

module.exports = AccountService;
