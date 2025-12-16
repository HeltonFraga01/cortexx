/**
 * Supabase Service
 * Task 11.1: Create server/services/SupabaseService.js
 * 
 * Replaces server/database.js as the database abstraction layer
 * Provides RLS-aware queries and admin operations
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    
    // Service role client (bypasses RLS) - for admin operations
    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Store config for creating user clients
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    
    logger.info('SupabaseService initialized');
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
   * @returns {Promise<{data: any, error: any}>}
   */
  async queryAsUser(token, table, queryBuilder) {
    try {
      const client = this.createUserClient(token);
      const query = queryBuilder(client.from(table));
      const result = await query;
      
      if (result.error) {
        throw this.translateError(result.error);
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      logger.error('queryAsUser failed', {
        table,
        error: error.message
      });
      return { data: null, error: this.translateError(error) };
    }
  }

  /**
   * Query as admin (bypasses RLS)
   * Use for system operations like audit logging
   * @param {string} table - Table name
   * @param {Function} queryBuilder - Function that builds the query
   * @returns {Promise<{data: any, error: any}>}
   */
  async queryAsAdmin(table, queryBuilder) {
    try {
      const query = queryBuilder(this.adminClient.from(table));
      const result = await query;
      
      if (result.error) {
        throw this.translateError(result.error);
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      logger.error('queryAsAdmin failed', {
        table,
        error: error.message
      });
      return { data: null, error: this.translateError(error) };
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
   * @param {string} sql - SQL query
   * @param {object} params - Query parameters
   * @returns {Promise<{data: any, error: any}>}
   */
  async executeSql(sql, params = {}) {
    try {
      const { data, error } = await this.adminClient.rpc('exec_sql', {
        query: sql,
        params: JSON.stringify(params)
      });
      
      if (error) {
        throw this.translateError(error);
      }
      
      return { data, error: null };
    } catch (error) {
      logger.error('executeSql failed', {
        error: error.message
      });
      return { data: null, error: this.translateError(error) };
    }
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
}

// Export singleton instance
module.exports = new SupabaseService();
