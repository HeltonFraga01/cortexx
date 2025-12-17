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
    // For simple health check queries, use Supabase healthCheck
    if (sql.trim().toLowerCase() === 'select 1 as test') {
      const { data, error } = await SupabaseService.healthCheck();
      if (error) throw error;
      return { rows: [{ test: 1 }] };
    }
    // Route to Supabase RPC or direct query
    return SupabaseService.executeSql(sql, params);
  }

  // Branding config methods
  async getBrandingConfig() {
    try {
      // Try to get the first branding config (there should only be one)
      const { data, error } = await SupabaseService.queryAsAdmin('branding_config', (query) =>
        query.select('*').limit(1).single()
      );
      
      if (error || !data) {
        logger.warn('No branding config found, using defaults');
        return this._getDefaultBrandingConfig();
      }

      // Map snake_case to camelCase
      return {
        id: data.id,
        appName: data.app_name || 'WUZAPI',
        logoUrl: data.logo_url || null,
        primaryColor: data.primary_color || null,
        secondaryColor: data.secondary_color || null,
        customHomeHtml: data.custom_home_html || null,
        supportPhone: data.support_phone || null,
        ogImageUrl: data.og_image_url || null,
        primaryForeground: data.primary_foreground || null,
        secondaryForeground: data.secondary_foreground || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      logger.error('Error fetching branding config:', error.message);
      return this._getDefaultBrandingConfig();
    }
  }

  _getDefaultBrandingConfig() {
    return {
      id: null,
      appName: 'WUZAPI',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      customHomeHtml: null,
      supportPhone: null,
      ogImageUrl: null,
      primaryForeground: null,
      secondaryForeground: null
    };
  }

  async updateBrandingConfig(brandingData) {
    try {
      // Validate required fields
      if (!brandingData.appName || brandingData.appName.trim().length === 0) {
        throw new Error('appName é obrigatório');
      }

      if (brandingData.appName.length > 50) {
        throw new Error('appName deve ter no máximo 50 caracteres');
      }

      // Map camelCase to snake_case for Supabase
      const updateData = {
        app_name: brandingData.appName.trim(),
        logo_url: brandingData.logoUrl || null,
        primary_color: brandingData.primaryColor || null,
        secondary_color: brandingData.secondaryColor || null,
        custom_home_html: brandingData.customHomeHtml || null,
        support_phone: brandingData.supportPhone || null,
        og_image_url: brandingData.ogImageUrl || null,
        primary_foreground: brandingData.primaryForeground || null,
        secondary_foreground: brandingData.secondaryForeground || null,
        updated_at: new Date().toISOString()
      };

      // Check if branding config exists
      const existing = await this.getBrandingConfig();
      
      logger.info('Updating branding config', {
        existingId: existing?.id,
        appName: updateData.app_name,
        hasCustomHtml: !!updateData.custom_home_html
      });

      let result;
      if (existing && existing.id) {
        // Update existing config
        const { data, error } = await SupabaseService.update('branding_config', existing.id, updateData);
        if (error) {
          logger.error('Error updating branding config:', { error: error.message, id: existing.id });
          throw new Error(error.message || 'Falha ao atualizar configuração de branding');
        }
        if (!data) {
          logger.error('No data returned from branding config update', { id: existing.id });
          throw new Error('Nenhum dado retornado após atualização');
        }
        result = data;
        logger.info('Branding config updated successfully', { id: result.id });
      } else {
        // Create new config
        const { data, error } = await SupabaseService.insert('branding_config', updateData);
        if (error) {
          logger.error('Error creating branding config:', { error: error.message });
          throw new Error(error.message || 'Falha ao criar configuração de branding');
        }
        if (!data) {
          logger.error('No data returned from branding config insert');
          throw new Error('Nenhum dado retornado após criação');
        }
        result = data;
        logger.info('Branding config created successfully', { id: result.id });
      }

      // Map snake_case back to camelCase for response
      return {
        id: result.id,
        appName: result.app_name,
        logoUrl: result.logo_url,
        primaryColor: result.primary_color,
        secondaryColor: result.secondary_color,
        customHomeHtml: result.custom_home_html,
        supportPhone: result.support_phone,
        ogImageUrl: result.og_image_url,
        primaryForeground: result.primary_foreground,
        secondaryForeground: result.secondary_foreground,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (error) {
      logger.error('Error in updateBrandingConfig:', error.message);
      throw error;
    }
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
    // Filter and map fields to match Supabase table schema
    // The table has: id, account_id, name, type, host, port, database_name, username, password,
    // table_name, status, nocodb_token, nocodb_project_id, nocodb_table_id, user_link_field,
    // field_mappings, view_configuration, default_view_mode, assigned_users, created_at, updated_at
    const allowedFields = [
      'account_id', 'name', 'type', 'host', 'port', 'database_name', 'username', 'password',
      'table_name', 'status', 'nocodb_token', 'nocodb_project_id', 'nocodb_table_id',
      'user_link_field', 'field_mappings', 'view_configuration', 'default_view_mode', 'assigned_users'
    ];

    // Map camelCase to snake_case and filter to allowed fields only
    const fieldMapping = {
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

    const filteredData = {};
    for (const [key, value] of Object.entries(connectionData)) {
      // Skip id and timestamp fields
      if (key === 'id' || key === 'created_at' || key === 'updated_at') {
        continue;
      }

      // Map camelCase to snake_case if needed
      const mappedKey = fieldMapping[key] || key;

      // Only include if it's an allowed field
      if (allowedFields.includes(mappedKey)) {
        filteredData[mappedKey] = value;
      }
    }

    const { data, error } = await SupabaseService.insert('database_connections', filteredData);
    if (error) throw error;
    return { id: data?.id, changes: 1 };
  }

  async updateConnection(id, connectionData) {
    // Filter and map fields to match Supabase table schema (same as createConnection)
    const allowedFields = [
      'account_id', 'name', 'type', 'host', 'port', 'database_name', 'username', 'password',
      'table_name', 'status', 'nocodb_token', 'nocodb_project_id', 'nocodb_table_id',
      'user_link_field', 'field_mappings', 'view_configuration', 'default_view_mode', 'assigned_users'
    ];

    const fieldMapping = {
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

    const filteredData = {};
    for (const [key, value] of Object.entries(connectionData)) {
      // Skip id and timestamp fields
      if (key === 'id' || key === 'created_at') {
        continue;
      }

      // Map camelCase to snake_case if needed
      const mappedKey = fieldMapping[key] || key;

      // Only include if it's an allowed field
      if (allowedFields.includes(mappedKey) || mappedKey === 'updated_at') {
        filteredData[mappedKey] = value;
      }
    }

    const { data, error } = await SupabaseService.update('database_connections', id, filteredData);
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

  // Note: External database methods (NocoDB, SQL) have been moved to dedicated services.
  // Use NocoDBService for NocoDB operations.
  // Use SupabaseService for direct database operations.

  async getDatabaseStats() {
    // Return mock stats since we're using Supabase
    return {
      databaseSize: 0,
      recordCount: 0,
      pageCount: 0,
      pageSize: 0
    };
  }

  // Table Permissions methods
  async getAllTablePermissions() {
    const { data, error } = await SupabaseService.getMany('table_permissions', {}, {
      orderBy: 'created_at',
      ascending: false
    });
    if (error) {
      logger.error('Error fetching all table permissions:', error.message);
      throw error;
    }
    return data || [];
  }

  async getUserTablePermissions(userId, tableName = null) {
    const filters = { user_id: userId };
    if (tableName) {
      filters.table_name = tableName;
    }
    const { data, error } = await SupabaseService.getMany('table_permissions', filters);
    if (error) {
      logger.error('Error fetching user table permissions:', error.message);
      throw error;
    }
    return data || [];
  }

  async createTablePermission(userId, tableName, permissions = {}) {
    // Check if permission already exists
    const existing = await this.getUserTablePermissions(userId, tableName);
    if (existing && existing.length > 0) {
      throw new Error('Permission already exists for this user and table');
    }

    const permissionData = {
      user_id: userId,
      table_name: tableName,
      can_read: permissions.can_read || false,
      can_write: permissions.can_write || false,
      can_delete: permissions.can_delete || false
    };

    const { data, error } = await SupabaseService.insert('table_permissions', permissionData);
    if (error) {
      logger.error('Error creating table permission:', error.message);
      throw error;
    }
    return data;
  }

  async updateTablePermission(id, permissions) {
    const updateData = {};
    if (permissions.can_read !== undefined) updateData.can_read = permissions.can_read;
    if (permissions.can_write !== undefined) updateData.can_write = permissions.can_write;
    if (permissions.can_delete !== undefined) updateData.can_delete = permissions.can_delete;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await SupabaseService.update('table_permissions', id, updateData);
    if (error) {
      logger.error('Error updating table permission:', error.message);
      return false;
    }
    return !!data;
  }

  async deleteTablePermission(id) {
    const { error } = await SupabaseService.delete('table_permissions', id);
    if (error) {
      logger.error('Error deleting table permission:', error.message);
      return false;
    }
    return true;
  }

  // Table introspection methods for admin
  async getAvailableTables() {
    try {
      // List of known Supabase tables in the system
      const knownTables = [
        'accounts', 'agents', 'agent_bots', 'agent_campaigns', 'agent_database_access',
        'agent_drafts', 'agent_invitations', 'agent_sessions', 'agent_templates',
        'audit_log', 'automation_audit_log', 'bot_inbox_assignments', 'bot_templates',
        'branding_config', 'bulk_campaigns', 'campaign_contacts', 'campaign_templates',
        'canned_responses', 'chat_messages', 'contact_attributes', 'contact_notes',
        'conversation_labels', 'conversations', 'custom_links', 'custom_roles',
        'custom_themes', 'database_connections', 'default_canned_responses',
        'default_labels', 'global_settings', 'inbox_members', 'inboxes', 'labels',
        'macros', 'message_drafts', 'message_reactions', 'message_templates',
        'outgoing_webhooks', 'plans', 'scheduled_single_messages', 'sent_messages',
        'session_token_mapping', 'sessions', 'system_settings', 'table_permissions',
        'team_members', 'teams', 'usage_metrics', 'user_feature_overrides',
        'user_quota_overrides', 'user_quota_usage', 'user_subscriptions', 'webhook_events'
      ];

      const tables = [];
      for (const tableName of knownTables) {
        try {
          const { count, error } = await SupabaseService.count(tableName);
          if (!error) {
            // Get sample row to count columns
            const { data: sampleData } = await SupabaseService.getMany(tableName, {}, { limit: 1 });
            const columnCount = sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]).length : 0;
            
            tables.push({
              table_name: tableName,
              row_count: count || 0,
              column_count: columnCount,
              index_count: 0 // Supabase doesn't expose index info easily
            });
          }
        } catch (e) {
          // Table might not exist, skip it
        }
      }

      return tables;
    } catch (error) {
      logger.error('Error getting available tables:', error.message);
      return [];
    }
  }

  async getTableSchema(tableName) {
    try {
      // Get a sample row to infer schema
      const { data, error } = await SupabaseService.getMany(tableName, {}, { limit: 1 });
      
      if (error) {
        throw new Error(`Table '${tableName}' not found`);
      }

      // Infer columns from sample data or return empty schema
      const columns = [];
      if (data && data.length > 0) {
        const sampleRow = data[0];
        for (const [key, value] of Object.entries(sampleRow)) {
          let inferredType = 'text';
          if (value === null) {
            inferredType = 'text';
          } else if (typeof value === 'boolean') {
            inferredType = 'boolean';
          } else if (typeof value === 'number') {
            inferredType = Number.isInteger(value) ? 'integer' : 'numeric';
          } else if (typeof value === 'object') {
            inferredType = Array.isArray(value) ? 'array' : 'jsonb';
          } else if (typeof value === 'string') {
            // Check if it looks like a date/timestamp
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
              inferredType = 'timestamp';
            } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
              inferredType = 'uuid';
            } else {
              inferredType = 'text';
            }
          }
          
          columns.push({
            name: key,
            type: inferredType,
            not_null: key === 'id', // Assume id is always required
            default_value: null,
            primary_key: key === 'id'
          });
        }
      }

      return {
        table_name: tableName,
        columns
      };
    } catch (error) {
      logger.error('Error getting table schema:', error.message);
      throw error;
    }
  }

  async queryTable(tableName, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      const { data, error } = await SupabaseService.getMany(tableName, {}, {
        limit,
        offset,
        orderBy: 'created_at',
        ascending: false
      });

      if (error) {
        throw error;
      }

      const { count } = await SupabaseService.count(tableName);

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      logger.error('Error querying table:', error.message);
      throw error;
    }
  }

  // Message history methods
  async getMessageHistory(userToken, limit = 50, offset = 0) {
    try {
      // First, get the account_id for this user token
      const { data: accountData, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('wuzapi_token', userToken).single()
      );

      if (accountError || !accountData) {
        logger.warn('Account not found for user token:', userToken.substring(0, 8) + '...');
        return [];
      }

      const accountId = accountData.id;

      // Fetch messages for this account
      const { data, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
        query
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
      );

      if (error) {
        logger.error('Error fetching message history:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getMessageHistory:', error.message);
      return [];
    }
  }

  async getMessageCount(userToken, period = 'all') {
    try {
      // First, get the account_id for this user token
      const { data: accountData, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('wuzapi_token', userToken).single()
      );

      if (accountError || !accountData) {
        logger.warn('Account not found for user token in getMessageCount:', userToken.substring(0, 8) + '...');
        return 0;
      }

      const accountId = accountData.id;

      // Build query based on period
      let queryBuilder;
      if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const { count, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
          query
            .select('*', { count: 'exact', head: true })
            .eq('account_id', accountId)
            .gte('created_at', todayISO)
        );

        if (error) {
          logger.error('Error counting messages for today:', error.message);
          return 0;
        }

        return count || 0;
      } else {
        // Count all messages
        const { count, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
          query
            .select('*', { count: 'exact', head: true })
            .eq('account_id', accountId)
        );

        if (error) {
          logger.error('Error counting all messages:', error.message);
          return 0;
        }

        return count || 0;
      }
    } catch (error) {
      logger.error('Error in getMessageCount:', error.message);
      return 0;
    }
  }

  async close() {
    logger.info('Database connection closed (Supabase - no action needed)');
    return true;
  }
}

// Export singleton instance
module.exports = new Database();
