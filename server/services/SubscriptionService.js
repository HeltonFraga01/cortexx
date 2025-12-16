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
  CANCELED: 'canceled',
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

  async assignPlan(userId, planId, adminId) {
    try {
      const now = new Date();
      const existingSubscription = await this.getUserSubscription(userId);

      if (existingSubscription) {
        await this.db.query(
          'UPDATE user_subscriptions SET plan_id = ?, status = ?, updated_at = ? WHERE user_id = ?',
          [planId, SUBSCRIPTION_STATUS.ACTIVE, now.toISOString(), userId]
        );
        
        logger.info('Plan assigned to existing subscription', { userId, planId, adminId });
      } else {
        const id = this.generateId();
        const periodEnd = this.calculatePeriodEnd(now, 'monthly');
        
        await this.db.query(`
          INSERT INTO user_subscriptions (
            id, user_id, plan_id, status, started_at, 
            current_period_start, current_period_end, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, userId, planId, SUBSCRIPTION_STATUS.ACTIVE,
          now.toISOString(), now.toISOString(), periodEnd.toISOString(),
          now.toISOString(), now.toISOString()
        ]);
        
        logger.info('New subscription created', { userId, planId, adminId });
      }

      return this.getUserSubscription(userId);
    } catch (error) {
      logger.error('Failed to assign plan', { error: error.message, userId, planId });
      throw error;
    }
  }

  async getUserSubscription(userId) {
    try {
      const { rows } = await this.db.query(`
        SELECT s.*, p.name as plan_name, p.price_cents, p.billing_cycle,
               p.max_agents, p.max_connections, p.max_messages_per_day,
               p.max_messages_per_month, p.max_inboxes, p.max_teams,
               p.max_webhooks, p.max_campaigns, p.max_storage_mb, p.max_bots, p.features
        FROM user_subscriptions s
        LEFT JOIN plans p ON s.plan_id = p.id
        WHERE s.user_id = ?
      `, [userId]);

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.formatSubscription(rows[0]);
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

      const now = new Date().toISOString();
      let sql = 'UPDATE user_subscriptions SET status = ?, updated_at = ?';
      const params = [status, now];

      if (status === SUBSCRIPTION_STATUS.CANCELED) {
        sql += ', canceled_at = ?';
        params.push(now);
      }

      if (status === SUBSCRIPTION_STATUS.SUSPENDED && reason) {
        sql += ', suspension_reason = ?';
        params.push(reason);
      }

      sql += ' WHERE user_id = ?';
      params.push(userId);

      await this.db.query(sql, params);

      logger.info('Subscription status updated', { userId, status, reason });

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

      const { rows } = await this.db.query('SELECT price_cents FROM plans WHERE id = ?', [newPlanId]);
      if (!rows || rows.length === 0) {
        throw new Error('Plan not found');
      }

      const newPlanPrice = rows[0].price_cents;
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

      await this.db.query(
        'UPDATE user_subscriptions SET current_period_start = ?, current_period_end = ?, updated_at = ? WHERE user_id = ?',
        [newPeriodStart.toISOString(), newPeriodEnd.toISOString(), now.toISOString(), userId]
      );

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

  formatSubscription(row) {
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      status: row.status,
      startedAt: row.started_at,
      trialEndsAt: row.trial_ends_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      canceledAt: row.canceled_at,
      suspensionReason: row.suspension_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      plan: row.plan_name ? {
        id: row.plan_id,
        name: row.plan_name,
        priceCents: row.price_cents,
        billingCycle: row.billing_cycle,
        quotas: {
          maxAgents: row.max_agents,
          maxConnections: row.max_connections,
          maxMessagesPerDay: row.max_messages_per_day,
          maxMessagesPerMonth: row.max_messages_per_month,
          maxInboxes: row.max_inboxes,
          maxTeams: row.max_teams,
          maxWebhooks: row.max_webhooks,
          maxCampaigns: row.max_campaigns,
          maxStorageMb: row.max_storage_mb,
          maxBots: row.max_bots || 3
        },
        features: this.parseJSON(row.features, {})
      } : null
    };
  }

  parseJSON(jsonString, defaultValue = {}) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

SubscriptionService.SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS;
SubscriptionService.ACTIVE_STATUSES = ACTIVE_STATUSES;
SubscriptionService.READ_ONLY_STATUSES = READ_ONLY_STATUSES;

module.exports = SubscriptionService;
