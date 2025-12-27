/**
 * Cache Service
 * 
 * High-level caching abstraction using Redis.
 * Implements cache-aside pattern with automatic fallback.
 * 
 * Task 1: Expanded cache for additional endpoints
 */

const redisClient = require('../utils/redisClient');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');

class CacheService {
  /**
   * Cache key generators
   */
  static CACHE_KEYS = {
    // Existing keys
    PLANS: (tenantId) => `cache:plans:${tenantId}`,
    TENANT_INFO: (subdomain) => `cache:tenant:${subdomain}`,
    BRANDING: (tenantId) => `cache:branding:${tenantId}`,
    DASHBOARD_STATS: (tenantId) => `cache:dashboard:${tenantId}`,
    
    // Task 1.1-1.6: New cache keys
    STRIPE_SETTINGS: (tenantId) => `cache:stripe:settings:${tenantId}`,
    STRIPE_ANALYTICS: (tenantId) => `cache:stripe:analytics:${tenantId}`,
    USER_SUBSCRIPTION: (userId) => `cache:user:subscription:${userId}`,
    SESSION_AGENTS: (accountId) => `cache:session:agents:${accountId}`,
    SESSION_TEAMS: (accountId) => `cache:session:teams:${accountId}`,
    SESSION_ROLES: (accountId) => `cache:session:roles:${accountId}`,
    SESSION_INBOXES: (accountId) => `cache:session:inboxes:${accountId}`,
    USER_QUOTAS: (userId) => `cache:user:quotas:${userId}`,
    USER_FEATURES: (userId) => `cache:user:features:${userId}`,
    ACCOUNT_SUMMARY: (userId) => `cache:user:account-summary:${userId}`,
  };

  /**
   * TTL values in seconds
   */
  static TTL = {
    // Existing TTLs
    PLANS: 300,           // 5 minutes
    TENANT_INFO: 600,     // 10 minutes
    BRANDING: 300,        // 5 minutes
    DASHBOARD_STATS: 60,  // 1 minute
    
    // Task 1.1-1.6: New TTLs
    STRIPE_SETTINGS: 300,    // 5 minutes (Task 1.1)
    STRIPE_ANALYTICS: 120,   // 2 minutes (Task 1.2)
    USER_SUBSCRIPTION: 300,  // 5 minutes (Task 1.3)
    SESSION_AGENTS: 300,     // 5 minutes (Task 1.4)
    SESSION_TEAMS: 300,      // 5 minutes (Task 1.5)
    SESSION_ROLES: 600,      // 10 minutes (Task 1.6)
    SESSION_INBOXES: 300,    // 5 minutes
    USER_QUOTAS: 60,         // 1 minute (quotas change frequently)
    USER_FEATURES: 300,      // 5 minutes
    ACCOUNT_SUMMARY: 120,    // 2 minutes
    
    DEFAULT: parseInt(process.env.REDIS_CACHE_TTL) || 300,
  };

  /**
   * Cache statistics for monitoring
   */
  static stats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  /**
   * Get value from cache or fetch from source
   * Implements cache-aside pattern
   * 
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @param {Function} fetchFn - Async function to fetch data if cache miss
   * @returns {Promise<{data: any, fromCache: boolean}>}
   */
  static async getOrSet(key, ttl, fetchFn) {
    // Try to get from cache
    const cached = await redisClient.get(key);
    if (cached !== null) {
      logger.debug('Cache HIT', { key });
      CacheService.stats.hits++;
      metrics.incrementCounter('redis_cache_hits_total', { key_prefix: key.split(':')[1] || 'unknown' });
      return { data: cached, fromCache: true };
    }

    // Cache miss - fetch from source
    logger.debug('Cache MISS', { key });
    CacheService.stats.misses++;
    metrics.incrementCounter('redis_cache_misses_total', { key_prefix: key.split(':')[1] || 'unknown' });
    
    try {
      const data = await fetchFn();
      
      // Store in cache (fire and forget)
      redisClient.set(key, data, ttl).catch((err) => {
        logger.warn('Failed to cache data', { key, error: err.message });
        CacheService.stats.errors++;
      });
      
      return { data, fromCache: false };
    } catch (error) {
      logger.error('Cache fetchFn error', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get value from cache only (no fetch)
   * @param {string} key - Cache key
   * @returns {Promise<any|null>}
   */
  static async get(key) {
    return redisClient.get(key);
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>}
   */
  static async set(key, value, ttl = CacheService.TTL.DEFAULT) {
    return redisClient.set(key, value, ttl);
  }

  /**
   * Invalidate a specific cache key
   * @param {string} key - Cache key to invalidate
   * @returns {Promise<boolean>}
   */
  static async invalidate(key) {
    logger.debug('Cache invalidate', { key });
    return redisClient.del(key);
  }

  /**
   * Invalidate all cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  static async invalidateTenantCache(tenantId) {
    logger.info('Invalidating all cache for tenant', { tenantId });
    return redisClient.invalidatePattern(`cache:*:${tenantId}`);
  }

  /**
   * Invalidate plans cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  static async invalidatePlansCache(tenantId) {
    const key = CacheService.CACHE_KEYS.PLANS(tenantId);
    logger.debug('Invalidating plans cache', { tenantId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate branding cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  static async invalidateBrandingCache(tenantId) {
    const key = CacheService.CACHE_KEYS.BRANDING(tenantId);
    logger.debug('Invalidating branding cache', { tenantId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate tenant info cache
   * @param {string} subdomain - Tenant subdomain
   * @returns {Promise<boolean>}
   */
  static async invalidateTenantInfoCache(subdomain) {
    const key = CacheService.CACHE_KEYS.TENANT_INFO(subdomain);
    logger.debug('Invalidating tenant info cache', { subdomain, key });
    return redisClient.del(key);
  }

  // ==================== Task 1.7: New Invalidation Methods ====================

  /**
   * Invalidate Stripe settings cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  static async invalidateStripeSettingsCache(tenantId) {
    const key = CacheService.CACHE_KEYS.STRIPE_SETTINGS(tenantId);
    logger.debug('Invalidating Stripe settings cache', { tenantId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate Stripe analytics cache for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  static async invalidateStripeAnalyticsCache(tenantId) {
    const key = CacheService.CACHE_KEYS.STRIPE_ANALYTICS(tenantId);
    logger.debug('Invalidating Stripe analytics cache', { tenantId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate user subscription cache
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  static async invalidateUserSubscriptionCache(userId) {
    const key = CacheService.CACHE_KEYS.USER_SUBSCRIPTION(userId);
    logger.debug('Invalidating user subscription cache', { userId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate session agents cache for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  static async invalidateSessionAgentsCache(accountId) {
    const key = CacheService.CACHE_KEYS.SESSION_AGENTS(accountId);
    logger.debug('Invalidating session agents cache', { accountId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate session teams cache for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  static async invalidateSessionTeamsCache(accountId) {
    const key = CacheService.CACHE_KEYS.SESSION_TEAMS(accountId);
    logger.debug('Invalidating session teams cache', { accountId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate session roles cache for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  static async invalidateSessionRolesCache(accountId) {
    const key = CacheService.CACHE_KEYS.SESSION_ROLES(accountId);
    logger.debug('Invalidating session roles cache', { accountId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate session inboxes cache for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  static async invalidateSessionInboxesCache(accountId) {
    const key = CacheService.CACHE_KEYS.SESSION_INBOXES(accountId);
    logger.debug('Invalidating session inboxes cache', { accountId, key });
    return redisClient.del(key);
  }

  /**
   * Invalidate all user-related caches
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  static async invalidateUserCaches(userId) {
    logger.debug('Invalidating all user caches', { userId });
    const keys = [
      CacheService.CACHE_KEYS.USER_SUBSCRIPTION(userId),
      CacheService.CACHE_KEYS.USER_QUOTAS(userId),
      CacheService.CACHE_KEYS.USER_FEATURES(userId),
      CacheService.CACHE_KEYS.ACCOUNT_SUMMARY(userId),
    ];
    
    const results = await Promise.all(keys.map(key => redisClient.del(key)));
    return results.every(r => r);
  }

  /**
   * Invalidate all account-related caches
   * @param {string} accountId - Account ID
   * @returns {Promise<boolean>}
   */
  static async invalidateAccountCaches(accountId) {
    logger.debug('Invalidating all account caches', { accountId });
    const keys = [
      CacheService.CACHE_KEYS.SESSION_AGENTS(accountId),
      CacheService.CACHE_KEYS.SESSION_TEAMS(accountId),
      CacheService.CACHE_KEYS.SESSION_ROLES(accountId),
      CacheService.CACHE_KEYS.SESSION_INBOXES(accountId),
    ];
    
    const results = await Promise.all(keys.map(key => redisClient.del(key)));
    return results.every(r => r);
  }

  /**
   * Get cache statistics (Task 1.8)
   * @returns {Object} Cache hit/miss statistics
   */
  static getStats() {
    const total = CacheService.stats.hits + CacheService.stats.misses;
    const hitRate = total > 0 ? (CacheService.stats.hits / total) * 100 : 0;
    
    return {
      hits: CacheService.stats.hits,
      misses: CacheService.stats.misses,
      errors: CacheService.stats.errors,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      hitRateValue: hitRate,
    };
  }

  /**
   * Reset cache statistics
   */
  static resetStats() {
    CacheService.stats.hits = 0;
    CacheService.stats.misses = 0;
    CacheService.stats.errors = 0;
  }

  /**
   * Get cache health status
   * @returns {Promise<Object>}
   */
  static async getHealth() {
    const health = await redisClient.healthCheck();
    return {
      ...health,
      stats: CacheService.getStats(),
    };
  }

  /**
   * Destroy the cache service and cleanup resources
   * Called during graceful shutdown
   * @returns {Promise<void>}
   */
  static async destroy() {
    logger.info('Destroying CacheService...');
    
    try {
      // Reset statistics
      CacheService.resetStats();
      
      // Disconnect Redis client
      await redisClient.disconnect();
      
      logger.info('CacheService destroyed successfully');
    } catch (error) {
      logger.error('Error destroying CacheService', { error: error.message });
      throw error;
    }
  }
}

module.exports = CacheService;
