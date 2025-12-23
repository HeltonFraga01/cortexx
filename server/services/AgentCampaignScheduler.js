/**
 * AgentCampaignScheduler
 * 
 * Handles campaign execution with humanization delays and quota consumption.
 * Processes contacts in order with configurable delays.
 * 
 * Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 9.1, 9.4
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const AgentCampaignService = require('./AgentCampaignService');
const QuotaService = require('./QuotaService');
const templateProcessor = require('./TemplateProcessor');
const SupabaseService = require('./SupabaseService');

class AgentCampaignScheduler {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
    this.campaignService = new AgentCampaignService();
    this.quotaService = new QuotaService();
    this.runningCampaigns = new Map();
  }

  /**
   * Start executing a campaign
   * @param {string} agentId - Agent ID
   * @param {string} campaignId - Campaign ID
   * @param {string} ownerId - Owner user ID for quota
   * @param {object} inbox - Inbox with wuzapi_token
   */
  async executeCampaign(agentId, campaignId, ownerId, inbox) {
    const campaign = await this.campaignService.getCampaign(agentId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Start the campaign
    await this.campaignService.startCampaign(agentId, campaignId);

    // Store running state
    this.runningCampaigns.set(campaignId, { running: true });

    logger.info('Starting campaign execution', { campaignId, agentId, ownerId });

    try {
      await this.processContacts(campaignId, ownerId, inbox, campaign.config);
    } catch (error) {
      logger.error('Campaign execution failed', { campaignId, error: error.message });
      throw error;
    } finally {
      this.runningCampaigns.delete(campaignId);
    }
  }

  /**
   * Process all contacts in a campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} ownerId - Owner user ID
   * @param {object} inbox - Inbox details
   * @param {object} config - Campaign config
   */
  async processContacts(campaignId, ownerId, inbox, config) {
    const { messages = [], humanization = {} } = config;
    const { minDelay = 5, maxDelay = 15, randomize = false } = humanization;

    // Get all pending contacts
    let contacts = await this.campaignService.getCampaignContacts(campaignId, { status: 'pending' });

    // Randomize order if enabled
    if (randomize && contacts.length > 1) {
      contacts = this.shuffleArray([...contacts]);
    }

    let sentCount = 0;
    let failedCount = 0;
    let position = 0;

    for (const contact of contacts) {
      // Check if campaign is still running
      const state = this.runningCampaigns.get(campaignId);
      if (!state || !state.running) {
        logger.info('Campaign execution stopped', { campaignId, position });
        break;
      }

      // Check if campaign was paused/cancelled
      const campaign = await this.getCampaignStatus(campaignId);
      if (['paused', 'cancelled'].includes(campaign?.status)) {
        logger.info('Campaign paused or cancelled', { campaignId, status: campaign.status });
        break;
      }

      // Check sending window
      if (config.schedule?.sendingWindow) {
        const canSend = this.isWithinSendingWindow(config.schedule.sendingWindow);
        if (!canSend) {
          logger.info('Outside sending window, waiting...', { campaignId });
          await this.sleep(60000); // Wait 1 minute and check again
          continue;
        }
      }

      // Check quota before sending
      const quotaCheck = await this.quotaService.checkQuota(ownerId, 'max_messages_per_day', 1);
      if (!quotaCheck.allowed) {
        logger.warn('Daily quota exceeded, stopping campaign', { campaignId, ownerId });
        await this.campaignService.pauseCampaign(null, campaignId);
        break;
      }

      try {
        // Send message
        await this.sendMessage(contact, messages, inbox);
        
        // Update contact status
        await this.campaignService.updateContactStatus(contact.id, 'sent');
        
        // Increment quota
        await this.quotaService.incrementUsage(ownerId, 'max_messages_per_day', 1);
        await this.quotaService.incrementUsage(ownerId, 'max_messages_per_month', 1);
        
        sentCount++;
      } catch (error) {
        logger.error('Failed to send message', { 
          campaignId, 
          contactId: contact.id, 
          error: error.message 
        });
        
        await this.campaignService.updateContactStatus(contact.id, 'failed', {
          errorMessage: error.message
        });
        
        failedCount++;
      }

      position++;

      // Update progress
      await this.campaignService.updateProgress(campaignId, {
        sentCount,
        failedCount,
        currentPosition: position
      });

      // Apply delay before next message
      if (position < contacts.length) {
        const delay = this.getRandomDelay(minDelay, maxDelay);
        await this.sleep(delay * 1000);
      }
    }

    // Check if all contacts processed
    const remainingContacts = await this.campaignService.getCampaignContacts(campaignId, { status: 'pending' });
    if (remainingContacts.length === 0) {
      await this.campaignService.completeCampaign(campaignId);
    }

    logger.info('Campaign execution finished', { 
      campaignId, 
      sentCount, 
      failedCount, 
      position 
    });
  }

  /**
   * Generate dynamic variables at send time
   * @returns {Object} Dynamic variables (data, saudacao, empresa)
   */
  generateDynamicVariables(inbox) {
    const now = new Date();

    // Generate greeting based on current hour
    const hour = now.getHours();
    let saudacao = 'Olá';
    if (hour >= 6 && hour < 12) {
      saudacao = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      saudacao = 'Boa tarde';
    } else {
      saudacao = 'Boa noite';
    }

    return {
      data: now.toLocaleDateString('pt-BR'),
      saudacao: saudacao,
      empresa: inbox?.name || 'Empresa'
    };
  }

  /**
   * Send a message to a contact
   * @param {object} contact - Contact data
   * @param {array} messages - Message templates
   * @param {object} inbox - Inbox with token
   */
  async sendMessage(contact, messages, inbox) {
    if (!messages || messages.length === 0) {
      throw new Error('No messages configured');
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    // Generate dynamic variables
    const dynamicVars = this.generateDynamicVariables(inbox);

    // Merge contact variables with dynamic variables
    const allVariables = {
      ...(contact.variables || {}),
      ...dynamicVars
    };

    for (const message of messages) {
      // Process template with all variables
      const processed = templateProcessor.process(message.content || message.text, allVariables);
      if (!processed.success) {
        throw new Error('Template processing failed');
      }

      const response = await axios.post(`${wuzapiBaseUrl}/chat/send/text`, {
        Phone: contact.phone,
        Body: processed.finalMessage
      }, {
        headers: {
          'token': inbox.wuzapi_token,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (!response.data) {
        throw new Error('No response from WUZAPI');
      }
    }
  }

  /**
   * Get campaign status directly from DB
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>}
   */
  async getCampaignStatus(campaignId) {
    const { data, error } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
      query.select('status').eq('id', campaignId).single()
    );
    
    if (error || !data) {
      return null;
    }
    
    return data;
  }

  /**
   * Check if current time is within sending window
   * @param {object} window - Sending window config
   * @returns {boolean}
   */
  isWithinSendingWindow(window) {
    if (!window) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday

    // Check day of week
    if (window.days && window.days.length > 0) {
      if (!window.days.includes(currentDay)) {
        return false;
      }
    }

    // Check hours
    if (window.startHour !== undefined && window.endHour !== undefined) {
      if (currentHour < window.startHour || currentHour >= window.endHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get random delay between min and max
   * @param {number} min - Minimum delay in seconds
   * @param {number} max - Maximum delay in seconds
   * @returns {number} Delay in seconds
   */
  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {array} array - Array to shuffle
   * @returns {array} Shuffled array
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop a running campaign
   * @param {string} campaignId - Campaign ID
   */
  stopCampaign(campaignId) {
    const state = this.runningCampaigns.get(campaignId);
    if (state) {
      state.running = false;
    }
  }
}

module.exports = AgentCampaignScheduler;
