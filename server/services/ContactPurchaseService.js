/**
 * ContactPurchaseService - Service for managing contact purchases
 * 
 * Handles purchase recording, history, metrics calculation, and webhook processing.
 * 
 * Requirements: 3.1, 3.2, 3.3, 9.1, 9.2, 9.3 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');
const LeadScoringService = require('./LeadScoringService');

class ContactPurchaseService {
  /**
   * Create a purchase record for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Created purchase
   */
  async createPurchase(contactId, purchaseData) {
    try {
      // Get contact info
      const queryFn = (query) => query
        .select('id, account_id, tenant_id')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Create purchase record
      const purchase = {
        tenant_id: contact.tenant_id,
        account_id: contact.account_id,
        contact_id: contactId,
        external_id: purchaseData.externalId || null,
        amount_cents: purchaseData.amountCents,
        currency: purchaseData.currency || 'BRL',
        description: purchaseData.description || null,
        product_name: purchaseData.productName || null,
        status: purchaseData.status || 'completed',
        source: purchaseData.source || 'manual',
        metadata: purchaseData.metadata || {},
        purchased_at: purchaseData.purchasedAt || new Date().toISOString()
      };

      const { data: createdPurchase, error: insertError } = await supabaseService.insert(
        'contact_purchases',
        purchase
      );

      if (insertError) throw insertError;

      // Update contact metrics if purchase is completed
      if (purchase.status === 'completed') {
        await this.updateContactMetrics(contactId);
        
        // Update lead score
        try {
          await LeadScoringService.updateScoreOnPurchase(contactId, purchase.amount_cents);
        } catch (scoreError) {
          logger.warn('Failed to update lead score on purchase', { 
            error: scoreError.message, 
            contactId 
          });
        }
      }

      logger.info('Purchase created', { 
        purchaseId: createdPurchase.id, 
        contactId, 
        amountCents: purchase.amount_cents 
      });

      return createdPurchase;
    } catch (error) {
      logger.error('Failed to create purchase', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get purchase history for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getPurchaseHistory(contactId, options = {}) {
    try {
      const { 
        page = 1, 
        pageSize = 50, 
        status = null,
        startDate = null,
        endDate = null 
      } = options;

      const offset = (page - 1) * pageSize;

      const queryFn = (query) => {
        let q = query
          .select('*', { count: 'exact' })
          .eq('contact_id', contactId)
          .order('purchased_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (status) {
          q = q.eq('status', status);
        }

        if (startDate) {
          q = q.gte('purchased_at', startDate);
        }

        if (endDate) {
          q = q.lte('purchased_at', endDate);
        }

        return q;
      };

      const { data, count, error } = await supabaseService.queryAsAdmin(
        'contact_purchases', 
        queryFn
      );

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get purchase history', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Update contact metrics (LTV, purchase_count, last_purchase_at)
   * @param {string} contactId - Contact UUID
   * @returns {Promise<Object>} Updated metrics
   */
  async updateContactMetrics(contactId) {
    try {
      // Calculate metrics from completed purchases
      const queryFn = (query) => query
        .select('amount_cents, purchased_at')
        .eq('contact_id', contactId)
        .eq('status', 'completed');

      const { data: purchases, error } = await supabaseService.queryAsAdmin(
        'contact_purchases', 
        queryFn
      );

      if (error) throw error;

      const purchaseCount = purchases?.length || 0;
      const lifetimeValueCents = (purchases || []).reduce(
        (sum, p) => sum + (p.amount_cents || 0), 
        0
      );

      // Find last purchase date
      let lastPurchaseAt = null;
      if (purchases && purchases.length > 0) {
        const sorted = purchases.sort((a, b) => 
          new Date(b.purchased_at) - new Date(a.purchased_at)
        );
        lastPurchaseAt = sorted[0].purchased_at;
      }

      // Update contact
      await supabaseService.update('contacts', contactId, {
        lifetime_value_cents: lifetimeValueCents,
        purchase_count: purchaseCount,
        last_purchase_at: lastPurchaseAt,
        updated_at: new Date().toISOString()
      });

      logger.info('Contact metrics updated', { 
        contactId, 
        lifetimeValueCents, 
        purchaseCount 
      });

      return { lifetimeValueCents, purchaseCount, lastPurchaseAt };
    } catch (error) {
      logger.error('Failed to update contact metrics', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Process purchase from webhook
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Created purchase and contact
   */
  async processWebhookPurchase(accountId, tenantId, webhookData) {
    try {
      const { 
        phone, 
        email, 
        customerName,
        externalId, 
        amountCents, 
        currency,
        productName,
        description,
        metadata 
      } = webhookData;

      // Check for duplicate by external_id
      if (externalId) {
        const dupQueryFn = (query) => query
          .select('id')
          .eq('external_id', externalId)
          .eq('account_id', accountId)
          .single();

        const { data: existing } = await supabaseService.queryAsAdmin(
          'contact_purchases', 
          dupQueryFn
        );

        if (existing) {
          logger.info('Duplicate purchase webhook ignored', { externalId });
          return { duplicate: true, purchaseId: existing.id };
        }
      }

      // Find or create contact
      let contact = null;

      // Try to find by phone first
      if (phone) {
        const phoneQueryFn = (query) => query
          .select('id')
          .eq('account_id', accountId)
          .eq('phone', phone)
          .single();

        const { data: phoneContact } = await supabaseService.queryAsAdmin('contacts', phoneQueryFn);
        contact = phoneContact;
      }

      // Try to find by email in metadata if no phone match
      if (!contact && email) {
        const emailQueryFn = (query) => query
          .select('id')
          .eq('account_id', accountId)
          .contains('metadata', { email })
          .single();

        const { data: emailContact } = await supabaseService.queryAsAdmin('contacts', emailQueryFn);
        contact = emailContact;
      }

      // Create new contact if not found
      if (!contact) {
        const newContactData = {
          tenant_id: tenantId,
          account_id: accountId,
          phone: phone || `webhook_${Date.now()}`,
          name: customerName || null,
          source: 'webhook',
          metadata: { email, webhookSource: 'purchase' }
        };

        const { data: newContact, error: contactError } = await supabaseService.insert(
          'contacts',
          newContactData
        );

        if (contactError) throw contactError;
        contact = newContact;

        logger.info('Contact created from webhook', { contactId: contact.id });
      }

      // Create purchase
      const purchase = await this.createPurchase(contact.id, {
        externalId,
        amountCents,
        currency,
        productName,
        description,
        source: 'webhook',
        metadata
      });

      return { 
        duplicate: false, 
        purchase, 
        contact,
        contactCreated: !contact.id 
      };
    } catch (error) {
      logger.error('Failed to process webhook purchase', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update purchase status
   * @param {string} purchaseId - Purchase UUID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated purchase
   */
  async updatePurchaseStatus(purchaseId, status) {
    try {
      const validStatuses = ['pending', 'completed', 'refunded', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error('INVALID_STATUS');
      }

      // Get purchase to find contact
      const queryFn = (query) => query
        .select('id, contact_id, status')
        .eq('id', purchaseId)
        .single();

      const { data: purchase, error } = await supabaseService.queryAsAdmin(
        'contact_purchases', 
        queryFn
      );

      if (error || !purchase) {
        throw new Error('PURCHASE_NOT_FOUND');
      }

      const previousStatus = purchase.status;

      // Update purchase
      const { data: updated, error: updateError } = await supabaseService.update(
        'contact_purchases',
        purchaseId,
        { status }
      );

      if (updateError) throw updateError;

      // Recalculate metrics if status changed to/from completed
      if (previousStatus !== status && 
          (previousStatus === 'completed' || status === 'completed')) {
        await this.updateContactMetrics(purchase.contact_id);
      }

      logger.info('Purchase status updated', { purchaseId, previousStatus, status });

      return updated;
    } catch (error) {
      logger.error('Failed to update purchase status', { error: error.message, purchaseId });
      throw error;
    }
  }

  /**
   * Get purchase by external ID
   * @param {string} accountId - Account UUID
   * @param {string} externalId - External ID
   * @returns {Promise<Object|null>}
   */
  async getPurchaseByExternalId(accountId, externalId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .eq('external_id', externalId)
        .single();

      const { data, error } = await supabaseService.queryAsAdmin('contact_purchases', queryFn);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      logger.error('Failed to get purchase by external ID', { error: error.message, externalId });
      throw error;
    }
  }

  /**
   * Get purchase statistics for an account
   * @param {string} accountId - Account UUID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getPurchaseStats(accountId, options = {}) {
    try {
      const { startDate, endDate } = options;

      const queryFn = (query) => {
        let q = query
          .select('amount_cents, status, purchased_at')
          .eq('account_id', accountId);

        if (startDate) {
          q = q.gte('purchased_at', startDate);
        }

        if (endDate) {
          q = q.lte('purchased_at', endDate);
        }

        return q;
      };

      const { data: purchases, error } = await supabaseService.queryAsAdmin(
        'contact_purchases', 
        queryFn
      );

      if (error) throw error;

      const completed = (purchases || []).filter(p => p.status === 'completed');
      const totalRevenue = completed.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      const averageOrderValue = completed.length > 0 
        ? Math.round(totalRevenue / completed.length) 
        : 0;

      return {
        totalPurchases: purchases?.length || 0,
        completedPurchases: completed.length,
        totalRevenueCents: totalRevenue,
        averageOrderValueCents: averageOrderValue,
        refundedCount: (purchases || []).filter(p => p.status === 'refunded').length,
        pendingCount: (purchases || []).filter(p => p.status === 'pending').length
      };
    } catch (error) {
      logger.error('Failed to get purchase stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Import purchases from CSV data
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object[]} purchases - Array of purchase data
   * @returns {Promise<{imported: number, failed: number, errors: string[]}>}
   */
  async importPurchases(accountId, tenantId, purchases) {
    const results = { imported: 0, failed: 0, errors: [] };

    for (const purchaseData of purchases) {
      try {
        await this.processWebhookPurchase(accountId, tenantId, {
          ...purchaseData,
          source: 'import'
        });
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${results.imported + results.failed}: ${error.message}`);
      }
    }

    logger.info('Purchases imported', { accountId, ...results });

    return results;
  }

  /**
   * Get top customers by LTV
   * @param {string} accountId - Account UUID
   * @param {number} limit - Number of customers to return
   * @returns {Promise<Object[]>}
   */
  async getTopCustomers(accountId, limit = 10) {
    try {
      const queryFn = (query) => query
        .select('id, name, phone, lifetime_value_cents, purchase_count')
        .eq('account_id', accountId)
        .gt('lifetime_value_cents', 0)
        .order('lifetime_value_cents', { ascending: false })
        .limit(limit);

      const { data, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get top customers', { error: error.message, accountId });
      throw error;
    }
  }
}

module.exports = new ContactPurchaseService();
module.exports.ContactPurchaseService = ContactPurchaseService;
