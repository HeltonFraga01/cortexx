/**
 * AgentDatabaseAccessService - Service for managing agent database access
 * 
 * Controls which external database connections each agent can access
 * and at what level (none, view, full).
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Valid access levels
const ACCESS_LEVELS = ['none', 'view', 'full'];

class AgentDatabaseAccessService {
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
   * Get database access configurations for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of database access configs
   */
  async getAgentDatabaseAccess(agentId) {
    try {
      const sql = `
        SELECT id, agent_id, connection_id, access_level, created_at, updated_at
        FROM agent_database_access
        WHERE agent_id = ?
      `;
      
      const result = await this.db.query(sql, [agentId]);
      return result.rows.map(row => this.formatAccessConfig(row));
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
      await this.db.query(
        'DELETE FROM agent_database_access WHERE agent_id = ?',
        [agentId]
      );

      // Insert new configurations (skip 'none' as it's the default)
      for (const config of accessConfigs) {
        if (config.accessLevel !== 'none') {
          const id = this.generateId();
          await this.db.query(
            `INSERT INTO agent_database_access (id, agent_id, connection_id, access_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, agentId, config.connectionId, config.accessLevel, now, now]
          );
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
   * Check if agent has access to a specific database connection
   * @param {string} agentId - Agent ID
   * @param {string} connectionId - Database connection ID
   * @returns {Promise<string>} Access level ('none', 'view', 'full')
   */
  async checkDatabaseAccess(agentId, connectionId) {
    try {
      const sql = `
        SELECT access_level
        FROM agent_database_access
        WHERE agent_id = ? AND connection_id = ?
      `;
      
      const result = await this.db.query(sql, [agentId, connectionId]);
      
      if (result.rows.length === 0) {
        return 'none';
      }
      
      return result.rows[0].access_level;
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
   * Returns only databases with 'view' or 'full' access
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of accessible database configs with access level
   */
  async getAccessibleDatabases(agentId) {
    try {
      const sql = `
        SELECT ada.connection_id, ada.access_level
        FROM agent_database_access ada
        WHERE ada.agent_id = ? AND ada.access_level IN ('view', 'full')
      `;
      
      const result = await this.db.query(sql, [agentId]);
      return result.rows.map(row => ({
        connectionId: row.connection_id,
        accessLevel: row.access_level
      }));
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
      await this.db.query(
        'DELETE FROM agent_database_access WHERE agent_id = ? AND connection_id = ?',
        [agentId, connectionId]
      );

      // If access level is 'none', we're done (no record needed)
      if (accessLevel === 'none') {
        logger.info('Database access removed', { agentId, connectionId });
        return null;
      }

      // Insert new config
      const id = this.generateId();
      await this.db.query(
        `INSERT INTO agent_database_access (id, agent_id, connection_id, access_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, agentId, connectionId, accessLevel, now, now]
      );

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
      await this.db.query(
        'DELETE FROM agent_database_access WHERE agent_id = ?',
        [agentId]
      );
      
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
      const sql = `
        SELECT ada.agent_id, ada.access_level, a.name as agent_name, a.email as agent_email
        FROM agent_database_access ada
        JOIN agents a ON ada.agent_id = a.id
        WHERE ada.connection_id = ? AND ada.access_level IN ('view', 'full')
      `;
      
      const result = await this.db.query(sql, [connectionId]);
      return result.rows.map(row => ({
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentEmail: row.agent_email,
        accessLevel: row.access_level
      }));
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

      for (const agentId of agentIds) {
        // Delete existing
        await this.db.query(
          'DELETE FROM agent_database_access WHERE agent_id = ? AND connection_id = ?',
          [agentId, connectionId]
        );

        // Insert if not 'none'
        if (accessLevel !== 'none') {
          const id = this.generateId();
          await this.db.query(
            `INSERT INTO agent_database_access (id, agent_id, connection_id, access_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, agentId, connectionId, accessLevel, now, now]
          );
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
    return {
      id: row.id,
      agentId: row.agent_id,
      connectionId: row.connection_id,
      accessLevel: row.access_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = AgentDatabaseAccessService;
