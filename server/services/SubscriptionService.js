/**
 * SubscriptionService - Service for managing user subscriptions
 * 
 * Handles subscription assignment, status management, proration calculation,
 * and billing cycle processing.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

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
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get account_id from user_id (which is the WUZAPI user hash)
   * The user_id maps to accounts.owner_user_id
   */
  async getAccountIdFromUserId(userId) {
    try {
      const { data: accounts, error } = await this.db.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId).limit(1)
      );
      
      if (error) throw error;
      if (!accounts || accounts.length === 0) return null;
      
      return accounts[0].id;
    } catch (error) {
      logger.debug('Could not find account for userId', { userId, error: error.message });
      return null;
    }
  }

  async assignPlan(userId, planId, adminId) {
    try {
      const now = new Date();
      const accountId = await this.getAccountIdFromUserId(userId);
      
      if (!accountId) {
        logger.warn('No account found for user, cannot assign plan', { userId });
        return null;
      }
      
      const existingSubscription = await this.getUserSubscription(userId);

      if (existingSubscription) {
        // Update existing subscription
        const { error } = await this.db.queryAsAdmin('user_subscriptions', (query) =>
          query.update({
            plan_id: planId,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            updated_at: now.toISOString()
          }).eq('account_id', accountId)
        );
        
        if (error) throw error;
        logger.info('Plan assigned to existing subscription', { userId, accountId, planId, adminId });
      } else {
        // Create new subscription
        const id = this.generateId();
        const periodEnd = this.calculatePeriodEnd(now, 'monthly');
        
        const { error } = await this.db.queryAsAdmin('user_subscriptions', (query) =>
          query.insert({
            id,
            account_id: accountId,
            plan_id: planId,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          })
        );
        
        if (error) throw error;
        logger.info('New subscription created', { userId, accountId, planId, adminId });
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
      
      // Get subscription with plan data using Supabase query builder
      const { data: subscriptions, error } = await this.db.queryAsAdmin('user_subscriptions', (query) =>
        query.select(`
          *,
          plans (
            id,
            name,
            price_cents,
            billing_cycle,
            quotas,
            features
          )
        `).eq('account_id', accountId).limit(1)
      );

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

      const accountId = await this.getAccountIdFromUserId(userId);
      if (!accountId) {
        throw new Error('No account found for user');
      }

      const now = new Date().toISOString();
      const updateData = {
        status,
        updated_at: now
      };

      if (status === SUBSCRIPTION_STATUS.CANCELED) {
        updateData.cancelled_at = now;
      }

      const { error } = await this.db.queryAsAdmin('user_subscriptions', (query) =>
        query.update(updateData).eq('account_id', accountId)
      );

      if (error) throw error;

      logger.info('Subscription status updated', { userId, accountId, status, reason });

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
      const { data: plans, error } = await this.db.queryAsAdmin('plans', (query) =>
        query.select('price_cents').eq('id', newPlanId).limit(1)
      );

      if (error) throw error;
      if (!plans || plans.length === 0) {
        throw new Error('Plan not found');
      }

      const newPlanPrice = plans[0].price_cents;
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

      const accountId = await this.getAccountIdFromUserId(userId);
      if (!accountId) {
        throw new Error('No account found for user');
      }

      const newPeriodStart = periodEnd;
      const newPeriodEnd = this.calculatePeriodEnd(newPeriodStart, subscription.plan?.billingCycle || 'monthly');

      const { error } = await this.db.queryAsAdmin('user_subscriptions', (query) =>
        query.update({
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          updated_at: now.toISOString()
        }).eq('account_id', accountId)
      );

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
    const plan = row.plans;
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
}

SubscriptionService.SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS;
SubscriptionService.ACTIVE_STATUSES = ACTIVE_STATUSES;
SubscriptionService.READ_ONLY_STATUSES = READ_ONLY_STATUSES;

module.exports = SubscriptionService;
