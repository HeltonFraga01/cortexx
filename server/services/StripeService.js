/**
 * StripeService - Core Stripe operations wrapper
 * 
 * Handles all Stripe API interactions including customers, products,
 * prices, checkout sessions, billing portal, and webhooks.
 * 
 * Requirements: 1.2, 2.1, 3.1, 5.6
 */

const Stripe = require('stripe');
const { logger } = require('../utils/logger');
const { 
  getStripeClient, 
  createTemporaryClient, 
  maskSecretKey,
  encrypt,
  clearCache 
} = require('../utils/stripeClient');
const SupabaseService = require('./SupabaseService');

class StripeService {
  /**
   * Validate Stripe API keys by making a test API call
   * @param {string} secretKey - Stripe secret key
   * @param {string} publishableKey - Stripe publishable key
   * @returns {Promise<{valid: boolean, error?: string, accountId?: string}>}
   */
  static async validateApiKeys(secretKey, publishableKey) {
    try {
      // Validate secret key format
      if (!secretKey || !secretKey.startsWith('sk_')) {
        return { valid: false, error: 'Invalid secret key format. Must start with sk_' };
      }

      // Validate publishable key format
      if (!publishableKey || !publishableKey.startsWith('pk_')) {
        return { valid: false, error: 'Invalid publishable key format. Must start with pk_' };
      }

      // Test the secret key by fetching account info
      const stripe = createTemporaryClient(secretKey);
      const account = await stripe.accounts.retrieve();

      logger.info('Stripe API keys validated', { accountId: account.id });
      return { valid: true, accountId: account.id };
    } catch (error) {
      logger.error('Stripe API key validation failed', { error: error.message });
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get Stripe account information
   * @returns {Promise<Object|null>}
   */
  static async getAccountInfo() {
    try {
      const stripe = await getStripeClient();
      if (!stripe) return null;

      const account = await stripe.accounts.retrieve();
      return {
        id: account.id,
        businessName: account.business_profile?.name,
        country: account.country,
        defaultCurrency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      };
    } catch (error) {
      logger.error('Failed to get Stripe account info', { error: error.message });
      return null;
    }
  }

  // ==================== Customer Operations ====================

  /**
   * Create a new Stripe customer
   * Best Practice: Use idempotency keys to prevent duplicate customers
   * @param {string} email - Customer email
   * @param {string} name - Customer name
   * @param {Object} metadata - Additional metadata
   * @param {string} idempotencyKey - Optional idempotency key
   * @returns {Promise<Object>}
   */
  static async createCustomer(email, name, metadata = {}, idempotencyKey = null) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const customerData = {
        email,
        name,
        metadata,
      };

      // Best Practice: Use idempotency keys to prevent duplicate customers on retries
      const createOptions = idempotencyKey ? { idempotencyKey } : {};
      const customer = await stripe.customers.create(customerData, createOptions);

      logger.info('Stripe customer created', { customerId: customer.id, email });
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Get a Stripe customer by ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Promise<Object|null>}
   */
  static async getCustomer(customerId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      logger.error('Failed to get Stripe customer', { error: error.message, customerId });
      return null;
    }
  }

  /**
   * Update a Stripe customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  static async updateCustomer(customerId, data) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const customer = await stripe.customers.update(customerId, data);
      logger.info('Stripe customer updated', { customerId });
      return customer;
    } catch (error) {
      logger.error('Failed to update Stripe customer', { error: error.message, customerId });
      throw error;
    }
  }

  // ==================== Product Operations ====================

  /**
   * Create a new Stripe product
   * Best Practice: Use idempotency keys for safe retries
   * @param {string} name - Product name
   * @param {string} description - Product description
   * @param {Object} metadata - Additional metadata
   * @param {string} idempotencyKey - Optional idempotency key
   * @returns {Promise<Object>}
   */
  static async createProduct(name, description, metadata = {}, idempotencyKey = null) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const productData = {
        name,
        description,
        metadata,
      };

      const createOptions = idempotencyKey ? { idempotencyKey } : {};
      const product = await stripe.products.create(productData, createOptions);

      logger.info('Stripe product created', { productId: product.id, name });
      return product;
    } catch (error) {
      logger.error('Failed to create Stripe product', { error: error.message, name });
      throw error;
    }
  }

  /**
   * Archive a Stripe product
   * @param {string} productId - Stripe product ID
   * @returns {Promise<Object>}
   */
  static async archiveProduct(productId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const product = await stripe.products.update(productId, { active: false });
      logger.info('Stripe product archived', { productId });
      return product;
    } catch (error) {
      logger.error('Failed to archive Stripe product', { error: error.message, productId });
      throw error;
    }
  }

  // ==================== Price Operations ====================

  /**
   * Create a new Stripe price
   * Best Practice: Use idempotency keys for safe retries
   * @param {string} productId - Stripe product ID
   * @param {number} unitAmount - Price in cents
   * @param {string} currency - Currency code (e.g., 'brl')
   * @param {Object} recurring - Recurring options (interval, interval_count)
   * @param {string} idempotencyKey - Optional idempotency key
   * @returns {Promise<Object>}
   */
  static async createPrice(productId, unitAmount, currency = 'brl', recurring = null, idempotencyKey = null) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const priceData = {
        product: productId,
        unit_amount: unitAmount,
        currency,
      };

      if (recurring) {
        priceData.recurring = recurring;
      }

      const createOptions = idempotencyKey ? { idempotencyKey } : {};
      const price = await stripe.prices.create(priceData, createOptions);
      
      logger.info('Stripe price created', { priceId: price.id, productId, unitAmount });
      return price;
    } catch (error) {
      logger.error('Failed to create Stripe price', { error: error.message, productId });
      throw error;
    }
  }

  /**
   * Archive a Stripe price
   * @param {string} priceId - Stripe price ID
   * @returns {Promise<Object>}
   */
  static async archivePrice(priceId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const price = await stripe.prices.update(priceId, { active: false });
      logger.info('Stripe price archived', { priceId });
      return price;
    } catch (error) {
      logger.error('Failed to archive Stripe price', { error: error.message, priceId });
      throw error;
    }
  }

  // ==================== Checkout Operations ====================

  /**
   * Create a Stripe Checkout Session
   * Best Practice: Uses Checkout Sessions API (recommended over PaymentIntents for standard flows)
   * Best Practice: Dynamic payment methods enabled (no hardcoded payment_method_types)
   * @param {Object} options - Checkout options
   * @returns {Promise<Object>}
   */
  static async createCheckoutSession(options) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const {
        customerId,
        priceId,
        mode = 'subscription', // 'subscription' or 'payment'
        successUrl,
        cancelUrl,
        metadata = {},
        allowPromotionCodes = true,
        billingAddressCollection = 'auto',
        quantity = 1,
        idempotencyKey = null,
      } = options;

      const sessionData = {
        mode,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        allow_promotion_codes: allowPromotionCodes,
        billing_address_collection: billingAddressCollection,
        // Best Practice: Don't hardcode payment_method_types - let Stripe choose dynamically
        // based on customer location, available wallets, and preferences
        // Enable dynamic payment methods in Stripe Dashboard instead
        line_items: [
          {
            price: priceId,
            quantity,
          },
        ],
        // Best Practice: Enable automatic tax calculation if configured
        automatic_tax: { enabled: true },
        // Best Practice: Collect phone for better fraud detection
        phone_number_collection: { enabled: true },
      };

      if (customerId) {
        sessionData.customer = customerId;
        // Best Practice: Update customer info from checkout
        sessionData.customer_update = {
          address: 'auto',
          name: 'auto',
        };
      }

      // Best Practice: Use idempotency keys to prevent duplicate charges
      const createOptions = idempotencyKey ? { idempotencyKey } : {};
      const session = await stripe.checkout.sessions.create(sessionData, createOptions);
      
      logger.info('Checkout session created', { 
        sessionId: session.id, 
        mode,
        customerId,
        priceId,
      });
      return session;
    } catch (error) {
      logger.error('Failed to create checkout session', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a Stripe Billing Portal session
   * @param {string} customerId - Stripe customer ID
   * @param {string} returnUrl - URL to return to after portal
   * @returns {Promise<Object>}
   */
  static async createBillingPortalSession(customerId, returnUrl) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      logger.info('Billing portal session created', { customerId });
      return session;
    } catch (error) {
      logger.error('Failed to create billing portal session', { error: error.message, customerId });
      throw error;
    }
  }

  // ==================== Subscription Operations ====================

  /**
   * Get a subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object|null>}
   */
  static async getSubscription(subscriptionId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Failed to get subscription', { error: error.message, subscriptionId });
      return null;
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {boolean} cancelAtPeriodEnd - Whether to cancel at period end
   * @returns {Promise<Object>}
   */
  static async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      let subscription;
      if (cancelAtPeriodEnd) {
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        subscription = await stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('Subscription canceled', { subscriptionId, cancelAtPeriodEnd });
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', { error: error.message, subscriptionId });
      throw error;
    }
  }

  /**
   * Reactivate a canceled subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>}
   */
  static async reactivateSubscription(subscriptionId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      logger.info('Subscription reactivated', { subscriptionId });
      return subscription;
    } catch (error) {
      logger.error('Failed to reactivate subscription', { error: error.message, subscriptionId });
      throw error;
    }
  }

  // ==================== Invoice Operations ====================

  /**
   * List invoices for a customer
   * @param {string} customerId - Stripe customer ID
   * @param {number} limit - Number of invoices to return
   * @returns {Promise<Array>}
   */
  static async listInvoices(customerId, limit = 12) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data;
    } catch (error) {
      logger.error('Failed to list invoices', { error: error.message, customerId });
      return [];
    }
  }

  // ==================== Webhook Operations ====================

  /**
   * Verify webhook signature
   * @param {string|Buffer} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @param {string} webhookSecret - Webhook endpoint secret
   * @returns {Object} Verified event
   */
  static verifyWebhookSignature(payload, signature, webhookSecret) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
        apiVersion: '2024-11-20.acacia',
      });

      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (error) {
      logger.error('Webhook signature verification failed', { error: error.message });
      throw error;
    }
  }

  // ==================== Settings Operations ====================

  /**
   * Save Stripe settings to global_settings
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>}
   */
  static async saveSettings(settings) {
    try {
      const { secretKey, publishableKey, webhookSecret, connectEnabled } = settings;

      // Save each setting
      const settingsToSave = [
        { key: 'stripe_secret_key', value: { key: encrypt(secretKey) } },
        { key: 'stripe_publishable_key', value: { key: publishableKey } },
        { key: 'stripe_webhook_secret', value: { key: encrypt(webhookSecret) } },
        { key: 'stripe_connect_enabled', value: { enabled: connectEnabled } },
      ];

      for (const setting of settingsToSave) {
        if (setting.value.key === null && setting.value.enabled === undefined) continue;

        const { data: existing } = await SupabaseService.adminClient
          .from('global_settings')
          .select('id')
          .eq('key', setting.key)
          .single();

        if (existing) {
          await SupabaseService.adminClient
            .from('global_settings')
            .update({ value: setting.value, updated_at: new Date().toISOString() })
            .eq('key', setting.key);
        } else {
          await SupabaseService.adminClient
            .from('global_settings')
            .insert({ key: setting.key, value: setting.value });
        }
      }

      // Clear cached Stripe instance
      clearCache();

      logger.info('Stripe settings saved');
      return true;
    } catch (error) {
      logger.error('Failed to save Stripe settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Stripe settings (masked)
   * @returns {Promise<Object>}
   */
  static async getSettings() {
    try {
      const { data: settings } = await SupabaseService.adminClient
        .from('global_settings')
        .select('key, value')
        .in('key', ['stripe_secret_key', 'stripe_publishable_key', 'stripe_webhook_secret', 'stripe_connect_enabled']);

      const result = {
        secretKeyMasked: '',
        publishableKey: '',
        webhookSecretMasked: '',
        connectEnabled: false,
        isConfigured: false,
      };

      for (const setting of settings || []) {
        switch (setting.key) {
          case 'stripe_secret_key':
            if (setting.value?.key) {
              result.secretKeyMasked = maskSecretKey(setting.value.key);
              result.isConfigured = true;
            }
            break;
          case 'stripe_publishable_key':
            result.publishableKey = setting.value?.key || '';
            break;
          case 'stripe_webhook_secret':
            if (setting.value?.key) {
              result.webhookSecretMasked = maskSecretKey(setting.value.key);
            }
            break;
          case 'stripe_connect_enabled':
            result.connectEnabled = setting.value?.enabled || false;
            break;
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get Stripe settings', { error: error.message });
      return {
        secretKeyMasked: '',
        publishableKey: '',
        webhookSecretMasked: '',
        connectEnabled: false,
        isConfigured: false,
      };
    }
  }
}

module.exports = StripeService;
