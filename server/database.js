/**
 * Database Compatibility Layer
 * 
 * This file provides backward compatibility for code that still references
 * the old SQLite database interface. All operations are now routed to Supabase.
 * 
 * This is a temporary shim - code should be gradually migrated to use
 * SupabaseService directly.
 */

const SupabaseService = require('./services/SupabaseService');
const { logger } = require('./utils/logger');

class Database {
  constructor() {
    this.isInitialized = false;
    logger.info('Database compatibility layer initialized - using Supabase backend');
  }

  async init() {
    try {
      // Test Supabase connection
      const { data, error } = await SupabaseService.healthCheck();
      if (error) {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }
      this.isInitialized = true;
      logger.info('✅ Database (Supabase) initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  async query(sql, params = []) {
    // Route to Supabase RPC or direct query
    return SupabaseService.executeSql(sql, params);
  }

  // Branding config methods
  async getBrandingConfig() {
    const { data, error } = await SupabaseService.getById('branding_config', 1);
    if (error) {
      logger.warn('Error fetching branding config:', error.message);
      return this._getDefaultBrandingConfig();
    }
    return data || this._getDefaultBrandingConfig();
  }

  _getDefaultBrandingConfig() {
    return {
      id: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customHomeHtml: null,
      supportPhone: null
    };
  }

  // Connection methods - these should be migrated to use Supabase tables
  async getAllConnections() {
    const { data, error } = await SupabaseService.getMany('database_connections', {}, {
      orderBy: 'created_at',
      ascending: false
    });
    return data || [];
  }

  async getConnectionById(id) {
    const { data, error } = await SupabaseService.getById('database_connections', id);
    return data;
  }

  async createConnection(connectionData) {
    const { data, error } = await SupabaseService.insert('database_connections', connectionData);
    if (error) throw error;
    return { id: data?.id, changes: 1 };
  }

  async updateConnection(id, connectionData) {
    const { data, error } = await SupabaseService.update('database_connections', id, connectionData);
    if (error) throw error;
    return { changes: data ? 1 : 0 };
  }

  async updateConnectionStatus(id, status) {
    return this.updateConnection(id, { status, updated_at: new Date().toISOString() });
  }

  async deleteConnection(id) {
    const { error } = await SupabaseService.delete('database_connections', id);
    if (error) throw error;
    return { changes: 1 };
  }

  async getUserConnections(userToken) {
    // This needs to be implemented based on your user-connection relationship
    const { data, error } = await SupabaseService.getMany('database_connections', {});
    return data || [];
  }

  async validateUserAndGetId(userToken) {
    // Validate user token and return user ID
    const { data, error } = await SupabaseService.getMany('agents', { user_token: userToken });
    if (error || !data || data.length === 0) {
      throw new Error('Invalid user token');
    }
    return data[0].id;
  }

  validateUserConnectionAccess(userId, connection) {
    // Check if user has access to connection
    // This is a simplified check - implement proper access control
    return true;
  }

  // NocoDB and external database methods
  async fetchNocoDBUserRecord(connection, userLinkField, userToken) {
    // Implement NocoDB fetch logic
    logger.warn('fetchNocoDBUserRecord not fully implemented for Supabase');
    return null;
  }

  async fetchSQLiteUserRecord(connection, userLinkField, userToken) {
    // SQLite is no longer supported
    logger.warn('SQLite connections are no longer supported');
    return null;
  }

  async fetchSQLUserRecord(connection, userLinkField, userToken) {
    // External SQL database fetch
    logger.warn('fetchSQLUserRecord not fully implemented for Supabase');
    return null;
  }

  async getUserTableData(userToken, connectionId) {
    logger.warn('getUserTableData not fully implemented for Supabase');
    return [];
  }

  async createUserTableRecord(userToken, connectionId, recordData) {
    logger.warn('createUserTableRecord not fully implemented for Supabase');
    return { id: null };
  }

  async updateUserTableRecord(userToken, connectionId, recordId, recordData) {
    logger.warn('updateUserTableRecord not fully implemented for Supabase');
    return { changes: 0 };
  }

  async deleteUserTableRecord(userToken, connectionId, recordId) {
    logger.warn('deleteUserTableRecord not fully implemented for Supabase');
    return { changes: 0 };
  }

  async getDatabaseStats() {
    // Return mock stats since we're using Supabase
    return {
      databaseSize: 0,
      recordCount: 0,
      pageCount: 0,
      pageSize: 0
    };
  }

  async close() {
    logger.info('Database connection closed (Supabase - no action needed)');
    return true;
  }
}

// Export singleton instance
module.exports = new Database();
