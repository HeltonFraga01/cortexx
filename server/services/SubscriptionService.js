/**
 * SubscriptionService - Service for managing user subscriptions
 * 
 * Handles subscription assignment, status management, proration calculation,
 * and billing cycle processing.
 * 
 * Migrated to use SupabaseService directly.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');
const StripeService = require('./StripeService');
const PlanService = require('./PlanService');
const { normalizeToUUID, isUUID, isWuzapiHash } = require('../utils/userIdHelper');

const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'cancelled',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended'
};

const ACTIVE_STATUSES = [SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.ACTIVE];
const READ_ONLY_STATUSES = [SUBSCRIPTION_STATUS.EXPIRED, SUBSCRIPTION_STATUS.SUSPENDED];

class SubscriptionService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Create an account for a user who doesn't have one yet
   * @param {string} userId - WUZAPI user ID (32-char hash or UUID)
   * @returns {Promise<string|null>} Account ID or null if failed
   */
  async createAccountForUser(userId) {
    try {
      // Use helper to normalize to UUID format
      const uuidUserId = normalizeToUUID(userId);
      
      if (!uuidUserId) {
        logger.error('Invalid userId format for account creation', { userId: userId?.substring(0, 8) + '...' });
        return null;
      }

      const now = new Date().toISOString();
      const accountId = this.generateId();

      const { data: newAccount, error } = await SupabaseService.insert('accounts', {
        id: accountId,
        name: `Account - ${userId.substring(0, 8)}`,
        owner_user_id: uuidUserId,
        wuzapi_token: userId, // Keep original format for WUZAPI compatibility
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        status: 'active',
        settings: {
          maxAgents: 10,
          maxInboxes: 5,
          maxTeams: 5,
          features: ['messaging', 'webhooks', 'contacts']
        },
        created_at: now,
        updated_at: now
      });

      if (error) {
        logger.error('Failed to create account for user', { userId, error: error.message });
        return null;
      }

      logger.info('Account created automatically for user', { accountId, userId });
      return accountId;
    } catch (error) {
      logger.error('Error creating account for user', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Get account_id from user_id (which is the WUZAPI user hash or UUID)
   * The user_id maps to accounts.owner_user_id
   * 
   * Uses userIdHelper for consistent ID normalization.
   */
  async getAccountIdFromUserId(userId) {
    try {
      // Use helper to normalize to UUID format
      const uuidUserId = normalizeToUUID(userId);
      
      if (!uuidUserId) {
        logger.debug('Invalid userId format', { userId: userId?.substring(0, 8) + '...' });
        return null;
      }

      const { data: accounts, error } = await SupabaseService.getMany('accounts', { owner_user_id: uuidUserId });
      
      if (error) throw error;
      if (!accounts || accounts.length === 0) {
        // Try by wuzapi_token as fallback (for legacy compatibility)
        const { data: accountsByToken } = await SupabaseService.getMany('accounts', { wuzapi_token: userId });
        if (accountsByToken && accountsByToken.length > 0) {
          return accountsByToken[0].id;
        }
        return null;
      }
      
      return accounts[0].id;
    } catch (error) {
      logger.debug('Could not find account for userId', { userId, error: error.message });
      return null;
    }
  }

  async assignPlan(userId, planId, adminId) {
    try {
      const now = new Date();
      let accountId = await this.getAccountIdFromUserId(userId);
      
      // If no account exists, create one automatically
      if (!accountId) {
        logger.info('No account found for user, creating one automatically', { userId });
        accountId = await this.createAccountForUser(userId);
        
        if (!accountId) {
          throw new Error('Failed to create account for user.');
        }
      }

      // Get account to validate tenant
      const { data: account, error: accountError } = await SupabaseService.getById('accounts', accountId);
      if (accountError) throw accountError;
      if (!account) {
        throw new Error('Account not found');
      }

      // Validate that the plan belongs to the account's tenant
      const { data: plan, error: planError } = await SupabaseService.getById('tenant_plans', planId);
      if (planError) throw planError;
      if (!plan) {
        throw new Error('Plan not found');
      }
      if (plan.tenant_id !== account.tenant_id) {
        throw new Error('Plan does not belong to the account\'s tenant');
      }
      
      const existingSubscription = await this.getUserSubscription(userId);

      if (existingSubscription) {
        // Update existing subscription
        const { error } = await SupabaseService.update('user_subscriptions', existingSubscription.id, {
          plan_id: planId,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          updated_at: now.toISOString()
        });
        
        if (error) throw error;
        logger.info('Plan assigned to existing subscription', { 
          userId, 
          accountId, 
          planId, 
          tenantId: account.tenant_id,
          adminId 
        });
      } else {
        // Create new subscription
        const id = this.generateId();
        const periodEnd = this.calculatePeriodEnd(now, plan.billing_cycle || 'monthly');
        
        const { error } = await SupabaseService.insert('user_subscriptions', {
          id,
          account_id: accountId,
          plan_id: planId,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
        
        if (error) throw error;
        logger.info('New subscription created', { 
          userId, 
          accountId, 
          planId, 
          tenantId: account.tenant_id,
          adminId 
        });
      }

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to assign plan', { error: error.message, userId, planId });
      throw error;
    }
  }

  async getUserSubscription(userId) {
    try {
      // First get account_id from userId
      const accountId = await this.getAccountIdFromUserId(userId);
      
      if (!accountId) {
        // No account found - return null (user may not have an account yet)
        return null;
      }
      
      // Get subscription with tenant plan data using Supabase query builder
      const { data: subscriptions, error } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select(`
          *,
          tenant_plans (
            id,
            name,
            price_cents,
            billing_cycle,
            quotas,
            features,
            tenant_id
          )
        `)
        .eq('account_id', accountId)
        .limit(1);

      if (error) {
        logger.error('Failed to get subscription', { error: error.message, userId, accountId });
        throw error;
      }

      if (!subscriptions || subscriptions.length === 0) {
        return null;
      }

      return this.formatSubscription(subscriptions[0], userId);
    } catch (error) {
      logger.error('Failed to get subscription', { error: error.message, userId });
      throw error;
    }
  }

  async updateSubscriptionStatus(userId, status, reason = null) {
    try {
      const validStatuses = Object.values(SUBSCRIPTION_STATUS);
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found for user');
      }

      const now = new Date().toISOString();
      const updateData = {
        status,
        updated_at: now
      };

      if (status === SUBSCRIPTION_STATUS.CANCELED) {
        updateData.cancelled_at = now;
      }

      const { error } = await SupabaseService.update('user_subscriptions', subscription.id, updateData);

      if (error) throw error;

      logger.info('Subscription status updated', { userId, subscriptionId: subscription.id, status, reason });

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to update subscription status', { error: error.message, userId, status });
      throw error;
    }
  }

  async calculateProration(userId, newPlanId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return { proratedAmount: 0, daysRemaining: 0, credit: 0 };
      }

      // Get new plan price
      const { data: plan, error } = await SupabaseService.getById('tenant_plans', newPlanId);

      if (error) throw error;
      if (!plan) {
        throw new Error('Plan not found');
      }

      const newPlanPrice = plan.price_cents;
      const currentPlanPrice = subscription.plan?.priceCents || 0;

      const now = new Date();
      const periodEnd = new Date(subscription.currentPeriodEnd);
      const periodStart = new Date(subscription.currentPeriodStart);
      
      const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)));

      const dailyRateCurrent = currentPlanPrice / totalDays;
      const dailyRateNew = newPlanPrice / totalDays;
      
      const credit = Math.round(dailyRateCurrent * daysRemaining);
      const charge = Math.round(dailyRateNew * daysRemaining);
      const proratedAmount = charge - credit;

      return {
        proratedAmount,
        daysRemaining,
        credit,
        charge,
        currentPlanPrice,
        newPlanPrice
      };
    } catch (error) {
      logger.error('Failed to calculate proration', { error: error.message, userId, newPlanId });
      throw error;
    }
  }

  async processBillingCycle(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const now = new Date();
      const periodEnd = new Date(subscription.currentPeriodEnd);

      if (now < periodEnd) {
        return subscription;
      }

      const newPeriodStart = periodEnd;
      const newPeriodEnd = this.calculatePeriodEnd(newPeriodStart, subscription.plan?.billingCycle || 'monthly');

      const { error } = await SupabaseService.update('user_subscriptions', subscription.id, {
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        updated_at: now.toISOString()
      });

      if (error) throw error;

      logger.info('Billing cycle processed', { userId, newPeriodStart, newPeriodEnd });

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to process billing cycle', { error: error.message, userId });
      throw error;
    }
  }

  async isUserActive(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return false;
      }
      return ACTIVE_STATUSES.includes(subscription.status);
    } catch (error) {
      logger.error('Failed to check user active status', { error: error.message, userId });
      return false;
    }
  }

  async isUserReadOnly(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return false;
      }
      return READ_ONLY_STATUSES.includes(subscription.status);
    } catch (error) {
      logger.error('Failed to check user read-only status', { error: error.message, userId });
      return false;
    }
  }

  calculatePeriodEnd(startDate, billingCycle) {
    const date = new Date(startDate);
    
    switch (billingCycle) {
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'lifetime':
        date.setFullYear(date.getFullYear() + 100);
        break;
      case 'monthly':
      default:
        date.setMonth(date.getMonth() + 1);
        break;
    }
    
    return date;
  }

  formatSubscription(row, userId) {
    const plan = row.tenant_plans;
    const quotas = plan?.quotas || {};
    
    return {
      id: row.id,
      userId: userId,
      accountId: row.account_id,
      planId: row.plan_id,
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      canceledAt: row.cancelled_at,
      externalSubscriptionId: row.external_subscription_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        priceCents: plan.price_cents,
        billingCycle: plan.billing_cycle,
        tenantId: plan.tenant_id,
        quotas: {
          maxAgents: quotas.max_agents || 1,
          maxConnections: quotas.max_connections || 1,
          maxMessagesPerDay: quotas.max_messages_per_day || 100,
          maxMessagesPerMonth: quotas.max_messages_per_month || 3000,
          maxInboxes: quotas.max_inboxes || 1,
          maxTeams: quotas.max_teams || 1,
          maxWebhooks: quotas.max_webhooks || 5,
          maxCampaigns: quotas.max_campaigns || 1,
          maxStorageMb: quotas.max_storage_mb || 100,
          maxBots: quotas.max_bots || 3,
          maxBotMessagesPerDay: quotas.max_bot_messages_per_day || 100,
          maxBotMessagesPerMonth: quotas.max_bot_messages_per_month || 3000
        },
        features: this.parseJSON(plan.features, {})
      } : null
    };
  }

  parseJSON(jsonValue, defaultValue = {}) {
    try {
      if (typeof jsonValue === 'string') {
        return JSON.parse(jsonValue);
      }
      return jsonValue || defaultValue;
    } catch {
      return defaultValue;
    }
  }

  // ==================== Stripe Integration Methods ====================

  /**
   * Create a Stripe Checkout Session for subscription
   * Requirements: 3.1, 3.2
   * @param {string} userId - User ID
   * @param {string} planId - Plan ID to subscribe to
   * @param {string} successUrl - URL to redirect on success
   * @param {string} cancelUrl - URL to redirect on cancel
   * @returns {Promise<Object>} Checkout session with URL
   */
  async createSubscriptionCheckout(userId, planId, successUrl, cancelUrl) {
    try {
      // Get or create account for user
      let accountId = await this.getAccountIdFromUserId(userId);
      if (!accountId) {
        accountId = await this.createAccountForUser(userId);
        if (!accountId) {
          throw new Error('Failed to create account for user');
        }
      }

      // Get account to check for existing Stripe customer
      const { data: account, error: accountError } = await SupabaseService.getById('accounts', accountId);
      if (accountError) throw accountError;

      // Get tenant plan with Stripe price ID
      const { data: plan, error: planError } = await SupabaseService.getById('tenant_plans', planId);
      if (planError) throw planError;
      if (!plan) {
        throw new Error('Plan not found');
      }
      if (!plan.stripe_price_id) {
        throw new Error('Plan is not synced with Stripe. Please sync the plan first.');
      }

      // Validate that the plan belongs to the account's tenant
      if (plan.tenant_id !== account.tenant_id) {
        throw new Error('Plan does not belong to the account\'s tenant');
      }

      // Get or create Stripe customer
      let stripeCustomerId = account.stripe_customer_id;
      if (!stripeCustomerId) {
        const customer = await StripeService.createCustomer(
          account.email || `user-${userId}@placeholder.com`,
          account.name || `User ${userId.substring(0, 8)}`,
          { accountId, userId }
        );
        stripeCustomerId = customer.id;

        // Save Stripe customer ID to account
        await SupabaseService.update('accounts', accountId, {
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString()
        });
      }

      // Create Checkout Session
      const session = await StripeService.createCheckoutSession({
        customerId: stripeCustomerId,
        priceId: plan.stripe_price_id,
        mode: 'subscription',
        successUrl: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl,
        metadata: {
          userId,
          accountId,
          planId,
          tenantId: account.tenant_id
        }
      });

      logger.info('Subscription checkout session created', {
        userId,
        accountId,
        planId,
        sessionId: session.id
      });

      return {
        url: session.url,
        sessionId: session.id
      };
    } catch (error) {
      logger.error('Failed to create subscription checkout', {
        error: error.message,
        userId,
        planId
      });
      throw error;
    }
  }

  /**
   * Sync subscription from Stripe webhook event
   * Requirements: 5.1, 5.2, 5.3
   * @param {Object} stripeSubscription - Stripe subscription object
   * @returns {Promise<Object>} Updated subscription
   */
  async syncSubscriptionFromWebhook(stripeSubscription) {
    try {
      const stripeSubscriptionId = stripeSubscription.id;
      const stripeCustomerId = stripeSubscription.customer;
      const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id;

      // Find account by Stripe customer ID
      const { data: accounts, error: accountError } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, owner_user_id, wuzapi_token')
        .eq('stripe_customer_id', stripeCustomerId)
        .limit(1);

      if (accountError) throw accountError;
      if (!accounts || accounts.length === 0) {
        throw new Error(`No account found for Stripe customer: ${stripeCustomerId}`);
      }

      const account = accounts[0];
      const accountId = account.id;
      const userId = account.wuzapi_token || account.owner_user_id;

      // Find plan by Stripe price ID
      const { data: plans, error: planError } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('id')
        .eq('stripe_price_id', stripePriceId)
        .limit(1);

      if (planError) throw planError;
      const planId = plans?.[0]?.id;

      // Map Stripe status to local status
      const statusMap = {
        'active': SUBSCRIPTION_STATUS.ACTIVE,
        'trialing': SUBSCRIPTION_STATUS.TRIAL,
        'past_due': SUBSCRIPTION_STATUS.PAST_DUE,
        'canceled': SUBSCRIPTION_STATUS.CANCELED,
        'unpaid': SUBSCRIPTION_STATUS.PAST_DUE,
        'incomplete': SUBSCRIPTION_STATUS.SUSPENDED,
        'incomplete_expired': SUBSCRIPTION_STATUS.EXPIRED
      };
      const localStatus = statusMap[stripeSubscription.status] || SUBSCRIPTION_STATUS.ACTIVE;

      // Check for existing subscription
      const { data: existingSubs, error: subError } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select('id')
        .eq('account_id', accountId)
        .limit(1);

      if (subError) throw subError;

      const now = new Date().toISOString();
      const subscriptionData = {
        plan_id: planId,
        status: localStatus,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
        updated_at: now
      };

      if (stripeSubscription.canceled_at) {
        subscriptionData.cancelled_at = new Date(stripeSubscription.canceled_at * 1000).toISOString();
      }

      if (existingSubs && existingSubs.length > 0) {
        // Update existing subscription
        await SupabaseService.update('user_subscriptions', existingSubs[0].id, subscriptionData);
        logger.info('Subscription synced from webhook (updated)', {
          subscriptionId: existingSubs[0].id,
          stripeSubscriptionId,
          status: localStatus
        });
      } else {
        // Create new subscription
        subscriptionData.id = this.generateId();
        subscriptionData.account_id = accountId;
        subscriptionData.created_at = now;
        await SupabaseService.insert('user_subscriptions', subscriptionData);
        logger.info('Subscription synced from webhook (created)', {
          subscriptionId: subscriptionData.id,
          stripeSubscriptionId,
          status: localStatus
        });
      }

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to sync subscription from webhook', {
        error: error.message,
        stripeSubscriptionId: stripeSubscription?.id
      });
      throw error;
    }
  }

  /**
   * Cancel subscription via Stripe
   * Requirements: 4.3, 4.4
   * @param {string} userId - User ID
   * @param {boolean} cancelAtPeriodEnd - Whether to cancel at period end
   * @returns {Promise<Object>} Updated subscription
   */
  async cancelSubscriptionViaStripe(userId, cancelAtPeriodEnd = true) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found for user');
      }

      // Get Stripe subscription ID
      const { data: subData, error: subError } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select('stripe_subscription_id')
        .eq('id', subscription.id)
        .single();

      if (subError) throw subError;
      if (!subData?.stripe_subscription_id) {
        throw new Error('Subscription is not linked to Stripe');
      }

      // Cancel in Stripe
      await StripeService.cancelSubscription(subData.stripe_subscription_id, cancelAtPeriodEnd);

      // Update local subscription
      const updateData = {
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString()
      };

      if (!cancelAtPeriodEnd) {
        updateData.status = SUBSCRIPTION_STATUS.CANCELED;
        updateData.cancelled_at = new Date().toISOString();
      }

      await SupabaseService.update('user_subscriptions', subscription.id, updateData);

      logger.info('Subscription canceled via Stripe', {
        userId,
        subscriptionId: subscription.id,
        cancelAtPeriodEnd
      });

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to cancel subscription via Stripe', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Reactivate a canceled subscription via Stripe
   * Requirements: 4.5
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated subscription
   */
  async reactivateSubscriptionViaStripe(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found for user');
      }

      // Get Stripe subscription ID
      const { data: subData, error: subError } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select('stripe_subscription_id, cancel_at_period_end')
        .eq('id', subscription.id)
        .single();

      if (subError) throw subError;
      if (!subData?.stripe_subscription_id) {
        throw new Error('Subscription is not linked to Stripe');
      }

      if (!subData.cancel_at_period_end) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate in Stripe
      await StripeService.reactivateSubscription(subData.stripe_subscription_id);

      // Update local subscription
      await SupabaseService.update('user_subscriptions', subscription.id, {
        cancel_at_period_end: false,
        cancelled_at: null,
        updated_at: new Date().toISOString()
      });

      logger.info('Subscription reactivated via Stripe', {
        userId,
        subscriptionId: subscription.id
      });

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to reactivate subscription via Stripe', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Get subscription details including Stripe info
   * Requirements: 4.1
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription with payment details
   */
  async getSubscriptionWithStripeDetails(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return null;
      }

      // Get Stripe subscription ID
      const { data: subData, error: subError } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select('stripe_subscription_id, cancel_at_period_end')
        .eq('id', subscription.id)
        .single();

      if (subError) throw subError;

      const result = {
        ...subscription,
        stripeSubscriptionId: subData?.stripe_subscription_id,
        cancelAtPeriodEnd: subData?.cancel_at_period_end || false,
        paymentMethod: null
      };

      // Get payment method from Stripe if available
      if (subData?.stripe_subscription_id) {
        try {
          const stripeSubscription = await StripeService.getSubscription(subData.stripe_subscription_id);
          if (stripeSubscription?.default_payment_method) {
            const pm = stripeSubscription.default_payment_method;
            if (pm.card) {
              result.paymentMethod = {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year
              };
            }
          }
        } catch (stripeError) {
          logger.warn('Could not fetch Stripe subscription details', {
            error: stripeError.message,
            stripeSubscriptionId: subData.stripe_subscription_id
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get subscription with Stripe details', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

SubscriptionService.SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS;
SubscriptionService.ACTIVE_STATUSES = ACTIVE_STATUSES;
SubscriptionService.READ_ONLY_STATUSES = READ_ONLY_STATUSES;

module.exports = SubscriptionService;
