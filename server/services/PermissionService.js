/**
 * PermissionService - Service for managing permissions in multi-user system
 * 
 * Handles permission checking, custom role management, and role assignments.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');

// All available permissions
const ALL_PERMISSIONS = [
  'conversations:view',
  'conversations:create',
  'conversations:assign',
  'conversations:manage',
  'conversations:delete',
  'messages:send',
  'messages:delete',
  'contacts:view',
  'contacts:create',
  'contacts:edit',
  'contacts:delete',
  'agents:view',
  'agents:create',
  'agents:edit',
  'agents:delete',
  'teams:view',
  'teams:manage',
  'inboxes:view',
  'inboxes:manage',
  'reports:view',
  'settings:view',
  'settings:edit',
  'webhooks:manage',
  'integrations:manage'
];

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS = {
  owner: ['*'], // All permissions
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

class PermissionService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  // ==================== PERMISSION CHECKING ====================

  /**
   * Check if an agent has a specific permission
   * @param {string} agentId - Agent ID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} True if agent has permission
   */
  async checkPermission(agentId, permission) {
    try {
      const permissions = await this.getAgentPermissions(agentId);
      
      // Wildcard permission (owner)
      if (permissions.includes('*')) {
        return true;
      }
      
      return permissions.includes(permission);
    } catch (error) {
      logger.error('Failed to check permission', { error: error.message, agentId, permission });
      return false;
    }
  }

  /**
   * Check if an agent has any of the specified permissions
   * @param {string} agentId - Agent ID
   * @param {string[]} permissions - Permissions to check
   * @returns {Promise<boolean>} True if agent has any permission
   */
  async checkAnyPermission(agentId, permissions) {
    try {
      const agentPermissions = await this.getAgentPermissions(agentId);
      
      if (agentPermissions.includes('*')) {
        return true;
      }
      
      return permissions.some(p => agentPermissions.includes(p));
    } catch (error) {
      logger.error('Failed to check any permission', { error: error.message, agentId });
      return false;
    }
  }

  /**
   * Check if an agent has all of the specified permissions
   * @param {string} agentId - Agent ID
   * @param {string[]} permissions - Permissions to check
   * @returns {Promise<boolean>} True if agent has all permissions
   */
  async checkAllPermissions(agentId, permissions) {
    try {
      const agentPermissions = await this.getAgentPermissions(agentId);
      
      if (agentPermissions.includes('*')) {
        return true;
      }
      
      return permissions.every(p => agentPermissions.includes(p));
    } catch (error) {
      logger.error('Failed to check all permissions', { error: error.message, agentId });
      return false;
    }
  }

  /**
   * Get all permissions for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<string[]>} List of permissions
   */
  async getAgentPermissions(agentId) {
    try {
      // Get agent with role info
      const { data: agent, error: agentError } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('role, custom_role_id').eq('id', agentId).single()
      );
      
      if (agentError || !agent) {
        return [];
      }
      
      // If agent has a custom role, get those permissions
      if (agent.custom_role_id) {
        const { data: role, error: roleError } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
          query.select('permissions').eq('id', agent.custom_role_id).single()
        );
        
        if (!roleError && role) {
          return this.parseJSON(role.permissions, []);
        }
      }
      
      // Otherwise, use default role permissions
      return DEFAULT_ROLE_PERMISSIONS[agent.role] || [];
    } catch (error) {
      logger.error('Failed to get agent permissions', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Get default permissions for a role
   * @param {string} role - Role name
   * @returns {string[]} List of permissions
   */
  getDefaultRolePermissions(role) {
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Get all available permissions
   * @returns {string[]} List of all permissions
   */
  getAllPermissions() {
    return [...ALL_PERMISSIONS];
  }

  /**
   * Get all default roles with their permissions
   * @returns {Object} Map of role to permissions
   */
  getDefaultRoles() {
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }

  // ==================== CUSTOM ROLE MANAGEMENT ====================

  /**
   * Create a custom role
   * @param {string} accountId - Account ID
   * @param {Object} data - Role data
   * @param {string} data.name - Role name
   * @param {string} [data.description] - Role description
   * @param {string[]} data.permissions - List of permissions
   * @returns {Promise<Object>} Created role
   */
  async createCustomRole(accountId, data) {
    try {
      // Validate permissions
      const invalidPermissions = data.permissions.filter(p => !ALL_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
      
      const id = this.generateId();
      const now = new Date().toISOString();
      
      const { error } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.insert({
          id,
          account_id: accountId,
          name: data.name,
          description: data.description || null,
          permissions: JSON.stringify(data.permissions),
          created_at: now,
          updated_at: now
        })
      );
      
      if (error) throw error;
      
      logger.info('Custom role created', { roleId: id, accountId, name: data.name });
      
      return this.getCustomRoleById(id);
    } catch (error) {
      logger.error('Failed to create custom role', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get custom role by ID
   * @param {string} roleId - Role ID
   * @returns {Promise<Object|null>} Role or null
   */
  async getCustomRoleById(roleId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.select('*').eq('id', roleId).single()
      );
      
      if (error || !data) {
        return null;
      }
      
      return this.formatCustomRole(data);
    } catch (error) {
      logger.error('Failed to get custom role', { error: error.message, roleId });
      throw error;
    }
  }

  /**
   * List custom roles for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object[]>} List of custom roles
   */
  async listCustomRoles(accountId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.select('*').eq('account_id', accountId).order('name')
      );
      
      if (error) throw error;
      
      return (data || []).map(row => this.formatCustomRole(row));
    } catch (error) {
      logger.error('Failed to list custom roles', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a custom role
   * @param {string} roleId - Role ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated role
   */
  async updateCustomRole(roleId, data) {
    try {
      const updateData = {};
      
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      
      if (data.permissions !== undefined) {
        // Validate permissions
        const invalidPermissions = data.permissions.filter(p => !ALL_PERMISSIONS.includes(p));
        if (invalidPermissions.length > 0) {
          throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
        
        updateData.permissions = JSON.stringify(data.permissions);
      }
      
      if (Object.keys(updateData).length === 0) {
        return this.getCustomRoleById(roleId);
      }
      
      updateData.updated_at = new Date().toISOString();
      
      const { error } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.update(updateData).eq('id', roleId)
      );
      
      if (error) throw error;
      
      logger.info('Custom role updated', { roleId });
      
      return this.getCustomRoleById(roleId);
    } catch (error) {
      logger.error('Failed to update custom role', { error: error.message, roleId });
      throw error;
    }
  }

  /**
   * Delete a custom role
   * @param {string} roleId - Role ID
   * @returns {Promise<void>}
   */
  async deleteCustomRole(roleId) {
    try {
      // First, remove custom role from any agents using it
      await SupabaseService.queryAsAdmin('agents', (query) =>
        query.update({ custom_role_id: null }).eq('custom_role_id', roleId)
      );
      
      // Then delete the role
      const { error } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.delete().eq('id', roleId)
      );
      
      if (error) throw error;
      
      logger.info('Custom role deleted', { roleId });
    } catch (error) {
      logger.error('Failed to delete custom role', { error: error.message, roleId });
      throw error;
    }
  }

  /**
   * Get agents using a custom role
   * @param {string} roleId - Role ID
   * @returns {Promise<number>} Count of agents using this role
   */
  async getCustomRoleUsageCount(roleId) {
    try {
      const { count, error } = await SupabaseService.count('agents', { custom_role_id: roleId });
      
      if (error) throw error;
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to get custom role usage', { error: error.message, roleId });
      throw error;
    }
  }

  // ==================== ROLE ASSIGNMENT ====================

  /**
   * Assign a role to an agent
   * @param {string} agentId - Agent ID
   * @param {string} role - Role name (owner, administrator, agent, viewer)
   * @param {string} [customRoleId] - Custom role ID (optional)
   * @returns {Promise<void>}
   */
  async assignRole(agentId, role, customRoleId = null) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.update({
          role,
          custom_role_id: customRoleId,
          updated_at: new Date().toISOString()
        }).eq('id', agentId)
      );
      
      if (error) throw error;
      
      logger.info('Role assigned to agent', { agentId, role, customRoleId });
    } catch (error) {
      logger.error('Failed to assign role', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Assign a custom role to an agent
   * @param {string} agentId - Agent ID
   * @param {string} customRoleId - Custom role ID
   * @returns {Promise<void>}
   */
  async assignCustomRole(agentId, customRoleId) {
    try {
      // Verify custom role exists
      const role = await this.getCustomRoleById(customRoleId);
      if (!role) {
        throw new Error('CUSTOM_ROLE_NOT_FOUND');
      }
      
      const { error } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.update({
          custom_role_id: customRoleId,
          updated_at: new Date().toISOString()
        }).eq('id', agentId)
      );
      
      if (error) throw error;
      
      logger.info('Custom role assigned to agent', { agentId, customRoleId });
    } catch (error) {
      logger.error('Failed to assign custom role', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Remove custom role from an agent (revert to default role permissions)
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async removeCustomRole(agentId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.update({
          custom_role_id: null,
          updated_at: new Date().toISOString()
        }).eq('id', agentId)
      );
      
      if (error) throw error;
      
      logger.info('Custom role removed from agent', { agentId });
    } catch (error) {
      logger.error('Failed to remove custom role', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== PERMISSION VALIDATION ====================

  /**
   * Check if a user can grant specific permissions to another agent
   * Prevents permission escalation - users cannot grant permissions they don't have
   * @param {string} grantorAgentId - Agent ID of the user granting permissions
   * @param {string[]} permissionsToGrant - Permissions being granted
   * @returns {Promise<{allowed: boolean, deniedPermissions: string[]}>}
   */
  async canGrantPermissions(grantorAgentId, permissionsToGrant) {
    try {
      const grantorPermissions = await this.getAgentPermissions(grantorAgentId);
      
      // Owner can grant any permission
      if (grantorPermissions.includes('*')) {
        return { allowed: true, deniedPermissions: [] };
      }
      
      // Check which permissions the grantor doesn't have
      const deniedPermissions = permissionsToGrant.filter(p => !grantorPermissions.includes(p));
      
      return {
        allowed: deniedPermissions.length === 0,
        deniedPermissions
      };
    } catch (error) {
      logger.error('Failed to check permission grant', { error: error.message, grantorAgentId });
      throw error;
    }
  }

  /**
   * Check if a role change would be a permission escalation
   * @param {string} grantorAgentId - Agent ID of the user making the change
   * @param {string} targetRole - Role being assigned
   * @param {string} [customRoleId] - Custom role ID if applicable
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async canAssignRole(grantorAgentId, targetRole, customRoleId = null) {
    try {
      const grantorPermissions = await this.getAgentPermissions(grantorAgentId);
      
      // Owner can assign any role
      if (grantorPermissions.includes('*')) {
        return { allowed: true };
      }
      
      // Get target role permissions
      let targetPermissions;
      if (customRoleId) {
        const customRole = await this.getCustomRoleById(customRoleId);
        if (!customRole) {
          return { allowed: false, reason: 'CUSTOM_ROLE_NOT_FOUND' };
        }
        targetPermissions = customRole.permissions;
      } else {
        targetPermissions = DEFAULT_ROLE_PERMISSIONS[targetRole] || [];
      }
      
      // Check if target role has any permissions the grantor doesn't have
      const escalatedPermissions = targetPermissions.filter(p => !grantorPermissions.includes(p));
      
      if (escalatedPermissions.length > 0) {
        return {
          allowed: false,
          reason: 'PERMISSION_ESCALATION',
          escalatedPermissions
        };
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check role assignment', { error: error.message, grantorAgentId });
      throw error;
    }
  }

  /**
   * Check if an agent is trying to demote themselves from owner
   * @param {string} agentId - Agent ID being modified
   * @param {string} requestingAgentId - Agent ID making the request
   * @param {string} newRole - New role being assigned
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async canChangeOwnRole(agentId, requestingAgentId, newRole) {
    try {
      // If not the same agent, allow (other checks will apply)
      if (agentId !== requestingAgentId) {
        return { allowed: true };
      }
      
      // Get current role
      const { data: agent, error } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('role').eq('id', agentId).single()
      );
      
      if (error || !agent) {
        return { allowed: false, reason: 'AGENT_NOT_FOUND' };
      }
      
      const currentRole = agent.role;
      
      // Prevent owner from demoting themselves
      if (currentRole === 'owner' && newRole !== 'owner') {
        return { allowed: false, reason: 'CANNOT_DEMOTE_SELF' };
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check self role change', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Detect permission conflicts in a configuration
   * @param {string[]} permissions - List of permissions to check
   * @returns {{hasConflicts: boolean, conflicts: string[]}}
   */
  detectPermissionConflicts(permissions) {
    const conflicts = [];
    
    // Check for conflicting permissions
    // Example: having 'delete' without 'view' is a conflict
    const dependencyMap = {
      'conversations:delete': ['conversations:view'],
      'conversations:manage': ['conversations:view'],
      'conversations:assign': ['conversations:view'],
      'messages:delete': ['messages:send'],
      'contacts:delete': ['contacts:view'],
      'contacts:edit': ['contacts:view'],
      'agents:delete': ['agents:view'],
      'agents:edit': ['agents:view'],
      'teams:manage': ['teams:view'],
      'inboxes:manage': ['inboxes:view'],
      'settings:edit': ['settings:view']
    };
    
    for (const [permission, dependencies] of Object.entries(dependencyMap)) {
      if (permissions.includes(permission)) {
        for (const dep of dependencies) {
          if (!permissions.includes(dep)) {
            conflicts.push(`${permission} requires ${dep}`);
          }
        }
      }
    }
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Check if permission changes would affect active sessions
   * @param {string} agentId - Agent ID being modified
   * @returns {Promise<{hasActiveSessions: boolean, sessionCount: number}>}
   */
  async checkActiveSessionsImpact(agentId) {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await SupabaseService.queryAsAdmin('agent_sessions', (query) =>
        query.select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .gt('expires_at', now)
      );
      
      const sessionCount = data?.length || 0;
      
      return {
        hasActiveSessions: sessionCount > 0,
        sessionCount
      };
    } catch (error) {
      logger.error('Failed to check active sessions', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Format custom role row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted role
   */
  formatCustomRole(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      permissions: this.parseJSON(row.permissions, []),
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
  parseJSON(jsonString, defaultValue = []) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

module.exports = PermissionService;
module.exports.ALL_PERMISSIONS = ALL_PERMISSIONS;
module.exports.DEFAULT_ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;
