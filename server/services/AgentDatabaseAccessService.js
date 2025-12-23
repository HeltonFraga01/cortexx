/**
 * AgentDatabaseAccessService - Service for managing agent database access
 * 
 * Controls which external database connections each agent can access
 * and at what level (none, view, full).
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const crypto = require('crypto');

// Valid access levels
const ACCESS_LEVELS = ['none', 'view', 'full'];

class AgentDatabaseAccessService {
  constructor() {
    // Uses SupabaseService directly - no db parameter needed
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get database access configurations for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of database access configs
   */
  async getAgentDatabaseAccess(agentId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query
          .select('id, agent_id, connection_id, permissions, created_at')
          .eq('agent_id', agentId);
      });
      
      if (error) throw error;
      return (data || []).map(row => this.formatAccessConfig(row));
    } catch (error) {
      logger.error('Failed to get agent database access', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Set database access configurations for an agent
   * Replaces all existing configurations with the new ones
   * @param {string} agentId - Agent ID
   * @param {Object[]} accessConfigs - Array of {connectionId, accessLevel}
   * @returns {Promise<Object[]>} Updated access configurations
   */
  async setAgentDatabaseAccess(agentId, accessConfigs) {
    try {
      // Validate access levels
      for (const config of accessConfigs) {
        if (!ACCESS_LEVELS.includes(config.accessLevel)) {
          throw new Error(`Invalid access level: ${config.accessLevel}`);
        }
      }

      const now = new Date().toISOString();

      // Delete existing configurations
      await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query.delete().eq('agent_id', agentId);
      });

      // Insert new configurations (skip 'none' as it's the default)
      for (const config of accessConfigs) {
        if (config.accessLevel !== 'none') {
          const id = this.generateId();
          const permissions = this.accessLevelToPermissions(config.accessLevel);
          await SupabaseService.insert('agent_database_access', {
            id,
            agent_id: agentId,
            connection_id: config.connectionId,
            permissions,
            created_at: now
          });
        }
      }

      logger.info('Agent database access updated', { 
        agentId, 
        configCount: accessConfigs.filter(c => c.accessLevel !== 'none').length 
      });

      return this.getAgentDatabaseAccess(agentId);
    } catch (error) {
      logger.error('Failed to set agent database access', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Convert access level to permissions object
   * @param {string} accessLevel - Access level ('none', 'view', 'full')
   * @returns {Object} Permissions object
   */
  accessLevelToPermissions(accessLevel) {
    switch (accessLevel) {
      case 'full':
        return { read: true, write: true, delete: true };
      case 'view':
        return { read: true, write: false, delete: false };
      default:
        return { read: false, write: false, delete: false };
    }
  }

  /**
   * Check if agent has access to a specific database connection
   * @param {string} agentId - Agent ID
   * @param {string} connectionId - Database connection ID
   * @returns {Promise<string>} Access level ('none', 'view', 'full')
   */
  async checkDatabaseAccess(agentId, connectionId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query
          .select('permissions')
          .eq('agent_id', agentId)
          .eq('connection_id', connectionId)
          .single();
      });
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        return 'none';
      }
      
      const permissions = data.permissions || {};
      if (permissions.write || permissions.delete) {
        return 'full';
      } else if (permissions.read) {
        return 'view';
      }
      return 'none';
    } catch (error) {
      logger.error('Failed to check database access', { 
        error: error.message, 
        agentId, 
        connectionId 
      });
      throw error;
    }
  }

  /**
   * Get all accessible databases for an agent
   * Returns only databases with 'view' or 'full' access (read permission)
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of accessible database configs with access level
   */
  async getAccessibleDatabases(agentId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query
          .select('connection_id, permissions')
          .eq('agent_id', agentId);
      });
      
      if (error) throw error;
      
      // Filter to only those with read access and map to access levels
      return (data || [])
        .filter(row => row.permissions?.read)
        .map(row => {
          const permissions = row.permissions || {};
          let accessLevel = 'none';
          if (permissions.write || permissions.delete) {
            accessLevel = 'full';
          } else if (permissions.read) {
            accessLevel = 'view';
          }
          return {
            connectionId: row.connection_id,
            accessLevel
          };
        });
    } catch (error) {
      logger.error('Failed to get accessible databases', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Set access for a single database connection
   * @param {string} agentId - Agent ID
   * @param {string} connectionId - Database connection ID
   * @param {string} accessLevel - Access level ('none', 'view', 'full')
   * @returns {Promise<Object|null>} Updated access config or null if removed
   */
  async setDatabaseAccess(agentId, connectionId, accessLevel) {
    try {
      if (!ACCESS_LEVELS.includes(accessLevel)) {
        throw new Error(`Invalid access level: ${accessLevel}`);
      }

      const now = new Date().toISOString();

      // Delete existing config for this connection
      await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query.delete().eq('agent_id', agentId).eq('connection_id', connectionId);
      });

      // If access level is 'none', we're done (no record needed)
      if (accessLevel === 'none') {
        logger.info('Database access removed', { agentId, connectionId });
        return null;
      }

      // Insert new config
      const id = this.generateId();
      const permissions = this.accessLevelToPermissions(accessLevel);
      await SupabaseService.insert('agent_database_access', {
        id,
        agent_id: agentId,
        connection_id: connectionId,
        permissions,
        created_at: now
      });

      logger.info('Database access set', { agentId, connectionId, accessLevel });

      return {
        id,
        agentId,
        connectionId,
        accessLevel,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      logger.error('Failed to set database access', { 
        error: error.message, 
        agentId, 
        connectionId 
      });
      throw error;
    }
  }

  /**
   * Remove all database access for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async removeAllAccess(agentId) {
    try {
      await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query.delete().eq('agent_id', agentId);
      });
      
      logger.info('All database access removed for agent', { agentId });
    } catch (error) {
      logger.error('Failed to remove all database access', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Get agents with access to a specific database connection
   * @param {string} connectionId - Database connection ID
   * @returns {Promise<Object[]>} List of agents with their access levels
   */
  async getAgentsWithAccess(connectionId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
        return query
          .select(`
            agent_id,
            permissions,
            agents!inner (
              name,
              email
            )
          `)
          .eq('connection_id', connectionId);
      });
      
      if (error) throw error;
      
      // Filter to only those with read access and map to access levels
      return (data || [])
        .filter(row => row.permissions?.read)
        .map(row => {
          const permissions = row.permissions || {};
          let accessLevel = 'none';
          if (permissions.write || permissions.delete) {
            accessLevel = 'full';
          } else if (permissions.read) {
            accessLevel = 'view';
          }
          return {
            agentId: row.agent_id,
            agentName: row.agents?.name,
            agentEmail: row.agents?.email,
            accessLevel
          };
        });
    } catch (error) {
      logger.error('Failed to get agents with access', { error: error.message, connectionId });
      throw error;
    }
  }

  /**
   * Bulk set database access for multiple agents
   * @param {string[]} agentIds - Array of agent IDs
   * @param {string} connectionId - Database connection ID
   * @param {string} accessLevel - Access level to set
   * @returns {Promise<number>} Number of agents updated
   */
  async bulkSetAccess(agentIds, connectionId, accessLevel) {
    try {
      if (!ACCESS_LEVELS.includes(accessLevel)) {
        throw new Error(`Invalid access level: ${accessLevel}`);
      }

      const now = new Date().toISOString();
      let updatedCount = 0;
      const permissions = this.accessLevelToPermissions(accessLevel);

      for (const agentId of agentIds) {
        // Delete existing
        await SupabaseService.queryAsAdmin('agent_database_access', (query) => {
          return query.delete().eq('agent_id', agentId).eq('connection_id', connectionId);
        });

        // Insert if not 'none'
        if (accessLevel !== 'none') {
          const id = this.generateId();
          await SupabaseService.insert('agent_database_access', {
            id,
            agent_id: agentId,
            connection_id: connectionId,
            permissions,
            created_at: now
          });
        }
        updatedCount++;
      }

      logger.info('Bulk database access updated', { 
        agentCount: updatedCount, 
        connectionId, 
        accessLevel 
      });

      return updatedCount;
    } catch (error) {
      logger.error('Failed to bulk set database access', { 
        error: error.message, 
        agentCount: agentIds.length, 
        connectionId 
      });
      throw error;
    }
  }

  /**
   * Format access config row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted access config
   */
  formatAccessConfig(row) {
    // Extract access level from permissions jsonb
    const permissions = row.permissions || { read: false, write: false, delete: false };
    let accessLevel = 'none';
    if (permissions.write || permissions.delete) {
      accessLevel = 'full';
    } else if (permissions.read) {
      accessLevel = 'view';
    }
    
    return {
      id: row.id,
      agentId: row.agent_id,
      connectionId: row.connection_id,
      accessLevel,
      permissions,
      createdAt: row.created_at
    };
  }
}

module.exports = AgentDatabaseAccessService;
