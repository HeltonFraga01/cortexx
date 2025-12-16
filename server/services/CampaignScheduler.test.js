/**
 * Tests for CampaignScheduler Service
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const CampaignScheduler = require('./CampaignScheduler');

describe('CampaignScheduler', () => {
  let scheduler;
  let mockDb;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: async (sql, params) => {
        // Simular resposta vazia por padrão
        return { rows: [] };
      }
    };

    scheduler = new CampaignScheduler(mockDb);
  });

  afterEach(() => {
    if (scheduler.isRunning) {
      scheduler.stop();
    }
  });

  describe('constructor', () => {
    it('should create CampaignScheduler instance', () => {
      assert.strictEqual(scheduler.isRunning, false);
      assert.strictEqual(scheduler.checkInterval, 60000);
      assert.ok(scheduler.activeQueues instanceof Map);
      assert.strictEqual(scheduler.activeQueues.size, 0);
    });
  });

  describe('start and stop', () => {
    it('should start scheduler', () => {
      scheduler.start();
      
      assert.strictEqual(scheduler.isRunning, true);
      assert.ok(scheduler.intervalId !== null);
    });

    it('should not start if already running', () => {
      scheduler.start();
      const firstIntervalId = scheduler.intervalId;
      
      scheduler.start();
      
      assert.strictEqual(scheduler.intervalId, firstIntervalId);
    });

    it('should stop scheduler', () => {
      scheduler.start();
      scheduler.stop();
      
      assert.strictEqual(scheduler.isRunning, false);
      assert.strictEqual(scheduler.intervalId, null);
    });

    it('should handle stop when not running', () => {
      scheduler.stop();
      
      assert.strictEqual(scheduler.isRunning, false);
    });
  });

  describe('getActiveQueue', () => {
    it('should return undefined for non-existent campaign', () => {
      const queue = scheduler.getActiveQueue('non-existent');
      
      assert.strictEqual(queue, undefined);
    });
  });

  describe('getActiveQueues', () => {
    it('should return empty array when no active queues', () => {
      const queues = scheduler.getActiveQueues();
      
      assert.ok(Array.isArray(queues));
      assert.strictEqual(queues.length, 0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const stats = scheduler.getStats();
      
      assert.strictEqual(stats.isRunning, false);
      assert.strictEqual(stats.checkInterval, 60000);
      assert.strictEqual(stats.activeQueuesCount, 0);
      assert.ok(Array.isArray(stats.activeQueues));
    });

    it('should reflect running state', () => {
      scheduler.start();
      const stats = scheduler.getStats();
      
      assert.strictEqual(stats.isRunning, true);
    });
  });



  describe('failCampaign', () => {
    it('should update campaign status to failed', async () => {
      let queryCalls = [];

      mockDb.query = async (sql, params) => {
        queryCalls.push({ sql, params });
        return { rows: [], changes: 1 };
      };

      await scheduler.failCampaign('test-campaign', 'Test error');
      
      // Deve ter chamado query pelo menos uma vez (update status)
      assert.ok(queryCalls.length >= 1, 'Query should be called at least once');
      
      // A primeira query deve ser o update de status
      const statusUpdate = queryCalls.find(q => q.sql.includes('status = \'failed\''));
      assert.ok(statusUpdate, 'Should update status to failed');
      assert.ok(statusUpdate.params.includes('test-campaign'), 'Should include campaign id');
    });
  });

  describe('pauseCampaign', () => {
    it('should throw error if campaign not running', async () => {
      await assert.rejects(
        async () => {
          await scheduler.pauseCampaign('non-existent');
        },
        {
          message: 'Campanha não está em execução'
        }
      );
    });
  });

  describe('resumeCampaign', () => {
    it('should throw error if campaign not found', async () => {
      await assert.rejects(
        async () => {
          await scheduler.resumeCampaign('non-existent');
        },
        {
          message: 'Campanha não encontrada'
        }
      );
    });
  });

  describe('cancelCampaign', () => {
    it('should throw error if campaign not running', async () => {
      await assert.rejects(
        async () => {
          await scheduler.cancelCampaign('non-existent');
        },
        {
          message: 'Campanha não está em execução'
        }
      );
    });
  });

  describe('processing locks', () => {
    it('should acquire lock successfully', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      const result = await scheduler.acquireLock('test-campaign');
      
      assert.strictEqual(result, true);
      assert.strictEqual(scheduler.hasLock('test-campaign'), true);
    });

    it('should not acquire lock if already held in memory', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      // First acquisition
      await scheduler.acquireLock('test-campaign');
      
      // Second acquisition should fail
      const result = await scheduler.acquireLock('test-campaign');
      
      assert.strictEqual(result, false);
    });

    it('should not acquire lock if database update fails', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 0 }; // No rows updated
      };

      const result = await scheduler.acquireLock('test-campaign');
      
      assert.strictEqual(result, false);
      assert.strictEqual(scheduler.hasLock('test-campaign'), false);
    });

    it('should release lock successfully', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      // Acquire lock first
      await scheduler.acquireLock('test-campaign');
      assert.strictEqual(scheduler.hasLock('test-campaign'), true);
      
      // Release lock
      await scheduler.releaseLock('test-campaign');
      
      assert.strictEqual(scheduler.hasLock('test-campaign'), false);
    });

    it('should return active locks', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      await scheduler.acquireLock('campaign-1');
      await scheduler.acquireLock('campaign-2');
      
      const locks = scheduler.getActiveLocks();
      
      assert.ok(locks.includes('campaign-1'));
      assert.ok(locks.includes('campaign-2'));
      assert.strictEqual(locks.length, 2);
    });

    it('should include lock info in stats', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      await scheduler.acquireLock('test-campaign');
      
      const stats = scheduler.getStats();
      
      assert.strictEqual(stats.activeLocksCount, 1);
      assert.ok(stats.activeLocks.includes('test-campaign'));
      assert.ok(stats.instanceId); // Should have instance ID
    });
  });

  describe('cleanupQueue', () => {
    it('should remove queue from activeQueues and release lock', async () => {
      mockDb.query = async (sql, params) => {
        return { rows: [], changes: 1 };
      };

      // Setup: add a mock queue and acquire lock
      scheduler.activeQueues.set('test-campaign', { status: 'running' });
      await scheduler.acquireLock('test-campaign');
      
      assert.strictEqual(scheduler.activeQueues.has('test-campaign'), true);
      assert.strictEqual(scheduler.hasLock('test-campaign'), true);
      
      // Cleanup
      await scheduler.cleanupQueue('test-campaign');
      
      assert.strictEqual(scheduler.activeQueues.has('test-campaign'), false);
      assert.strictEqual(scheduler.hasLock('test-campaign'), false);
    });
  });
});
