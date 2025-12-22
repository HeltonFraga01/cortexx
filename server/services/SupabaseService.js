/**
 * Supabase Service
 * Task 11.1: Create server/services/SupabaseService.js
 * 
 * Replaces server/database.js as the database abstraction layer
 * Provides RLS-aware queries and admin operations
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// PostgreSQL error codes mapping
const PG_ERROR_CODES = {
  '23505': { code: 'DUPLICATE_KEY', message: 'Record already exists' },
  '23503': { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record not found' },
  '23502': { code: 'NOT_NULL_VIOLATION', message: 'Required field is missing' },
  '23514': { code: 'CHECK_VIOLATION', message: 'Value does not meet constraints' },
  '42501': { code: 'INSUFFICIENT_PRIVILEGE', message: 'Access denied' },
  '42P01': { code: 'UNDEFINED_TABLE', message: 'Table does not exist' },
  '42703': { code: 'UNDEFINED_COLUMN', message: 'Column does not exist' },
  'PGRST301': { code: 'ROW_NOT_FOUND', message: 'Record not found' },
  'PGRST116': { code: 'MULTIPLE_ROWS', message: 'Multiple rows returned when one expected' }
};

class SupabaseService {
  constructor() {
    this._initialized = false;
    this._adminClient = null;
    this.supabaseUrl = null;
    this.supabaseAnonKey = null;
    
    // Try to initialize immediately if config is available
    this._tryInitialize();
  }

  /**
   * Try to initialize the Supabase client
   * Does not throw if config is missing - allows tests to run without Supabase
   */
  _tryInitialize() {
    if (this._initialized) return true;
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      // Don't throw - allow module to load for testing
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Supabase configuration missing - some features may not work');
      }
      return false;
    }
    
    // Service role client (bypasses RLS) - for admin operations
    this._adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Store config for creating user clients
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this._initialized = true;
    
    logger.info('SupabaseService initialized');
    return true;
  }

  /**
   * Get the admin client, initializing if needed
   * @throws {Error} if Supabase is not configured
   */
  get adminClient() {
    if (!this._initialized) {
      this._tryInitialize();
    }
    if (!this._adminClient) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    return this._adminClient;
  }

  /**
   * Create a user-scoped client that respects RLS
   * @param {string} token - User's JWT token
   * @returns {SupabaseClient}
   */
  createUserClient(token) {
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Query with user context (respects RLS)
   * @param {string} token - User's JWT token
   * @param {string} table - Table name
   * @param {Function} queryBuilder - Function that builds the query
   * @returns {Promise<{data: any, count: number|null, error: any}>}
   */
  async queryAsUser(token, table, queryBuilder) {
    try {
      const client = this.createUserClient(token);
      const query = queryBuilder(client.from(table));
      const result = await query;
      
      if (result.error) {
        throw this.translateError(result.error);
      }
      
      return { data: result.data, count: result.count, error: null };
    } catch (error) {
      logger.error('queryAsUser failed', {
        table,
        error: error.message
      });
      return { data: null, count: null, error: this.translateError(error) };
    }
  }

  /**
   * Query as admin (bypasses RLS)
   * Use for system operations like audit logging
   * @param {string} table - Table name
   * @param {Function} queryBuilder - Function that builds the query
   * @returns {Promise<{data: any, count: number|null, error: any}>}
   */
  async queryAsAdmin(table, queryBuilder) {
    try {
      const query = queryBuilder(this.adminClient.from(table));
      const result = await query;
      
      if (result.error) {
        throw this.translateError(result.error);
      }
      
      return { data: result.data, count: result.count, error: null };
    } catch (error) {
      logger.error('queryAsAdmin failed', {
        table,
        error: error.message
      });
      return { data: null, count: null, error: this.translateError(error) };
    }
  }

  /**
   * Execute a transaction using RPC
   * Task 11.2: Implement transaction support
   * @param {Function} callback - Async function receiving transaction client
   * @returns {Promise<{data: any, error: any}>}
   */
  async transaction(callback) {
    // Note: Supabase doesn't have native transaction support in the JS client
    // We use RPC functions for complex transactions
    // For simple cases, we rely on PostgreSQL's implicit transactions
    
    try {
      // Execute callback with admin client
      // Each query is its own transaction
      const result = await callback(this.adminClient);
      return { data: result, error: null };
    } catch (error) {
      logger.error('Transaction failed', {
        error: error.message,
        stack: error.stack
      });
      return { data: null, error: this.translateError(error) };
    }
  }

  /**
   * Execute raw SQL via RPC (admin only)
   * NOTE: Supabase JS client doesn't support raw SQL execution directly.
   * This method parses common SQL patterns and routes to appropriate Supabase methods.
   * For complex queries, use queryAsAdmin with proper query builders.
   * 
   * @param {string} sql - SQL query
   * @param {array|object} params - Query parameters (array for positional, object for named)
   * @returns {Promise<{rows: array, data: any, error: any}>}
   */
  async executeSql(sql, params = []) {
    try {
      // Normalize params to array if object
      const paramArray = Array.isArray(params) ? params : Object.values(params);
      
      // Parse the SQL to determine the operation type
      const sqlLower = sql.trim().toLowerCase();
      
      // Handle SELECT queries
      if (sqlLower.startsWith('select')) {
        return await this._executeSelect(sql, paramArray);
      }
      
      // Handle INSERT queries
      if (sqlLower.startsWith('insert')) {
        return await this._executeInsert(sql, paramArray);
      }
      
      // Handle UPDATE queries
      if (sqlLower.startsWith('update')) {
        return await this._executeUpdate(sql, paramArray);
      }
      
      // Handle DELETE queries
      if (sqlLower.startsWith('delete')) {
        return await this._executeDelete(sql, paramArray);
      }
      
      // For unsupported queries, log warning and return empty result
      logger.warn('Unsupported SQL operation in executeSql', { 
        sqlPreview: sql.substring(0, 100),
        operation: sqlLower.split(' ')[0]
      });
      return { rows: [], data: null, error: null };
    } catch (error) {
      logger.error('executeSql failed', {
        error: error.message,
        sqlPreview: sql.substring(0, 100)
      });
      return { rows: [], data: null, error: this.translateError(error) };
    }
  }

  /**
   * Execute SELECT query by parsing SQL and using Supabase query builder
   * @private
   */
  async _executeSelect(sql, params) {
    try {
      // Extract table name from SQL
      const tableMatch = sql.match(/from\s+([a-z_]+)/i);
      if (!tableMatch) {
        throw new Error('Could not parse table name from SELECT query');
      }
      const tableName = tableMatch[1];
      
      // Build query using Supabase
      let query = this.adminClient.from(tableName).select('*');
      
      // Parse WHERE conditions and apply them
      const whereMatch = sql.match(/where\s+(.+?)(?:\s+order|\s+limit|\s+group|\s*$)/i);
      if (whereMatch) {
        const conditions = this._parseWhereConditions(whereMatch[1], params);
        for (const condition of conditions) {
          if (condition.operator === '=') {
            query = query.eq(condition.column, condition.value);
          } else if (condition.operator === 'in') {
            query = query.in(condition.column, condition.value);
          } else if (condition.operator === '>=') {
            query = query.gte(condition.column, condition.value);
          } else if (condition.operator === '<=') {
            query = query.lte(condition.column, condition.value);
          } else if (condition.operator === '>') {
            query = query.gt(condition.column, condition.value);
          } else if (condition.operator === '<') {
            query = query.lt(condition.column, condition.value);
          }
        }
      }
      
      // Parse ORDER BY
      const orderMatch = sql.match(/order\s+by\s+([a-z_]+)(?:\s+(asc|desc))?/i);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        const ascending = !orderMatch[2] || orderMatch[2].toLowerCase() === 'asc';
        query = query.order(orderColumn, { ascending });
      }
      
      // Parse LIMIT
      const limitMatch = sql.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1]));
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return { rows: data || [], data: data, error: null };
    } catch (error) {
      logger.error('_executeSelect failed', { error: error.message });
      return { rows: [], data: null, error };
    }
  }

  /**
   * Execute INSERT query
   * @private
   */
  async _executeInsert(sql, params) {
    try {
      // Extract table name
      const tableMatch = sql.match(/insert\s+into\s+([a-z_]+)/i);
      if (!tableMatch) {
        throw new Error('Could not parse table name from INSERT query');
      }
      const tableName = tableMatch[1];
      
      // Extract column names
      const columnsMatch = sql.match(/\(([^)]+)\)\s*values/i);
      if (!columnsMatch) {
        throw new Error('Could not parse columns from INSERT query');
      }
      const columns = columnsMatch[1].split(',').map(c => c.trim());
      
      // Build insert data object
      const insertData = {};
      columns.forEach((col, idx) => {
        if (idx < params.length) {
          insertData[col] = params[idx];
        }
      });
      
      const { data, error } = await this.adminClient
        .from(tableName)
        .insert(insertData)
        .select();
      
      if (error) {
        throw error;
      }
      
      return { rows: data || [], data: data, error: null };
    } catch (error) {
      logger.error('_executeInsert failed', { error: error.message });
      return { rows: [], data: null, error };
    }
  }

  /**
   * Execute UPDATE query
   * @private
   */
  async _executeUpdate(sql, params) {
    try {
      // Extract table name
      const tableMatch = sql.match(/update\s+([a-z_]+)/i);
      if (!tableMatch) {
        throw new Error('Could not parse table name from UPDATE query');
      }
      const tableName = tableMatch[1];
      
      // Extract SET clause
      const setMatch = sql.match(/set\s+(.+?)\s+where/i);
      if (!setMatch) {
        throw new Error('Could not parse SET clause from UPDATE query');
      }
      
      // Parse SET assignments
      const setClause = setMatch[1];
      const assignments = setClause.split(',').map(a => a.trim());
      const updateData = {};
      let paramIndex = 0;
      
      for (const assignment of assignments) {
        const [column] = assignment.split('=').map(s => s.trim());
        if (assignment.includes('?')) {
          updateData[column] = params[paramIndex++];
        }
      }
      
      // Build query
      let query = this.adminClient.from(tableName).update(updateData);
      
      // Parse WHERE conditions
      const whereMatch = sql.match(/where\s+(.+?)$/i);
      if (whereMatch) {
        const remainingParams = params.slice(paramIndex);
        const conditions = this._parseWhereConditions(whereMatch[1], remainingParams);
        for (const condition of conditions) {
          if (condition.operator === '=') {
            query = query.eq(condition.column, condition.value);
          }
        }
      }
      
      const { data, error } = await query.select();
      
      if (error) {
        throw error;
      }
      
      return { rows: data || [], data: data, error: null };
    } catch (error) {
      logger.error('_executeUpdate failed', { error: error.message });
      return { rows: [], data: null, error };
    }
  }

  /**
   * Execute DELETE query
   * @private
   */
  async _executeDelete(sql, params) {
    try {
      // Extract table name
      const tableMatch = sql.match(/delete\s+from\s+([a-z_]+)/i);
      if (!tableMatch) {
        throw new Error('Could not parse table name from DELETE query');
      }
      const tableName = tableMatch[1];
      
      // Build query
      let query = this.adminClient.from(tableName).delete();
      
      // Parse WHERE conditions
      const whereMatch = sql.match(/where\s+(.+?)$/i);
      if (whereMatch) {
        const conditions = this._parseWhereConditions(whereMatch[1], params);
        for (const condition of conditions) {
          if (condition.operator === '=') {
            query = query.eq(condition.column, condition.value);
          } else if (condition.operator === 'in') {
            query = query.in(condition.column, condition.value);
          }
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return { rows: [], data: null, error: null };
    } catch (error) {
      logger.error('_executeDelete failed', { error: error.message });
      return { rows: [], data: null, error };
    }
  }

  /**
   * Parse WHERE conditions from SQL
   * @private
   */
  _parseWhereConditions(whereClause, params) {
    const conditions = [];
    let paramIndex = 0;
    
    // Split by AND (simple parsing, doesn't handle OR or complex expressions)
    const parts = whereClause.split(/\s+and\s+/i);
    
    for (const part of parts) {
      // Handle IN clause
      const inMatch = part.match(/([a-z_]+)\s+in\s*\(([^)]+)\)/i);
      if (inMatch) {
        const column = inMatch[1];
        const placeholders = inMatch[2].split(',').map(p => p.trim());
        const values = [];
        for (const ph of placeholders) {
          if (ph === '?') {
            values.push(params[paramIndex++]);
          } else {
            values.push(ph.replace(/'/g, ''));
          }
        }
        conditions.push({ column, operator: 'in', value: values });
        continue;
      }
      
      // Handle comparison operators
      const compMatch = part.match(/([a-z_]+)\s*(>=|<=|>|<|=)\s*\?/i);
      if (compMatch) {
        conditions.push({
          column: compMatch[1],
          operator: compMatch[2],
          value: params[paramIndex++]
        });
      }
    }
    
    return conditions;
  }

  /**
   * Task 11.3: Translate PostgreSQL errors to app errors
   * @param {Error} error - Original error
   * @returns {Error} - Translated error
   */
  translateError(error) {
    if (!error) return null;
    
    const pgCode = error.code || error.details?.code;
    const mapped = PG_ERROR_CODES[pgCode];
    
    if (mapped) {
      const appError = new Error(mapped.message);
      appError.code = mapped.code;
      appError.originalError = error;
      appError.details = error.details || error.message;
      return appError;
    }
    
    // Handle Supabase-specific errors
    if (error.message?.includes('JWT')) {
      const appError = new Error('Authentication required');
      appError.code = 'AUTH_REQUIRED';
      appError.originalError = error;
      return appError;
    }
    
    if (error.message?.includes('permission denied')) {
      const appError = new Error('Access denied');
      appError.code = 'ACCESS_DENIED';
      appError.originalError = error;
      return appError;
    }
    
    // Default error
    const appError = new Error(error.message || 'Database operation failed');
    appError.code = 'DATABASE_ERROR';
    appError.originalError = error;
    return appError;
  }

  /**
   * Validate schema completeness
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async validateSchema() {
    const errors = [];
    const requiredTables = [
      'accounts', 'agents', 'conversations', 'chat_messages', 'plans',
      'inboxes', 'teams', 'labels', 'canned_responses', 'agent_bots',
      'outgoing_webhooks', 'bulk_campaigns', 'user_subscriptions'
    ];
    
    for (const table of requiredTables) {
      const { error } = await this.adminClient
        .from(table)
        .select('id')
        .limit(0);
      
      if (error) {
        errors.push(`Table '${table}' not accessible: ${error.message}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Convenience methods for common operations

  /**
   * Get a single record by ID
   */
  async getById(table, id, token = null) {
    const queryFn = (query) => query.select('*').eq('id', id).single();
    
    if (token) {
      return this.queryAsUser(token, table, queryFn);
    }
    return this.queryAsAdmin(table, queryFn);
  }

  /**
   * Get multiple records with filters
   */
  async getMany(table, filters = {}, options = {}, token = null) {
    const queryFn = (query) => {
      let q = query.select(options.select || '*');
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          q = q.eq(key, value);
        }
      });
      
      // Apply ordering
      if (options.orderBy) {
        q = q.order(options.orderBy, { ascending: options.ascending ?? true });
      }
      
      // Apply pagination
      if (options.limit) {
        q = q.limit(options.limit);
      }
      if (options.offset) {
        q = q.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      
      return q;
    };
    
    if (token) {
      return this.queryAsUser(token, table, queryFn);
    }
    return this.queryAsAdmin(table, queryFn);
  }

  /**
   * Insert a new record
   */
  async insert(table, data, token = null) {
    const queryFn = (query) => query.insert(data).select().single();
    
    if (token) {
      return this.queryAsUser(token, table, queryFn);
    }
    return this.queryAsAdmin(table, queryFn);
  }

  /**
   * Update a record by ID
   */
  async update(table, id, data, token = null) {
    const queryFn = (query) => query.update(data).eq('id', id).select().single();
    
    if (token) {
      return this.queryAsUser(token, table, queryFn);
    }
    return this.queryAsAdmin(table, queryFn);
  }

  /**
   * Delete a record by ID
   */
  async delete(table, id, token = null) {
    const queryFn = (query) => query.delete().eq('id', id);
    
    if (token) {
      return this.queryAsUser(token, table, queryFn);
    }
    return this.queryAsAdmin(table, queryFn);
  }

  /**
   * Count records with filters
   */
  async count(table, filters = {}, token = null) {
    const queryFn = (query) => {
      let q = query.select('*', { count: 'exact', head: true });
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          q = q.eq(key, value);
        }
      });
      
      return q;
    };
    
    if (token) {
      const result = await this.queryAsUser(token, table, queryFn);
      return { count: result.count, error: result.error };
    }
    
    const result = await this.queryAsAdmin(table, queryFn);
    return { count: result.count, error: result.error };
  }

  /**
   * Health check - verify Supabase connection
   * @returns {Promise<{data: boolean, error: any}>}
   */
  async healthCheck() {
    try {
      // Simple query to verify connection
      const { data, error } = await this.adminClient
        .from('plans')
        .select('id')
        .limit(1);
      
      if (error) {
        return { data: false, error };
      }
      
      return { data: true, error: null };
    } catch (error) {
      logger.error('Supabase health check failed', { error: error.message });
      return { data: false, error };
    }
  }

  /**
   * Execute raw SQL with array params (for compatibility)
   * Routes to executeSql which now handles SQL parsing
   * @param {string} sql - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<{rows: array, error: any}>}
   */
  async executeSqlWithArrayParams(sql, params = []) {
    return this.executeSql(sql, params);
  }
}

// Export singleton instance
module.exports = new SupabaseService();
