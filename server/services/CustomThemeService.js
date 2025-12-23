/**
 * CustomThemeService
 * 
 * Business logic for custom theme CRUD operations.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class CustomThemeService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Create a new custom theme
   * @param {Object} data - Theme data
   * @returns {Object} Created theme
   */
  async create(data) {
    const { name, description, connectionId, schema, previewImage } = data;

    try {
      const { data: result, error } = await SupabaseService.insert('custom_themes', {
        name,
        description: description || null,
        connection_id: connectionId || null,
        schema: schema,
        preview_image: previewImage || null
      });

      if (error) throw error;

      logger.info('Custom theme created', { themeId: result.id, name });

      return this._formatTheme(result);
    } catch (error) {
      logger.error('Failed to create custom theme', { error: error.message, name });
      throw error;
    }
  }

  /**
   * Get a custom theme by ID
   * @param {number} id - Theme ID
   * @returns {Object|null} Theme or null if not found
   */
  async getById(id) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_themes', (query) =>
        query.select('id, name, description, connection_id, schema, preview_image, created_at, updated_at')
          .eq('id', id)
          .single()
      );

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return this._formatTheme(data);
    } catch (error) {
      logger.error('Failed to get custom theme', { error: error.message, id });
      throw error;
    }
  }

  /**
   * List all custom themes
   * @param {Object} options - Query options
   * @returns {Array} List of themes
   */
  async list(options = {}) {
    const { connectionId, limit = 100, offset = 0 } = options;

    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_themes', (query) => {
        let q = query.select('id, name, description, connection_id, schema, preview_image, created_at, updated_at');
        
        if (connectionId) {
          q = q.eq('connection_id', connectionId);
        }
        
        return q.order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
      });

      if (error) throw error;

      return (data || []).map(row => this._formatTheme(row));
    } catch (error) {
      logger.error('Failed to list custom themes', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a custom theme
   * @param {number} id - Theme ID
   * @param {Object} data - Updated data
   * @returns {Object} Updated theme
   */
  async update(id, data) {
    const { name, description, connectionId, schema, previewImage } = data;

    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Theme not found');
      }

      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (name !== undefined && name !== null) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (connectionId !== undefined) updateData.connection_id = connectionId;
      if (schema !== undefined && schema !== null) updateData.schema = schema;
      if (previewImage !== undefined) updateData.preview_image = previewImage;

      const { data: result, error } = await SupabaseService.update('custom_themes', id, updateData);

      if (error) throw error;

      logger.info('Custom theme updated', { themeId: id, name: name || existing.name });

      return this._formatTheme(result);
    } catch (error) {
      logger.error('Failed to update custom theme', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Delete a custom theme
   * @param {number} id - Theme ID
   * @returns {boolean} Success
   */
  async delete(id) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Theme not found');
      }

      const { error } = await SupabaseService.delete('custom_themes', id);

      if (error) throw error;

      logger.info('Custom theme deleted', { themeId: id, name: existing.name });

      return true;
    } catch (error) {
      logger.error('Failed to delete custom theme', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get themes count
   * @param {Object} options - Query options
   * @returns {number} Count
   */
  async count(options = {}) {
    const { connectionId } = options;

    try {
      const filters = {};
      if (connectionId) {
        filters.connection_id = connectionId;
      }

      const { count, error } = await SupabaseService.count('custom_themes', filters);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      logger.error('Failed to count custom themes', { error: error.message });
      throw error;
    }
  }

  /**
   * Format theme row from database
   * @private
   */
  _formatTheme(row) {
    let schema;
    try {
      schema = typeof row.schema === 'string' ? JSON.parse(row.schema) : row.schema;
    } catch (e) {
      schema = { blocks: [] };
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      connection_id: row.connection_id,
      schema,
      preview_image: row.preview_image,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// Singleton instance
let instance = null;

function getCustomThemeService() {
  if (!instance) {
    instance = new CustomThemeService();
  }
  return instance;
}

module.exports = { CustomThemeService, getCustomThemeService };
