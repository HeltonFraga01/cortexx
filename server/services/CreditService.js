/**
 * CreditService - Billing credits and usage metering
 * 
 * Handles credit purchases, grants, consumption tracking, and balance management.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const StripeService = require('./StripeService');

// Low balance threshold (configurable)
const LOW_BALANCE_THRESHOLD = 100;

class CreditService {
  /**
   * Create a checkout session for credit purchase
   * @param {string} accountId - Account ID
   * @param {string} packageId - Credit package ID
   * @param {number} quantity - Number of packages
   * @returns {Promise<Object>} Checkout session
   */
  static async createCreditPurchaseCheckout(accountId, packageId, quantity = 1) {
    try {
      // Get package details
      const { data: pkg } = await SupabaseService.adminClient
        .from('plans')
        .select('*')
        .eq('id', packageId)
        .eq('is_credit_package', true)
        .single();

      if (!pkg) {
        throw new Error('Credit package not found');
      }

      if (!pkg.stripe_price_id) {
        throw new Error('Package not synced with Stripe');
      }

      // Get account
      const { data: account } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, stripe_customer_id, name, owner_user_id')
        .eq('id', accountId)
        .single();

      if (!account) {
        throw new Error('Account not found');
      }

      let customerId = account.stripe_customer_id;

      // Create customer if needed
      if (!customerId) {
        const customer = await StripeService.createCustomer(
          `account-${accountId}@wuzapi.local`,
          account.name || `Account ${accountId}`,
          { accountId }
        );
        customerId = customer.id;

        await SupabaseService.adminClient
          .from('accounts')
          .update({ stripe_customer_id: customerId })
          .eq('id', accountId);
      }

      // Create checkout session
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const session = await StripeService.createCheckoutSession({
        customerId,
        priceId: pkg.stripe_price_id,
        mode: 'payment',
        successUrl: `${baseUrl}/user/settings?credits=success`,
        cancelUrl: `${baseUrl}/user/settings?credits=canceled`,
        metadata: {
          accountId,
          packageId,
          creditAmount: pkg.credit_amount * quantity,
          type: 'credit_purchase',
        },
        quantity,
      });

      logger.info('Credit purchase checkout created', { accountId, packageId, quantity });
      return session;
    } catch (error) {
      logger.error('Failed to create credit purchase checkout', { 
        error: error.message, 
        accountId, 
        packageId 
      });
      throw error;
    }
  }

  /**
   * Grant credits to an account
   * @param {string} accountId - Account ID
   * @param {number} amount - Credit amount
   * @param {string} category - Grant category (purchase, bonus, refund, etc.)
   * @param {Date} expiresAt - Optional expiration date
   * @returns {Promise<Object>} Transaction record
   */
  static async grantCredits(accountId, amount, category = 'grant', expiresAt = null) {
    try {
      // Get current balance
      const currentBalance = await this.getCreditBalance(accountId);
      const newBalance = currentBalance.available + amount;

      // Create transaction
      const { data: transaction, error } = await SupabaseService.adminClient
        .from('credit_transactions')
        .insert({
          account_id: accountId,
          type: category,
          amount,
          balance_after: newBalance,
          description: `Credit ${category}: ${amount} credits`,
          metadata: expiresAt ? { expires_at: expiresAt.toISOString() } : {},
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Credits granted', { accountId, amount, category, newBalance });
      return transaction;
    } catch (error) {
      logger.error('Failed to grant credits', { error: error.message, accountId, amount });
      throw error;
    }
  }

  /**
   * Get credit balance for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Credit balance info
   */
  static async getCreditBalance(accountId) {
    try {
      // Get latest transaction for balance
      const { data: transactions } = await SupabaseService.adminClient
        .from('credit_transactions')
        .select('balance_after')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);

      const available = transactions?.[0]?.balance_after || 0;

      return {
        available,
        pending: 0,
        currency: 'BRL',
        lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
        isLow: available < LOW_BALANCE_THRESHOLD,
      };
    } catch (error) {
      logger.error('Failed to get credit balance', { error: error.message, accountId });
      return {
        available: 0,
        pending: 0,
        currency: 'BRL',
        lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
        isLow: true,
      };
    }
  }

  /**
   * Record usage (consume credits)
   * @param {string} accountId - Account ID
   * @param {string} meterId - Usage meter ID (e.g., 'messages', 'bot_calls')
   * @param {number} quantity - Amount to consume
   * @param {Date} timestamp - Usage timestamp
   * @returns {Promise<Object>} Transaction record
   */
  static async recordUsage(accountId, meterId, quantity, timestamp = new Date()) {
    try {
      // Get current balance
      const currentBalance = await this.getCreditBalance(accountId);
      
      if (currentBalance.available < quantity) {
        throw new Error('Insufficient credits');
      }

      const newBalance = currentBalance.available - quantity;

      // Create consumption transaction
      const { data: transaction, error } = await SupabaseService.adminClient
        .from('credit_transactions')
        .insert({
          account_id: accountId,
          type: 'consumption',
          amount: -quantity,
          balance_after: newBalance,
          description: `Usage: ${meterId} x ${quantity}`,
          metadata: { meter_id: meterId, timestamp: timestamp.toISOString() },
        })
        .select()
        .single();

      if (error) throw error;

      logger.debug('Usage recorded', { accountId, meterId, quantity, newBalance });
      return transaction;
    } catch (error) {
      logger.error('Failed to record usage', { error: error.message, accountId, meterId });
      throw error;
    }
  }

  /**
   * Get usage summary for an account
   * @param {string} accountId - Account ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Usage summary
   */
  static async getUsageSummary(accountId, startDate, endDate) {
    try {
      const { data: transactions } = await SupabaseService.adminClient
        .from('credit_transactions')
        .select('type, amount, metadata, created_at')
        .eq('account_id', accountId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      const summary = {
        totalPurchased: 0,
        totalConsumed: 0,
        totalGranted: 0,
        byMeter: {},
      };

      for (const tx of transactions || []) {
        if (tx.type === 'purchase') {
          summary.totalPurchased += tx.amount;
        } else if (tx.type === 'consumption') {
          summary.totalConsumed += Math.abs(tx.amount);
          const meterId = tx.metadata?.meter_id || 'unknown';
          summary.byMeter[meterId] = (summary.byMeter[meterId] || 0) + Math.abs(tx.amount);
        } else if (tx.type === 'grant') {
          summary.totalGranted += tx.amount;
        }
      }

      return summary;
    } catch (error) {
      logger.error('Failed to get usage summary', { error: error.message, accountId });
      return { totalPurchased: 0, totalConsumed: 0, totalGranted: 0, byMeter: {} };
    }
  }

  /**
   * Check if balance is low
   * @param {string} accountId - Account ID
   * @param {number} threshold - Custom threshold (optional)
   * @returns {Promise<Object>} Low balance status
   */
  static async checkLowBalance(accountId, threshold = LOW_BALANCE_THRESHOLD) {
    try {
      const balance = await this.getCreditBalance(accountId);
      return {
        isLow: balance.available < threshold,
        balance: balance.available,
        threshold,
      };
    } catch (error) {
      logger.error('Failed to check low balance', { error: error.message, accountId });
      return { isLow: true, balance: 0, threshold };
    }
  }

  /**
   * Check if account can consume credits
   * @param {string} accountId - Account ID
   * @param {number} amount - Amount to check
   * @returns {Promise<boolean>} Whether consumption is allowed
   */
  static async canConsumeCredits(accountId, amount) {
    try {
      const balance = await this.getCreditBalance(accountId);
      return balance.available >= amount;
    } catch (error) {
      logger.error('Failed to check credit consumption', { error: error.message, accountId });
      return false;
    }
  }

  /**
   * Transfer credits between accounts (for reseller model)
   * @param {string} fromAccountId - Source account
   * @param {string} toAccountId - Destination account
   * @param {number} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  static async transferCredits(fromAccountId, toAccountId, amount) {
    try {
      // Check source balance
      const sourceBalance = await this.getCreditBalance(fromAccountId);
      if (sourceBalance.available < amount) {
        throw new Error('Insufficient credits for transfer');
      }

      // Deduct from source
      const newSourceBalance = sourceBalance.available - amount;
      await SupabaseService.adminClient
        .from('credit_transactions')
        .insert({
          account_id: fromAccountId,
          type: 'transfer',
          amount: -amount,
          balance_after: newSourceBalance,
          description: `Transfer to account ${toAccountId}`,
          metadata: { to_account_id: toAccountId },
        });

      // Add to destination
      const destBalance = await this.getCreditBalance(toAccountId);
      const newDestBalance = destBalance.available + amount;
      await SupabaseService.adminClient
        .from('credit_transactions')
        .insert({
          account_id: toAccountId,
          type: 'transfer',
          amount,
          balance_after: newDestBalance,
          description: `Transfer from account ${fromAccountId}`,
          metadata: { from_account_id: fromAccountId },
        });

      logger.info('Credits transferred', { fromAccountId, toAccountId, amount });
      return { success: true, amount, newSourceBalance, newDestBalance };
    } catch (error) {
      logger.error('Failed to transfer credits', { 
        error: error.message, 
        fromAccountId, 
        toAccountId, 
        amount 
      });
      throw error;
    }
  }
}

module.exports = CreditService;
