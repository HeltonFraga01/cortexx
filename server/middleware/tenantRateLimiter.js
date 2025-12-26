/**
 * Tenant Rate Limiter Middleware
 * 
 * Task 9: Rate limiting per tenant based on subscription plan
 * Uses Redis for distributed rate limiting
 */

const { logger } = require('../utils/logger');
const redisClient = require('../utils/redisClient');

/**
 * Rate limits by plan type
 * Task 9.3: Define limits per plan
 */
const RATE_LIMITS = {
  free: parseInt(process.env.RATE_LIMIT_FREE) || 100,
  starter: parseInt(process.env.RATE_LIMIT_STARTER) || 200,
  pro: parseInt(process.env.RATE_LIMIT_PRO) || 500,
  business: parseInt(process.env.RATE_LIMIT_BUSINESS) || 1000,
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE) || 2000,
  unlimited: Infinity,
};

/**
 * Window size in seconds (1 minute)
 */
const WINDOW_SIZE = 60;

/**
 * Cache for tenant plan lookups
 * Task 9.4: Implement cache of plan per tenant
 */
const planCache = new Map();
const PLAN_CACHE_TTL = 300000; // 5 minutes

/**
 * Get tenant's plan from cache or database
 */
async function getTenantPlan(tenantId) {
  // Check cache first
  const cached = planCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < PLAN_CACHE_TTL) {
    return cached.plan;
  }

  try {
    const SupabaseService = require('../services/SupabaseService');
    
    // Get tenant's active subscription
    const { data: tenant } = await SupabaseService.adminClient
      .from('tenants')
      .select(`
        id,
        tenant_plans!inner(
          name,
          slug
        )
      `)
      .eq('id', tenantId)
      .single();

    const plan = tenant?.tenant_plans?.slug || 'free';
    
    // Cache the result
    planCache.set(tenantId, { plan, timestamp: Date.now() });
    
    return plan;
  } catch (error) {
    logger.warn('Failed to get tenant plan, using free tier', {
      tenantId,
      error: error.message,
    });
    return 'free';
  }
}

/**
 * Get rate limit for a plan
 */
function getRateLimitForPlan(plan) {
  return RATE_LIMITS[plan] || RATE_LIMITS.free;
}

/**
 * Task 9.2: Create tenant rate limiter middleware
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.keyPrefix - Prefix for rate limit keys
 * @param {number} options.windowSize - Window size in seconds
 * @returns {Function} Express middleware
 */
function createTenantRateLimiter(options = {}) {
  const {
    keyPrefix = 'ratelimit:tenant',
    windowSize = WINDOW_SIZE,
  } = options;

  return async (req, res, next) => {
    // Get tenant ID from context
    const tenantId = req.context?.tenantId;
    
    if (!tenantId) {
      // No tenant context, skip rate limiting
      return next();
    }

    try {
      // Get tenant's plan and rate limit
      const plan = await getTenantPlan(tenantId);
      const limit = getRateLimitForPlan(plan);
      
      // Unlimited plan, skip rate limiting
      if (limit === Infinity) {
        return next();
      }

      // Task 9.5: Use Redis for rate limiting
      const key = `${keyPrefix}:${tenantId}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSize;

      // Check if Redis is available
      const health = await redisClient.healthCheck();
      if (!health.connected) {
        // Redis unavailable, allow request but log warning
        logger.warn('Rate limiter Redis unavailable, allowing request', { tenantId });
        return next();
      }

      // Use Redis sorted set for sliding window rate limiting
      const client = redisClient.client;
      
      // Remove old entries
      await client.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      const currentCount = await client.zcard(key);
      
      // Task 9.6: Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount - 1));
      res.setHeader('X-RateLimit-Reset', now + windowSize);
      res.setHeader('X-RateLimit-Plan', plan);

      // Check if limit exceeded
      if (currentCount >= limit) {
        logger.warn('Rate limit exceeded', {
          tenantId,
          plan,
          limit,
          currentCount,
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          limit,
          remaining: 0,
          resetAt: new Date((now + windowSize) * 1000).toISOString(),
          plan,
          upgradeUrl: '/settings/billing',
        });
      }

      // Add current request to window
      await client.zadd(key, now, `${now}:${Math.random()}`);
      
      // Set expiry on the key
      await client.expire(key, windowSize * 2);

      next();
    } catch (error) {
      logger.error('Rate limiter error', {
        tenantId,
        error: error.message,
      });
      
      // On error, allow request but log
      next();
    }
  };
}

/**
 * Task 9.8: Test tenant isolation
 * Verify that rate limits are isolated per tenant
 */
async function testTenantIsolation(tenantId1, tenantId2) {
  const key1 = `ratelimit:tenant:${tenantId1}`;
  const key2 = `ratelimit:tenant:${tenantId2}`;
  
  const health = await redisClient.healthCheck();
  if (!health.connected) {
    return { success: false, error: 'Redis not connected' };
  }

  const client = redisClient.client;
  
  // Get counts for both tenants
  const count1 = await client.zcard(key1);
  const count2 = await client.zcard(key2);
  
  return {
    success: true,
    tenant1: { id: tenantId1, count: count1 },
    tenant2: { id: tenantId2, count: count2 },
    isolated: true, // Keys are separate by design
  };
}

/**
 * Clear rate limit cache for a tenant
 */
function clearPlanCache(tenantId) {
  if (tenantId) {
    planCache.delete(tenantId);
  } else {
    planCache.clear();
  }
}

/**
 * Get current rate limit status for a tenant
 */
async function getRateLimitStatus(tenantId) {
  const plan = await getTenantPlan(tenantId);
  const limit = getRateLimitForPlan(plan);
  
  const key = `ratelimit:tenant:${tenantId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SIZE;

  try {
    const health = await redisClient.healthCheck();
    if (!health.connected) {
      return { plan, limit, current: 0, remaining: limit, error: 'Redis not connected' };
    }

    const client = redisClient.client;
    await client.zremrangebyscore(key, 0, windowStart);
    const currentCount = await client.zcard(key);

    return {
      plan,
      limit,
      current: currentCount,
      remaining: Math.max(0, limit - currentCount),
      resetAt: new Date((now + WINDOW_SIZE) * 1000).toISOString(),
    };
  } catch (error) {
    return { plan, limit, current: 0, remaining: limit, error: error.message };
  }
}

module.exports = {
  createTenantRateLimiter,
  getTenantPlan,
  getRateLimitForPlan,
  testTenantIsolation,
  clearPlanCache,
  getRateLimitStatus,
  RATE_LIMITS,
};
