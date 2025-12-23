/**
 * AgentCampaignService
 * 
 * Manages campaigns created by agents for bulk message sending.
 * Campaigns consume quota from the account owner.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 4.1, 4.2, 4.3, 5.3, 5.4, 9.1, 9.4
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AgentCampaignService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
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
    const campaignConfig = {
      messages: messages || [],
      humanization,
      schedule
    };

    const { error: insertError } = await SupabaseService.insert('agent_campaigns', {
      id: campaignId,
      agent_id: agentId,
      account_id: accountId,
      inbox_id: inboxId,
      name,
      status,
      total_contacts: contacts.length,
      config: campaignConfig,
      scheduled_at: scheduledAt
    });

    if (insertError) {
      logger.error('Failed to create campaign', { error: insertError.message, agentId });
      throw insertError;
    }

    // Insert contacts
    for (const contact of contacts) {
      const contactId = uuidv4();
      await SupabaseService.insert('agent_campaign_contacts', {
        id: contactId,
        campaign_id: campaignId,
        phone: contact.phone,
        name: contact.name || null,
        variables: contact.variables || {},
        status: 'pending'
      });
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
    const { data, error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) => {
      let q = query.select('*')
        .eq('agent_id', agentId)
        .eq('account_id', accountId);

      if (filters.status) {
        q = q.eq('status', filters.status);
      }

      if (filters.startDate) {
        q = q.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        q = q.lte('created_at', filters.endDate);
      }

      q = q.order('created_at', { ascending: false });

      if (filters.limit) {
        q = q.limit(filters.limit);
      }

      return q;
    });

    if (error) {
      logger.error('Failed to list campaigns', { error: error.message, agentId });
      return [];
    }

    return (data || []).map(row => this.formatCampaign(row));
  }

  /**
   * Get a single campaign by ID
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} Campaign or null
   */
  async getCampaign(agentId, campaignId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.select('*').eq('id', campaignId).eq('agent_id', agentId).single()
    );

    if (error || !data) {
      return null;
    }

    return this.formatCampaign(data);
  }

  /**
   * Get campaign contacts
   * @param {string} campaignId - Campaign ID
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} List of contacts
   */
  async getCampaignContacts(campaignId, filters = {}) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_campaign_contacts', (query) => {
      let q = query.select('*').eq('campaign_id', campaignId);

      if (filters.status) {
        q = q.eq('status', filters.status);
      }

      q = q.order('created_at', { ascending: true });

      return q;
    });

    if (error) {
      logger.error('Failed to get campaign contacts', { error: error.message, campaignId });
      return [];
    }

    return (data || []).map(row => this.formatContact(row));
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

    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ status: 'paused' }).eq('id', campaignId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to pause campaign', { error: error.message, campaignId });
      throw error;
    }

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

    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ status: 'running' }).eq('id', campaignId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to resume campaign', { error: error.message, campaignId });
      throw error;
    }

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
    await SupabaseService.queryAsAdmin('agent_campaign_contacts', (query) =>
      query.update({ status: 'cancelled' }).eq('campaign_id', campaignId).eq('status', 'pending')
    );

    // Update campaign status
    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ status: 'cancelled', completed_at: now }).eq('id', campaignId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to cancel campaign', { error: error.message, campaignId });
      throw error;
    }

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
    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ status: 'running', started_at: now }).eq('id', campaignId).eq('agent_id', agentId)
    );

    if (error) {
      logger.error('Failed to start campaign', { error: error.message, campaignId });
      throw error;
    }

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

    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ 
        sent_count: sentCount, 
        failed_count: failedCount, 
        current_position: currentPosition 
      }).eq('id', campaignId)
    );

    if (error) {
      logger.error('Failed to update campaign progress', { error: error.message, campaignId });
    }
  }

  /**
   * Mark campaign as completed
   * @param {string} campaignId - Campaign ID
   */
  async completeCampaign(campaignId) {
    const now = new Date().toISOString();
    const { error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.update({ status: 'completed', completed_at: now }).eq('id', campaignId)
    );

    if (error) {
      logger.error('Failed to complete campaign', { error: error.message, campaignId });
    } else {
      logger.info('Agent campaign completed', { campaignId });
    }
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

    const { error } = await SupabaseService.queryAsAdmin('agent_campaign_contacts', (query) =>
      query.update({ 
        status, 
        sent_at: status === 'sent' ? now : null, 
        error_message: errorMessage || null, 
        message_id: messageId || null 
      }).eq('id', contactId)
    );

    if (error) {
      logger.error('Failed to update contact status', { error: error.message, contactId });
    }
  }

  /**
   * Get next pending contact for a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} Next contact or null
   */
  async getNextPendingContact(campaignId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_campaign_contacts', (query) =>
      query.select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
    );

    if (error || !data || data.length === 0) {
      return null;
    }

    return this.formatContact(data[0]);
  }

  /**
   * Format a database row to campaign object
   * @param {object} row - Database row
   * @returns {object} Formatted campaign
   */
  formatCampaign(row) {
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
      variables = row.variables ? (typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables) : {};
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
