/**
 * CommunicationPreferenceService - Service for managing contact communication preferences
 * 
 * Handles opt-in/opt-out status, keyword detection, and campaign filtering.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Opt-out keywords (case-insensitive)
const OPT_OUT_KEYWORDS = ['SAIR', 'PARAR', 'STOP', 'UNSUBSCRIBE', 'CANCELAR', 'REMOVER'];

class CommunicationPreferenceService {
  /**
   * Set opt-in status for a contact
   * @param {string} contactId - Contact UUID
   * @param {boolean} optIn - Opt-in status
   * @param {string} method - Method of change (manual, keyword, api)
   * @returns {Promise<Object>} Updated contact
   */
  async setOptIn(contactId, optIn, method = 'manual') {
    try {
      const updateData = {
        bulk_messaging_opt_in: optIn,
        updated_at: new Date().toISOString()
      };

      // If opting out, record timestamp and method
      if (!optIn) {
        updateData.opt_out_at = new Date().toISOString();
        updateData.opt_out_method = method;
      } else {
        // If opting back in, clear opt-out fields
        updateData.opt_out_at = null;
        updateData.opt_out_method = null;
      }

      const { data, error } = await supabaseService.update('contacts', contactId, updateData);

      if (error) throw error;

      logger.info('Communication preference updated', { 
        contactId, 
        optIn, 
        method 
      });

      return data;
    } catch (error) {
      logger.error('Failed to set opt-in status', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Process a message for opt-out keywords
   * @param {string} contactId - Contact UUID
   * @param {string} message - Message content
   * @returns {Promise<{optedOut: boolean, keyword: string|null}>}
   */
  async processOptOutKeyword(contactId, message) {
    try {
      if (!message) {
        return { optedOut: false, keyword: null };
      }

      // Check for opt-out keywords
      const normalizedMessage = message.trim().toUpperCase();
      const foundKeyword = OPT_OUT_KEYWORDS.find(keyword => 
        normalizedMessage === keyword || 
        normalizedMessage.startsWith(keyword + ' ') ||
        normalizedMessage.endsWith(' ' + keyword)
      );

      if (foundKeyword) {
        await this.setOptIn(contactId, false, 'keyword');
        
        logger.info('Contact opted out via keyword', { 
          contactId, 
          keyword: foundKeyword 
        });

        return { optedOut: true, keyword: foundKeyword };
      }

      return { optedOut: false, keyword: null };
    } catch (error) {
      logger.error('Failed to process opt-out keyword', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get all opted-out contacts for an account
   * @param {string} accountId - Account UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getOptedOutContacts(accountId, options = {}) {
    try {
      const { page = 1, pageSize = 50 } = options;
      const offset = (page - 1) * pageSize;

      const queryFn = (query) => query
        .select('id, name, phone, opt_out_at, opt_out_method', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('bulk_messaging_opt_in', false)
        .order('opt_out_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data, count, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get opted-out contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Filter contact IDs to only include opted-in contacts
   * @param {string[]} contactIds - Contact UUIDs to filter
   * @returns {Promise<string[]>} Filtered contact IDs
   */
  async filterOptedIn(contactIds) {
    try {
      if (!contactIds || contactIds.length === 0) {
        return [];
      }

      const queryFn = (query) => query
        .select('id')
        .in('id', contactIds)
        .eq('bulk_messaging_opt_in', true);

      const { data, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return (data || []).map(c => c.id);
    } catch (error) {
      logger.error('Failed to filter opted-in contacts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get opt-in statistics for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object>}
   */
  async getOptInStats(accountId) {
    try {
      // Get total contacts
      const totalQueryFn = (query) => query
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);

      const { count: totalContacts } = await supabaseService.queryAsAdmin('contacts', totalQueryFn);

      // Get opted-in contacts
      const optedInQueryFn = (query) => query
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('bulk_messaging_opt_in', true);

      const { count: optedInContacts } = await supabaseService.queryAsAdmin('contacts', optedInQueryFn);

      // Get opt-out by method
      const methodQueryFn = (query) => query
        .select('opt_out_method')
        .eq('account_id', accountId)
        .eq('bulk_messaging_opt_in', false);

      const { data: optedOut } = await supabaseService.queryAsAdmin('contacts', methodQueryFn);

      const byMethod = {};
      for (const contact of optedOut || []) {
        const method = contact.opt_out_method || 'unknown';
        byMethod[method] = (byMethod[method] || 0) + 1;
      }

      return {
        totalContacts: totalContacts || 0,
        optedIn: optedInContacts || 0,
        optedOut: (totalContacts || 0) - (optedInContacts || 0),
        optInRate: totalContacts > 0 
          ? Math.round((optedInContacts / totalContacts) * 100) 
          : 0,
        optOutByMethod: byMethod
      };
    } catch (error) {
      logger.error('Failed to get opt-in stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Bulk update opt-in status for multiple contacts
   * @param {string[]} contactIds - Contact UUIDs
   * @param {boolean} optIn - Opt-in status
   * @param {string} method - Method of change
   * @returns {Promise<{updated: number}>}
   */
  async bulkSetOptIn(contactIds, optIn, method = 'manual') {
    try {
      let updated = 0;

      for (const contactId of contactIds) {
        try {
          await this.setOptIn(contactId, optIn, method);
          updated++;
        } catch (error) {
          logger.warn('Failed to update opt-in for contact', { 
            error: error.message, 
            contactId 
          });
        }
      }

      logger.info('Bulk opt-in update completed', { 
        total: contactIds.length, 
        updated, 
        optIn 
      });

      return { updated };
    } catch (error) {
      logger.error('Failed to bulk update opt-in', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a contact is opted in
   * @param {string} contactId - Contact UUID
   * @returns {Promise<boolean>}
   */
  async isOptedIn(contactId) {
    try {
      const queryFn = (query) => query
        .select('bulk_messaging_opt_in')
        .eq('id', contactId)
        .single();

      const { data, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !data) {
        return false;
      }

      return data.bulk_messaging_opt_in === true;
    } catch (error) {
      logger.error('Failed to check opt-in status', { error: error.message, contactId });
      return false;
    }
  }

  /**
   * Get preference history for a contact (from interactions)
   * @param {string} contactId - Contact UUID
   * @returns {Promise<Object[]>}
   */
  async getPreferenceHistory(contactId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('contact_id', contactId)
        .eq('type', 'status_change')
        .contains('metadata', { changeType: 'opt_in' })
        .order('created_at', { ascending: false });

      const { data, error } = await supabaseService.queryAsAdmin('contact_interactions', queryFn);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get preference history', { error: error.message, contactId });
      return [];
    }
  }

  /**
   * Get contacts eligible for a campaign (opted-in and active)
   * @param {string} accountId - Account UUID
   * @param {Object} options - Additional filters
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getCampaignEligibleContacts(accountId, options = {}) {
    try {
      const { 
        page = 1, 
        pageSize = 100,
        tagIds = null,
        segmentId = null,
        includeInactive = false
      } = options;

      const offset = (page - 1) * pageSize;

      const queryFn = (query) => {
        let q = query
          .select('id, name, phone', { count: 'exact' })
          .eq('account_id', accountId)
          .eq('bulk_messaging_opt_in', true);

        if (!includeInactive) {
          q = q.eq('is_active', true);
        }

        q = q.range(offset, offset + pageSize - 1);

        return q;
      };

      const { data, count, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      // Additional filtering by tags or segment would be done here
      // For now, return the basic filtered list

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get campaign eligible contacts', { error: error.message, accountId });
      throw error;
    }
  }
}

module.exports = new CommunicationPreferenceService();
module.exports.CommunicationPreferenceService = CommunicationPreferenceService;
module.exports.OPT_OUT_KEYWORDS = OPT_OUT_KEYWORDS;
