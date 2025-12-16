/**
 * Tests for ReportGenerator Service
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const ReportGenerator = require('./ReportGenerator');

describe('ReportGenerator', () => {
  // Mock database
  const mockDb = {
    query: async () => ({ rows: [] })
  };

  describe('calculateStatistics', () => {
    it('should calculate correct statistics', () => {
      const generator = new ReportGenerator(mockDb);
      
      const contacts = [
        { status: 'sent' },
        { status: 'sent' },
        { status: 'failed' },
        { status: 'pending' }
      ];
      
      const stats = generator.calculateStatistics(contacts);
      
      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.sent, 2);
      assert.strictEqual(stats.failed, 1);
      assert.strictEqual(stats.pending, 1);
      assert.strictEqual(stats.successRate, 50);
    });

    it('should handle empty contacts', () => {
      const generator = new ReportGenerator(mockDb);
      
      const stats = generator.calculateStatistics([]);
      
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.successRate, 0);
    });

    it('should calculate 100% success rate', () => {
      const generator = new ReportGenerator(mockDb);
      
      const contacts = [
        { status: 'sent' },
        { status: 'sent' }
      ];
      
      const stats = generator.calculateStatistics(contacts);
      
      assert.strictEqual(stats.successRate, 100);
    });
  });

  describe('categorizeErrors', () => {
    it('should categorize errors correctly', () => {
      const generator = new ReportGenerator(mockDb);
      
      const contacts = [
        { status: 'failed', errorType: 'invalid_number' },
        { status: 'failed', errorType: 'invalid_number' },
        { status: 'failed', errorType: 'timeout' },
        { status: 'sent' }
      ];
      
      const errors = generator.categorizeErrors(contacts);
      
      assert.strictEqual(errors.invalid_number, 2);
      assert.strictEqual(errors.timeout, 1);
      assert.strictEqual(errors.disconnected, 0);
      assert.strictEqual(errors.api_error, 0);
    });

    it('should handle unknown error types', () => {
      const generator = new ReportGenerator(mockDb);
      
      const contacts = [
        { status: 'failed', errorType: 'unknown_error' }
      ];
      
      const errors = generator.categorizeErrors(contacts);
      
      assert.strictEqual(errors.api_error, 1);
    });

    it('should handle contacts without errors', () => {
      const generator = new ReportGenerator(mockDb);
      
      const contacts = [
        { status: 'sent' },
        { status: 'pending' }
      ];
      
      const errors = generator.categorizeErrors(contacts);
      
      assert.strictEqual(errors.invalid_number, 0);
      assert.strictEqual(errors.timeout, 0);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in seconds', () => {
      const generator = new ReportGenerator(mockDb);
      
      const campaign = {
        started_at: '2025-01-01T10:00:00Z',
        completed_at: '2025-01-01T10:05:00Z'
      };
      
      const duration = generator.calculateDuration(campaign);
      
      assert.strictEqual(duration, 300); // 5 minutes
    });

    it('should return 0 for missing dates', () => {
      const generator = new ReportGenerator(mockDb);
      
      const campaign = {
        started_at: null,
        completed_at: null
      };
      
      const duration = generator.calculateDuration(campaign);
      
      assert.strictEqual(duration, 0);
    });

    it('should handle partial dates', () => {
      const generator = new ReportGenerator(mockDb);
      
      const campaign = {
        started_at: '2025-01-01T10:00:00Z',
        completed_at: null
      };
      
      const duration = generator.calculateDuration(campaign);
      
      assert.strictEqual(duration, 0);
    });
  });

  describe('escapeCSV', () => {
    it('should escape values with commas', () => {
      const generator = new ReportGenerator(mockDb);
      
      const result = generator.escapeCSV('Hello, World');
      
      assert.strictEqual(result, '"Hello, World"');
    });

    it('should escape values with quotes', () => {
      const generator = new ReportGenerator(mockDb);
      
      const result = generator.escapeCSV('Say "Hello"');
      
      assert.strictEqual(result, '"Say ""Hello"""');
    });

    it('should not escape simple values', () => {
      const generator = new ReportGenerator(mockDb);
      
      const result = generator.escapeCSV('Hello World');
      
      assert.strictEqual(result, 'Hello World');
    });

    it('should handle null and undefined', () => {
      const generator = new ReportGenerator(mockDb);
      
      assert.strictEqual(generator.escapeCSV(null), '');
      assert.strictEqual(generator.escapeCSV(undefined), '');
    });
  });

  describe('calculateAverageStats', () => {
    it('should calculate averages correctly', () => {
      const generator = new ReportGenerator(mockDb);
      
      const reports = [
        { stats: { successRate: 80, total: 100 }, duration: 300 },
        { stats: { successRate: 90, total: 200 }, duration: 600 }
      ];
      
      const avg = generator.calculateAverageStats(reports);
      
      assert.strictEqual(avg.successRate, 85);
      assert.strictEqual(avg.duration, 450);
      assert.strictEqual(avg.totalContacts, 150);
    });

    it('should handle empty reports', () => {
      const generator = new ReportGenerator(mockDb);
      
      const avg = generator.calculateAverageStats([]);
      
      assert.strictEqual(avg.successRate, 0);
      assert.strictEqual(avg.duration, 0);
      assert.strictEqual(avg.totalContacts, 0);
    });
  });

  describe('findBestCampaign', () => {
    it('should find campaign with highest success rate', () => {
      const generator = new ReportGenerator(mockDb);
      
      const reports = [
        { campaignId: '1', stats: { successRate: 80 } },
        { campaignId: '2', stats: { successRate: 95 } },
        { campaignId: '3', stats: { successRate: 70 } }
      ];
      
      const best = generator.findBestCampaign(reports);
      
      assert.strictEqual(best.campaignId, '2');
    });

    it('should return null for empty reports', () => {
      const generator = new ReportGenerator(mockDb);
      
      const best = generator.findBestCampaign([]);
      
      assert.strictEqual(best, null);
    });
  });

  describe('findWorstCampaign', () => {
    it('should find campaign with lowest success rate', () => {
      const generator = new ReportGenerator(mockDb);
      
      const reports = [
        { campaignId: '1', stats: { successRate: 80 } },
        { campaignId: '2', stats: { successRate: 95 } },
        { campaignId: '3', stats: { successRate: 70 } }
      ];
      
      const worst = generator.findWorstCampaign(reports);
      
      assert.strictEqual(worst.campaignId, '3');
    });

    it('should return null for empty reports', () => {
      const generator = new ReportGenerator(mockDb);
      
      const worst = generator.findWorstCampaign([]);
      
      assert.strictEqual(worst, null);
    });
  });

  describe('generateInsights', () => {
    it('should generate success insight for high success rate', () => {
      const generator = new ReportGenerator(mockDb);
      
      const reports = [
        { stats: { successRate: 95, total: 100 }, duration: 300, errorsByType: {} }
      ];
      
      const insights = generator.generateInsights(reports);
      
      assert.ok(insights.some(i => i.type === 'success'));
    });

    it('should generate warning for low success rate', () => {
      const generator = new ReportGenerator(mockDb);
      
      const reports = [
        { stats: { successRate: 65, total: 100 }, duration: 300, errorsByType: {} }
      ];
      
      const insights = generator.generateInsights(reports);
      
      assert.ok(insights.some(i => i.type === 'warning'));
    });

    it('should handle empty reports', () => {
      const generator = new ReportGenerator(mockDb);
      
      const insights = generator.generateInsights([]);
      
      assert.ok(Array.isArray(insights));
      assert.strictEqual(insights.length, 0);
    });
  });
});
