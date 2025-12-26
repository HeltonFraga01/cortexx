/**
 * Tests for Tenant Rate Limiter Middleware
 * Task 13.2: Create tests for tenantRateLimiter
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock dependencies
const mockRedisClient = {
  healthCheck: mock.fn(() => Promise.resolve({ connected: true })),
  client: {
    zremrangebyscore: mock.fn(() => Promise.resolve(0)),
    zcard: mock.fn(() => Promise.resolve(0)),
    zadd: mock.fn(() => Promise.resolve(1)),
    expire: mock.fn(() => Promise.resolve(1)),
  },
};

const mockSupabaseService = {
  adminClient: {
    from: mock.fn(() => ({
      select: mock.fn(() => ({
        eq: mock.fn(() => ({
          single: mock.fn(() => Promise.resolve({
            data: { id: 'tenant-1', tenant_plans: { slug: 'pro' } },
            error: null,
          })),
        })),
      })),
    })),
  },
};

mock.module('../utils/redisClient', {
  namedExports: {},
  defaultExport: mockRedisClient,
});

mock.module('../services/SupabaseService', {
  namedExports: {},
  defaultExport: mockSupabaseService,
});

mock.module('../utils/logger', {
  namedExports: {
    logger: {
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
      debug: mock.fn(),
    },
  },
});

describe('Tenant Rate Limiter', () => {
  let rateLimiter;

  beforeEach(() => {
    // Reset mocks
    mockRedisClient.healthCheck.mock.resetCalls();
    mockRedisClient.client.zcard.mock.resetCalls();
    mockRedisClient.client.zadd.mock.resetCalls();
    
    // Re-require module
    delete require.cache[require.resolve('./tenantRateLimiter')];
    rateLimiter = require('./tenantRateLimiter');
  });

  describe('RATE_LIMITS', () => {
    it('should export rate limits by plan', () => {
      assert.ok(rateLimiter.RATE_LIMITS, 'RATE_LIMITS should be exported');
      assert.strictEqual(rateLimiter.RATE_LIMITS.free, 100, 'free plan should have 100 limit');
      assert.strictEqual(rateLimiter.RATE_LIMITS.pro, 500, 'pro plan should have 500 limit');
      assert.strictEqual(rateLimiter.RATE_LIMITS.enterprise, 2000, 'enterprise plan should have 2000 limit');
    });
  });

  describe('getRateLimitForPlan', () => {
    it('should return correct limit for known plans', () => {
      assert.strictEqual(rateLimiter.getRateLimitForPlan('free'), 100);
      assert.strictEqual(rateLimiter.getRateLimitForPlan('pro'), 500);
      assert.strictEqual(rateLimiter.getRateLimitForPlan('enterprise'), 2000);
    });

    it('should return free limit for unknown plans', () => {
      assert.strictEqual(rateLimiter.getRateLimitForPlan('unknown'), 100);
    });

    it('should return Infinity for unlimited plan', () => {
      assert.strictEqual(rateLimiter.getRateLimitForPlan('unlimited'), Infinity);
    });
  });

  describe('createTenantRateLimiter', () => {
    it('should return a middleware function', () => {
      const middleware = rateLimiter.createTenantRateLimiter();
      assert.strictEqual(typeof middleware, 'function', 'should return a function');
    });

    it('should skip rate limiting when no tenant context', async () => {
      const middleware = rateLimiter.createTenantRateLimiter();
      const req = { context: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true, 'next() should be called');
    });

    it('should add rate limit headers to response', async () => {
      mockRedisClient.client.zcard.mock.mockImplementation(() => Promise.resolve(10));
      
      const middleware = rateLimiter.createTenantRateLimiter();
      const req = { context: { tenantId: 'tenant-1' } };
      const headers = {};
      const res = {
        setHeader: (key, value) => { headers[key] = value; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.ok(headers['X-RateLimit-Limit'], 'should set X-RateLimit-Limit header');
      assert.ok(headers['X-RateLimit-Remaining'] !== undefined, 'should set X-RateLimit-Remaining header');
      assert.ok(headers['X-RateLimit-Reset'], 'should set X-RateLimit-Reset header');
      assert.strictEqual(nextCalled, true, 'next() should be called');
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Mock high request count
      mockRedisClient.client.zcard.mock.mockImplementation(() => Promise.resolve(1000));
      
      const middleware = rateLimiter.createTenantRateLimiter();
      const req = { context: { tenantId: 'tenant-1' } };
      const headers = {};
      let statusCode = null;
      let jsonResponse = null;
      const res = {
        setHeader: (key, value) => { headers[key] = value; },
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => { jsonResponse = data; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(statusCode, 429, 'should return 429 status');
      assert.strictEqual(jsonResponse.error, 'Rate limit exceeded', 'should return rate limit error');
      assert.strictEqual(nextCalled, false, 'next() should not be called');
    });

    it('should allow request when Redis unavailable', async () => {
      mockRedisClient.healthCheck.mock.mockImplementation(() => 
        Promise.resolve({ connected: false })
      );
      
      const middleware = rateLimiter.createTenantRateLimiter();
      const req = { context: { tenantId: 'tenant-1' } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true, 'next() should be called when Redis unavailable');
    });
  });

  describe('clearPlanCache', () => {
    it('should export clearPlanCache function', () => {
      assert.strictEqual(typeof rateLimiter.clearPlanCache, 'function');
    });

    it('should not throw when clearing cache', () => {
      assert.doesNotThrow(() => rateLimiter.clearPlanCache());
      assert.doesNotThrow(() => rateLimiter.clearPlanCache('tenant-1'));
    });
  });

  describe('getRateLimitStatus', () => {
    it('should export getRateLimitStatus function', () => {
      assert.strictEqual(typeof rateLimiter.getRateLimitStatus, 'function');
    });

    it('should return status object', async () => {
      mockRedisClient.client.zcard.mock.mockImplementation(() => Promise.resolve(50));
      
      const status = await rateLimiter.getRateLimitStatus('tenant-1');
      
      assert.ok(status.plan, 'should have plan');
      assert.ok(status.limit, 'should have limit');
      assert.ok(status.current !== undefined, 'should have current count');
      assert.ok(status.remaining !== undefined, 'should have remaining count');
    });
  });

  describe('testTenantIsolation', () => {
    it('should export testTenantIsolation function', () => {
      assert.strictEqual(typeof rateLimiter.testTenantIsolation, 'function');
    });

    it('should return isolation test results', async () => {
      const result = await rateLimiter.testTenantIsolation('tenant-1', 'tenant-2');
      
      assert.ok(result.success !== undefined, 'should have success flag');
      assert.ok(result.tenant1, 'should have tenant1 data');
      assert.ok(result.tenant2, 'should have tenant2 data');
      assert.strictEqual(result.isolated, true, 'should indicate isolation');
    });
  });
});
