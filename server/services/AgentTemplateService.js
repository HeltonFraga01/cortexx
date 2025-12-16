/**
 * AgentTemplateService
 * 
 * Manages message templates created by agents.
 * Templates are scoped to the agent and their account.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

class AgentTemplateService {
  constructor(db) {
    this.db = db;
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
    const now = new Date().toISOString();

    await this.db.query(`
      INSERT INTO agent_templates (id, agent_id, account_id, name, content, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, agentId, accountId, name, content, JSON.stringify(config), now, now]);

    logger.info('Agent template created', { templateId: id, agentId, accountId });

    return {
      id,
      agentId,
      accountId,
      name,
      content,
      config,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * List templates for an agent
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID
   * @returns {Promise<array>} List of templates
   */
  async listTemplates(agentId, accountId) {
    const { rows } = await this.db.query(`
      SELECT id, agent_id, account_id, name, content, config, created_at, updated_at
      FROM agent_templates
      WHERE agent_id = ? AND account_id = ?
      ORDER BY created_at DESC
    `, [agentId, accountId]);

    return rows.map(row => this.formatTemplate(row));
  }

  /**
   * Get a single template by ID
   * @param {string} agentId - Agent ID
   * @param {string} templateId - Template ID
   * @returns {Promise<object|null>} Template or null
   */
  async getTemplate(agentId, templateId) {
    const { rows } = await this.db.query(`
      SELECT id, agent_id, account_id, name, content, config, created_at, updated_at
      FROM agent_templates
      WHERE id = ? AND agent_id = ?
    `, [templateId, agentId]);

    if (rows.length === 0) {
      return null;
    }

    return this.formatTemplate(rows[0]);
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
    const now = new Date().toISOString();

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(config));
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(templateId);
    values.push(agentId);

    await this.db.query(`
      UPDATE agent_templates
      SET ${updates.join(', ')}
      WHERE id = ? AND agent_id = ?
    `, values);

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

    await this.db.query(`
      DELETE FROM agent_templates
      WHERE id = ? AND agent_id = ?
    `, [templateId, agentId]);

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
      config = row.config ? JSON.parse(row.config) : {};
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
