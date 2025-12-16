/**
 * AutomationService - Service for managing admin automation settings
 * 
 * Handles global settings, bot templates, default labels, canned responses,
 * and automation application to new users.
 * 
 * Requirements: 1.1-1.5, 2.1-2.5, 4.1-4.5, 5.1-5.5, 6.1-6.5, 8.3-8.5, 13.1-13.5
 */

const { logger } = require('../utils/logger');

class AutomationService {
  constructor(db) {
    this.db = db;
  }

  // ==================== Global Settings ====================

  /**
   * Get all global settings as a structured object
   * @returns {Promise<Object>} Global settings
   * 
   * Requirements: 4.5
   */
  async getGlobalSettings() {
    try {
      const { rows } = await this.db.query('SELECT key, value FROM global_settings');
      
      const settings = {
        automationsEnabled: {
          bot: false,
          labels: false,
          cannedResponses: false,
          webhooks: false
        },
        defaultBotTemplateId: null,
        defaultWebhookUrl: null,
        defaultWebhookEvents: [],
        auditLogRetentionDays: 90
      };

      for (const row of rows) {
        switch (row.key) {
          case 'automation.bot.enabled':
            settings.automationsEnabled.bot = row.value === 'true';
            break;
          case 'automation.bot.defaultTemplateId':
            settings.defaultBotTemplateId = row.value === 'null' ? null : parseInt(row.value, 10);
            break;
          case 'automation.labels.enabled':
            settings.automationsEnabled.labels = row.value === 'true';
            break;
          case 'automation.cannedResponses.enabled':
            settings.automationsEnabled.cannedResponses = row.value === 'true';
            break;
          case 'automation.webhooks.enabled':
            settings.automationsEnabled.webhooks = row.value === 'true';
            break;
          case 'automation.webhooks.defaultUrl':
            settings.defaultWebhookUrl = row.value === 'null' ? null : row.value;
            break;
          case 'automation.webhooks.defaultEvents':
            try {
              settings.defaultWebhookEvents = JSON.parse(row.value);
            } catch {
              settings.defaultWebhookEvents = [];
            }
            break;
          case 'automation.auditLog.retentionDays':
            settings.auditLogRetentionDays = parseInt(row.value, 10) || 90;
            break;
        }
      }

      return settings;
    } catch (error) {
      logger.error('Failed to get global settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Update global settings
   * @param {Object} updates - Settings to update
   * @returns {Promise<Object>} Updated settings
   * 
   * Requirements: 4.2
   */
  async updateGlobalSettings(updates) {
    try {
      const settingsMap = [];

      if (updates.automationsEnabled) {
        if (typeof updates.automationsEnabled.bot === 'boolean') {
          settingsMap.push({ key: 'automation.bot.enabled', value: String(updates.automationsEnabled.bot) });
        }
        if (typeof updates.automationsEnabled.labels === 'boolean') {
          settingsMap.push({ key: 'automation.labels.enabled', value: String(updates.automationsEnabled.labels) });
        }
        if (typeof updates.automationsEnabled.cannedResponses === 'boolean') {
          settingsMap.push({ key: 'automation.cannedResponses.enabled', value: String(updates.automationsEnabled.cannedResponses) });
        }
        if (typeof updates.automationsEnabled.webhooks === 'boolean') {
          settingsMap.push({ key: 'automation.webhooks.enabled', value: String(updates.automationsEnabled.webhooks) });
        }
      }

      if (updates.defaultBotTemplateId !== undefined) {
        settingsMap.push({ 
          key: 'automation.bot.defaultTemplateId', 
          value: updates.defaultBotTemplateId === null ? 'null' : String(updates.defaultBotTemplateId) 
        });
      }

      if (updates.defaultWebhookUrl !== undefined) {
        settingsMap.push({ 
          key: 'automation.webhooks.defaultUrl', 
          value: updates.defaultWebhookUrl === null ? 'null' : updates.defaultWebhookUrl 
        });
      }

      if (updates.defaultWebhookEvents !== undefined) {
        settingsMap.push({ 
          key: 'automation.webhooks.defaultEvents', 
          value: JSON.stringify(updates.defaultWebhookEvents) 
        });
      }

      if (updates.auditLogRetentionDays !== undefined) {
        settingsMap.push({ 
          key: 'automation.auditLog.retentionDays', 
          value: String(updates.auditLogRetentionDays) 
        });
      }

      for (const setting of settingsMap) {
        await this.db.query(
          `INSERT INTO global_settings (key, value, updated_at) 
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
          [setting.key, setting.value, setting.value]
        );
      }

      logger.info('Global settings updated', { updatedKeys: settingsMap.map(s => s.key) });

      return this.getGlobalSettings();
    } catch (error) {
      logger.error('Failed to update global settings', { error: error.message });
      throw error;
    }
  }

  // ==================== Bot Templates ====================

  /**
   * Get all bot templates
   * @returns {Promise<Array>} Bot templates
   * 
   * Requirements: 2.1
   */
  async getBotTemplates() {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM bot_templates ORDER BY is_default DESC, created_at DESC'
      );
      return rows.map(this.transformBotTemplate);
    } catch (error) {
      logger.error('Failed to get bot templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get bot template by ID
   * @param {number} id - Template ID
   * @returns {Promise<Object|null>} Bot template or null
   */
  async getBotTemplateById(id) {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM bot_templates WHERE id = ?',
        [id]
      );
      return rows[0] ? this.transformBotTemplate(rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get bot template', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new bot template
   * @param {Object} data - Template data
   * @returns {Promise<Object>} Created template
   * 
   * Requirements: 2.2
   */
  async createBotTemplate(data) {
    const { 
      name, 
      description, 
      outgoingUrl, 
      includeHistory = false, 
      chatwootUserId = null, 
      chatwootInboxId = null,
      inboxAssignments = []
    } = data;

    if (!name || !name.trim()) {
      throw new Error('Bot template name is required');
    }

    if (!outgoingUrl || !outgoingUrl.trim()) {
      throw new Error('Outgoing URL is required');
    }

    // Validate URL format
    try {
      new URL(outgoingUrl);
    } catch {
      throw new Error('Invalid outgoing URL format');
    }

    // Serialize inbox assignments to JSON
    const inboxAssignmentsJson = JSON.stringify(inboxAssignments || []);

    try {
      const { lastID } = await this.db.query(
        `INSERT INTO bot_templates (name, description, outgoing_url, include_history, is_default, chatwoot_user_id, chatwoot_inbox_id, inbox_assignments)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [name.trim(), description || null, outgoingUrl.trim(), includeHistory ? 1 : 0, chatwootUserId, chatwootInboxId, inboxAssignmentsJson]
      );

      logger.info('Bot template created', { id: lastID, name, inboxCount: inboxAssignments.length });

      return this.getBotTemplateById(lastID);
    } catch (error) {
      logger.error('Failed to create bot template', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a bot template
   * @param {number} id - Template ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated template
   * 
   * Requirements: 2.3
   */
  async updateBotTemplate(id, data) {
    const template = await this.getBotTemplateById(id);
    if (!template) {
      throw new Error('Bot template not found');
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new Error('Bot template name is required');
      }
      updates.push('name = ?');
      params.push(data.name.trim());
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.outgoingUrl !== undefined) {
      if (!data.outgoingUrl || !data.outgoingUrl.trim()) {
        throw new Error('Outgoing URL is required');
      }
      try {
        new URL(data.outgoingUrl);
      } catch {
        throw new Error('Invalid outgoing URL format');
      }
      updates.push('outgoing_url = ?');
      params.push(data.outgoingUrl.trim());
    }

    if (data.includeHistory !== undefined) {
      updates.push('include_history = ?');
      params.push(data.includeHistory ? 1 : 0);
    }

    if (data.chatwootUserId !== undefined) {
      updates.push('chatwoot_user_id = ?');
      params.push(data.chatwootUserId || null);
    }

    if (data.chatwootInboxId !== undefined) {
      updates.push('chatwoot_inbox_id = ?');
      params.push(data.chatwootInboxId || null);
    }

    if (data.inboxAssignments !== undefined) {
      updates.push('inbox_assignments = ?');
      params.push(JSON.stringify(data.inboxAssignments || []));
    }

    if (updates.length === 0) {
      return template;
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    try {
      await this.db.query(
        `UPDATE bot_templates SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      logger.info('Bot template updated', { id });

      return this.getBotTemplateById(id);
    } catch (error) {
      logger.error('Failed to update bot template', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a bot template
   * @param {number} id - Template ID
   * 
   * Requirements: 2.4
   */
  async deleteBotTemplate(id) {
    const template = await this.getBotTemplateById(id);
    if (!template) {
      throw new Error('Bot template not found');
    }

    if (template.isDefault) {
      throw new Error('Cannot delete the default bot template');
    }

    try {
      await this.db.query('DELETE FROM bot_templates WHERE id = ?', [id]);
      logger.info('Bot template deleted', { id });
    } catch (error) {
      logger.error('Failed to delete bot template', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Set a bot template as default
   * @param {number} id - Template ID
   * @returns {Promise<Object>} Updated template
   * 
   * Requirements: 2.5
   */
  async setDefaultBotTemplate(id) {
    const template = await this.getBotTemplateById(id);
    if (!template) {
      throw new Error('Bot template not found');
    }

    try {
      // Remove default from all templates
      await this.db.query("UPDATE bot_templates SET is_default = 0, updated_at = datetime('now')");
      
      // Set this template as default
      await this.db.query(
        "UPDATE bot_templates SET is_default = 1, updated_at = datetime('now') WHERE id = ?",
        [id]
      );

      // Update global settings
      await this.updateGlobalSettings({ defaultBotTemplateId: id });

      logger.info('Bot template set as default', { id });

      return this.getBotTemplateById(id);
    } catch (error) {
      logger.error('Failed to set default bot template', { id, error: error.message });
      throw error;
    }
  }

  transformBotTemplate(row) {
    if (!row) return null;
    
    // Parse inbox_assignments JSON
    let inboxAssignments = [];
    if (row.inbox_assignments) {
      try {
        inboxAssignments = JSON.parse(row.inbox_assignments);
      } catch {
        inboxAssignments = [];
      }
    }
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      outgoingUrl: row.outgoing_url,
      includeHistory: Boolean(row.include_history),
      isDefault: Boolean(row.is_default),
      chatwootUserId: row.chatwoot_user_id || null,
      chatwootInboxId: row.chatwoot_inbox_id || null,
      inboxAssignments,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get bot templates assigned to specific inboxes
   * @param {number[]} inboxIds - Array of inbox IDs
   * @returns {Promise<Array>} Bot templates with inbox info for user's inboxes only
   * 
   * Requirements: 9.1, 9.2
   */
  async getBotTemplatesForInboxes(inboxIds) {
    if (!inboxIds || inboxIds.length === 0) {
      return [];
    }

    try {
      const { rows } = await this.db.query(`
        SELECT * FROM bot_templates 
        WHERE inbox_assignments IS NOT NULL 
          AND inbox_assignments != '[]'
        ORDER BY is_default DESC, created_at DESC
      `);

      // Filter templates that have assignments matching user's inboxes
      const matchingTemplates = rows.filter(template => {
        const assignments = JSON.parse(template.inbox_assignments || '[]');
        return assignments.some(a => inboxIds.includes(a.inboxId));
      });

      // Transform and filter inbox assignments to only include user's inboxes
      return matchingTemplates.map(template => {
        const allAssignments = JSON.parse(template.inbox_assignments || '[]');
        const userAssignments = allAssignments.filter(a => inboxIds.includes(a.inboxId));
        
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          outgoingUrl: template.outgoing_url,
          includeHistory: Boolean(template.include_history),
          isDefault: Boolean(template.is_default),
          inboxAssignments: userAssignments
        };
      });
    } catch (error) {
      logger.error('Failed to get bot templates for inboxes', { 
        inboxIds, 
        error: error.message 
      });
      throw error;
    }
  }


  // ==================== Default Labels ====================

  /**
   * Get all default labels
   * @returns {Promise<Array>} Default labels
   * 
   * Requirements: 5.1
   */
  async getDefaultLabels() {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM default_labels ORDER BY sort_order ASC, created_at ASC'
      );
      return rows.map(this.transformDefaultLabel);
    } catch (error) {
      logger.error('Failed to get default labels', { error: error.message });
      throw error;
    }
  }

  /**
   * Get default label by ID
   * @param {number} id - Label ID
   * @returns {Promise<Object|null>} Default label or null
   */
  async getDefaultLabelById(id) {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM default_labels WHERE id = ?',
        [id]
      );
      return rows[0] ? this.transformDefaultLabel(rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get default label', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new default label
   * @param {Object} data - Label data
   * @returns {Promise<Object>} Created label
   * 
   * Requirements: 5.2
   */
  async createDefaultLabel(data) {
    const { name, color } = data;

    if (!name || !name.trim()) {
      throw new Error('Label name is required');
    }

    if (!color || !color.trim()) {
      throw new Error('Label color is required');
    }

    try {
      // Get next sort order
      const { rows: sortRows } = await this.db.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM default_labels'
      );
      const sortOrder = sortRows[0]?.next_order || 1;

      const { lastID } = await this.db.query(
        `INSERT INTO default_labels (name, color, sort_order)
         VALUES (?, ?, ?)`,
        [name.trim(), color.trim(), sortOrder]
      );

      logger.info('Default label created', { id: lastID, name });

      return this.getDefaultLabelById(lastID);
    } catch (error) {
      logger.error('Failed to create default label', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a default label
   * @param {number} id - Label ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated label
   * 
   * Requirements: 5.4
   */
  async updateDefaultLabel(id, data) {
    const label = await this.getDefaultLabelById(id);
    if (!label) {
      throw new Error('Default label not found');
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new Error('Label name is required');
      }
      updates.push('name = ?');
      params.push(data.name.trim());
    }

    if (data.color !== undefined) {
      if (!data.color || !data.color.trim()) {
        throw new Error('Label color is required');
      }
      updates.push('color = ?');
      params.push(data.color.trim());
    }

    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    if (updates.length === 0) {
      return label;
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    try {
      await this.db.query(
        `UPDATE default_labels SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      logger.info('Default label updated', { id });

      return this.getDefaultLabelById(id);
    } catch (error) {
      logger.error('Failed to update default label', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a default label
   * @param {number} id - Label ID
   */
  async deleteDefaultLabel(id) {
    const label = await this.getDefaultLabelById(id);
    if (!label) {
      throw new Error('Default label not found');
    }

    try {
      await this.db.query('DELETE FROM default_labels WHERE id = ?', [id]);
      logger.info('Default label deleted', { id });
    } catch (error) {
      logger.error('Failed to delete default label', { id, error: error.message });
      throw error;
    }
  }

  transformDefaultLabel(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ==================== Default Canned Responses ====================

  /**
   * Get all default canned responses
   * @returns {Promise<Array>} Default canned responses
   * 
   * Requirements: 6.1
   */
  async getDefaultCannedResponses() {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM default_canned_responses ORDER BY sort_order ASC, created_at ASC'
      );
      return rows.map(this.transformDefaultCannedResponse);
    } catch (error) {
      logger.error('Failed to get default canned responses', { error: error.message });
      throw error;
    }
  }

  /**
   * Get default canned response by ID
   * @param {number} id - Response ID
   * @returns {Promise<Object|null>} Default canned response or null
   */
  async getDefaultCannedResponseById(id) {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM default_canned_responses WHERE id = ?',
        [id]
      );
      return rows[0] ? this.transformDefaultCannedResponse(rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get default canned response', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new default canned response
   * @param {Object} data - Response data
   * @returns {Promise<Object>} Created response
   * 
   * Requirements: 6.2
   */
  async createDefaultCannedResponse(data) {
    const { shortcut, content } = data;

    if (!shortcut || !shortcut.trim()) {
      throw new Error('Shortcut is required');
    }

    if (!content || !content.trim()) {
      throw new Error('Content is required');
    }

    try {
      // Get next sort order
      const { rows: sortRows } = await this.db.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM default_canned_responses'
      );
      const sortOrder = sortRows[0]?.next_order || 1;

      const { lastID } = await this.db.query(
        `INSERT INTO default_canned_responses (shortcut, content, sort_order)
         VALUES (?, ?, ?)`,
        [shortcut.trim(), content.trim(), sortOrder]
      );

      logger.info('Default canned response created', { id: lastID, shortcut });

      return this.getDefaultCannedResponseById(lastID);
    } catch (error) {
      logger.error('Failed to create default canned response', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a default canned response
   * @param {number} id - Response ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated response
   * 
   * Requirements: 6.4
   */
  async updateDefaultCannedResponse(id, data) {
    const response = await this.getDefaultCannedResponseById(id);
    if (!response) {
      throw new Error('Default canned response not found');
    }

    const updates = [];
    const params = [];

    if (data.shortcut !== undefined) {
      if (!data.shortcut || !data.shortcut.trim()) {
        throw new Error('Shortcut is required');
      }
      updates.push('shortcut = ?');
      params.push(data.shortcut.trim());
    }

    if (data.content !== undefined) {
      if (!data.content || !data.content.trim()) {
        throw new Error('Content is required');
      }
      updates.push('content = ?');
      params.push(data.content.trim());
    }

    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    if (updates.length === 0) {
      return response;
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    try {
      await this.db.query(
        `UPDATE default_canned_responses SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      logger.info('Default canned response updated', { id });

      return this.getDefaultCannedResponseById(id);
    } catch (error) {
      logger.error('Failed to update default canned response', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a default canned response
   * @param {number} id - Response ID
   */
  async deleteDefaultCannedResponse(id) {
    const response = await this.getDefaultCannedResponseById(id);
    if (!response) {
      throw new Error('Default canned response not found');
    }

    try {
      await this.db.query('DELETE FROM default_canned_responses WHERE id = ?', [id]);
      logger.info('Default canned response deleted', { id });
    } catch (error) {
      logger.error('Failed to delete default canned response', { id, error: error.message });
      throw error;
    }
  }

  transformDefaultCannedResponse(row) {
    if (!row) return null;
    return {
      id: row.id,
      shortcut: row.shortcut,
      content: row.content,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }


  // ==================== Automation Application ====================

  /**
   * Apply automations to a new user
   * @param {string} userId - User ID (token)
   * @param {Object} auditLogService - AuditLogService instance for logging
   * @returns {Promise<Object>} Result of automation application
   * 
   * Requirements: 1.3, 5.3, 6.3
   */
  async applyAutomationsToNewUser(userId, auditLogService) {
    const results = {
      bot: { applied: false, error: null },
      labels: { applied: false, count: 0, error: null },
      cannedResponses: { applied: false, count: 0, error: null },
      webhooks: { applied: false, error: null }
    };

    try {
      const settings = await this.getGlobalSettings();

      // Apply default bot if enabled
      if (settings.automationsEnabled.bot && settings.defaultBotTemplateId) {
        try {
          const template = await this.getBotTemplateById(settings.defaultBotTemplateId);
          if (template) {
            await this.createBotForUser(userId, template);
            results.bot.applied = true;
            
            if (auditLogService) {
              await auditLogService.logAutomation({
                userId,
                automationType: 'bot',
                details: JSON.stringify({ templateId: template.id, templateName: template.name }),
                status: 'success'
              });
            }
          }
        } catch (error) {
          results.bot.error = error.message;
          logger.error('Failed to apply default bot', { userId, error: error.message });
          
          if (auditLogService) {
            await auditLogService.logAutomation({
              userId,
              automationType: 'bot',
              details: JSON.stringify({ templateId: settings.defaultBotTemplateId }),
              status: 'failed',
              errorMessage: error.message
            });
          }
        }
      }

      // Apply default labels if enabled
      if (settings.automationsEnabled.labels) {
        try {
          const defaultLabels = await this.getDefaultLabels();
          if (defaultLabels.length > 0) {
            for (const label of defaultLabels) {
              await this.createLabelForUser(userId, label);
              results.labels.count++;
            }
            results.labels.applied = true;
            
            if (auditLogService) {
              await auditLogService.logAutomation({
                userId,
                automationType: 'labels',
                details: JSON.stringify({ count: results.labels.count }),
                status: 'success'
              });
            }
          }
        } catch (error) {
          results.labels.error = error.message;
          logger.error('Failed to apply default labels', { userId, error: error.message });
          
          if (auditLogService) {
            await auditLogService.logAutomation({
              userId,
              automationType: 'labels',
              status: 'failed',
              errorMessage: error.message
            });
          }
        }
      }

      // Apply default canned responses if enabled
      if (settings.automationsEnabled.cannedResponses) {
        try {
          const defaultResponses = await this.getDefaultCannedResponses();
          if (defaultResponses.length > 0) {
            for (const response of defaultResponses) {
              await this.createCannedResponseForUser(userId, response);
              results.cannedResponses.count++;
            }
            results.cannedResponses.applied = true;
            
            if (auditLogService) {
              await auditLogService.logAutomation({
                userId,
                automationType: 'canned_responses',
                details: JSON.stringify({ count: results.cannedResponses.count }),
                status: 'success'
              });
            }
          }
        } catch (error) {
          results.cannedResponses.error = error.message;
          logger.error('Failed to apply default canned responses', { userId, error: error.message });
          
          if (auditLogService) {
            await auditLogService.logAutomation({
              userId,
              automationType: 'canned_responses',
              status: 'failed',
              errorMessage: error.message
            });
          }
        }
      }

      // Apply default webhook if enabled
      if (settings.automationsEnabled.webhooks && settings.defaultWebhookUrl) {
        try {
          await this.createWebhookForUser(userId, settings.defaultWebhookUrl, settings.defaultWebhookEvents);
          results.webhooks.applied = true;
          
          if (auditLogService) {
            await auditLogService.logAutomation({
              userId,
              automationType: 'webhooks',
              details: JSON.stringify({ 
                url: settings.defaultWebhookUrl, 
                events: settings.defaultWebhookEvents 
              }),
              status: 'success'
            });
          }
        } catch (error) {
          results.webhooks.error = error.message;
          logger.error('Failed to apply default webhook', { userId, error: error.message });
          
          if (auditLogService) {
            await auditLogService.logAutomation({
              userId,
              automationType: 'webhooks',
              details: JSON.stringify({ url: settings.defaultWebhookUrl }),
              status: 'failed',
              errorMessage: error.message
            });
          }
        }
      }

      logger.info('Automations applied to new user', { userId, results });

      return results;
    } catch (error) {
      logger.error('Failed to apply automations to new user', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Create a bot for a user based on a template
   * @param {string} userId - User ID
   * @param {Object} template - Bot template
   */
  async createBotForUser(userId, template) {
    const crypto = require('crypto');
    const accessToken = `bot_${crypto.randomBytes(32).toString('hex')}`;

    await this.db.query(
      `INSERT INTO agent_bots (user_id, name, description, outgoing_url, access_token, status, priority, is_default, include_history)
       VALUES (?, ?, ?, ?, ?, 'active', 1, 1, ?)`,
      [userId, template.name, template.description, template.outgoingUrl, accessToken, template.includeHistory ? 1 : 0]
    );

    logger.info('Bot created for user from template', { userId, templateId: template.id });
  }

  /**
   * Create a label for a user based on a default label
   * @param {string} userId - User ID
   * @param {Object} defaultLabel - Default label
   */
  async createLabelForUser(userId, defaultLabel) {
    await this.db.query(
      `INSERT INTO labels (user_id, name, color)
       VALUES (?, ?, ?)`,
      [userId, defaultLabel.name, defaultLabel.color]
    );
  }

  /**
   * Create a canned response for a user based on a default response
   * @param {string} userId - User ID
   * @param {Object} defaultResponse - Default canned response
   */
  async createCannedResponseForUser(userId, defaultResponse) {
    await this.db.query(
      `INSERT INTO canned_responses (user_id, shortcut, content)
       VALUES (?, ?, ?)`,
      [userId, defaultResponse.shortcut, defaultResponse.content]
    );
  }

  /**
   * Create a webhook for a user based on default settings
   * @param {string} userId - User ID (token)
   * @param {string} webhookUrl - Webhook URL
   * @param {Array<string>} events - Webhook events
   */
  async createWebhookForUser(userId, webhookUrl, events) {
    // Check if user already has a webhook configured
    const { rows: existingWebhooks } = await this.db.query(
      'SELECT id FROM outgoing_webhooks WHERE user_id = ?',
      [userId]
    );

    if (existingWebhooks.length > 0) {
      logger.info('User already has webhook configured, skipping', { userId });
      return;
    }

    await this.db.query(
      `INSERT INTO outgoing_webhooks (user_id, url, events, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [userId, webhookUrl, JSON.stringify(events)]
    );

    logger.info('Webhook created for user from default settings', { userId, webhookUrl, events });
  }

  /**
   * Apply automations to existing users in bulk
   * @param {Array<string>} userIds - User IDs
   * @param {Array<string>} automationTypes - Types of automations to apply
   * @param {Object} auditLogService - AuditLogService instance
   * @returns {Promise<Object>} Bulk result
   * 
   * Requirements: 8.3, 8.4
   */
  async applyAutomationsToExistingUsers(userIds, automationTypes, auditLogService) {
    const result = {
      totalUsers: userIds.length,
      successCount: 0,
      failureCount: 0,
      failures: []
    };

    for (const userId of userIds) {
      try {
        const userResult = await this.applyAutomationsToNewUser(userId, auditLogService);
        
        // Check if any automation was applied
        const anyApplied = userResult.bot.applied || userResult.labels.applied || userResult.cannedResponses.applied || userResult.webhooks.applied;
        
        if (anyApplied) {
          result.successCount++;
        } else {
          // No automations were enabled or applicable
          result.failureCount++;
          result.failures.push({ userId, error: 'No automations applied' });
        }
      } catch (error) {
        result.failureCount++;
        result.failures.push({ userId, error: error.message });
      }
    }

    logger.info('Bulk automation applied', { 
      totalUsers: result.totalUsers, 
      successCount: result.successCount, 
      failureCount: result.failureCount 
    });

    return result;
  }

  // ==================== Export/Import ====================

  /**
   * Export all automation configuration
   * @returns {Promise<Object>} Configuration export
   * 
   * Requirements: 13.2
   */
  async exportConfiguration() {
    try {
      const globalSettings = await this.getGlobalSettings();
      const botTemplates = await this.getBotTemplates();
      const defaultLabels = await this.getDefaultLabels();
      const defaultCannedResponses = await this.getDefaultCannedResponses();

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        globalSettings,
        botTemplates,
        defaultLabels,
        defaultCannedResponses
      };
    } catch (error) {
      logger.error('Failed to export configuration', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate configuration for import
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   * 
   * Requirements: 13.3
   */
  validateConfiguration(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, errors: ['Invalid configuration format'] };
    }

    if (!config.version) {
      errors.push('Missing version field');
    }

    if (config.botTemplates && Array.isArray(config.botTemplates)) {
      config.botTemplates.forEach((template, index) => {
        if (!template.name) {
          errors.push(`Bot template ${index + 1}: name is required`);
        }
        if (!template.outgoingUrl) {
          errors.push(`Bot template ${index + 1}: outgoingUrl is required`);
        } else {
          try {
            new URL(template.outgoingUrl);
          } catch {
            errors.push(`Bot template ${index + 1}: invalid outgoingUrl format`);
          }
        }
      });
    }

    if (config.defaultLabels && Array.isArray(config.defaultLabels)) {
      config.defaultLabels.forEach((label, index) => {
        if (!label.name) {
          errors.push(`Default label ${index + 1}: name is required`);
        }
        if (!label.color) {
          errors.push(`Default label ${index + 1}: color is required`);
        }
      });
    }

    if (config.defaultCannedResponses && Array.isArray(config.defaultCannedResponses)) {
      config.defaultCannedResponses.forEach((response, index) => {
        if (!response.shortcut) {
          errors.push(`Default canned response ${index + 1}: shortcut is required`);
        }
        if (!response.content) {
          errors.push(`Default canned response ${index + 1}: content is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Import configuration
   * @param {Object} config - Configuration to import
   * @returns {Promise<Object>} Import result
   * 
   * Requirements: 13.3, 13.4
   */
  async importConfiguration(config) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    const result = {
      globalSettings: false,
      botTemplates: { imported: 0, skipped: 0 },
      defaultLabels: { imported: 0, skipped: 0 },
      defaultCannedResponses: { imported: 0, skipped: 0 }
    };

    try {
      // Import global settings
      if (config.globalSettings) {
        await this.updateGlobalSettings(config.globalSettings);
        result.globalSettings = true;
      }

      // Import bot templates
      if (config.botTemplates && Array.isArray(config.botTemplates)) {
        for (const template of config.botTemplates) {
          try {
            await this.createBotTemplate({
              name: template.name,
              description: template.description,
              outgoingUrl: template.outgoingUrl,
              includeHistory: template.includeHistory
            });
            result.botTemplates.imported++;
          } catch {
            result.botTemplates.skipped++;
          }
        }
      }

      // Import default labels
      if (config.defaultLabels && Array.isArray(config.defaultLabels)) {
        for (const label of config.defaultLabels) {
          try {
            await this.createDefaultLabel({
              name: label.name,
              color: label.color
            });
            result.defaultLabels.imported++;
          } catch {
            result.defaultLabels.skipped++;
          }
        }
      }

      // Import default canned responses
      if (config.defaultCannedResponses && Array.isArray(config.defaultCannedResponses)) {
        for (const response of config.defaultCannedResponses) {
          try {
            await this.createDefaultCannedResponse({
              shortcut: response.shortcut,
              content: response.content
            });
            result.defaultCannedResponses.imported++;
          } catch {
            result.defaultCannedResponses.skipped++;
          }
        }
      }

      logger.info('Configuration imported', { result });

      return result;
    } catch (error) {
      logger.error('Failed to import configuration', { error: error.message });
      throw error;
    }
  }
}

module.exports = AutomationService;
