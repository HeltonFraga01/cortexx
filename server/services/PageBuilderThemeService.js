/**
 * PageBuilderThemeService
 * 
 * Business logic for Page Builder theme CRUD operations.
 * Manages account-specific page builder themes with Puck schema data.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class PageBuilderThemeService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Create a new page builder theme
   * @param {Object} data - Theme data
   * @returns {Object} Created theme
   */
  async create(data) {
    const { 
      accountId, 
      name, 
      description,
      connectionId,
      schema,
      previewImage,
      isActive
    } = data;

    try {
      const { data: result, error } = await SupabaseService.insert('page_builder_themes', {
        account_id: accountId,
        name,
        description: description || null,
        connection_id: connectionId || null,
        schema: schema || {},
        preview_image: previewImage || null,
        is_active: isActive !== false
      });

      if (error) throw error;

      logger.info('Page builder theme created', { themeId: result.id, name, accountId });

      return this._formatTheme(result);
    } catch (error) {
      logger.error('Failed to create page builder theme', { error: error.message, name, accountId });
      throw error;
    }
  }

  /**
   * Get a page builder theme by ID
   * @param {string} id - Theme ID
   * @param {string} accountId - Account ID for authorization
   * @returns {Object|null} Theme or null if not found
   */
  async getById(id, accountId = null) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('page_builder_themes', (query) => {
        let q = query.select('*').eq('id', id);
        if (accountId) {
          q = q.eq('account_id', accountId);
        }
        return q.single();
      });

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return this._formatTheme(data);
    } catch (error) {
      logger.error('Failed to get page builder theme', { error: error.message, id });
      throw error;
    }
  }


  /**
   * List page builder themes
   * @param {Object} options - Query options
   * @returns {Array} List of themes
   */
  async list(options = {}) {
    const { accountId, connectionId, isActive, limit = 100, offset = 0 } = options;

    try {
      const { data, error } = await SupabaseService.queryAsAdmin('page_builder_themes', (query) => {
        let q = query.select('*');
        
        if (accountId) {
          q = q.eq('account_id', accountId);
        }
        if (connectionId) {
          q = q.eq('connection_id', connectionId);
        }
        if (isActive !== undefined) {
          q = q.eq('is_active', isActive);
        }
        
        return q.order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
      });

      if (error) throw error;

      return (data || []).map(row => this._formatTheme(row));
    } catch (error) {
      logger.error('Failed to list page builder themes', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a page builder theme
   * @param {string} id - Theme ID
   * @param {Object} data - Updated data
   * @param {string} accountId - Account ID for authorization
   * @returns {Object} Updated theme
   */
  async update(id, data, accountId = null) {
    const { 
      name, 
      description,
      connectionId,
      schema,
      previewImage,
      isActive
    } = data;

    try {
      // Verify theme exists and belongs to account
      const existing = await this.getById(id, accountId);
      if (!existing) {
        throw new Error('Theme not found');
      }

      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (name !== undefined && name !== null) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (connectionId !== undefined) updateData.connection_id = connectionId;
      if (schema !== undefined) updateData.schema = schema;
      if (previewImage !== undefined) updateData.preview_image = previewImage;
      if (isActive !== undefined) updateData.is_active = isActive;

      const { data: result, error } = await SupabaseService.update('page_builder_themes', id, updateData);

      if (error) throw error;

      logger.info('Page builder theme updated', { themeId: id, name: name || existing.name });

      return this._formatTheme(result);
    } catch (error) {
      logger.error('Failed to update page builder theme', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Delete a page builder theme
   * @param {string} id - Theme ID
   * @param {string} accountId - Account ID for authorization
   * @returns {boolean} Success
   */
  async delete(id, accountId = null) {
    try {
      // Verify theme exists and belongs to account
      const existing = await this.getById(id, accountId);
      if (!existing) {
        throw new Error('Theme not found');
      }

      const { error } = await SupabaseService.delete('page_builder_themes', id);

      if (error) throw error;

      logger.info('Page builder theme deleted', { themeId: id, name: existing.name });

      return true;
    } catch (error) {
      logger.error('Failed to delete page builder theme', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Get themes count
   * @param {Object} options - Query options
   * @returns {number} Count
   */
  async count(options = {}) {
    const { accountId, connectionId, isActive } = options;

    try {
      const filters = {};
      if (accountId) filters.account_id = accountId;
      if (connectionId) filters.connection_id = connectionId;
      if (isActive !== undefined) filters.is_active = isActive;

      const { count, error } = await SupabaseService.count('page_builder_themes', filters);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      logger.error('Failed to count page builder themes', { error: error.message });
      throw error;
    }
  }

  /**
   * Format theme row from database
   * @private
   */
  _formatTheme(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      connectionId: row.connection_id,
      schema: row.schema,
      previewImage: row.preview_image,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Singleton instance
let instance = null;

function getPageBuilderThemeService() {
  if (!instance) {
    instance = new PageBuilderThemeService();
  }
  return instance;
}

module.exports = { PageBuilderThemeService, getPageBuilderThemeService };
