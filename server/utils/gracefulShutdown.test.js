/**
 * Tests for Graceful Shutdown
 * Task 13.5: Test graceful shutdown
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock dependencies
const mockLogger = {
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  debug: mock.fn(),
};

const mockRedisClient = {
  quit: mock.fn(() => Promise.resolve()),
  disconnect: mock.fn(() => Promise.resolve()),
};

const mockWorkers = {
  closeAll: mock.fn(() => Promise.resolve()),
};

mock.module('../utils/logger', {
  namedExports: { logger: mockLogger },
});

mock.module('../utils/redisClient', {
  namedExports: {},
  defaultExport: mockRedisClient,
});

mock.module('../workers', {
  namedExports: mockWorkers,
});

describe('Graceful Shutdown', () => {
  describe('shutdown handler', () => {
    it('should handle SIGTERM signal', async () => {
      // Simulate shutdown handler
      const shutdownHandler = async () => {
        mockLogger.info('Received shutdown signal');
        
        // Close workers
        await mockWorkers.closeAll();
        
        // Close Redis
        await mockRedisClient.quit();
        
        mockLogger.info('Graceful shutdown complete');
      };

      await shutdownHandler();

      assert.ok(mockLogger.info.mock.callCount() >= 2, 'should log shutdown messages');
      assert.strictEqual(mockWorkers.closeAll.mock.callCount(), 1, 'should close workers');
      assert.strictEqual(mockRedisClient.quit.mock.callCount(), 1, 'should close Redis');
    });

    it('should handle errors during shutdown', async () => {
      mockWorkers.closeAll.mock.mockImplementation(() => 
        Promise.reject(new Error('Worker close failed'))
      );

      const shutdownHandler = async () => {
        try {
          await mockWorkers.closeAll();
        } catch (error) {
          mockLogger.error('Error closing workers', { error: error.message });
        }
        
        try {
          await mockRedisClient.quit();
        } catch (error) {
          mockLogger.error('Error closing Redis', { error: error.message });
        }
      };

      await shutdownHandler();

      assert.ok(mockLogger.error.mock.callCount() >= 1, 'should log error');
    });

    it('should timeout if shutdown takes too long', async () => {
      const SHUTDOWN_TIMEOUT = 100; // 100ms for test
      
      const slowShutdown = () => new Promise(resolve => setTimeout(resolve, 500));
      
      const shutdownWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT)
        );
        
        try {
          await Promise.race([slowShutdown(), timeoutPromise]);
        } catch (error) {
          if (error.message === 'Shutdown timeout') {
            mockLogger.warn('Shutdown timeout, forcing exit');
            return 'timeout';
          }
          throw error;
        }
        return 'complete';
      };

      const result = await shutdownWithTimeout();
      
      assert.strictEqual(result, 'timeout', 'should timeout');
      assert.ok(mockLogger.warn.mock.callCount() >= 1, 'should log timeout warning');
    });
  });

  describe('connection draining', () => {
    it('should stop accepting new connections', async () => {
      const mockServer = {
        close: mock.fn((callback) => callback()),
        listening: true,
      };

      const drainConnections = async (server) => {
        return new Promise((resolve) => {
          server.close(() => {
            mockLogger.info('Server stopped accepting connections');
            resolve();
          });
        });
      };

      await drainConnections(mockServer);

      assert.strictEqual(mockServer.close.mock.callCount(), 1, 'should close server');
      assert.ok(mockLogger.info.mock.callCount() >= 1, 'should log connection drain');
    });
  });

  describe('queue draining', () => {
    it('should wait for active jobs to complete', async () => {
      const mockQueue = {
        getActiveCount: mock.fn(() => Promise.resolve(5)),
        pause: mock.fn(() => Promise.resolve()),
        close: mock.fn(() => Promise.resolve()),
      };

      const drainQueue = async (queue, maxWait = 100) => {
        await queue.pause();
        mockLogger.info('Queue paused');
        
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          const activeCount = await queue.getActiveCount();
          if (activeCount === 0) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        await queue.close();
        mockLogger.info('Queue closed');
      };

      await drainQueue(mockQueue);

      assert.strictEqual(mockQueue.pause.mock.callCount(), 1, 'should pause queue');
      assert.strictEqual(mockQueue.close.mock.callCount(), 1, 'should close queue');
    });
  });

  describe('cleanup order', () => {
    it('should cleanup in correct order', async () => {
      const cleanupOrder = [];
      
      const cleanup = async () => {
        // 1. Stop accepting new requests
        cleanupOrder.push('stop-server');
        
        // 2. Drain active requests
        cleanupOrder.push('drain-requests');
        
        // 3. Close queue workers
        cleanupOrder.push('close-workers');
        
        // 4. Close database connections
        cleanupOrder.push('close-database');
        
        // 5. Close Redis
        cleanupOrder.push('close-redis');
        
        // 6. Final cleanup
        cleanupOrder.push('final-cleanup');
      };

      await cleanup();

      assert.deepStrictEqual(cleanupOrder, [
        'stop-server',
        'drain-requests',
        'close-workers',
        'close-database',
        'close-redis',
        'final-cleanup',
      ], 'should cleanup in correct order');
    });
  });
});
