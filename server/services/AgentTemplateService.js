/**
 * AgentTemplateService
 * 
 * Manages message templates created by agents.
 * Templates are scoped to the agent and their account.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AgentTemplateService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Create a new template
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID
   * @param {object} data - Template data
   * @returns {Promise<object>} Created template
   */
  async createTemplate(agentId, accountId, data) {
    const { name, content, config = {} } = data;

    if (!name || !content) {
      throw new Error('Name and content are required');
    }

    const id = uuidv4();

    const { data: newTemplate, error } = await SupabaseService.insert('agent_templates', {
      id,
      agent_id: agentId,
      account_id: accountId,
      name,
      content,
      config
    });

    if (error) {
      logger.error('Failed to create template', { error: error.message, agentId });
      throw error;
    }

    logger.info('Agent template created', { templateId: id, agentId, accountId });

    return this.formatTemplate(newTemplate);
  }

  /**
   * List templates for an agent
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID
   * @returns {Promise<array>} List of templates
   */
  async listTemplates(agentId, accountId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_templates', (query) =>
      query.select('*')
        .eq('agent_id', agentId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
    );

    if (error) {
      logger.error('Failed to list templates', { error: error.message, agentId });
      return [];
    }

    return (data || []).map(row => this.formatTemplate(row));
  }

  /**
   * Get a single template by ID
   * @param {string} agentId - Agent ID
   * @param {string} templateId - Template ID
   * @returns {Promise<object|null>} Template or null
   */
  async getTemplate(agentId, templateId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_templates', (query) =>
      query.select('*').eq('id', templateId).eq('agent_id', agentId).single()
    );

    if (error || !data) {
      return null;
    }

    return this.formatTemplate(data);
  }

  /**
   * Update a template
   * @param {string} agentId - Agent ID
   * @param {string} templateId - Template ID
   * @param {object} data - Update data
   * @returns {Promise<object>} Updated template
   */
  async updateTemplate(agentId, templateId, data) {
    const existing = await this.getTemplate(agentId, templateId);
    if (!existing) {
      throw new Error('Template not found');
    }

    const { name, content, config } = data;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;
    if (config !== undefined) updates.config = config;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const { error } = await SupabaseService.queryAsAdmin('agent_templates', (query) =>
      query.update(updates).eq('id', templateId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to update template', { error: error.message, templateId });
      throw error;
    }

    logger.info('Agent template updated', { templateId, agentId });

    return this.getTemplate(agentId, templateId);
  }

  /**
   * Delete a template
   * @param {string} agentId - Agent ID
   * @param {string} templateId - Template ID
   * @returns {Promise<boolean>} Success
   */
  async deleteTemplate(agentId, templateId) {
    const existing = await this.getTemplate(agentId, templateId);
    if (!existing) {
      throw new Error('Template not found');
    }

    const { error } = await SupabaseService.queryAsAdmin('agent_templates', (query) =>
      query.delete().eq('id', templateId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to delete template', { error: error.message, templateId });
      throw error;
    }

    logger.info('Agent template deleted', { templateId, agentId });

    return true;
  }

  /**
   * Format a database row to template object
   * @param {object} row - Database row
   * @returns {object} Formatted template
   */
  formatTemplate(row) {
    let config = {};
    try {
      config = row.config ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : {};
    } catch (e) {
      config = {};
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      accountId: row.account_id,
      name: row.name,
      content: row.content,
      config,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = AgentTemplateService;
