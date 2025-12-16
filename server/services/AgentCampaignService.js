/**
 * AgentCampaignService
 * 
 * Manages campaigns created by agents for bulk message sending.
 * Campaigns consume quota from the account owner.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 4.1, 4.2, 4.3, 5.3, 5.4, 9.1, 9.4
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

class AgentCampaignService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new campaign
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID
   * @param {object} config - Campaign configuration
   * @returns {Promise<object>} Created campaign
   */
  async createCampaign(agentId, accountId, config) {
    const { name, inboxId, messages, contacts, humanization = {}, schedule = null } = config;

    if (!name || !inboxId || !contacts || contacts.length === 0) {
      throw new Error('Name, inboxId, and contacts are required');
    }

    const campaignId = uuidv4();
    const now = new Date().toISOString();
    const scheduledAt = schedule?.scheduledAt || null;
    const status = scheduledAt ? 'scheduled' : 'pending';

    // Store campaign config as JSON
    const campaignConfig = JSON.stringify({
      messages: messages || [],
      humanization,
      schedule
    });

    await this.db.query(`
      INSERT INTO agent_campaigns (
        id, agent_id, account_id, inbox_id, name, status, 
        total_contacts, config, scheduled_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId, agentId, accountId, inboxId, name, status,
      contacts.length, campaignConfig, scheduledAt, now, now
    ]);

    // Insert contacts
    for (const contact of contacts) {
      const contactId = uuidv4();
      await this.db.query(`
        INSERT INTO agent_campaign_contacts (id, campaign_id, phone, name, variables, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `, [
        contactId,
        campaignId,
        contact.phone,
        contact.name || null,
        JSON.stringify(contact.variables || {}),
        now
      ]);
    }

    logger.info('Agent campaign created', { 
      campaignId, 
      agentId, 
      accountId, 
      contactCount: contacts.length 
    });

    return this.getCampaign(agentId, campaignId);
  }

  /**
   * List campaigns for an agent
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} List of campaigns
   */
  async listCampaigns(agentId, accountId, filters = {}) {
    let query = `
      SELECT id, agent_id, account_id, inbox_id, name, status,
             total_contacts, sent_count, failed_count, current_position,
             config, scheduled_at, started_at, completed_at, created_at, updated_at
      FROM agent_campaigns
      WHERE agent_id = ? AND account_id = ?
    `;
    const params = [agentId, accountId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const { rows } = await this.db.query(query, params);
    return rows.map(row => this.formatCampaign(row));
  }

  /**
   * Get a single campaign by ID
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} Campaign or null
   */
  async getCampaign(agentId, campaignId) {
    const { rows } = await this.db.query(`
      SELECT id, agent_id, account_id, inbox_id, name, status,
             total_contacts, sent_count, failed_count, current_position,
             config, scheduled_at, started_at, completed_at, created_at, updated_at
      FROM agent_campaigns
      WHERE id = ? AND agent_id = ?
    `, [campaignId, agentId]);

    if (rows.length === 0) {
      return null;
    }

    return this.formatCampaign(rows[0]);
  }

  /**
   * Get campaign contacts
   * @param {string} campaignId - Campaign ID
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} List of contacts
   */
  async getCampaignContacts(campaignId, filters = {}) {
    let query = `
      SELECT id, campaign_id, phone, name, variables, status, sent_at, error_message, message_id, created_at
      FROM agent_campaign_contacts
      WHERE campaign_id = ?
    `;
    const params = [campaignId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at ASC';

    const { rows } = await this.db.query(query, params);
    return rows.map(row => this.formatContact(row));
  }

  /**
   * Pause a running campaign
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object>} Updated campaign
   */
  async pauseCampaign(agentId, campaignId) {
    const campaign = await this.getCampaign(agentId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'running') {
      throw new Error('Only running campaigns can be paused');
    }

    const now = new Date().toISOString();
    await this.db.query(`
      UPDATE agent_campaigns
      SET status = 'paused', updated_at = ?
      WHERE id = ? AND agent_id = ?
    `, [now, campaignId, agentId]);

    logger.info('Agent campaign paused', { campaignId, agentId, position: campaign.currentPosition });

    return this.getCampaign(agentId, campaignId);
  }

  /**
   * Resume a paused campaign
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object>} Updated campaign
   */
  async resumeCampaign(agentId, campaignId) {
    const campaign = await this.getCampaign(agentId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'paused') {
      throw new Error('Only paused campaigns can be resumed');
    }

    const now = new Date().toISOString();
    await this.db.query(`
      UPDATE agent_campaigns
      SET status = 'running', updated_at = ?
      WHERE id = ? AND agent_id = ?
    `, [now, campaignId, agentId]);

    logger.info('Agent campaign resumed', { campaignId, agentId, position: campaign.currentPosition });

    return this.getCampaign(agentId, campaignId);
  }

  /**
   * Cancel a campaign
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object>} Updated campaign
   */
  async cancelCampaign(agentId, campaignId) {
    const campaign = await this.getCampaign(agentId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (['completed', 'cancelled'].includes(campaign.status)) {
      throw new Error('Campaign is already completed or cancelled');
    }

    const now = new Date().toISOString();

    // Mark remaining pending contacts as cancelled
    await this.db.query(`
      UPDATE agent_campaign_contacts
      SET status = 'cancelled'
      WHERE campaign_id = ? AND status = 'pending'
    `, [campaignId]);

    // Update campaign status
    await this.db.query(`
      UPDATE agent_campaigns
      SET status = 'cancelled', completed_at = ?, updated_at = ?
      WHERE id = ? AND agent_id = ?
    `, [now, now, campaignId, agentId]);

    logger.info('Agent campaign cancelled', { campaignId, agentId });

    return this.getCampaign(agentId, campaignId);
  }

  /**
   * Start a campaign (set to running)
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object>} Updated campaign
   */
  async startCampaign(agentId, campaignId) {
    const campaign = await this.getCampaign(agentId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!['pending', 'scheduled'].includes(campaign.status)) {
      throw new Error('Campaign cannot be started');
    }

    const now = new Date().toISOString();
    await this.db.query(`
      UPDATE agent_campaigns
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ? AND agent_id = ?
    `, [now, now, campaignId, agentId]);

    logger.info('Agent campaign started', { campaignId, agentId });

    return this.getCampaign(agentId, campaignId);
  }

  /**
   * Update campaign progress
   * @param {string} campaignId - Campaign ID
   * @param {object} progress - Progress data
   */
  async updateProgress(campaignId, progress) {
    const { sentCount, failedCount, currentPosition } = progress;
    const now = new Date().toISOString();

    await this.db.query(`
      UPDATE agent_campaigns
      SET sent_count = ?, failed_count = ?, current_position = ?, updated_at = ?
      WHERE id = ?
    `, [sentCount, failedCount, currentPosition, now, campaignId]);
  }

  /**
   * Mark campaign as completed
   * @param {string} campaignId - Campaign ID
   */
  async completeCampaign(campaignId) {
    const now = new Date().toISOString();
    await this.db.query(`
      UPDATE agent_campaigns
      SET status = 'completed', completed_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, campaignId]);

    logger.info('Agent campaign completed', { campaignId });
  }

  /**
   * Update contact status
   * @param {string} contactId - Contact ID
   * @param {string} status - New status
   * @param {object} data - Additional data
   */
  async updateContactStatus(contactId, status, data = {}) {
    const now = new Date().toISOString();
    const { errorMessage, messageId } = data;

    await this.db.query(`
      UPDATE agent_campaign_contacts
      SET status = ?, sent_at = ?, error_message = ?, message_id = ?
      WHERE id = ?
    `, [status, status === 'sent' ? now : null, errorMessage || null, messageId || null, contactId]);
  }

  /**
   * Get next pending contact for a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} Next contact or null
   */
  async getNextPendingContact(campaignId) {
    const { rows } = await this.db.query(`
      SELECT id, campaign_id, phone, name, variables, status, created_at
      FROM agent_campaign_contacts
      WHERE campaign_id = ? AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `, [campaignId]);

    if (rows.length === 0) {
      return null;
    }

    return this.formatContact(rows[0]);
  }

  /**
   * Format a database row to campaign object
   * @param {object} row - Database row
   * @returns {object} Formatted campaign
   */
  formatCampaign(row) {
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
      inboxId: row.inbox_id,
      name: row.name,
      status: row.status,
      totalContacts: row.total_contacts,
      sentCount: row.sent_count,
      failedCount: row.failed_count,
      currentPosition: row.current_position,
      config,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      progress: row.total_contacts > 0 
        ? Math.round((row.sent_count / row.total_contacts) * 100) 
        : 0
    };
  }

  /**
   * Format a database row to contact object
   * @param {object} row - Database row
   * @returns {object} Formatted contact
   */
  formatContact(row) {
    let variables = {};
    try {
      variables = row.variables ? JSON.parse(row.variables) : {};
    } catch (e) {
      variables = {};
    }

    // Adicionar nome às variáveis automaticamente se não existir
    if (row.name && !variables.nome) {
      variables.nome = row.name;
    }

    // Adicionar telefone às variáveis se não existir
    if (row.phone && !variables.telefone) {
      variables.telefone = row.phone;
    }

    return {
      id: row.id,
      campaignId: row.campaign_id,
      phone: row.phone,
      name: row.name,
      variables,
      status: row.status,
      sentAt: row.sent_at,
      errorMessage: row.error_message,
      messageId: row.message_id,
      createdAt: row.created_at
    };
  }
}

module.exports = AgentCampaignService;
