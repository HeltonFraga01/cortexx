/**
 * ContactCreditService - Service for managing contact credit balances
 * 
 * Handles credit balance management, transactions, and history for contacts.
 * Uses atomic transactions to ensure balance consistency.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.7 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

class ContactCreditService {
  /**
   * Get credit balance for a contact
   * @param {string} contactId - Contact UUID
   * @returns {Promise<{balance: number, lastTransaction: Object|null}>}
   */
  async getBalance(contactId) {
    try {
      // Get contact's current balance
      const queryFn = (query) => query
        .select('credit_balance')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Get last transaction
      const txQueryFn = (query) => query
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: transactions } = await supabaseService.queryAsAdmin('contact_credit_transactions', txQueryFn);

      return {
        balance: contact.credit_balance || 0,
        lastTransaction: transactions?.[0] || null
      };
    } catch (error) {
      logger.error('Failed to get contact credit balance', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Add credits to a contact
   * @param {string} contactId - Contact UUID
   * @param {number} amount - Amount to add (positive)
   * @param {string} source - Source of credits (purchase, bonus, manual, etc.)
   * @param {Object} metadata - Additional metadata
   * @param {Object} createdBy - Creator info { id, type }
   * @returns {Promise<{balance: number, transaction: Object}>}
   */
  async addCredits(contactId, amount, source, metadata = {}, createdBy = null) {
    try {
      if (amount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }

      // Get contact and current balance
      const queryFn = (query) => query
        .select('id, account_id, tenant_id, credit_balance')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const currentBalance = contact.credit_balance || 0;
      const newBalance = currentBalance + amount;

      // Create transaction record
      const transactionData = {
        tenant_id: contact.tenant_id,
        account_id: contact.account_id,
        contact_id: contactId,
        type: 'credit',
        amount: amount,
        balance_after: newBalance,
        source: source,
        description: metadata.description || `Added ${amount} credits from ${source}`,
        metadata: metadata,
        created_by: createdBy?.id || null,
        created_by_type: createdBy?.type || 'system'
      };

      const { data: transaction, error: txError } = await supabaseService.insert(
        'contact_credit_transactions', 
        transactionData
      );

      if (txError) throw txError;

      // Update contact balance
      await supabaseService.update('contacts', contactId, {
        credit_balance: newBalance,
        updated_at: new Date().toISOString()
      });

      logger.info('Credits added to contact', { 
        contactId, 
        amount, 
        source, 
        newBalance 
      });

      return { balance: newBalance, transaction };
    } catch (error) {
      logger.error('Failed to add credits to contact', { error: error.message, contactId, amount });
      throw error;
    }
  }

  /**
   * Consume credits from a contact
   * @param {string} contactId - Contact UUID
   * @param {number} amount - Amount to consume (positive)
   * @param {string} reason - Reason for consumption
   * @param {Object} metadata - Additional metadata
   * @param {Object} createdBy - Creator info { id, type }
   * @returns {Promise<{balance: number, transaction: Object}>}
   */
  async consumeCredits(contactId, amount, reason, metadata = {}, createdBy = null) {
    try {
      if (amount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }

      // Get contact and current balance
      const queryFn = (query) => query
        .select('id, account_id, tenant_id, credit_balance')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const currentBalance = contact.credit_balance || 0;

      // Check sufficient balance
      if (currentBalance < amount) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      const newBalance = currentBalance - amount;

      // Create transaction record
      const transactionData = {
        tenant_id: contact.tenant_id,
        account_id: contact.account_id,
        contact_id: contactId,
        type: 'debit',
        amount: -amount, // Negative for debit
        balance_after: newBalance,
        source: reason,
        description: metadata.description || `Consumed ${amount} credits for ${reason}`,
        metadata: metadata,
        created_by: createdBy?.id || null,
        created_by_type: createdBy?.type || 'system'
      };

      const { data: transaction, error: txError } = await supabaseService.insert(
        'contact_credit_transactions', 
        transactionData
      );

      if (txError) throw txError;

      // Update contact balance
      await supabaseService.update('contacts', contactId, {
        credit_balance: newBalance,
        updated_at: new Date().toISOString()
      });

      logger.info('Credits consumed from contact', { 
        contactId, 
        amount, 
        reason, 
        newBalance 
      });

      return { balance: newBalance, transaction };
    } catch (error) {
      logger.error('Failed to consume credits from contact', { error: error.message, contactId, amount });
      throw error;
    }
  }

  /**
   * Adjust credit balance (can be positive or negative)
   * @param {string} contactId - Contact UUID
   * @param {number} amount - Adjustment amount (positive or negative)
   * @param {string} reason - Reason for adjustment
   * @param {Object} metadata - Additional metadata
   * @param {Object} createdBy - Creator info { id, type }
   * @returns {Promise<{balance: number, transaction: Object}>}
   */
  async adjustCredits(contactId, amount, reason, metadata = {}, createdBy = null) {
    try {
      // Get contact and current balance
      const queryFn = (query) => query
        .select('id, account_id, tenant_id, credit_balance')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      const currentBalance = contact.credit_balance || 0;
      const newBalance = currentBalance + amount;

      // Prevent negative balance
      if (newBalance < 0) {
        throw new Error('ADJUSTMENT_WOULD_CAUSE_NEGATIVE_BALANCE');
      }

      // Create transaction record
      const transactionData = {
        tenant_id: contact.tenant_id,
        account_id: contact.account_id,
        contact_id: contactId,
        type: 'adjustment',
        amount: amount,
        balance_after: newBalance,
        source: 'adjustment',
        description: reason || `Balance adjustment: ${amount > 0 ? '+' : ''}${amount}`,
        metadata: metadata,
        created_by: createdBy?.id || null,
        created_by_type: createdBy?.type || 'system'
      };

      const { data: transaction, error: txError } = await supabaseService.insert(
        'contact_credit_transactions', 
        transactionData
      );

      if (txError) throw txError;

      // Update contact balance
      await supabaseService.update('contacts', contactId, {
        credit_balance: newBalance,
        updated_at: new Date().toISOString()
      });

      logger.info('Credits adjusted for contact', { 
        contactId, 
        amount, 
        reason, 
        newBalance 
      });

      return { balance: newBalance, transaction };
    } catch (error) {
      logger.error('Failed to adjust credits for contact', { error: error.message, contactId, amount });
      throw error;
    }
  }

  /**
   * Get transaction history for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getTransactionHistory(contactId, options = {}) {
    try {
      const { 
        page = 1, 
        pageSize = 50, 
        type = null,
        startDate = null,
        endDate = null 
      } = options;

      const offset = (page - 1) * pageSize;

      const queryFn = (query) => {
        let q = query
          .select('*', { count: 'exact' })
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (type) {
          q = q.eq('type', type);
        }

        if (startDate) {
          q = q.gte('created_at', startDate);
        }

        if (endDate) {
          q = q.lte('created_at', endDate);
        }

        return q;
      };

      const { data, count, error } = await supabaseService.queryAsAdmin(
        'contact_credit_transactions', 
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
      logger.error('Failed to get transaction history', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Check if contact has sufficient balance
   * @param {string} contactId - Contact UUID
   * @param {number} amount - Amount to check
   * @returns {Promise<{sufficient: boolean, balance: number, shortfall: number}>}
   */
  async checkSufficientBalance(contactId, amount) {
    try {
      const { balance } = await this.getBalance(contactId);
      const sufficient = balance >= amount;
      const shortfall = sufficient ? 0 : amount - balance;

      return { sufficient, balance, shortfall };
    } catch (error) {
      logger.error('Failed to check sufficient balance', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get contacts with low or zero balance
   * @param {string} accountId - Account UUID
   * @param {number} threshold - Balance threshold
   * @returns {Promise<Object[]>}
   */
  async getContactsWithLowBalance(accountId, threshold = 0) {
    try {
      const queryFn = (query) => query
        .select('id, name, phone, credit_balance')
        .eq('account_id', accountId)
        .lte('credit_balance', threshold)
        .order('credit_balance', { ascending: true });

      const { data, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get contacts with low balance', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Bulk add credits to multiple contacts
   * @param {string[]} contactIds - Contact UUIDs
   * @param {number} amount - Amount to add
   * @param {string} source - Source of credits
   * @param {Object} createdBy - Creator info
   * @returns {Promise<{success: number, failed: number, results: Object[]}>}
   */
  async bulkAddCredits(contactIds, amount, source, createdBy = null) {
    const results = [];
    let success = 0;
    let failed = 0;

    for (const contactId of contactIds) {
      try {
        const result = await this.addCredits(contactId, amount, source, {}, createdBy);
        results.push({ contactId, success: true, balance: result.balance });
        success++;
      } catch (error) {
        results.push({ contactId, success: false, error: error.message });
        failed++;
      }
    }

    logger.info('Bulk credits added', { success, failed, total: contactIds.length });

    return { success, failed, results };
  }

  /**
   * Get credit summary for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object>}
   */
  async getCreditSummary(accountId) {
    try {
      // Get total balance across all contacts
      const balanceQueryFn = (query) => query
        .select('credit_balance')
        .eq('account_id', accountId)
        .gt('credit_balance', 0);

      const { data: contacts } = await supabaseService.queryAsAdmin('contacts', balanceQueryFn);

      const totalBalance = (contacts || []).reduce((sum, c) => sum + (c.credit_balance || 0), 0);
      const contactsWithCredits = (contacts || []).length;

      // Get transaction totals for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const txQueryFn = (query) => query
        .select('type, amount')
        .eq('account_id', accountId)
        .gte('created_at', startOfMonth.toISOString());

      const { data: transactions } = await supabaseService.queryAsAdmin(
        'contact_credit_transactions', 
        txQueryFn
      );

      let creditsAdded = 0;
      let creditsConsumed = 0;

      for (const tx of transactions || []) {
        if (tx.type === 'credit') {
          creditsAdded += tx.amount;
        } else if (tx.type === 'debit') {
          creditsConsumed += Math.abs(tx.amount);
        }
      }

      return {
        totalBalance,
        contactsWithCredits,
        monthlyCreditsAdded: creditsAdded,
        monthlyCreditsConsumed: creditsConsumed
      };
    } catch (error) {
      logger.error('Failed to get credit summary', { error: error.message, accountId });
      throw error;
    }
  }
}

module.exports = new ContactCreditService();
module.exports.ContactCreditService = ContactCreditService;
