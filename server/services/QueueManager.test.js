/**
 * Tests for QueueManager Service
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const QueueManager = require('./QueueManager');

describe('QueueManager', () => {
  // Mock database
  const mockDb = {
    query: async () => ({ rows: [] })
  };

  // Mock config
  const mockConfig = {
    instance: 'test-instance',
    user_token: 'test-token',
    message_type: 'text',
    message_content: 'Olá {{nome}}!',
    delay_min: 5,
    delay_max: 10,
    randomize_order: false
  };

  describe('constructor', () => {
    it('should create QueueManager instance', () => {
      const qm = new QueueManager('test-campaign', mockConfig, mockDb);
      
      assert.strictEqual(qm.campaignId, 'test-campaign');
      assert.strictEqual(qm.status, 'initialized');
      assert.strictEqual(qm.currentIndex, 0);
      assert.strictEqual(qm.sentCount, 0);
      assert.strictEqual(qm.failedCount, 0);
    });
  });



  describe('categorizeError', () => {
    it('should categorize invalid number error', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      
      const error = new Error('Invalid phone number');
      error.status = 400;
      
      const category = qm.categorizeError(error);
      assert.strictEqual(category, 'INVALID_NUMBER');
    });

    it('should categorize disconnected error', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      
      const error = new Error('Number not found');
      error.status = 404;
      
      const category = qm.categorizeError(error);
      assert.strictEqual(category, 'DISCONNECTED');
    });

    it('should categorize timeout error', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      
      const error = new Error('Request timeout');
      error.code = 'ECONNABORTED';
      
      const category = qm.categorizeError(error);
      assert.strictEqual(category, 'TIMEOUT');
    });

    it('should default to API_ERROR', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      
      const error = new Error('Unknown error');
      
      const category = qm.categorizeError(error);
      assert.strictEqual(category, 'API_ERROR');
    });
  });

  describe('getProgress', () => {
    it('should return correct progress', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      qm.contacts = [
        { id: 1, phone: '1' },
        { id: 2, phone: '2' },
        { id: 3, phone: '3' }
      ];
      qm.currentIndex = 1;
      qm.sentCount = 1;
      qm.failedCount = 0;
      qm.status = 'running';
      
      const progress = qm.getProgress();
      
      assert.strictEqual(progress.stats.total, 3);
      assert.strictEqual(progress.stats.sent, 1);
      assert.strictEqual(progress.stats.pending, 2);
      assert.strictEqual(progress.stats.failed, 0);
      assert.ok(progress.stats.successRate > 0);
    });

    it('should handle empty contacts', () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      qm.contacts = [];
      
      const progress = qm.getProgress();
      
      assert.strictEqual(progress.stats.total, 0);
      assert.strictEqual(progress.stats.successRate, 0);
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const qm = new QueueManager('test', mockConfig, mockDb);
      
      const start = Date.now();
      await qm.sleep(100);
      const elapsed = Date.now() - start;
      
      assert.ok(elapsed >= 100);
      assert.ok(elapsed < 150);
    });
  });
});
