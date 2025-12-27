/**
 * ContactInteractionService - Service for managing contact interactions
 * 
 * Handles interaction logging, timeline retrieval, and inactivity detection.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');
const LeadScoringService = require('./LeadScoringService');

// Inactivity threshold in days
const INACTIVITY_THRESHOLD_DAYS = 30;

class ContactInteractionService {
  /**
   * Log an interaction with a contact
   * @param {string} contactId - Contact UUID
   * @param {string} type - Interaction type (message, call, email, note, status_change)
   * @param {string} direction - Direction (incoming, outgoing) - optional for notes
   * @param {string} content - Interaction content
   * @param {Object} metadata - Additional metadata
   * @param {Object} createdBy - Creator info { id, type }
   * @returns {Promise<Object>} Created interaction
   */
  async logInteraction(contactId, type, direction, content, metadata = {}, createdBy = null) {
    try {
      // Validate type
      const validTypes = ['message', 'call', 'email', 'note', 'status_change'];
      if (!validTypes.includes(type)) {
        throw new Error('INVALID_INTERACTION_TYPE');
      }

      // Get contact info
      const queryFn = (query) => query
        .select('id, account_id, tenant_id')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Create content preview (first 200 chars)
      const contentPreview = content 
        ? content.substring(0, 200) + (content.length > 200 ? '...' : '')
        : null;

      // Create interaction record
      const interactionData = {
        tenant_id: contact.tenant_id,
        account_id: contact.account_id,
        contact_id: contactId,
        type,
        direction: direction || null,
        content,
        content_preview: contentPreview,
        metadata,
        created_by: createdBy?.id || null,
        created_by_type: createdBy?.type || 'system'
      };

      const { data: interaction, error: insertError } = await supabaseService.insert(
        'contact_interactions',
        interactionData
      );

      if (insertError) throw insertError;

      // Update contact's last interaction timestamp
      await this.updateLastInteraction(contactId);

      // Update lead score for messages
      if (type === 'message' && direction) {
        try {
          await LeadScoringService.updateScoreOnMessage(contactId, direction);
        } catch (scoreError) {
          logger.warn('Failed to update lead score on interaction', { 
            error: scoreError.message, 
            contactId 
          });
        }
      }

      logger.info('Interaction logged', { 
        interactionId: interaction.id, 
        contactId, 
        type, 
        direction 
      });

      return interaction;
    } catch (error) {
      logger.error('Failed to log interaction', { error: error.message, contactId, type });
      throw error;
    }
  }

  /**
   * Get timeline of interactions for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getTimeline(contactId, options = {}) {
    try {
      const { 
        page = 1, 
        pageSize = 50, 
        types = null,
        startDate = null,
        endDate = null,
        includeRelated = false
      } = options;

      const offset = (page - 1) * pageSize;

      // Get interactions
      const interactionQueryFn = (query) => {
        let q = query
          .select('*', { count: 'exact' })
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (types && types.length > 0) {
          q = q.in('type', types);
        }

        if (startDate) {
          q = q.gte('created_at', startDate);
        }

        if (endDate) {
          q = q.lte('created_at', endDate);
        }

        return q;
      };

      const { data: interactions, count, error } = await supabaseService.queryAsAdmin(
        'contact_interactions', 
        interactionQueryFn
      );

      if (error) throw error;

      let timelineEvents = (interactions || []).map(i => ({
        id: i.id,
        type: i.type,
        timestamp: i.created_at,
        direction: i.direction,
        content: i.content_preview || i.content,
        fullContent: i.content,
        metadata: i.metadata,
        createdBy: i.created_by,
        createdByType: i.created_by_type
      }));

      // Optionally include purchases and credit transactions
      if (includeRelated) {
        const relatedEvents = await this.getRelatedTimelineEvents(contactId, startDate, endDate);
        timelineEvents = [...timelineEvents, ...relatedEvents]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, pageSize);
      }

      return {
        data: timelineEvents,
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get timeline', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get related timeline events (purchases, credits)
   * @param {string} contactId - Contact UUID
   * @param {string} startDate - Start date filter
   * @param {string} endDate - End date filter
   * @returns {Promise<Object[]>}
   */
  async getRelatedTimelineEvents(contactId, startDate = null, endDate = null) {
    const events = [];

    try {
      // Get purchases
      const purchaseQueryFn = (query) => {
        let q = query
          .select('id, amount_cents, product_name, status, purchased_at')
          .eq('contact_id', contactId);

        if (startDate) q = q.gte('purchased_at', startDate);
        if (endDate) q = q.lte('purchased_at', endDate);

        return q;
      };

      const { data: purchases } = await supabaseService.queryAsAdmin(
        'contact_purchases', 
        purchaseQueryFn
      );

      for (const p of purchases || []) {
        events.push({
          id: `purchase_${p.id}`,
          type: 'purchase',
          timestamp: p.purchased_at,
          content: `Purchase: ${p.product_name || 'Product'} - R$ ${(p.amount_cents / 100).toFixed(2)}`,
          metadata: { purchaseId: p.id, amountCents: p.amount_cents, status: p.status }
        });
      }

      // Get credit transactions
      const creditQueryFn = (query) => {
        let q = query
          .select('id, type, amount, source, created_at')
          .eq('contact_id', contactId);

        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate);

        return q;
      };

      const { data: credits } = await supabaseService.queryAsAdmin(
        'contact_credit_transactions', 
        creditQueryFn
      );

      for (const c of credits || []) {
        events.push({
          id: `credit_${c.id}`,
          type: 'credit',
          timestamp: c.created_at,
          content: `${c.type === 'credit' ? 'Added' : 'Used'} ${Math.abs(c.amount)} credits (${c.source})`,
          metadata: { transactionId: c.id, amount: c.amount, transactionType: c.type }
        });
      }

      return events;
    } catch (error) {
      logger.warn('Failed to get related timeline events', { error: error.message, contactId });
      return [];
    }
  }

  /**
   * Update contact's last interaction timestamp
   * @param {string} contactId - Contact UUID
   * @returns {Promise<void>}
   */
  async updateLastInteraction(contactId) {
    try {
      const now = new Date().toISOString();

      await supabaseService.update('contacts', contactId, {
        last_interaction_at: now,
        is_active: true,
        updated_at: now
      });
    } catch (error) {
      logger.error('Failed to update last interaction', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Check and update inactivity status for all contacts in an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<{updated: number}>}
   */
  async checkInactivity(accountId) {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - INACTIVITY_THRESHOLD_DAYS);

      // Find contacts that should be marked inactive
      const queryFn = (query) => query
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .or(`last_interaction_at.lt.${thresholdDate.toISOString()},last_interaction_at.is.null`);

      const { data: inactiveContacts, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      let updated = 0;

      for (const contact of inactiveContacts || []) {
        await supabaseService.update('contacts', contact.id, {
          is_active: false,
          updated_at: new Date().toISOString()
        });
        updated++;
      }

      logger.info('Inactivity check completed', { accountId, updated });

      return { updated };
    } catch (error) {
      logger.error('Failed to check inactivity', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get interaction statistics for a contact
   * @param {string} contactId - Contact UUID
   * @returns {Promise<Object>}
   */
  async getInteractionStats(contactId) {
    try {
      const queryFn = (query) => query
        .select('type, direction')
        .eq('contact_id', contactId);

      const { data: interactions, error } = await supabaseService.queryAsAdmin(
        'contact_interactions', 
        queryFn
      );

      if (error) throw error;

      const stats = {
        total: interactions?.length || 0,
        byType: {},
        incoming: 0,
        outgoing: 0
      };

      for (const i of interactions || []) {
        stats.byType[i.type] = (stats.byType[i.type] || 0) + 1;
        if (i.direction === 'incoming') stats.incoming++;
        if (i.direction === 'outgoing') stats.outgoing++;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get interaction stats', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get inactive contacts for an account
   * @param {string} accountId - Account UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getInactiveContacts(accountId, options = {}) {
    try {
      const { page = 1, pageSize = 50 } = options;
      const offset = (page - 1) * pageSize;

      const queryFn = (query) => query
        .select('id, name, phone, last_interaction_at, lead_score', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('is_active', false)
        .order('last_interaction_at', { ascending: true, nullsFirst: true })
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
      logger.error('Failed to get inactive contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Add a note to a contact
   * @param {string} contactId - Contact UUID
   * @param {string} note - Note content
   * @param {Object} createdBy - Creator info
   * @returns {Promise<Object>}
   */
  async addNote(contactId, note, createdBy = null) {
    return this.logInteraction(contactId, 'note', null, note, {}, createdBy);
  }

  /**
   * Get recent interactions across all contacts for an account
   * @param {string} accountId - Account UUID
   * @param {number} limit - Number of interactions to return
   * @returns {Promise<Object[]>}
   */
  async getRecentInteractions(accountId, limit = 20) {
    try {
      const queryFn = (query) => query
        .select(`
          *,
          contacts(id, name, phone)
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data, error } = await supabaseService.queryAsAdmin('contact_interactions', queryFn);

      if (error) throw error;

      return (data || []).map(i => ({
        id: i.id,
        type: i.type,
        direction: i.direction,
        contentPreview: i.content_preview,
        timestamp: i.created_at,
        contact: i.contacts
      }));
    } catch (error) {
      logger.error('Failed to get recent interactions', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Delete an interaction
   * @param {string} interactionId - Interaction UUID
   * @param {string} accountId - Account UUID (for verification)
   * @returns {Promise<void>}
   */
  async deleteInteraction(interactionId, accountId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('id', interactionId)
        .eq('account_id', accountId);

      const { error } = await supabaseService.queryAsAdmin('contact_interactions', queryFn);

      if (error) throw error;

      logger.info('Interaction deleted', { interactionId, accountId });
    } catch (error) {
      logger.error('Failed to delete interaction', { error: error.message, interactionId });
      throw error;
    }
  }
}

module.exports = new ContactInteractionService();
module.exports.ContactInteractionService = ContactInteractionService;
module.exports.INACTIVITY_THRESHOLD_DAYS = INACTIVITY_THRESHOLD_DAYS;
