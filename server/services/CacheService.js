/**
 * Cache Service
 * 
 * High-level caching abstraction using Redis.
 * Implements cache-aside pattern with automatic fallback.
 */

const redisClient = require('../utils/redisClient');
const { logger } = require('../utils/logger');

class CacheService {
  /**
   * Cache key generators
   */
  static CACHE_KEYS = {
    PLANS: (tenantId) => `cache:plans:${tenantId}`,
    TENANT_INFO: (subdomain) => `cache:tenant:${subdomain}`,
    BRANDING: (tenantId) => `cache:branding:${tenantId}`,
    DASHBOARD_STATS: (tenantId) => `cache:dashboard:${tenantId}`,
  };

  /**
   * TTL values in seconds
   */
  static TTL = {
    PLANS: 300,           // 5 minutes
    TENANT_INFO: 600,     // 10 minutes
    BRANDING: 300,        // 5 minutes
    DASHBOARD_STATS: 60,  // 1 minute
    DEFAULT: parseInt(process.env.REDIS_CACHE_TTL) || 300,
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
      return { data: cached, fromCache: true };
    }

    // Cache miss - fetch from source
    logger.debug('Cache MISS', { key });
    
    try {
      const data = await fetchFn();
      
      // Store in cache (fire and forget)
      redisClient.set(key, data, ttl).catch((err) => {
        logger.warn('Failed to cache data', { key, error: err.message });
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

  /**
   * Get cache health status
   * @returns {Promise<Object>}
   */
  static async getHealth() {
    return redisClient.healthCheck();
  }
}

module.exports = CacheService;
