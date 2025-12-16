/**
 * CustomThemeService
 * 
 * Business logic for custom theme CRUD operations.
 */

const { logger } = require('../utils/logger');

class CustomThemeService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new custom theme
   * @param {Object} data - Theme data
   * @returns {Object} Created theme
   */
  async create(data) {
    const { name, description, connectionId, schema, previewImage } = data;

    try {
      const result = await this.db.query(`
        INSERT INTO custom_themes (name, description, connection_id, schema, preview_image)
        VALUES (?, ?, ?, ?, ?)
      `, [
        name,
        description || null,
        connectionId || null,
        JSON.stringify(schema),
        previewImage || null
      ]);

      logger.info('Custom theme created', { themeId: result.lastID, name });

      return this.getById(result.lastID);
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
      const result = await this.db.query(`
        SELECT 
          id,
          name,
          description,
          connection_id,
          schema,
          preview_image,
          created_at,
          updated_at
        FROM custom_themes
        WHERE id = ?
      `, [id]);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return this._formatTheme(result.rows[0]);
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
      let query = `
        SELECT 
          id,
          name,
          description,
          connection_id,
          schema,
          preview_image,
          created_at,
          updated_at
        FROM custom_themes
      `;

      const params = [];

      if (connectionId) {
        query += ' WHERE connection_id = ?';
        params.push(connectionId);
      }

      query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return (result.rows || []).map(row => this._formatTheme(row));
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

      await this.db.query(`
        UPDATE custom_themes
        SET 
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          connection_id = ?,
          schema = COALESCE(?, schema),
          preview_image = COALESCE(?, preview_image),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name || null,
        description !== undefined ? description : null,
        connectionId !== undefined ? connectionId : existing.connection_id,
        schema ? JSON.stringify(schema) : null,
        previewImage !== undefined ? previewImage : null,
        id
      ]);

      logger.info('Custom theme updated', { themeId: id, name: name || existing.name });

      return this.getById(id);
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

      await this.db.query('DELETE FROM custom_themes WHERE id = ?', [id]);

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
      let query = 'SELECT COUNT(*) as count FROM custom_themes';
      const params = [];

      if (connectionId) {
        query += ' WHERE connection_id = ?';
        params.push(connectionId);
      }

      const result = await this.db.query(query, params);

      return result.rows[0]?.count || 0;
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

function getCustomThemeService(db) {
  if (!instance && db) {
    instance = new CustomThemeService(db);
  }
  return instance;
}

module.exports = { CustomThemeService, getCustomThemeService };
