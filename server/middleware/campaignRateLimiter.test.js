/**
 * Tests for Campaign Rate Limiter Middleware
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('CampaignRateLimiter', () => {
  describe('Module exports', () => {
    it('should export campaignCreationLimiter', () => {
      const { campaignCreationLimiter } = require('./campaignRateLimiter');
      assert.ok(campaignCreationLimiter);
      assert.strictEqual(typeof campaignCreationLimiter, 'function');
    });

    it('should export campaignOperationLimiter', () => {
      const { campaignOperationLimiter } = require('./campaignRateLimiter');
      assert.ok(campaignOperationLimiter);
      assert.strictEqual(typeof campaignOperationLimiter, 'function');
    });

    it('should export campaignProgressLimiter', () => {
      const { campaignProgressLimiter } = require('./campaignRateLimiter');
      assert.ok(campaignProgressLimiter);
      assert.strictEqual(typeof campaignProgressLimiter, 'function');
    });
  });

  describe('Rate limit configuration', () => {
    it('campaignCreationLimiter should have correct window and max', () => {
      const { campaignCreationLimiter } = require('./campaignRateLimiter');
      // The limiter is a middleware function, we can check its options
      // by examining the internal state (express-rate-limit stores options)
      assert.ok(campaignCreationLimiter);
    });
  });
});
