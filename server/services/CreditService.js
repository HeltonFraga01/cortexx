/**
 * CreditService - Billing credits and usage metering
 * 
 * Handles credit purchases, grants, consumption tracking, and balance management.
 * Uses atomic PostgreSQL functions to prevent race conditions.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 * 
 * IMPORTANT: This service now uses atomic RPC functions for all credit operations
 * to prevent race conditions in concurrent scenarios.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const StripeService = require('./StripeService');

// Low balance threshold (configurable)
const LOW_BALANCE_THRESHOLD = 100;

// Flag to track if atomic functions are available
let atomicFunctionsAvailable = null;

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
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
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
   * Check if atomic RPC functions are available
   * @returns {Promise<boolean>}
   */
  static async checkAtomicFunctionsAvailable() {
    if (atomicFunctionsAvailable !== null) {
      return atomicFunctionsAvailable;
    }

    try {
      // Try to call get_credit_balance with a dummy UUID to check if function exists
      const { error } = await SupabaseService.adminClient.rpc('get_credit_balance', {
        p_account_id: '00000000-0000-0000-0000-000000000000'
      });

      // If error is about the account not existing, the function exists
      // If error is about function not existing, it doesn't
      atomicFunctionsAvailable = !error || !error.message?.includes('function');
      
      if (!atomicFunctionsAvailable) {
        logger.warn('Atomic credit functions not available, using fallback mode', {
          error: error?.message
        });
      }
      
      return atomicFunctionsAvailable;
    } catch (error) {
      atomicFunctionsAvailable = false;
      logger.warn('Failed to check atomic functions availability', { error: error.message });
      return false;
    }
  }

  /**
   * Grant credits to an account (ATOMIC)
   * @param {string} accountId - Account ID
   * @param {number} amount - Credit amount
   * @param {string} category - Grant category (purchase, bonus, refund, etc.)
   * @param {Date} expiresAt - Optional expiration date
   * @returns {Promise<Object>} Transaction record
   */
  static async grantCredits(accountId, amount, category = 'grant', expiresAt = null) {
    try {
      const useAtomic = await this.checkAtomicFunctionsAvailable();

      if (useAtomic) {
        // Use atomic RPC function
        const { data, error } = await SupabaseService.adminClient.rpc('grant_credits_atomic', {
          p_account_id: accountId,
          p_amount: amount,
          p_category: category,
          p_description: `Credit ${category}: ${amount} credits`,
          p_metadata: expiresAt ? { expires_at: expiresAt.toISOString() } : {}
        });

        if (error) throw error;

        const result = data?.[0];
        if (!result?.success) {
          throw new Error('Failed to grant credits');
        }

        logger.info('Credits granted (atomic)', { 
          accountId, 
          amount, 
          category, 
          newBalance: result.new_balance 
        });

        return {
          id: result.transaction_id,
          account_id: accountId,
          type: category,
          amount,
          balance_after: result.new_balance
        };
      }

      // Fallback: Non-atomic operation (legacy)
      return await this.grantCreditsLegacy(accountId, amount, category, expiresAt);
    } catch (error) {
      logger.error('Failed to grant credits', { error: error.message, accountId, amount });
      throw error;
    }
  }

  /**
   * Legacy grant credits (non-atomic fallback)
   * @private
   */
  static async grantCreditsLegacy(accountId, amount, category = 'grant', expiresAt = null) {
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

    logger.info('Credits granted (legacy)', { accountId, amount, category, newBalance });
    return transaction;
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
   * Record usage (consume credits) - ATOMIC
   * @param {string} accountId - Account ID
   * @param {string} meterId - Usage meter ID (e.g., 'messages', 'bot_calls')
   * @param {number} quantity - Amount to consume
   * @param {Date} timestamp - Usage timestamp
   * @returns {Promise<Object>} Transaction record
   */
  static async recordUsage(accountId, meterId, quantity, timestamp = new Date()) {
    try {
      const useAtomic = await this.checkAtomicFunctionsAvailable();

      if (useAtomic) {
        // Use atomic RPC function
        const { data, error } = await SupabaseService.adminClient.rpc('consume_credits_atomic', {
          p_account_id: accountId,
          p_amount: quantity,
          p_meter_id: meterId,
          p_description: `Usage: ${meterId} x ${quantity}`,
          p_metadata: { timestamp: timestamp.toISOString() }
        });

        if (error) throw error;

        const result = data?.[0];
        if (!result?.success) {
          throw new Error(result?.error_message || 'Insufficient credits');
        }

        logger.debug('Usage recorded (atomic)', { 
          accountId, 
          meterId, 
          quantity, 
          newBalance: result.new_balance 
        });

        return {
          id: result.transaction_id,
          account_id: accountId,
          type: 'consumption',
          amount: -quantity,
          balance_after: result.new_balance
        };
      }

      // Fallback: Non-atomic operation (legacy)
      return await this.recordUsageLegacy(accountId, meterId, quantity, timestamp);
    } catch (error) {
      logger.error('Failed to record usage', { error: error.message, accountId, meterId });
      throw error;
    }
  }

  /**
   * Legacy record usage (non-atomic fallback)
   * @private
   */
  static async recordUsageLegacy(accountId, meterId, quantity, timestamp = new Date()) {
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

    logger.debug('Usage recorded (legacy)', { accountId, meterId, quantity, newBalance });
    return transaction;
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
   * Transfer credits between accounts (for reseller model) - ATOMIC
   * @param {string} fromAccountId - Source account
   * @param {string} toAccountId - Destination account
   * @param {number} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  static async transferCredits(fromAccountId, toAccountId, amount) {
    try {
      const useAtomic = await this.checkAtomicFunctionsAvailable();

      if (useAtomic) {
        // Use atomic RPC function
        const { data, error } = await SupabaseService.adminClient.rpc('transfer_credits_atomic', {
          p_from_account_id: fromAccountId,
          p_to_account_id: toAccountId,
          p_amount: amount,
          p_description: null
        });

        if (error) throw error;

        const result = data?.[0];
        if (!result?.success) {
          throw new Error(result?.error_message || 'Transfer failed');
        }

        logger.info('Credits transferred (atomic)', { 
          fromAccountId, 
          toAccountId, 
          amount,
          fromNewBalance: result.from_new_balance,
          toNewBalance: result.to_new_balance
        });

        return { 
          success: true, 
          amount, 
          newSourceBalance: result.from_new_balance, 
          newDestBalance: result.to_new_balance 
        };
      }

      // Fallback: Non-atomic operation (legacy)
      return await this.transferCreditsLegacy(fromAccountId, toAccountId, amount);
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

  /**
   * Legacy transfer credits (non-atomic fallback)
   * @private
   */
  static async transferCreditsLegacy(fromAccountId, toAccountId, amount) {
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

    logger.info('Credits transferred (legacy)', { fromAccountId, toAccountId, amount });
    return { success: true, amount, newSourceBalance, newDestBalance };
  }
}

module.exports = CreditService;
