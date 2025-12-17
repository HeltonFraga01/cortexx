/**
 * ConnectService - Stripe Connect operations for resellers
 * 
 * Handles Stripe Connect account creation, onboarding, and marketplace operations.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2
 */

const { logger } = require('../utils/logger');
const { getStripeClient } = require('../utils/stripeClient');
const SupabaseService = require('./SupabaseService');

class ConnectService {
  /**
   * Create a new Stripe Connect account for a reseller
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {Object} options - Additional options
   * @returns {Promise<Object>}
   */
  static async createConnectAccount(userId, email, options = {}) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const account = await stripe.accounts.create({
        type: 'express',
        email,
        metadata: {
          userId,
          ...options.metadata,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: options.businessType || 'individual',
      });

      // Update account with stripe_account_id
      await SupabaseService.adminClient
        .from('accounts')
        .update({
          stripe_account_id: account.id,
          is_reseller: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      logger.info('Stripe Connect account created', { userId, accountId: account.id });
      return account;
    } catch (error) {
      logger.error('Failed to create Connect account', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create an account link for onboarding
   * @param {string} accountId - Stripe Connect account ID
   * @param {string} returnUrl - URL to return to after onboarding
   * @param {string} refreshUrl - URL to refresh onboarding if link expires
   * @returns {Promise<Object>}
   */
  static async createAccountLink(accountId, returnUrl, refreshUrl) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      logger.info('Account link created', { accountId });
      return accountLink;
    } catch (error) {
      logger.error('Failed to create account link', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get Connect account status
   * @param {string} accountId - Stripe Connect account ID
   * @returns {Promise<Object>}
   */
  static async getAccountStatus(accountId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const account = await stripe.accounts.retrieve(accountId);

      return {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requiresAction: !account.details_submitted || 
          (account.requirements?.currently_due?.length > 0),
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        email: account.email,
        businessType: account.business_type,
      };
    } catch (error) {
      logger.error('Failed to get account status', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create a login link for Express Dashboard
   * @param {string} accountId - Stripe Connect account ID
   * @returns {Promise<Object>}
   */
  static async createLoginLink(accountId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const loginLink = await stripe.accounts.createLoginLink(accountId);

      logger.info('Login link created', { accountId });
      return loginLink;
    } catch (error) {
      logger.error('Failed to create login link', { error: error.message, accountId });
      throw error;
    }
  }


  /**
   * Create a product in reseller's connected account
   * @param {string} accountId - Stripe Connect account ID
   * @param {string} name - Product name
   * @param {string} description - Product description
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>}
   */
  static async createResellerProduct(accountId, name, description, metadata = {}) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const product = await stripe.products.create(
        {
          name,
          description,
          metadata,
        },
        { stripeAccount: accountId }
      );

      logger.info('Reseller product created', { accountId, productId: product.id });
      return product;
    } catch (error) {
      logger.error('Failed to create reseller product', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create a price in reseller's connected account
   * @param {string} accountId - Stripe Connect account ID
   * @param {string} productId - Product ID
   * @param {number} amount - Price in cents
   * @param {string} currency - Currency code
   * @returns {Promise<Object>}
   */
  static async createResellerPrice(accountId, productId, amount, currency = 'brl') {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const price = await stripe.prices.create(
        {
          product: productId,
          unit_amount: amount,
          currency,
        },
        { stripeAccount: accountId }
      );

      logger.info('Reseller price created', { accountId, priceId: price.id });
      return price;
    } catch (error) {
      logger.error('Failed to create reseller price', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create a destination charge (payment to platform, transfer to connected account)
   * @param {Object} options - Charge options
   * @returns {Promise<Object>}
   */
  static async createDestinationCharge(options) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const {
        amount,
        currency = 'brl',
        destinationAccountId,
        applicationFeeAmount,
        customerId,
        description,
        metadata = {},
      } = options;

      // Create checkout session with destination charge
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: description || 'Credit Package',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: destinationAccountId,
          },
          metadata,
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/user/account?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/user/account?payment=canceled`,
        metadata,
      });

      logger.info('Destination charge checkout created', { 
        sessionId: session.id, 
        destinationAccountId,
        applicationFeeAmount 
      });
      return session;
    } catch (error) {
      logger.error('Failed to create destination charge', { error: error.message });
      throw error;
    }
  }

  /**
   * Get reseller by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  static async getResellerByUserId(userId) {
    try {
      const { data, error } = await SupabaseService.adminClient
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_reseller', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get reseller', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Update reseller credit balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add (positive) or deduct (negative)
   * @returns {Promise<number>} New balance
   */
  static async updateResellerBalance(userId, amount) {
    try {
      // Get current balance
      const { data: account, error: fetchError } = await SupabaseService.adminClient
        .from('accounts')
        .select('reseller_credit_balance')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = account?.reseller_credit_balance || 0;
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error('Insufficient reseller credit balance');
      }

      // Update balance
      const { error: updateError } = await SupabaseService.adminClient
        .from('accounts')
        .update({
          reseller_credit_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      logger.info('Reseller balance updated', { userId, amount, newBalance });
      return newBalance;
    } catch (error) {
      logger.error('Failed to update reseller balance', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get platform application fee percentage from settings
   * @returns {Promise<number>} Fee percentage (0-100)
   */
  static async getPlatformFeePercentage() {
    try {
      const { data } = await SupabaseService.adminClient
        .from('global_settings')
        .select('value')
        .eq('key', 'stripe_platform_fee_percentage')
        .single();

      return data?.value?.percentage || 10; // Default 10%
    } catch (error) {
      logger.error('Failed to get platform fee', { error: error.message });
      return 10; // Default 10%
    }
  }
}

module.exports = ConnectService;
