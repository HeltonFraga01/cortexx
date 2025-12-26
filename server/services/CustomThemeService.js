/**
 * CustomThemeService
 * 
 * Business logic for custom UI theme CRUD operations.
 * Manages account-specific UI themes (colors, CSS, branding).
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
    const { 
      accountId, 
      name, 
      primaryColor, 
      secondaryColor, 
      backgroundColor, 
      textColor, 
      accentColor, 
      logoUrl, 
      customCss, 
      isActive 
    } = data;

    try {
      const { data: result, error } = await SupabaseService.insert('custom_themes', {
        account_id: accountId,
        name,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,
        background_color: backgroundColor || null,
        text_color: textColor || null,
        accent_color: accentColor || null,
        logo_url: logoUrl || null,
        custom_css: customCss || null,
        is_active: isActive || false
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
   * @param {string} id - Theme ID
   * @returns {Object|null} Theme or null if not found
   */
  async getById(id) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_themes', (query) =>
        query.select('id, account_id, name, primary_color, secondary_color, background_color, text_color, accent_color, logo_url, custom_css, is_active, created_at, updated_at')
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
    const { accountId, limit = 100, offset = 0 } = options;

    try {
      const { data, error } = await SupabaseService.queryAsAdmin('custom_themes', (query) => {
        let q = query.select('id, account_id, name, primary_color, secondary_color, background_color, text_color, accent_color, logo_url, custom_css, is_active, created_at, updated_at');
        
        if (accountId) {
          q = q.eq('account_id', accountId);
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
   * @param {string} id - Theme ID
   * @param {Object} data - Updated data
   * @returns {Object} Updated theme
   */
  async update(id, data) {
    const { 
      name, 
      primaryColor, 
      secondaryColor, 
      backgroundColor, 
      textColor, 
      accentColor, 
      logoUrl, 
      customCss, 
      isActive 
    } = data;

    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Theme not found');
      }

      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (name !== undefined && name !== null) updateData.name = name;
      if (primaryColor !== undefined) updateData.primary_color = primaryColor;
      if (secondaryColor !== undefined) updateData.secondary_color = secondaryColor;
      if (backgroundColor !== undefined) updateData.background_color = backgroundColor;
      if (textColor !== undefined) updateData.text_color = textColor;
      if (accentColor !== undefined) updateData.accent_color = accentColor;
      if (logoUrl !== undefined) updateData.logo_url = logoUrl;
      if (customCss !== undefined) updateData.custom_css = customCss;
      if (isActive !== undefined) updateData.is_active = isActive;

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
   * @param {string} id - Theme ID
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
    const { accountId } = options;

    try {
      const filters = {};
      if (accountId) {
        filters.account_id = accountId;
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
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      backgroundColor: row.background_color,
      textColor: row.text_color,
      accentColor: row.accent_color,
      logoUrl: row.logo_url,
      customCss: row.custom_css,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
