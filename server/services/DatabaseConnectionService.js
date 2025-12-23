/**
 * Database Connection Service
 * Handles CRUD operations for database connections (NocoDB, etc.)
 * Migrated from database.js compatibility layer
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

// Field mapping from camelCase to snake_case
const FIELD_MAPPING = {
  accountId: 'account_id',
  databaseName: 'database_name',
  tableName: 'table_name',
  nocodbToken: 'nocodb_token',
  nocodbProjectId: 'nocodb_project_id',
  nocodbTableId: 'nocodb_table_id',
  userLinkField: 'user_link_field',
  fieldMappings: 'field_mappings',
  viewConfiguration: 'view_configuration',
  defaultViewMode: 'default_view_mode',
  assignedUsers: 'assigned_users'
};

// Allowed fields for insert/update
const ALLOWED_FIELDS = [
  'account_id', 'name', 'type', 'host', 'port', 'database_name', 'username', 'password',
  'table_name', 'status', 'nocodb_token', 'nocodb_project_id', 'nocodb_table_id',
  'user_link_field', 'field_mappings', 'view_configuration', 'default_view_mode', 'assigned_users'
];

class DatabaseConnectionService {
  /**
   * Filter and map connection data to match Supabase table schema
   * @param {Object} connectionData - Raw connection data
   * @param {boolean} allowUpdatedAt - Whether to allow updated_at field
   * @returns {Object} Filtered and mapped data
   */
  static _filterConnectionData(connectionData, allowUpdatedAt = false) {
    const filteredData = {};
    
    for (const [key, value] of Object.entries(connectionData)) {
      // Skip id and timestamp fields
      if (key === 'id' || key === 'created_at') {
        continue;
      }
      
      // Map camelCase to snake_case if needed
      const mappedKey = FIELD_MAPPING[key] || key;
      
      // Only include if it's an allowed field
      if (ALLOWED_FIELDS.includes(mappedKey) || (allowUpdatedAt && mappedKey === 'updated_at')) {
        filteredData[mappedKey] = value;
      }
    }
    
    return filteredData;
  }

  /**
   * Get all database connections
   * @returns {Promise<Array>} List of connections
   */
  static async getAllConnections() {
    const { data, error } = await SupabaseService.getMany('database_connections', {}, {
      orderBy: 'created_at',
      ascending: false
    });
    
    if (error) {
      logger.error('Error fetching all connections', { error: error.message });
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get a connection by ID
   * @param {string} id - Connection ID
   * @returns {Promise<Object|null>} Connection or null
   */
  static async getConnectionById(id) {
    const { data, error } = await SupabaseService.getById('database_connections', id);
    
    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching connection by ID', { id, error: error.message });
      throw error;
    }
    
    return data;
  }

  /**
   * Create a new database connection
   * @param {Object} connectionData - Connection data
   * @returns {Promise<Object>} Created connection result
   */
  static async createConnection(connectionData) {
    const filteredData = this._filterConnectionData(connectionData);
    
    const { data, error } = await SupabaseService.insert('database_connections', filteredData);
    
    if (error) {
      logger.error('Error creating connection', { error: error.message });
      throw error;
    }
    
    return { id: data?.id, changes: 1, data };
  }

  /**
   * Update a database connection
   * @param {string} id - Connection ID
   * @param {Object} connectionData - Updated connection data
   * @returns {Promise<Object>} Update result
   */
  static async updateConnection(id, connectionData) {
    const filteredData = this._filterConnectionData(connectionData, true);
    
    const { data, error } = await SupabaseService.update('database_connections', id, filteredData);
    
    if (error) {
      logger.error('Error updating connection', { id, error: error.message });
      throw error;
    }
    
    return { changes: data ? 1 : 0, data };
  }

  /**
   * Update connection status
   * @param {string} id - Connection ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Update result
   */
  static async updateConnectionStatus(id, status) {
    return this.updateConnection(id, { 
      status, 
      updated_at: new Date().toISOString() 
    });
  }

  /**
   * Delete a database connection
   * @param {string} id - Connection ID
   * @returns {Promise<Object>} Delete result
   */
  static async deleteConnection(id) {
    const { error } = await SupabaseService.delete('database_connections', id);
    
    if (error) {
      logger.error('Error deleting connection', { id, error: error.message });
      throw error;
    }
    
    return { changes: 1 };
  }

  /**
   * Get connections assigned to a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of connections
   */
  static async getUserConnections(userId) {
    try {
      const { data, error } = await SupabaseService.getMany('database_connections', {});
      
      if (error) {
        logger.error('Error fetching user connections', { userId, error: error.message });
        return [];
      }
      
      // Filter connections where user is in assigned_users array
      const userConnections = (data || []).filter(conn => {
        if (!conn.assigned_users) return false;
        const assignedUsers = Array.isArray(conn.assigned_users) 
          ? conn.assigned_users 
          : JSON.parse(conn.assigned_users || '[]');
        return assignedUsers.includes(userId);
      });
      
      return userConnections;
    } catch (err) {
      logger.error('Error in getUserConnections', { userId, error: err.message });
      return [];
    }
  }

  /**
   * Get connections by account ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>} List of connections
   */
  static async getConnectionsByAccount(accountId) {
    const { data, error } = await SupabaseService.getMany('database_connections', {
      account_id: accountId
    }, {
      orderBy: 'created_at',
      ascending: false
    });
    
    if (error) {
      logger.error('Error fetching connections by account', { accountId, error: error.message });
      throw error;
    }
    
    return data || [];
  }
}

module.exports = DatabaseConnectionService;
