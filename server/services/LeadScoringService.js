/**
 * LeadScoringService - Service for managing lead scores in CRM
 * 
 * Handles lead score calculation, updates, decay, and tier classification.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Default scoring configuration
const DEFAULT_CONFIG = {
  messageReceived: 5,
  messageSent: 2,
  purchaseMade: 20,
  purchaseValueMultiplier: 0.01, // 1 point per R$100
  inactivityDecayPerDay: 0.5,
  maxScore: 100,
  tiers: {
    cold: { min: 0, max: 25 },
    warm: { min: 26, max: 50 },
    hot: { min: 51, max: 75 },
    vip: { min: 76, max: 100 }
  }
};

class LeadScoringService {
  /**
   * Get scoring configuration for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object>} Scoring configuration
   */
  async getConfig(accountId) {
    try {
      const queryFn = (query) => query
        .select('config')
        .eq('account_id', accountId)
        .single();

      const { data, error } = await supabaseService.queryAsAdmin('lead_scoring_config', queryFn);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.config || DEFAULT_CONFIG;
    } catch (error) {
      logger.error('Failed to get lead scoring config', { error: error.message, accountId });
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save scoring configuration for an account
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} config - Scoring configuration
   * @returns {Promise<Object>} Saved configuration
   */
  async saveConfig(accountId, tenantId, config) {
    try {
      // Validate config structure
      const validatedConfig = this.validateConfig(config);

      // Check if config exists
      const queryFn = (query) => query
        .select('id')
        .eq('account_id', accountId)
        .single();

      const { data: existing } = await supabaseService.queryAsAdmin('lead_scoring_config', queryFn);

      if (existing) {
        // Update existing
        const { data, error } = await supabaseService.update('lead_scoring_config', existing.id, {
          config: validatedConfig,
          updated_at: new Date().toISOString()
        });

        if (error) throw error;
        return data.config;
      } else {
        // Create new
        const { data, error } = await supabaseService.insert('lead_scoring_config', {
          tenant_id: tenantId,
          account_id: accountId,
          config: validatedConfig
        });

        if (error) throw error;
        return data.config;
      }
    } catch (error) {
      logger.error('Failed to save lead scoring config', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Validate and merge config with defaults
   * @param {Object} config - Config to validate
   * @returns {Object} Validated config
   */
  validateConfig(config) {
    return {
      messageReceived: config.messageReceived ?? DEFAULT_CONFIG.messageReceived,
      messageSent: config.messageSent ?? DEFAULT_CONFIG.messageSent,
      purchaseMade: config.purchaseMade ?? DEFAULT_CONFIG.purchaseMade,
      purchaseValueMultiplier: config.purchaseValueMultiplier ?? DEFAULT_CONFIG.purchaseValueMultiplier,
      inactivityDecayPerDay: config.inactivityDecayPerDay ?? DEFAULT_CONFIG.inactivityDecayPerDay,
      maxScore: config.maxScore ?? DEFAULT_CONFIG.maxScore,
      tiers: config.tiers ?? DEFAULT_CONFIG.tiers
    };
  }

  /**
   * Calculate lead score for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} config - Scoring configuration (optional)
   * @returns {Promise<{score: number, tier: string}>}
   */
  async calculateScore(contactId, config = null) {
    try {
      // Get contact data
      const queryFn = (query) => query
        .select('id, account_id, lead_score, last_interaction_at, lifetime_value_cents, purchase_count')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Get config if not provided
      if (!config) {
        config = await this.getConfig(contact.account_id);
      }

      // Calculate base score from purchases
      let score = 0;
      
      if (contact.purchase_count > 0) {
        score += contact.purchase_count * config.purchaseMade;
        score += (contact.lifetime_value_cents / 100) * config.purchaseValueMultiplier;
      }

      // Get interaction count
      const interactionQueryFn = (query) => query
        .select('direction', { count: 'exact' })
        .eq('contact_id', contactId);

      const { count: interactionCount } = await supabaseService.queryAsAdmin('contact_interactions', interactionQueryFn);

      // Add interaction points (simplified - could be more granular)
      score += (interactionCount || 0) * config.messageSent;

      // Apply decay for inactivity
      if (contact.last_interaction_at) {
        const daysSinceInteraction = this.getDaysSince(contact.last_interaction_at);
        if (daysSinceInteraction > 0) {
          const decay = daysSinceInteraction * config.inactivityDecayPerDay;
          score = Math.max(0, score - decay);
        }
      }

      // Clamp score to bounds
      score = Math.min(Math.max(Math.round(score), 0), config.maxScore);

      // Determine tier
      const tier = this.getTier(score, config);

      return { score, tier };
    } catch (error) {
      logger.error('Failed to calculate lead score', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Update score when a message is sent or received
   * @param {string} contactId - Contact UUID
   * @param {string} direction - 'incoming' or 'outgoing'
   * @returns {Promise<{score: number, tier: string}>}
   */
  async updateScoreOnMessage(contactId, direction) {
    try {
      // Get contact and config
      const queryFn = (query) => query
        .select('id, account_id, lead_score')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const config = await this.getConfig(contact.account_id);

      // Calculate score increase
      const increase = direction === 'incoming' 
        ? config.messageReceived 
        : config.messageSent;

      // Calculate new score (capped at max)
      const newScore = Math.min(contact.lead_score + increase, config.maxScore);
      const tier = this.getTier(newScore, config);

      // Update contact
      await supabaseService.update('contacts', contactId, {
        lead_score: newScore,
        lead_tier: tier,
        last_interaction_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      });

      logger.info('Lead score updated on message', { 
        contactId, 
        direction, 
        oldScore: contact.lead_score, 
        newScore, 
        tier 
      });

      return { score: newScore, tier };
    } catch (error) {
      logger.error('Failed to update score on message', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Update score when a purchase is made
   * @param {string} contactId - Contact UUID
   * @param {number} amountCents - Purchase amount in cents
   * @returns {Promise<{score: number, tier: string}>}
   */
  async updateScoreOnPurchase(contactId, amountCents) {
    try {
      // Get contact and config
      const queryFn = (query) => query
        .select('id, account_id, lead_score')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const config = await this.getConfig(contact.account_id);

      // Calculate score increase
      const baseIncrease = config.purchaseMade;
      const valueIncrease = (amountCents / 100) * config.purchaseValueMultiplier;
      const totalIncrease = Math.round(baseIncrease + valueIncrease);

      // Calculate new score (capped at max)
      const newScore = Math.min(contact.lead_score + totalIncrease, config.maxScore);
      const tier = this.getTier(newScore, config);

      // Update contact
      await supabaseService.update('contacts', contactId, {
        lead_score: newScore,
        lead_tier: tier,
        updated_at: new Date().toISOString()
      });

      logger.info('Lead score updated on purchase', { 
        contactId, 
        amountCents, 
        oldScore: contact.lead_score, 
        newScore, 
        tier 
      });

      return { score: newScore, tier };
    } catch (error) {
      logger.error('Failed to update score on purchase', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Apply decay to all inactive contacts in an account (batch job)
   * @param {string} accountId - Account UUID
   * @returns {Promise<{updated: number}>}
   */
  async applyDecay(accountId) {
    try {
      const config = await this.getConfig(accountId);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get contacts with score > 0 and last interaction > 1 day ago
      const queryFn = (query) => query
        .select('id, lead_score, last_interaction_at')
        .eq('account_id', accountId)
        .gt('lead_score', 0)
        .lt('last_interaction_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

      const { data: contacts, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      let updated = 0;

      for (const contact of contacts || []) {
        const daysSinceInteraction = this.getDaysSince(contact.last_interaction_at);
        const decay = Math.round(daysSinceInteraction * config.inactivityDecayPerDay);
        const newScore = Math.max(0, contact.lead_score - decay);
        const tier = this.getTier(newScore, config);

        // Check if contact should be marked inactive
        const isActive = contact.last_interaction_at 
          ? new Date(contact.last_interaction_at) > thirtyDaysAgo 
          : false;

        if (newScore !== contact.lead_score) {
          await supabaseService.update('contacts', contact.id, {
            lead_score: newScore,
            lead_tier: tier,
            is_active: isActive,
            updated_at: new Date().toISOString()
          });
          updated++;
        }
      }

      logger.info('Lead score decay applied', { accountId, updated });

      return { updated };
    } catch (error) {
      logger.error('Failed to apply lead score decay', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get tier based on score
   * @param {number} score - Lead score
   * @param {Object} config - Scoring configuration
   * @returns {string} Tier name
   */
  getTier(score, config = DEFAULT_CONFIG) {
    const tiers = config.tiers || DEFAULT_CONFIG.tiers;

    if (score >= tiers.vip.min) return 'vip';
    if (score >= tiers.hot.min) return 'hot';
    if (score >= tiers.warm.min) return 'warm';
    return 'cold';
  }

  /**
   * Get days since a date
   * @param {string} dateString - ISO date string
   * @returns {number} Days since date
   */
  getDaysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Manually set lead score for a contact
   * @param {string} contactId - Contact UUID
   * @param {number} score - New score (0-100)
   * @returns {Promise<{score: number, tier: string}>}
   */
  async setScore(contactId, score) {
    try {
      // Validate score
      if (score < 0 || score > 100) {
        throw new Error('INVALID_SCORE');
      }

      // Get contact for config
      const queryFn = (query) => query
        .select('account_id')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const config = await this.getConfig(contact.account_id);
      const tier = this.getTier(score, config);

      // Update contact
      await supabaseService.update('contacts', contactId, {
        lead_score: score,
        lead_tier: tier,
        updated_at: new Date().toISOString()
      });

      logger.info('Lead score manually set', { contactId, score, tier });

      return { score, tier };
    } catch (error) {
      logger.error('Failed to set lead score', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get contacts by tier
   * @param {string} accountId - Account UUID
   * @param {string} tier - Tier name
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getContactsByTier(accountId, tier, options = {}) {
    try {
      const { page = 1, pageSize = 50 } = options;
      const offset = (page - 1) * pageSize;

      const queryFn = (query) => query
        .select('*', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('lead_tier', tier)
        .order('lead_score', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data, count, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return { data: data || [], total: count || 0 };
    } catch (error) {
      logger.error('Failed to get contacts by tier', { error: error.message, accountId, tier });
      throw error;
    }
  }

  /**
   * Get lead score distribution for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object>} Distribution by tier
   */
  async getScoreDistribution(accountId) {
    try {
      const tiers = ['cold', 'warm', 'hot', 'vip'];
      const distribution = {};

      for (const tier of tiers) {
        const queryFn = (query) => query
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('lead_tier', tier);

        const { count } = await supabaseService.queryAsAdmin('contacts', queryFn);
        distribution[tier] = count || 0;
      }

      return distribution;
    } catch (error) {
      logger.error('Failed to get score distribution', { error: error.message, accountId });
      throw error;
    }
  }
}

module.exports = new LeadScoringService();
module.exports.LeadScoringService = LeadScoringService;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
