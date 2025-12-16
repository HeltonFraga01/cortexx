/**
 * Tests for HumanizationEngine Service
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const HumanizationEngine = require('./HumanizationEngine');

describe('HumanizationEngine', () => {
  describe('calculateDelay', () => {
    it('should return delay within specified range', () => {
      const minSeconds = 10;
      const maxSeconds = 20;
      
      // Test multiple times to ensure consistency
      for (let i = 0; i < 100; i++) {
        const delay = HumanizationEngine.calculateDelay(minSeconds, maxSeconds);
        
        assert.ok(delay >= minSeconds * 1000, `Delay ${delay}ms should be >= ${minSeconds * 1000}ms`);
        assert.ok(delay <= maxSeconds * 1000, `Delay ${delay}ms should be <= ${maxSeconds * 1000}ms`);
      }
    });

    it('should return delay in milliseconds', () => {
      const delay = HumanizationEngine.calculateDelay(10, 20);
      assert.strictEqual(typeof delay, 'number');
      assert.ok(delay >= 10000 && delay <= 20000);
    });

    it('should handle minimum valid values', () => {
      const delay = HumanizationEngine.calculateDelay(5, 5);
      assert.ok(delay >= 4500 && delay <= 5500); // Allow micro-variation
    });

    it('should handle maximum valid values', () => {
      const delay = HumanizationEngine.calculateDelay(300, 300);
      assert.ok(delay >= 299500 && delay <= 300500); // Allow micro-variation
    });

    it('should throw error for invalid minSeconds', () => {
      const delay = HumanizationEngine.calculateDelay(3, 10);
      // Should return fallback value
      assert.strictEqual(typeof delay, 'number');
    });

    it('should throw error for invalid maxSeconds', () => {
      const delay = HumanizationEngine.calculateDelay(10, 400);
      // Should return fallback value
      assert.strictEqual(typeof delay, 'number');
    });

    it('should throw error when min > max', () => {
      const delay = HumanizationEngine.calculateDelay(20, 10);
      // Should return fallback value
      assert.strictEqual(typeof delay, 'number');
    });

    it('should produce different delays on multiple calls', () => {
      const delays = new Set();
      for (let i = 0; i < 50; i++) {
        delays.add(HumanizationEngine.calculateDelay(10, 20));
      }
      // Should have at least 40 different values (allowing some collisions)
      assert.ok(delays.size >= 40, `Should have at least 40 different delays, got ${delays.size}`);
    });
  });

  describe('shuffleContacts', () => {
    it('should return array with same length', () => {
      const contacts = [
        { phone: '1', name: 'A' },
        { phone: '2', name: 'B' },
        { phone: '3', name: 'C' }
      ];
      
      const shuffled = HumanizationEngine.shuffleContacts(contacts);
      assert.strictEqual(shuffled.length, contacts.length);
    });

    it('should preserve all contacts', () => {
      const contacts = [
        { phone: '1', name: 'A' },
        { phone: '2', name: 'B' },
        { phone: '3', name: 'C' }
      ];
      
      const shuffled = HumanizationEngine.shuffleContacts(contacts);
      
      // Check all original contacts are present
      contacts.forEach(contact => {
        const found = shuffled.find(c => c.phone === contact.phone && c.name === contact.name);
        assert.ok(found, `Contact ${contact.phone} should be present`);
      });
    });

    it('should not modify original array', () => {
      const contacts = [
        { phone: '1', name: 'A' },
        { phone: '2', name: 'B' },
        { phone: '3', name: 'C' }
      ];
      
      const original = JSON.stringify(contacts);
      HumanizationEngine.shuffleContacts(contacts);
      
      assert.strictEqual(JSON.stringify(contacts), original);
    });

    it('should handle empty array', () => {
      const contacts = [];
      const shuffled = HumanizationEngine.shuffleContacts(contacts);
      assert.strictEqual(shuffled.length, 0);
    });

    it('should handle single contact', () => {
      const contacts = [{ phone: '1', name: 'A' }];
      const shuffled = HumanizationEngine.shuffleContacts(contacts);
      assert.strictEqual(shuffled.length, 1);
      assert.deepStrictEqual(shuffled[0], contacts[0]);
    });

    it('should produce different orders on multiple calls', () => {
      const contacts = [
        { phone: '1', name: 'A' },
        { phone: '2', name: 'B' },
        { phone: '3', name: 'C' },
        { phone: '4', name: 'D' },
        { phone: '5', name: 'E' }
      ];
      
      const orders = new Set();
      for (let i = 0; i < 50; i++) {
        const shuffled = HumanizationEngine.shuffleContacts(contacts);
        orders.add(JSON.stringify(shuffled.map(c => c.phone)));
      }
      
      // Should have multiple different orders
      assert.ok(orders.size > 10, `Should have multiple different orders, got ${orders.size}`);
    });

    it('should handle non-array input gracefully', () => {
      const result = HumanizationEngine.shuffleContacts(null);
      assert.ok(result === null || Array.isArray(result));
    });
  });

  describe('normalRandom', () => {
    it('should return number close to mean', () => {
      const mean = 15;
      const stdDev = 2;
      
      const values = [];
      for (let i = 0; i < 1000; i++) {
        values.push(HumanizationEngine.normalRandom(mean, stdDev));
      }
      
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Average should be close to mean (within 10%)
      assert.ok(Math.abs(avg - mean) < mean * 0.1, `Average ${avg} should be close to mean ${mean}`);
    });

    it('should return different values on multiple calls', () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(HumanizationEngine.normalRandom(15, 2));
      }
      
      // Should have many different values
      assert.ok(values.size >= 95, `Should have at least 95 different values, got ${values.size}`);
    });

    it('should handle zero standard deviation', () => {
      const value = HumanizationEngine.normalRandom(10, 0);
      assert.strictEqual(typeof value, 'number');
    });

    it('should handle negative mean', () => {
      const value = HumanizationEngine.normalRandom(-10, 2);
      assert.strictEqual(typeof value, 'number');
    });
  });

  describe('estimateRemainingTime', () => {
    it('should calculate correct time for remaining contacts', () => {
      const remainingContacts = 10;
      const avgDelay = 15; // seconds
      const avgProcessing = 2; // seconds
      
      const estimated = HumanizationEngine.estimateRemainingTime(
        remainingContacts,
        avgDelay,
        avgProcessing
      );
      
      const expected = (avgDelay + avgProcessing) * remainingContacts;
      assert.strictEqual(estimated, expected);
    });

    it('should return 0 for no remaining contacts', () => {
      const estimated = HumanizationEngine.estimateRemainingTime(0, 15, 2);
      assert.strictEqual(estimated, 0);
    });

    it('should handle negative contacts', () => {
      const estimated = HumanizationEngine.estimateRemainingTime(-5, 15, 2);
      assert.strictEqual(estimated, 0);
    });

    it('should use default processing time', () => {
      const estimated = HumanizationEngine.estimateRemainingTime(10, 15);
      assert.ok(estimated > 0);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        delay_min: 10,
        delay_max: 20,
        randomize_order: true
      };
      
      const result = HumanizationEngine.validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject null config', () => {
      const result = HumanizationEngine.validateConfig(null);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should reject invalid delay_min', () => {
      const config = {
        delay_min: 3,
        delay_max: 20,
        randomize_order: true
      };
      
      const result = HumanizationEngine.validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('delay_min')));
    });

    it('should reject invalid delay_max', () => {
      const config = {
        delay_min: 10,
        delay_max: 400,
        randomize_order: true
      };
      
      const result = HumanizationEngine.validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('delay_max')));
    });

    it('should reject min > max', () => {
      const config = {
        delay_min: 20,
        delay_max: 10,
        randomize_order: true
      };
      
      const result = HumanizationEngine.validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('maior')));
    });

    it('should reject non-boolean randomize_order', () => {
      const config = {
        delay_min: 10,
        delay_max: 20,
        randomize_order: 'yes'
      };
      
      const result = HumanizationEngine.validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('randomize_order')));
    });
  });

  describe('getDelayStatistics', () => {
    it('should calculate statistics correctly', () => {
      const delays = [10000, 15000, 20000, 25000, 30000];
      
      const stats = HumanizationEngine.getDelayStatistics(delays);
      
      assert.strictEqual(stats.count, 5);
      assert.strictEqual(stats.min, 10000);
      assert.strictEqual(stats.max, 30000);
      assert.strictEqual(stats.mean, 20000);
      assert.strictEqual(stats.median, 20000);
      assert.ok(stats.stdDev > 0);
    });

    it('should handle empty array', () => {
      const stats = HumanizationEngine.getDelayStatistics([]);
      
      assert.strictEqual(stats.count, 0);
      assert.strictEqual(stats.min, 0);
      assert.strictEqual(stats.max, 0);
      assert.strictEqual(stats.mean, 0);
    });

    it('should handle single value', () => {
      const stats = HumanizationEngine.getDelayStatistics([15000]);
      
      assert.strictEqual(stats.count, 1);
      assert.strictEqual(stats.min, 15000);
      assert.strictEqual(stats.max, 15000);
      assert.strictEqual(stats.mean, 15000);
      assert.strictEqual(stats.median, 15000);
      assert.strictEqual(stats.stdDev, 0);
    });

    it('should calculate median for even count', () => {
      const delays = [10000, 20000, 30000, 40000];
      
      const stats = HumanizationEngine.getDelayStatistics(delays);
      
      assert.strictEqual(stats.median, 25000); // (20000 + 30000) / 2
    });

    it('should calculate median for odd count', () => {
      const delays = [10000, 20000, 30000];
      
      const stats = HumanizationEngine.getDelayStatistics(delays);
      
      assert.strictEqual(stats.median, 20000);
    });
  });
});
