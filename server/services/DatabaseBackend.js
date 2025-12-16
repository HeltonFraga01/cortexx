/**
 * Database Backend Abstraction
 * Task 20.1: Create database backend abstraction interface
 * 
 * Provides a unified interface for database operations that can be
 * implemented by both SQLite and Supabase backends.
 * 
 * Usage:
 *   const db = require('./services/DatabaseBackend');
 *   const users = await db.getMany('accounts', { status: 'active' });
 */

const logger = require('../utils/logger');

/**
 * Database Backend Interface
 * Both SQLite and Supabase implementations must provide these methods
 */
class DatabaseBackendInterface {
  /**
   * Get a single record by ID
   * @param {string} table - Table name
   * @param {string|number} id - Record ID
   * @param {object} options - Query options
   * @returns {Promise<{data: object|null, error: Error|null}>}
   */
  async getById(table, id, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Get multiple records with filters
   * @param {string} table - Table name
   * @param {object} filters - Filter conditions
   * @param {object} options - Query options (select, orderBy, limit, offset)
   * @returns {Promise<{data: array, error: Error|null}>}
   */
  async getMany(table, filters = {}, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Insert a new record
   * @param {string} table - Table name
   * @param {object} data - Record data
   * @returns {Promise<{data: object|null, error: Error|null}>}
   */
  async insert(table, data) {
    throw new Error('Not implemented');
  }

  /**
   * Update a record by ID
   * @param {string} table - Table name
   * @param {string|number} id - Record ID
   * @param {object} data - Updated data
   * @returns {Promise<{data: object|null, error: Error|null}>}
   */
  async update(table, id, data) {
    throw new Error('Not implemented');
  }

  /**
   * Delete a record by ID
   * @param {string} table - Table name
   * @param {string|number} id - Record ID
   * @returns {Promise<{data: null, error: Error|null}>}
   */
  async delete(table, id) {
    throw new Error('Not implemented');
  }

  /**
   * Count records with filters
   * @param {string} table - Table name
   * @param {object} filters - Filter conditions
   * @returns {Promise<{count: number, error: Error|null}>}
   */
  async count(table, filters = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Execute a raw query (use sparingly)
   * @param {string} sql - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<{data: array, error: Error|null}>}
   */
  async query(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Get backend name
   * @returns {string}
   */
  getBackendName() {
    throw new Error('Not implemented');
  }
}

/**
 * SQLite Backend Implementation
 */
class SQLiteBackend extends DatabaseBackendInterface {
  constructor(db) {
    super();
    this.db = db;
  }

  getBackendName() {
    return 'sqlite';
  }

  async getById(table, id, options = {}) {
    try {
      const sql = `SELECT * FROM ${table} WHERE id = ?`;
      const result = await this.db.query(sql, [id]);
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getMany(table, filters = {}, options = {}) {
    try {
      let sql = `SELECT ${options.select || '*'} FROM ${table}`;
      const params = [];
      
      // Build WHERE clause
      const conditions = Object.entries(filters)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        });
      
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add ORDER BY
      if (options.orderBy) {
        const direction = options.ascending === false ? 'DESC' : 'ASC';
        sql += ` ORDER BY ${options.orderBy} ${direction}`;
      }
      
      // Add LIMIT and OFFSET
      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
      
      const result = await this.db.query(sql, params);
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async insert(table, data) {
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);
      
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      const result = await this.db.query(sql, values);
      
      // Get the inserted record
      if (result.lastID) {
        const inserted = await this.getById(table, result.lastID);
        return inserted;
      }
      
      return { data: { ...data, id: result.lastID }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async update(table, id, data) {
    try {
      const sets = Object.keys(data).map(key => `${key} = ?`);
      const values = [...Object.values(data), id];
      
      const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`;
      await this.db.query(sql, values);
      
      return this.getById(table, id);
    } catch (error) {
      return { data: null, error };
    }
  }

  async delete(table, id) {
    try {
      const sql = `DELETE FROM ${table} WHERE id = ?`;
      await this.db.query(sql, [id]);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async count(table, filters = {}) {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${table}`;
      const params = [];
      
      const conditions = Object.entries(filters)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        });
      
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const result = await this.db.query(sql, params);
      return { count: result.rows[0]?.count || 0, error: null };
    } catch (error) {
      return { count: 0, error };
    }
  }

  async query(sql, params = []) {
    try {
      const result = await this.db.query(sql, params);
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }
}

/**
 * Supabase Backend Implementation
 */
class SupabaseBackend extends DatabaseBackendInterface {
  constructor(supabaseService) {
    super();
    this.supabase = supabaseService;
  }

  getBackendName() {
    return 'supabase';
  }

  async getById(table, id, options = {}) {
    return this.supabase.getById(table, id, options.token);
  }

  async getMany(table, filters = {}, options = {}) {
    return this.supabase.getMany(table, filters, options, options.token);
  }

  async insert(table, data) {
    return this.supabase.insert(table, data);
  }

  async update(table, id, data) {
    return this.supabase.update(table, id, data);
  }

  async delete(table, id) {
    return this.supabase.delete(table, id);
  }

  async count(table, filters = {}) {
    return this.supabase.count(table, filters);
  }

  async query(sql, params = []) {
    return this.supabase.executeSql(sql, params);
  }
}

/**
 * Dual-Write Backend
 * Task 20.2: Implement dual-write mode
 * 
 * Writes to both SQLite and Supabase during migration period.
 * Reads from primary backend (configurable).
 */
class DualWriteBackend extends DatabaseBackendInterface {
  constructor(primary, secondary) {
    super();
    this.primary = primary;
    this.secondary = secondary;
    this.discrepancies = [];
  }

  getBackendName() {
    return `dual-write (primary: ${this.primary.getBackendName()})`;
  }

  async getById(table, id, options = {}) {
    // Read from primary
    return this.primary.getById(table, id, options);
  }

  async getMany(table, filters = {}, options = {}) {
    // Read from primary
    return this.primary.getMany(table, filters, options);
  }

  async insert(table, data) {
    // Write to both
    const primaryResult = await this.primary.insert(table, data);
    
    try {
      const secondaryResult = await this.secondary.insert(table, data);
      
      // Log discrepancy if secondary fails
      if (secondaryResult.error) {
        this._logDiscrepancy('insert', table, data, secondaryResult.error);
      }
    } catch (error) {
      this._logDiscrepancy('insert', table, data, error);
    }
    
    return primaryResult;
  }

  async update(table, id, data) {
    // Write to both
    const primaryResult = await this.primary.update(table, id, data);
    
    try {
      const secondaryResult = await this.secondary.update(table, id, data);
      
      if (secondaryResult.error) {
        this._logDiscrepancy('update', table, { id, ...data }, secondaryResult.error);
      }
    } catch (error) {
      this._logDiscrepancy('update', table, { id, ...data }, error);
    }
    
    return primaryResult;
  }

  async delete(table, id) {
    // Delete from both
    const primaryResult = await this.primary.delete(table, id);
    
    try {
      const secondaryResult = await this.secondary.delete(table, id);
      
      if (secondaryResult.error) {
        this._logDiscrepancy('delete', table, { id }, secondaryResult.error);
      }
    } catch (error) {
      this._logDiscrepancy('delete', table, { id }, error);
    }
    
    return primaryResult;
  }

  async count(table, filters = {}) {
    return this.primary.count(table, filters);
  }

  async query(sql, params = []) {
    return this.primary.query(sql, params);
  }

  _logDiscrepancy(operation, table, data, error) {
    const discrepancy = {
      timestamp: new Date().toISOString(),
      operation,
      table,
      data,
      error: error.message
    };
    
    this.discrepancies.push(discrepancy);
    
    logger.warn('Dual-write discrepancy', discrepancy);
  }

  getDiscrepancies() {
    return this.discrepancies;
  }

  clearDiscrepancies() {
    this.discrepancies = [];
  }
}

/**
 * Database Backend Factory
 * Task 20.3: Create feature flag for backend switching
 * 
 * Creates the appropriate backend based on USE_SUPABASE environment variable.
 */
class DatabaseBackendFactory {
  static _instance = null;
  static _backend = null;

  /**
   * Get the database backend instance
   * @returns {DatabaseBackendInterface}
   */
  static getInstance() {
    if (this._backend) {
      return this._backend;
    }

    const useSupabase = process.env.USE_SUPABASE === 'true';
    const dualWrite = process.env.DUAL_WRITE_MODE === 'true';

    if (dualWrite) {
      // Dual-write mode: write to both, read from primary
      const sqliteDb = require('../database');
      const supabaseService = require('./SupabaseService');
      
      const sqliteBackend = new SQLiteBackend(sqliteDb);
      const supabaseBackend = new SupabaseBackend(supabaseService);
      
      // Primary is determined by USE_SUPABASE
      const primary = useSupabase ? supabaseBackend : sqliteBackend;
      const secondary = useSupabase ? sqliteBackend : supabaseBackend;
      
      this._backend = new DualWriteBackend(primary, secondary);
      logger.info(`Database backend: dual-write mode (primary: ${primary.getBackendName()})`);
    } else if (useSupabase) {
      // Supabase only
      const supabaseService = require('./SupabaseService');
      this._backend = new SupabaseBackend(supabaseService);
      logger.info('Database backend: Supabase');
    } else {
      // SQLite only (default)
      const sqliteDb = require('../database');
      this._backend = new SQLiteBackend(sqliteDb);
      logger.info('Database backend: SQLite');
    }

    return this._backend;
  }

  /**
   * Reset the backend instance (for testing)
   */
  static reset() {
    this._backend = null;
  }

  /**
   * Check if using Supabase
   * @returns {boolean}
   */
  static isUsingSupabase() {
    return process.env.USE_SUPABASE === 'true';
  }

  /**
   * Check if in dual-write mode
   * @returns {boolean}
   */
  static isDualWriteMode() {
    return process.env.DUAL_WRITE_MODE === 'true';
  }
}

// Export factory method for easy access
module.exports = {
  DatabaseBackendInterface,
  SQLiteBackend,
  SupabaseBackend,
  DualWriteBackend,
  DatabaseBackendFactory,
  
  // Convenience method
  getBackend: () => DatabaseBackendFactory.getInstance()
};
