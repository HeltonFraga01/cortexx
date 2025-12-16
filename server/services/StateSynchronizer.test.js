/**
 * Tests for StateSynchronizer Service
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const StateSynchronizer = require('./StateSynchronizer');

describe('StateSynchronizer', () => {
  let synchronizer;
  let mockDb;
  let mockScheduler;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: async (sql, params) => {
        return { rows: [], changes: 1 };
      }
    };

    // Mock scheduler
    mockScheduler = {
      getActiveQueues: () => [],
      getActiveQueue: (id) => null
    };

    synchronizer = new StateSynchronizer(mockDb, mockScheduler);
  });

  afterEach(() => {
    if (synchronizer.isRunning) {
      synchronizer.stopSync();
    }
  });

  describe('constructor', () => {
    it('should create StateSynchronizer instance', () => {
      assert.strictEqual(synchronizer.isRunning, false);
      assert.strictEqual(synchronizer.syncInterval, 30000);
      assert.strictEqual(synchronizer.db, mockDb);
      assert.strictEqual(synchronizer.scheduler, mockScheduler);
    });
  });

  describe('startSync and stopSync', () => {
    it('should start synchronizer', () => {
      synchronizer.startSync();
      
      assert.strictEqual(synchronizer.isRunning, true);
      assert.ok(synchronizer.intervalId !== null);
    });

    it('should not start if already running', () => {
      synchronizer.startSync();
      const firstIntervalId = synchronizer.intervalId;
      
      synchronizer.startSync();
      
      assert.strictEqual(synchronizer.intervalId, firstIntervalId);
    });

    it('should stop synchronizer', () => {
      synchronizer.startSync();
      synchronizer.stopSync();
      
      assert.strictEqual(synchronizer.isRunning, false);
      assert.strictEqual(synchronizer.intervalId, null);
    });

    it('should handle stop when not running', () => {
      synchronizer.stopSync();
      
      assert.strictEqual(synchronizer.isRunning, false);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const stats = synchronizer.getStats();
      
      assert.strictEqual(stats.isRunning, false);
      assert.strictEqual(stats.syncInterval, 30000);
    });

    it('should reflect running state', () => {
      synchronizer.startSync();
      const stats = synchronizer.getStats();
      
      assert.strictEqual(stats.isRunning, true);
    });
  });

  describe('restoreRunningCampaigns', () => {
    it('should return empty array when no campaigns to restore', async () => {
      mockDb.query = async () => ({ rows: [] });
      
      const restored = await synchronizer.restoreRunningCampaigns();
      
      assert.deepStrictEqual(restored, []);
    });

    it('should restore running campaigns as paused', async () => {
      const campaigns = [
        { id: 'camp-1', name: 'Campaign 1', status: 'running' },
        { id: 'camp-2', name: 'Campaign 2', status: 'running' }
      ];
      
      let updateCalls = [];
      mockDb.query = async (sql, params) => {
        if (sql.includes('SELECT')) {
          return { rows: campaigns };
        }
        if (sql.includes('UPDATE')) {
          updateCalls.push(params);
          return { changes: 1 };
        }
        return { rows: [] };
      };
      
      const restored = await synchronizer.restoreRunningCampaigns();
      
      assert.strictEqual(restored.length, 2);
      assert.strictEqual(restored[0].newStatus, 'paused');
      assert.strictEqual(restored[1].newStatus, 'paused');
      assert.strictEqual(updateCalls.length, 2);
    });
  });

  describe('detectInconsistencies', () => {
    it('should return empty array when no inconsistencies', async () => {
      mockDb.query = async () => ({ rows: [] });
      
      const inconsistencies = await synchronizer.detectInconsistencies();
      
      assert.deepStrictEqual(inconsistencies, []);
    });

    it('should detect RUNNING_NOT_IN_MEMORY inconsistency', async () => {
      mockDb.query = async (sql) => {
        if (sql.includes('status = \'running\'')) {
          return { rows: [{ id: 'camp-1', name: 'Test', status: 'running' }] };
        }
        return { rows: [] };
      };
      
      const inconsistencies = await synchronizer.detectInconsistencies();
      
      assert.strictEqual(inconsistencies.length, 1);
      assert.strictEqual(inconsistencies[0].type, 'RUNNING_NOT_IN_MEMORY');
      assert.strictEqual(inconsistencies[0].campaignId, 'camp-1');
    });

    it('should detect STALE_LOCK inconsistency', async () => {
      mockDb.query = async (sql) => {
        if (sql.includes('-10 minutes')) {
          return { rows: [{ id: 'camp-1', name: 'Test', processing_lock: 'lock-123', lock_acquired_at: '2024-01-01' }] };
        }
        return { rows: [] };
      };
      
      const inconsistencies = await synchronizer.detectInconsistencies();
      
      const staleLock = inconsistencies.find(i => i.type === 'STALE_LOCK');
      assert.ok(staleLock);
      assert.strictEqual(staleLock.campaignId, 'camp-1');
    });
  });

  describe('autoCorrect', () => {
    it('should correct RUNNING_NOT_IN_MEMORY', async () => {
      let updateParams = null;
      mockDb.query = async (sql, params) => {
        updateParams = params;
        return { changes: 1 };
      };
      
      const inconsistencies = [{
        type: 'RUNNING_NOT_IN_MEMORY',
        campaignId: 'camp-1'
      }];
      
      const corrected = await synchronizer.autoCorrect(inconsistencies);
      
      assert.strictEqual(corrected, 1);
      assert.ok(updateParams.includes('paused'));
      assert.ok(updateParams.includes('camp-1'));
    });

    it('should correct STALE_LOCK', async () => {
      let updateCalled = false;
      mockDb.query = async (sql, params) => {
        if (sql.includes('processing_lock = NULL')) {
          updateCalled = true;
        }
        return { changes: 1 };
      };
      
      const inconsistencies = [{
        type: 'STALE_LOCK',
        campaignId: 'camp-1'
      }];
      
      const corrected = await synchronizer.autoCorrect(inconsistencies);
      
      assert.strictEqual(corrected, 1);
      assert.strictEqual(updateCalled, true);
    });
  });
});
