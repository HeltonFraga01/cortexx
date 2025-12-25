/**
 * Cache Middleware
 * 
 * Express middleware for automatic response caching.
 * Adds X-Cache header to indicate cache status.
 */

const redisClient = require('../utils/redisClient');
const { logger } = require('../utils/logger');

/**
 * Create cache middleware for a route
 * 
 * @param {Function} keyGenerator - Function that receives req and returns cache key
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @returns {Function} Express middleware
 * 
 * @example
 * // Cache plans by tenant
 * router.get('/plans', cacheMiddleware(
 *   (req) => `cache:plans:${req.context?.tenantId}`,
 *   300
 * ), getPlans);
 */
function cacheMiddleware(keyGenerator, ttl = 300) {
  return async (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);
    
    // Skip if no cache key generated
    if (!cacheKey) {
      return next();
    }

    try {
      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        logger.debug('Cache middleware HIT', { key: cacheKey, path: req.path });
        return res.json(cached);
      }
    } catch (error) {
      logger.warn('Cache middleware GET error', { 
        key: cacheKey, 
        error: error.message 
      });
    }

    // Cache miss - intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode === 200 && data && data.success !== false) {
        redisClient.set(cacheKey, data, ttl).catch((err) => {
          logger.warn('Cache middleware SET error', { 
            key: cacheKey, 
            error: err.message 
          });
        });
      }
      
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);
      logger.debug('Cache middleware MISS', { key: cacheKey, path: req.path });
      
      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to invalidate cache after mutation
 * 
 * @param {Function} keyGenerator - Function that receives req and returns cache key(s) to invalidate
 * @returns {Function} Express middleware
 * 
 * @example
 * // Invalidate plans cache after create/update/delete
 * router.post('/plans', invalidateCacheMiddleware(
 *   (req) => `cache:plans:${req.context?.tenantId}`
 * ), createPlan);
 */
function invalidateCacheMiddleware(keyGenerator) {
  return async (req, res, next) => {
    // Store original json to intercept after response
    const originalJson = res.json.bind(res);
    
    res.json = async (data) => {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const keys = keyGenerator(req);
          const keysArray = Array.isArray(keys) ? keys : [keys];
          
          for (const key of keysArray) {
            if (key) {
              await redisClient.del(key);
              logger.debug('Cache invalidated after mutation', { 
                key, 
                path: req.path,
                method: req.method 
              });
            }
          }
        } catch (error) {
          logger.warn('Cache invalidation error', { error: error.message });
        }
      }
      
      return originalJson(data);
    };

    next();
  };
}

/**
 * Skip cache for specific conditions
 * 
 * @param {Function} condition - Function that receives req and returns true to skip cache
 * @returns {Function} Express middleware
 */
function skipCacheIf(condition) {
  return (req, res, next) => {
    if (condition(req)) {
      req.skipCache = true;
    }
    next();
  };
}

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  skipCacheIf
};
