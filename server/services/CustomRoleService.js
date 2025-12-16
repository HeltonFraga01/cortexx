/**
 * CustomRoleService - Service for managing custom roles
 * 
 * Handles CRUD operations for custom roles in the multi-user system.
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

class CustomRoleService {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  async createCustomRole(accountId, data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO custom_roles (id, account_id, name, description, permissions, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id, accountId, data.name, data.description || null,
        JSON.stringify(data.permissions || []), data.createdBy || null, now, now
      ]);

      logger.info('Custom role created', { roleId: id, accountId });
      return this.getCustomRoleById(id);
    } catch (error) {
      logger.error('Failed to create custom role', { error: error.message, accountId });
      throw error;
    }
  }

  async getCustomRoleById(roleId) {
    try {
      const sql = 'SELECT * FROM custom_roles WHERE id = ?';
      const result = await this.db.query(sql, [roleId]);
      if (result.rows.length === 0) return null;
      return this.formatRole(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get custom role', { error: error.message, roleId });
      throw error;
    }
  }

  async listCustomRoles(accountId) {
    try {
      const sql = 'SELECT * FROM custom_roles WHERE account_id = ? ORDER BY name';
      const result = await this.db.query(sql, [accountId]);
      return result.rows.map(row => this.formatRole(row));
    } catch (error) {
      logger.error('Failed to list custom roles', { error: error.message, accountId });
      throw error;
    }
  }


  async updateCustomRole(roleId, accountId, data) {
    try {
      const role = await this.getCustomRoleById(roleId);
      if (!role || role.accountId !== accountId) {
        throw new Error('ROLE_NOT_FOUND');
      }

      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }
      if (data.permissions !== undefined) {
        updates.push('permissions = ?');
        params.push(JSON.stringify(data.permissions));
      }

      if (updates.length === 0) return role;

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(roleId);

      const sql = `UPDATE custom_roles SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Custom role updated', { roleId });
      return this.getCustomRoleById(roleId);
    } catch (error) {
      logger.error('Failed to update custom role', { error: error.message, roleId });
      throw error;
    }
  }

  async deleteCustomRole(roleId, accountId) {
    try {
      const role = await this.getCustomRoleById(roleId);
      if (!role || role.accountId !== accountId) {
        throw new Error('ROLE_NOT_FOUND');
      }

      const sql = 'DELETE FROM custom_roles WHERE id = ?';
      await this.db.query(sql, [roleId]);
      logger.info('Custom role deleted', { roleId });
    } catch (error) {
      logger.error('Failed to delete custom role', { error: error.message, roleId });
      throw error;
    }
  }

  formatRole(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      permissions: this.parseJSON(row.permissions, []),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDefault: false
    };
  }

  parseJSON(jsonString, defaultValue = []) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

module.exports = CustomRoleService;
