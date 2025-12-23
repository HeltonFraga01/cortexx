/**
 * Bulk Campaign Service
 * Handles database operations for bulk message campaigns
 * Migrated from bulkCampaignRoutes.js db.query() calls
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class BulkCampaignService {
  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign data
   * @returns {Promise<Object>} Created campaign
   */
  static async createCampaign(campaignData) {
    const {
      id,
      name,
      instance,
      userToken,
      status,
      messageType,
      messageContent,
      mediaUrl,
      mediaType,
      mediaFileName,
      delayMin,
      delayMax,
      randomizeOrder,
      isScheduled,
      scheduledAt,
      totalContacts,
      messages,
      sendingWindow,
      inboxes
    } = campaignData;

    const insertData = {
      id,
      name,
      instance,
      user_token: userToken,
      status,
      message_type: messageType,
      message_content: messageContent,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      media_file_name: mediaFileName || null,
      delay_min: delayMin,
      delay_max: delayMax,
      randomize_order: randomizeOrder ? true : false,
      is_scheduled: isScheduled ? true : false,
      scheduled_at: scheduledAt,
      total_contacts: totalContacts,
      messages: messages ? JSON.stringify(messages) : null,
      sending_window: sendingWindow ? JSON.stringify(sendingWindow) : null,
      inboxes: inboxes && Array.isArray(inboxes) ? JSON.stringify(inboxes) : null
    };

    const { data, error } = await SupabaseService.insert('bulk_campaigns', insertData);
    
    if (error) {
      logger.error('Error creating campaign', { error: error.message });
      throw error;
    }
    
    return data;
  }

  /**
   * Create campaign contacts
   * @param {string} campaignId - Campaign ID
   * @param {Array} contacts - Array of contacts
   * @returns {Promise<void>}
   */
  static async createCampaignContacts(campaignId, contacts) {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      const insertData = {
        campaign_id: campaignId,
        phone: contact.phone,
        name: contact.name || null,
        variables: JSON.stringify(contact.variables || {}),
        status: 'pending',
        processing_order: i
      };

      const { error } = await SupabaseService.insert('campaign_contacts', insertData);
      
      if (error) {
        logger.error('Error creating campaign contact', { 
          campaignId, 
          phone: contact.phone, 
          error: error.message 
        });
        throw error;
      }
    }
  }

  /**
   * Get campaigns by user token with status filter
   * @param {string} userToken - User token
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of campaigns
   */
  static async getCampaignsByUserToken(userToken, options = {}) {
    const { instance, statuses, orderBy = 'created_at', ascending = false } = options;

    const { data, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      let q = query.select('*').eq('user_token', userToken);
      
      if (statuses && Array.isArray(statuses)) {
        q = q.in('status', statuses);
      }
      
      if (instance) {
        q = q.eq('instance', instance);
      }
      
      return q.order(orderBy, { ascending });
    });

    if (error) {
      logger.error('Error fetching campaigns', { userToken: userToken.substring(0, 8), error: error.message });
      throw error;
    }

    return data || [];
  }

  /**
   * Get a campaign by ID and user token
   * @param {string} id - Campaign ID
   * @param {string} userToken - User token
   * @returns {Promise<Object|null>} Campaign or null
   */
  static async getCampaignByIdAndToken(id, userToken) {
    const { data, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      return query.select('*').eq('id', id).eq('user_token', userToken).single();
    });

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching campaign', { id, error: error.message });
      throw error;
    }

    return data;
  }

  /**
   * Get pending contact for a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object|null>} Contact or null
   */
  static async getPendingContact(campaignId) {
    const { data, error } = await SupabaseService.queryAsAdmin('campaign_contacts', (query) => {
      return query
        .select('phone, name, variables, processing_order')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('processing_order', { ascending: true })
        .limit(1)
        .single();
    });

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching pending contact', { campaignId, error: error.message });
      throw error;
    }

    return data;
  }

  /**
   * Get recent failed contacts for a campaign
   * @param {string} campaignId - Campaign ID
   * @param {number} limit - Max number of results
   * @returns {Promise<Array>} List of failed contacts
   */
  static async getRecentFailedContacts(campaignId, limit = 5) {
    const { data, error } = await SupabaseService.queryAsAdmin('campaign_contacts', (query) => {
      return query
        .select('phone, name, error_type, error_message, sent_at')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')
        .order('id', { ascending: false })
        .limit(limit);
    });

    if (error) {
      logger.error('Error fetching failed contacts', { campaignId, error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Update campaign status
   * @param {string} id - Campaign ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Update result
   */
  static async updateCampaignStatus(id, status) {
    const { data, error } = await SupabaseService.update('bulk_campaigns', id, {
      status,
      updated_at: new Date().toISOString()
    });

    if (error) {
      logger.error('Error updating campaign status', { id, status, error: error.message });
      throw error;
    }

    return data;
  }

  /**
   * Get campaigns with pagination
   * @param {string} userToken - User token
   * @param {Object} options - Query options
   * @returns {Promise<{campaigns: Array, total: number}>}
   */
  static async getCampaignsWithPagination(userToken, options = {}) {
    const { instance, page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { data: campaigns, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      let q = query.select('*').eq('user_token', userToken);
      
      if (instance) {
        q = q.eq('instance', instance);
      }
      
      return q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    });

    if (error) {
      logger.error('Error fetching campaigns with pagination', { error: error.message });
      throw error;
    }

    // Get total count
    const { count, error: countError } = await SupabaseService.count('bulk_campaigns', {
      user_token: userToken,
      ...(instance && { instance })
    });

    return {
      campaigns: campaigns || [],
      total: countError ? (campaigns?.length || 0) : (count || 0)
    };
  }

  /**
   * Verify campaigns belong to user
   * @param {Array} campaignIds - Array of campaign IDs
   * @param {string} userToken - User token
   * @returns {Promise<Array>} List of valid campaign IDs
   */
  static async verifyCampaignsOwnership(campaignIds, userToken) {
    const { data, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) => {
      return query.select('id').in('id', campaignIds).eq('user_token', userToken);
    });

    if (error) {
      logger.error('Error verifying campaigns ownership', { error: error.message });
      throw error;
    }

    return (data || []).map(c => c.id);
  }

  /**
   * Delete campaign and its contacts
   * @param {string} id - Campaign ID
   * @returns {Promise<void>}
   */
  static async deleteCampaign(id) {
    // Delete contacts first
    const { error: contactsError } = await SupabaseService.queryAsAdmin('campaign_contacts', (query) => {
      return query.delete().eq('campaign_id', id);
    });

    if (contactsError) {
      logger.error('Error deleting campaign contacts', { id, error: contactsError.message });
      throw contactsError;
    }

    // Delete campaign
    const { error: campaignError } = await SupabaseService.delete('bulk_campaigns', id);

    if (campaignError) {
      logger.error('Error deleting campaign', { id, error: campaignError.message });
      throw campaignError;
    }
  }
}

module.exports = BulkCampaignService;
