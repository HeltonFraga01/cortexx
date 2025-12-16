/**
 * SubscriptionEnsurer - Service for ensuring users have subscriptions
 * 
 * Handles automatic assignment of default plan to users without subscriptions
 * and migration of existing users.
 * 
 * Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4
 */

const { logger } = require('../utils/logger');
const SubscriptionService = require('./SubscriptionService');
const PlanService = require('./PlanService');

class SubscriptionEnsurer {
  constructor(db) {
    this.db = db;
    this.subscriptionService = new SubscriptionService(db);
    this.planService = new PlanService(db);
  }

  /**
   * Ensures a user has an active subscription
   * If no subscription exists, assigns the default plan
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} The user's subscription or null if no default plan
   */
  async ensureSubscription(userId) {
    try {
      // Check if user already has a subscription
      const existing = await this.subscriptionService.getUserSubscription(userId);
      if (existing) {
        logger.debug('User already has subscription', { userId, planId: existing.planId });
        return existing;
      }

      // Get default plan
      const defaultPlan = await this.planService.getDefaultPlan();
      if (!defaultPlan) {
        logger.warn('No default plan found, cannot assign subscription', { userId });
        return null;
      }

      // Assign default plan to user
      logger.info('Assigning default plan to user', { userId, planId: defaultPlan.id, planName: defaultPlan.name });
      const subscription = await this.subscriptionService.assignPlan(userId, defaultPlan.id, 'system');
      
      return subscription;
    } catch (error) {
      logger.error('Failed to ensure subscription', { error: error.message, userId });
      // Don't throw - we don't want to block the user from using the system
      return null;
    }
  }

  /**
   * Migrates all users without subscriptions to the default plan
   * Users are identified by owner_user_id in the accounts table
   * 
   * @returns {Promise<{migrated: number, failed: number, skipped: number}>}
   */
  async migrateUsersWithoutSubscription() {
    const stats = { migrated: 0, failed: 0, skipped: 0 };
    
    try {
      // Get default plan
      const defaultPlan = await this.planService.getDefaultPlan();
      if (!defaultPlan) {
        logger.error('No default plan found, cannot migrate users');
        return stats;
      }

      // Find all users (account owners) without subscriptions
      // Users are identified by owner_user_id in the accounts table
      const { rows: usersWithoutSub } = await this.db.query(`
        SELECT DISTINCT a.owner_user_id as id
        FROM accounts a
        LEFT JOIN user_subscriptions s ON a.owner_user_id = s.user_id
        WHERE s.id IS NULL
      `);

      if (!usersWithoutSub || usersWithoutSub.length === 0) {
        logger.info('No users without subscriptions found');
        return stats;
      }

      logger.info('Starting migration of users without subscriptions', { 
        userCount: usersWithoutSub.length, 
        defaultPlanId: defaultPlan.id,
        defaultPlanName: defaultPlan.name
      });

      // Migrate each user
      for (const user of usersWithoutSub) {
        try {
          await this.subscriptionService.assignPlan(user.id, defaultPlan.id, 'system-migration');
          stats.migrated++;
          logger.info('User migrated to default plan', { userId: user.id, planId: defaultPlan.id });
        } catch (error) {
          stats.failed++;
          logger.error('Failed to migrate user', { userId: user.id, error: error.message });
        }
      }

      logger.info('Migration completed', stats);
      return stats;
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Gets the default plan quotas for fallback scenarios
   * 
   * @returns {Promise<Object>} Default quotas
   */
  async getDefaultQuotas() {
    try {
      const defaultPlan = await this.planService.getDefaultPlan();
      if (defaultPlan) {
        return defaultPlan.quotas;
      }
      
      // Hardcoded fallback if no default plan exists
      return {
        maxAgents: 1,
        maxConnections: 1,
        maxMessagesPerDay: 100,
        maxMessagesPerMonth: 3000,
        maxInboxes: 1,
        maxTeams: 1,
        maxWebhooks: 5,
        maxCampaigns: 1,
        maxStorageMb: 100
      };
    } catch (error) {
      logger.error('Failed to get default quotas', { error: error.message });
      return {
        maxAgents: 1,
        maxConnections: 1,
        maxMessagesPerDay: 100,
        maxMessagesPerMonth: 3000,
        maxInboxes: 1,
        maxTeams: 1,
        maxWebhooks: 5,
        maxCampaigns: 1,
        maxStorageMb: 100
      };
    }
  }
}

module.exports = SubscriptionEnsurer;
