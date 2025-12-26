/**
 * Supabase Connection Service
 * Handles operations for EXTERNAL Supabase connections (not the platform's own Supabase)
 * Requirements: 6.1, 6.3, 6.4, 6.5
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// Cache for table metadata (10 minutes TTL)
const metadataCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Client pool for connection reuse
const clientPool = new Map();

/**
 * Error codes for Supabase operations
 */
const SUPABASE_ERROR_CODES = {
  INVALID_URL: 'INVALID_SUPABASE_URL',
  AUTH_FAILED: 'SUPABASE_AUTH_FAILED',
  PERMISSION_DENIED: 'SUPABASE_PERMISSION_DENIED',
  TABLE_NOT_FOUND: 'SUPABASE_TABLE_NOT_FOUND',
  RLS_VIOLATION: 'SUPABASE_RLS_VIOLATION',
  TIMEOUT: 'SUPABASE_TIMEOUT',
  RATE_LIMITED: 'SUPABASE_RATE_LIMITED',
  UNKNOWN: 'SUPABASE_UNKNOWN_ERROR',
};

/**
 * Error messages in Portuguese
 */
const ERROR_MESSAGES = {
  [SUPABASE_ERROR_CODES.INVALID_URL]: 'URL do Supabase inválida. Use o formato: https://seu-projeto.supabase.co',
  [SUPABASE_ERROR_CODES.AUTH_FAILED]: 'Falha na autenticação. Verifique sua API key.',
  [SUPABASE_ERROR_CODES.PERMISSION_DENIED]: 'Permissão negada. A API key não tem acesso a este recurso.',
  [SUPABASE_ERROR_CODES.TABLE_NOT_FOUND]: 'Tabela não encontrada no projeto Supabase.',
  [SUPABASE_ERROR_CODES.RLS_VIOLATION]: 'Acesso negado pela política de segurança (RLS).',
  [SUPABASE_ERROR_CODES.TIMEOUT]: 'Tempo limite excedido ao conectar ao Supabase.',
  [SUPABASE_ERROR_CODES.RATE_LIMITED]: 'Muitas requisições. Aguarde alguns segundos.',
  [SUPABASE_ERROR_CODES.UNKNOWN]: 'Erro inesperado ao comunicar com Supabase.',
};

class SupabaseConnectionService {
  /**
   * Create an isolated Supabase client for external connection
   * @param {string} url - Supabase project URL
   * @param {string} key - API key (service_role or anon)
   * @returns {SupabaseClient} Configured Supabase client
   */
  static createClient(url, key) {
    const cacheKey = `${url}:${key.slice(-8)}`;
    
    // Check if client exists in pool
    if (clientPool.has(cacheKey)) {
      return clientPool.get(cacheKey);
    }
    
    // Create new client
    const client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'x-client-info': 'wuzapi-manager'
        }
      }
    });
    
    // Store in pool (limit pool size)
    if (clientPool.size >= 100) {
      // Remove oldest entry
      const firstKey = clientPool.keys().next().value;
      clientPool.delete(firstKey);
    }
    clientPool.set(cacheKey, client);
    
    logger.debug('Created Supabase client', { url: url.replace(/https:\/\/([^.]+).*/, 'https://$1.***') });
    
    return client;
  }

  /**
   * Get client from connection config
   * @param {Object} connection - Database connection config
   * @returns {SupabaseClient}
   */
  static getClient(connection) {
    if (!connection.supabase_url || !connection.supabase_key) {
      throw this.createError(SUPABASE_ERROR_CODES.INVALID_URL, 'Configuração de conexão incompleta');
    }
    return this.createClient(connection.supabase_url, connection.supabase_key);
  }

  /**
   * List all tables from the public schema
   * @param {Object} connection - Database connection config
   * @returns {Promise<Array>} List of tables with metadata
   */
  static async listTables(connection) {
    const cacheKey = `tables:${connection.id || connection.supabase_url}`;
    
    // Check cache
    const cached = metadataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Returning cached table list', { connectionId: connection.id });
      return cached.data;
    }
    
    try {
      // Get URL and key from connection
      const supabaseUrl = connection.supabase_url;
      const supabaseKey = connection.supabase_key;
      
      if (!supabaseUrl || !supabaseKey) {
        throw this.createError(SUPABASE_ERROR_CODES.INVALID_URL, 'Configuração de conexão incompleta');
      }
      
      // Primary method: Fetch OpenAPI schema from Supabase REST API
      // This endpoint lists all tables exposed via PostgREST
      const tables = await this.fetchTablesFromOpenAPI(supabaseUrl, supabaseKey);
      
      if (tables.length > 0) {
        // Cache result
        metadataCache.set(cacheKey, { data: tables, timestamp: Date.now() });
        
        logger.info('Listed Supabase tables via OpenAPI', { 
          connectionId: connection.id, 
          tableCount: tables.length 
        });
        
        return tables;
      }
      
      // Fallback: Try RPC if available
      const client = this.getClient(connection);
      let rpcTables = null;
      
      try {
        const rpcResult = await client.rpc('get_tables_metadata', {
          schema_name: 'public'
        });
        if (!rpcResult.error && rpcResult.data) {
          rpcTables = rpcResult.data;
        }
      } catch (rpcError) {
        // RPC doesn't exist, continue to next fallback
        logger.debug('RPC get_tables_metadata not available', { error: rpcError.message });
      }
      
      if (rpcTables && rpcTables.length > 0) {
        const formattedTables = rpcTables.map(t => ({
          name: t.table_name || t.tablename,
          schema: 'public',
          rlsEnabled: t.rls_enabled ?? true,
          rowCount: t.row_count ?? null,
          comment: t.comment ?? null
        }));
        
        metadataCache.set(cacheKey, { data: formattedTables, timestamp: Date.now() });
        return formattedTables;
      }
      
      // Final fallback: discover tables by probing
      const discoveredTables = await this.discoverTables(client);
      metadataCache.set(cacheKey, { data: discoveredTables, timestamp: Date.now() });
      
      logger.info('Listed Supabase tables via discovery', { 
        connectionId: connection.id, 
        tableCount: discoveredTables.length 
      });
      
      return discoveredTables;
    } catch (error) {
      logger.error('Failed to list Supabase tables', {
        connectionId: connection.id,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Fetch tables from Supabase OpenAPI schema endpoint
   * @param {string} supabaseUrl - Supabase project URL
   * @param {string} supabaseKey - API key
   * @returns {Promise<Array>} List of tables
   */
  static async fetchTablesFromOpenAPI(supabaseUrl, supabaseKey) {
    try {
      // Supabase exposes OpenAPI schema at /rest/v1/ endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/openapi+json'
        }
      });
      
      if (!response.ok) {
        logger.debug('OpenAPI fetch failed', { status: response.status });
        return [];
      }
      
      const schema = await response.json();
      
      // Extract table names from OpenAPI paths
      // Each table is exposed as a path like "/tablename"
      const tables = [];
      
      if (schema.paths) {
        for (const path of Object.keys(schema.paths)) {
          // Skip non-table paths (like /rpc/*)
          if (path.startsWith('/rpc/') || path === '/') continue;
          
          // Extract table name from path (e.g., "/contacts" -> "contacts")
          const tableName = path.replace(/^\//, '').split('/')[0];
          
          // Skip if already added or if it's a system table
          if (!tableName || tables.some(t => t.name === tableName)) continue;
          if (tableName.startsWith('_') || tableName.startsWith('pg_')) continue;
          
          tables.push({
            name: tableName,
            schema: 'public',
            rlsEnabled: true, // Assume RLS is enabled
            rowCount: null,
            comment: null
          });
        }
      }
      
      // Sort alphabetically
      tables.sort((a, b) => a.name.localeCompare(b.name));
      
      return tables;
    } catch (error) {
      logger.debug('Failed to fetch OpenAPI schema', { error: error.message });
      return [];
    }
  }

  /**
   * Discover tables by attempting to query common table names
   * @param {SupabaseClient} client
   * @returns {Promise<Array>}
   */
  static async discoverTables(client) {
    const tables = [];
    
    // Try to get tables from a simple query
    try {
      // This will fail but give us table info in error
      const { error } = await client.from('_').select('*').limit(0);
      
      // Parse available tables from error or try known patterns
      // For now, return empty - user will need to specify table manually
    } catch (e) {
      // Ignore
    }
    
    return tables;
  }

  /**
   * Get column metadata for a specific table
   * @param {Object} connection - Database connection config
   * @param {string} tableName - Name of the table
   * @returns {Promise<Array>} List of columns with types and constraints
   */
  static async getTableColumns(connection, tableName) {
    const cacheKey = `columns:${connection.id || connection.supabase_url}:${tableName}`;
    
    // Check cache
    const cached = metadataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Returning cached column metadata', { connectionId: connection.id, tableName });
      return cached.data;
    }
    
    try {
      const client = this.getClient(connection);
      
      // Try to get columns by querying the table with limit 0
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          throw this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, `Tabela '${tableName}' não encontrada`);
        }
        throw this.translateError(error);
      }
      
      // Get column info from the response headers or schema
      // Supabase doesn't directly expose column metadata, so we need to infer from data
      // For better metadata, we'd need to query information_schema
      
      // Try to get detailed column info - pass connection for OpenAPI fallback
      const columns = await this.getDetailedColumnInfo(client, tableName, connection);
      
      // Cache result
      metadataCache.set(cacheKey, { data: columns, timestamp: Date.now() });
      
      logger.info('Got Supabase table columns', { 
        connectionId: connection.id, 
        tableName,
        columnCount: columns.length 
      });
      
      return columns;
    } catch (error) {
      logger.error('Failed to get Supabase table columns', {
        connectionId: connection.id,
        tableName,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Get detailed column information using multiple strategies
   * @param {SupabaseClient} client
   * @param {string} tableName
   * @param {Object} connection - Optional connection config for OpenAPI fallback
   * @returns {Promise<Array>}
   */
  static async getDetailedColumnInfo(client, tableName, connection = null) {
    try {
      // Strategy 1: Try RPC function (if exists)
      let columnsData = null;
      let columnsError = null;
      
      try {
        const result = await client.rpc('get_column_metadata', { table_name: tableName });
        columnsData = result.data;
        columnsError = result.error;
      } catch (rpcError) {
        // RPC function doesn't exist or failed
        columnsError = { code: 'PGRST202' };
      }
      
      if (!columnsError && columnsData && columnsData.length > 0) {
        logger.debug('Got columns via RPC', { tableName, count: columnsData.length });
        return columnsData.map(col => ({
          name: col.column_name,
          dataType: col.data_type,
          isNullable: col.is_nullable === 'YES',
          isPrimaryKey: col.is_primary_key || false,
          isForeignKey: col.is_foreign_key || false,
          foreignKeyTable: col.foreign_table || null,
          defaultValue: col.column_default,
          comment: col.description || null
        }));
      }
      
      // Strategy 2: Get a sample row and infer types
      const { data: sampleData } = await client
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleData && sampleData.length > 0) {
        const sample = sampleData[0];
        logger.debug('Got columns via sample data', { tableName, count: Object.keys(sample).length });
        return Object.keys(sample).map(key => ({
          name: key,
          dataType: this.inferDataType(sample[key]),
          isNullable: true, // Assume nullable
          isPrimaryKey: key === 'id',
          isForeignKey: key.endsWith('_id') && key !== 'id',
          foreignKeyTable: key.endsWith('_id') ? key.replace('_id', 's') : null,
          defaultValue: null,
          comment: null
        }));
      }
      
      // Strategy 3: Use OpenAPI schema (works even for empty tables)
      if (connection && connection.supabase_url && connection.supabase_key) {
        const openApiColumns = await this.fetchColumnsFromOpenAPI(
          connection.supabase_url, 
          connection.supabase_key, 
          tableName
        );
        if (openApiColumns.length > 0) {
          logger.debug('Got columns via OpenAPI', { tableName, count: openApiColumns.length });
          return openApiColumns;
        }
      }
      
      // If no data and no OpenAPI, return empty columns
      logger.warn('Could not get column info for table', { tableName });
      return [];
    } catch (error) {
      logger.warn('Could not get detailed column info, using fallback', { 
        tableName, 
        error: error.message 
      });
      
      // Try OpenAPI as last resort
      if (connection && connection.supabase_url && connection.supabase_key) {
        try {
          const openApiColumns = await this.fetchColumnsFromOpenAPI(
            connection.supabase_url, 
            connection.supabase_key, 
            tableName
          );
          if (openApiColumns.length > 0) {
            logger.debug('Got columns via OpenAPI (fallback)', { tableName, count: openApiColumns.length });
            return openApiColumns;
          }
        } catch (openApiError) {
          logger.warn('OpenAPI fallback also failed', { tableName, error: openApiError.message });
        }
      }
      
      return [];
    }
  }

  /**
   * Fetch column metadata from OpenAPI schema
   * Works even for empty tables
   * @param {string} supabaseUrl
   * @param {string} supabaseKey
   * @param {string} tableName
   * @returns {Promise<Array>}
   */
  static async fetchColumnsFromOpenAPI(supabaseUrl, supabaseKey, tableName) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/openapi+json'
        }
      });
      
      if (!response.ok) {
        logger.debug('OpenAPI fetch failed for columns', { status: response.status });
        return [];
      }
      
      const schema = await response.json();
      
      // Look for table definition in OpenAPI schema
      // The definitions section contains the schema for each table
      if (!schema.definitions || !schema.definitions[tableName]) {
        logger.debug('Table not found in OpenAPI definitions', { tableName });
        return [];
      }
      
      const tableSchema = schema.definitions[tableName];
      const properties = tableSchema.properties || {};
      const required = tableSchema.required || [];
      
      // Extract columns from properties
      const columns = Object.entries(properties).map(([name, prop]) => {
        // Determine data type from OpenAPI format/type
        let dataType = this.openApiTypeToPostgres(prop);
        
        // Check if it's a primary key (usually 'id' or has 'primary' in description)
        const isPrimaryKey = name === 'id' || 
          (prop.description && prop.description.toLowerCase().includes('primary'));
        
        // Check if it's a foreign key (ends with _id and not the primary key)
        const isForeignKey = name.endsWith('_id') && name !== 'id';
        
        return {
          name,
          dataType,
          isNullable: !required.includes(name),
          isPrimaryKey,
          isForeignKey,
          foreignKeyTable: isForeignKey ? name.replace('_id', 's') : null,
          defaultValue: prop.default || null,
          comment: prop.description || null
        };
      });
      
      return columns;
    } catch (error) {
      logger.debug('Failed to fetch columns from OpenAPI', { tableName, error: error.message });
      return [];
    }
  }

  /**
   * Convert OpenAPI type to PostgreSQL type
   * @param {Object} prop - OpenAPI property definition
   * @returns {string}
   */
  static openApiTypeToPostgres(prop) {
    const format = prop.format;
    const type = prop.type;
    
    // Check format first (more specific)
    if (format) {
      const formatMap = {
        'uuid': 'uuid',
        'date': 'date',
        'date-time': 'timestamp with time zone',
        'time': 'time',
        'int64': 'bigint',
        'int32': 'integer',
        'float': 'real',
        'double': 'double precision',
        'email': 'text',
        'uri': 'text',
        'binary': 'bytea'
      };
      if (formatMap[format]) return formatMap[format];
    }
    
    // Fall back to type
    const typeMap = {
      'integer': 'integer',
      'number': 'numeric',
      'boolean': 'boolean',
      'string': 'text',
      'array': 'ARRAY',
      'object': 'jsonb'
    };
    
    return typeMap[type] || 'text';
  }

  /**
   * Infer PostgreSQL data type from JavaScript value
   * @param {any} value
   * @returns {string}
   */
  static inferDataType(value) {
    if (value === null || value === undefined) return 'text';
    
    const type = typeof value;
    
    if (type === 'boolean') return 'boolean';
    if (type === 'number') {
      return Number.isInteger(value) ? 'integer' : 'numeric';
    }
    if (type === 'string') {
      // Check for UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return 'uuid';
      }
      // Check for ISO date
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
        return value.includes('T') ? 'timestamp with time zone' : 'date';
      }
      return 'text';
    }
    if (Array.isArray(value)) return 'ARRAY';
    if (type === 'object') return 'jsonb';
    
    return 'text';
  }

  /**
   * Fetch records with pagination and filtering
   * @param {Object} connection - Database connection config
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated records with count
   */
  static async fetchRecords(connection, options = {}) {
    const {
      page = 1,
      limit = 25,
      filters = {},
      orderBy = 'created_at',
      ascending = false,
      userId = null,
      userLinkField = null
    } = options;
    
    try {
      const client = this.getClient(connection);
      const tableName = connection.supabase_table;
      
      if (!tableName) {
        throw this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, 'Tabela não configurada');
      }
      
      let query = client.from(tableName).select('*', { count: 'exact' });
      
      // Apply user filter if configured
      if (userLinkField && userId) {
        query = query.eq(userLinkField, userId);
      }
      
      // Apply additional filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
      
      // Apply ordering
      query = query.order(orderBy, { ascending });
      
      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      
      const { data, count, error } = await query;
      
      if (error) {
        throw this.translateError(error);
      }
      
      logger.debug('Fetched Supabase records', {
        connectionId: connection.id,
        tableName,
        count: data?.length,
        total: count
      });
      
      return {
        data: data || [],
        count: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      logger.error('Failed to fetch Supabase records', {
        connectionId: connection.id,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Create a new record
   * @param {Object} connection - Database connection config
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  static async createRecord(connection, data) {
    try {
      const client = this.getClient(connection);
      const tableName = connection.supabase_table;
      
      if (!tableName) {
        throw this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, 'Tabela não configurada');
      }
      
      const { data: created, error } = await client
        .from(tableName)
        .insert(data)
        .select()
        .single();
      
      if (error) {
        throw this.translateError(error);
      }
      
      logger.info('Created Supabase record', {
        connectionId: connection.id,
        tableName,
        recordId: created?.id
      });
      
      return created;
    } catch (error) {
      logger.error('Failed to create Supabase record', {
        connectionId: connection.id,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Update an existing record (only modified fields)
   * @param {Object} connection - Database connection config
   * @param {string} id - Record ID
   * @param {Object} data - Updated fields
   * @param {Object} originalData - Original record for diff calculation
   * @returns {Promise<Object>} Updated record
   */
  static async updateRecord(connection, id, data, originalData = null) {
    try {
      const client = this.getClient(connection);
      const tableName = connection.supabase_table;
      
      if (!tableName) {
        throw this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, 'Tabela não configurada');
      }
      
      // Calculate diff if original data provided
      let updateData = data;
      if (originalData) {
        updateData = {};
        Object.keys(data).forEach(key => {
          if (JSON.stringify(data[key]) !== JSON.stringify(originalData[key])) {
            updateData[key] = data[key];
          }
        });
        
        // If no changes, return original
        if (Object.keys(updateData).length === 0) {
          logger.debug('No changes detected, skipping update', { connectionId: connection.id, recordId: id });
          return originalData;
        }
      }
      
      // Add updated_at if not present
      if (!updateData.updated_at) {
        updateData.updated_at = new Date().toISOString();
      }
      
      const { data: updated, error } = await client
        .from(tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw this.translateError(error);
      }
      
      logger.info('Updated Supabase record', {
        connectionId: connection.id,
        tableName,
        recordId: id,
        fieldsUpdated: Object.keys(updateData)
      });
      
      return updated;
    } catch (error) {
      logger.error('Failed to update Supabase record', {
        connectionId: connection.id,
        recordId: id,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Delete a record
   * @param {Object} connection - Database connection config
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   */
  static async deleteRecord(connection, id) {
    try {
      const client = this.getClient(connection);
      const tableName = connection.supabase_table;
      
      if (!tableName) {
        throw this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, 'Tabela não configurada');
      }
      
      const { error } = await client
        .from(tableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        throw this.translateError(error);
      }
      
      logger.info('Deleted Supabase record', {
        connectionId: connection.id,
        tableName,
        recordId: id
      });
    } catch (error) {
      logger.error('Failed to delete Supabase record', {
        connectionId: connection.id,
        recordId: id,
        error: error.message
      });
      throw this.translateError(error);
    }
  }

  /**
   * Test connection validity
   * @param {Object} connection - Database connection config
   * @returns {Promise<Object>} Test result with status and details
   */
  static async testConnection(connection) {
    try {
      const client = this.getClient(connection);
      
      // Try to list tables as a connection test
      const tables = await this.listTables(connection);
      
      // If a specific table is configured, verify access
      if (connection.supabase_table) {
        const { error } = await client
          .from(connection.supabase_table)
          .select('*')
          .limit(1);
        
        if (error) {
          return {
            success: false,
            status: 'error',
            message: `Conexão OK, mas erro ao acessar tabela '${connection.supabase_table}': ${error.message}`,
            details: {
              tablesCount: tables.length,
              tableAccessible: false
            }
          };
        }
      }
      
      logger.info('Supabase connection test successful', {
        connectionId: connection.id,
        tablesCount: tables.length
      });
      
      return {
        success: true,
        status: 'connected',
        message: 'Conexão estabelecida com sucesso',
        details: {
          tablesCount: tables.length,
          tableAccessible: true,
          tables: tables.slice(0, 10).map(t => t.name) // First 10 table names
        }
      };
    } catch (error) {
      logger.error('Supabase connection test failed', {
        connectionId: connection.id,
        error: error.message
      });
      
      return {
        success: false,
        status: 'error',
        message: error.userMessage || error.message,
        details: {
          errorCode: error.code
        }
      };
    }
  }

  /**
   * Clear metadata cache for a connection
   * @param {string} connectionId
   */
  static clearCache(connectionId) {
    for (const key of metadataCache.keys()) {
      if (key.includes(connectionId)) {
        metadataCache.delete(key);
      }
    }
    logger.debug('Cleared metadata cache', { connectionId });
  }

  /**
   * Create a standardized error
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @returns {Error}
   */
  static createError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.userMessage = ERROR_MESSAGES[code] || message;
    return error;
  }

  /**
   * Translate Supabase/PostgreSQL errors to user-friendly messages
   * @param {Error} error - Original error
   * @returns {Error} - Translated error
   */
  static translateError(error) {
    if (!error) return error;
    
    // Already translated
    if (error.code && ERROR_MESSAGES[error.code]) {
      error.userMessage = ERROR_MESSAGES[error.code];
      return error;
    }
    
    const message = error.message || '';
    const code = error.code || '';
    
    // Map common errors
    if (message.includes('Invalid API key') || code === '401' || message.includes('JWT')) {
      return this.createError(SUPABASE_ERROR_CODES.AUTH_FAILED, message);
    }
    
    if (message.includes('permission denied') || code === '42501') {
      return this.createError(SUPABASE_ERROR_CODES.PERMISSION_DENIED, message);
    }
    
    if (message.includes('does not exist') || code === 'PGRST204' || code === '42P01') {
      return this.createError(SUPABASE_ERROR_CODES.TABLE_NOT_FOUND, message);
    }
    
    if (message.includes('row-level security') || message.includes('RLS')) {
      return this.createError(SUPABASE_ERROR_CODES.RLS_VIOLATION, message);
    }
    
    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return this.createError(SUPABASE_ERROR_CODES.TIMEOUT, message);
    }
    
    if (message.includes('rate limit') || code === '429') {
      return this.createError(SUPABASE_ERROR_CODES.RATE_LIMITED, message);
    }
    
    // Default error
    const translatedError = new Error(message);
    translatedError.code = SUPABASE_ERROR_CODES.UNKNOWN;
    translatedError.userMessage = ERROR_MESSAGES[SUPABASE_ERROR_CODES.UNKNOWN];
    translatedError.originalError = error;
    return translatedError;
  }

  /**
   * Mask API key for display (show only last 4 characters)
   * @param {string} key - API key
   * @returns {string} - Masked key
   */
  static maskApiKey(key) {
    if (!key || key.length < 8) return '****';
    return '****' + key.slice(-4);
  }
}

module.exports = SupabaseConnectionService;
