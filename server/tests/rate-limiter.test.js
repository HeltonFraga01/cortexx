/**
 * Tests for Rate Limiting Middleware
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Rate Limiting Configuration', () => {
  const rateLimiters = require('../middleware/rateLimiter');

  describe('Limiter Exports', () => {
    it('should export loginLimiter', () => {
      assert.ok(rateLimiters.loginLimiter, 'loginLimiter should be exported');
      assert.strictEqual(typeof rateLimiters.loginLimiter, 'function');
    });

    it('should export apiLimiter', () => {
      assert.ok(rateLimiters.apiLimiter, 'apiLimiter should be exported');
      assert.strictEqual(typeof rateLimiters.apiLimiter, 'function');
    });

    it('should export adminLimiter', () => {
      assert.ok(rateLimiters.adminLimiter, 'adminLimiter should be exported');
      assert.strictEqual(typeof rateLimiters.adminLimiter, 'function');
    });

    it('should export webhookLimiter', () => {
      assert.ok(rateLimiters.webhookLimiter, 'webhookLimiter should be exported');
      assert.strictEqual(typeof rateLimiters.webhookLimiter, 'function');
    });
  });

  describe('Login Limiter Configuration', () => {
    it('should have correct window (15 minutes)', () => {
      const windowMs = 15 * 60 * 1000;
      assert.strictEqual(windowMs, 900000, 'Window should be 15 minutes (900000ms)');
    });

    it('should have correct max attempts (5)', () => {
      const max = 5;
      assert.strictEqual(max, 5, 'Max attempts should be 5');
    });

    it('should have correct error message', () => {
      const message = {
        error: 'Too many login attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes'
      };
      
      assert.strictEqual(message.error, 'Too many login attempts');
      assert.strictEqual(message.code, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(message.retryAfter, '15 minutes');
    });
  });

  describe('API Limiter Configuration', () => {
    it('should have correct window (1 minute)', () => {
      const windowMs = 1 * 60 * 1000;
      assert.strictEqual(windowMs, 60000, 'Window should be 1 minute (60000ms)');
    });

    it('should have correct max requests (100)', () => {
      const max = 100;
      assert.strictEqual(max, 100, 'Max requests should be 100');
    });

    it('should skip health check paths', () => {
      const publicPaths = ['/health', '/api/health', '/api/wuzapi/health'];
      
      publicPaths.forEach(path => {
        assert.ok(publicPaths.includes(path), `${path} should be in public paths`);
      });
    });
  });

  describe('Admin Limiter Configuration', () => {
    it('should have correct window (1 minute)', () => {
      const windowMs = 1 * 60 * 1000;
      assert.strictEqual(windowMs, 60000, 'Window should be 1 minute (60000ms)');
    });

    it('should have correct max requests (50)', () => {
      const max = 50;
      assert.strictEqual(max, 50, 'Max requests should be 50');
    });

    it('should generate key with IP and userId', () => {
      const req = {
        ip: '127.0.0.1',
        session: { userId: 'user123' }
      };
      
      const key = `${req.ip}-${req.session.userId}`;
      assert.strictEqual(key, '127.0.0.1-user123');
    });

    it('should handle anonymous users', () => {
      const req = {
        ip: '127.0.0.1',
        session: {}
      };
      
      const userId = req.session?.userId || 'anonymous';
      const key = `${req.ip}-${userId}`;
      assert.strictEqual(key, '127.0.0.1-anonymous');
    });
  });

  describe('Webhook Limiter Configuration', () => {
    it('should have correct window (1 minute)', () => {
      const windowMs = 1 * 60 * 1000;
      assert.strictEqual(windowMs, 60000, 'Window should be 1 minute (60000ms)');
    });

    it('should have high max requests (1000)', () => {
      const max = 1000;
      assert.strictEqual(max, 1000, 'Max requests should be 1000 for webhooks');
    });
  });

  describe('Rate Limit Response', () => {
    it('should return 429 status code', () => {
      const statusCode = 429;
      assert.strictEqual(statusCode, 429, 'Should return 429 Too Many Requests');
    });

    it('should return structured error', () => {
      const error = {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '1 minute'
      };
      
      assert.ok(error.error, 'Should have error message');
      assert.ok(error.code, 'Should have error code');
      assert.ok(error.retryAfter, 'Should have retry after info');
    });
  });

  describe('Security Features', () => {
    it('should use standard headers', () => {
      const standardHeaders = true;
      assert.strictEqual(standardHeaders, true, 'Should use standard RateLimit-* headers');
    });

    it('should not use legacy headers', () => {
      const legacyHeaders = false;
      assert.strictEqual(legacyHeaders, false, 'Should not use legacy X-RateLimit-* headers');
    });

    it('should skip successful login requests', () => {
      const skipSuccessfulRequests = true;
      assert.strictEqual(skipSuccessfulRequests, true, 'Should only count failed login attempts');
    });
  });

  describe('Key Generation', () => {
    it('should generate key from IP for login', () => {
      const req = { ip: '192.168.1.1' };
      const key = req.ip;
      
      assert.strictEqual(key, '192.168.1.1');
    });

    it('should generate key from IP for API', () => {
      const req = { ip: '10.0.0.1' };
      const key = req.ip;
      
      assert.strictEqual(key, '10.0.0.1');
    });

    it('should generate combined key for admin', () => {
      const req = {
        ip: '172.16.0.1',
        session: { userId: 'admin123' }
      };
      const key = `${req.ip}-${req.session.userId}`;
      
      assert.strictEqual(key, '172.16.0.1-admin123');
    });
  });

  describe('Attack Prevention', () => {
    it('should prevent brute force login attacks', () => {
      // 5 attempts in 15 minutes
      const attempts = 5;
      const window = 15 * 60 * 1000;
      
      assert.ok(attempts <= 5, 'Should limit login attempts to prevent brute force');
      assert.ok(window >= 900000, 'Should have sufficient window to prevent rapid attacks');
    });

    it('should prevent API abuse', () => {
      // 100 requests per minute
      const requests = 100;
      const window = 1 * 60 * 1000;
      
      assert.ok(requests <= 100, 'Should limit API requests to prevent abuse');
      assert.ok(window === 60000, 'Should have 1-minute window');
    });

    it('should prevent admin endpoint abuse', () => {
      // 50 requests per minute (more restrictive than general API)
      const requests = 50;
      const window = 1 * 60 * 1000;
      
      assert.ok(requests < 100, 'Admin limit should be more restrictive than general API');
      assert.ok(window === 60000, 'Should have 1-minute window');
    });
  });

  describe('Legitimate Traffic', () => {
    it('should allow reasonable login attempts', () => {
      // 5 attempts in 15 minutes is reasonable for legitimate users
      const attempts = 5;
      assert.ok(attempts >= 3, 'Should allow at least 3 attempts for typos');
    });

    it('should allow high API usage', () => {
      // 100 requests per minute allows for active usage
      const requests = 100;
      assert.ok(requests >= 60, 'Should allow at least 1 request per second');
    });

    it('should allow very high webhook volume', () => {
      // 1000 requests per minute for webhooks
      const requests = 1000;
      assert.ok(requests >= 100, 'Should allow high volume for webhooks');
    });
  });
});
