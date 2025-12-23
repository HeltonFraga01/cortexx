/**
 * CustomRoleService - Service for managing custom roles
 * 
 * Handles CRUD operations for custom roles in the multi-user system.
 * Uses SupabaseService for all database operations.
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');

class CustomRoleService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  generateId() {
    return crypto.randomUUID();
  }

  async createCustomRole(accountId, data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const roleData = {
        id,
        account_id: accountId,
        name: data.name,
        description: data.description || null,
        permissions: data.permissions || [],
        created_by: data.createdBy || null,
        created_at: now,
        updated_at: now
      };

      const { data: result, error } = await SupabaseService.insert('custom_roles', roleData);

      if (error) {
        logger.error('Failed to create custom role', { error: error.message, accountId });
        throw error;
      }

      logger.info('Custom role created', { roleId: id, accountId });
      return this.formatRole(result);
    } catch (error) {
      logger.error('Failed to create custom role', { error: error.message, accountId });
      throw error;
    }
  }

  async getCustomRoleById(roleId) {
    try {
      const { data, error } = await SupabaseService.getById('custom_roles', roleId);
      
      if (error) {
        // PGRST116 means not found - return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to get custom role', { error: error.message, roleId });
        throw error;
      }
      
      if (!data) return null;
      return this.formatRole(data);
    } catch (error) {
      logger.error('Failed to get custom role', { error: error.message, roleId });
      throw error;
    }
  }

  async listCustomRoles(accountId) {
    try {
      const { data, error } = await SupabaseService.getMany(
        'custom_roles',
        { account_id: accountId },
        { orderBy: 'name', ascending: true }
      );

      if (error) {
        logger.error('Failed to list custom roles', { error: error.message, accountId });
        throw error;
      }

      return (data || []).map(row => this.formatRole(row));
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

      const updates = {
        updated_at: new Date().toISOString()
      };

      if (data.name !== undefined) {
        updates.name = data.name;
      }
      if (data.description !== undefined) {
        updates.description = data.description;
      }
      if (data.permissions !== undefined) {
        updates.permissions = data.permissions;
      }

      const { data: result, error } = await SupabaseService.update('custom_roles', roleId, updates);

      if (error) {
        logger.error('Failed to update custom role', { error: error.message, roleId });
        throw error;
      }

      logger.info('Custom role updated', { roleId });
      return this.formatRole(result);
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

      const { error } = await SupabaseService.delete('custom_roles', roleId);
      
      if (error) {
        logger.error('Failed to delete custom role', { error: error.message, roleId });
        throw error;
      }
      
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
