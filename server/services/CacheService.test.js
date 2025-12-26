/**
 * Tests for Cache Service Integration
 * Task 13.4: Create integration tests for cache
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock Redis client
const mockRedisClient = {
  healthCheck: mock.fn(() => Promise.resolve({ connected: true })),
  get: mock.fn(() => Promise.resolve(null)),
  set: mock.fn(() => Promise.resolve('OK')),
  del: mock.fn(() => Promise.resolve(1)),
  client: {
    get: mock.fn(() => Promise.resolve(null)),
    set: mock.fn(() => Promise.resolve('OK')),
    del: mock.fn(() => Promise.resolve(1)),
    setex: mock.fn(() => Promise.resolve('OK')),
    keys: mock.fn(() => Promise.resolve([])),
    mget: mock.fn(() => Promise.resolve([])),
  },
};

const mockLogger = {
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  debug: mock.fn(),
};

mock.module('../utils/redisClient', {
  namedExports: {},
  defaultExport: mockRedisClient,
});

mock.module('../utils/logger', {
  namedExports: { logger: mockLogger },
});

describe('CacheService Integration', () => {
  let CacheService;

  beforeEach(() => {
    // Reset mocks
    mockRedisClient.get.mock.resetCalls();
    mockRedisClient.set.mock.resetCalls();
    mockRedisClient.del.mock.resetCalls();
    mockRedisClient.client.get.mock.resetCalls();
    mockRedisClient.client.set.mock.resetCalls();
    
    // Re-require module
    delete require.cache[require.resolve('./CacheService')];
    CacheService = require('./CacheService');
  });

  describe('get', () => {
    it('should return null for cache miss', async () => {
      mockRedisClient.client.get.mock.mockImplementation(() => Promise.resolve(null));
      
      const result = await CacheService.get('test-key');
      
      assert.strictEqual(result, null, 'should return null for cache miss');
    });

    it('should return parsed value for cache hit', async () => {
      const testData = { foo: 'bar' };
      mockRedisClient.client.get.mock.mockImplementation(() => 
        Promise.resolve(JSON.stringify(testData))
      );
      
      const result = await CacheService.get('test-key');
      
      assert.deepStrictEqual(result, testData, 'should return parsed data');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.client.get.mock.mockImplementation(() => 
        Promise.reject(new Error('Redis error'))
      );
      
      const result = await CacheService.get('test-key');
      
      assert.strictEqual(result, null, 'should return null on error');
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      mockRedisClient.client.setex.mock.mockImplementation(() => Promise.resolve('OK'));
      
      const result = await CacheService.set('test-key', { foo: 'bar' }, 300);
      
      assert.strictEqual(result, true, 'should return true on success');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.client.setex.mock.mockImplementation(() => 
        Promise.reject(new Error('Redis error'))
      );
      
      const result = await CacheService.set('test-key', { foo: 'bar' }, 300);
      
      assert.strictEqual(result, false, 'should return false on error');
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedisClient.client.del.mock.mockImplementation(() => Promise.resolve(1));
      
      const result = await CacheService.del('test-key');
      
      assert.strictEqual(result, true, 'should return true on success');
    });

    it('should handle non-existent key', async () => {
      mockRedisClient.client.del.mock.mockImplementation(() => Promise.resolve(0));
      
      const result = await CacheService.del('non-existent-key');
      
      assert.strictEqual(result, true, 'should return true even for non-existent key');
    });
  });

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedisClient.client.keys.mock.mockImplementation(() => 
        Promise.resolve(['key1', 'key2', 'key3'])
      );
      mockRedisClient.client.del.mock.mockImplementation(() => Promise.resolve(3));
      
      const result = await CacheService.invalidatePattern('key*');
      
      assert.ok(result >= 0, 'should return count of deleted keys');
    });

    it('should handle no matching keys', async () => {
      mockRedisClient.client.keys.mock.mockImplementation(() => Promise.resolve([]));
      
      const result = await CacheService.invalidatePattern('nonexistent*');
      
      assert.strictEqual(result, 0, 'should return 0 for no matches');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { cached: true };
      mockRedisClient.client.get.mock.mockImplementation(() => 
        Promise.resolve(JSON.stringify(cachedData))
      );
      
      const fetchFn = mock.fn(() => Promise.resolve({ fresh: true }));
      const result = await CacheService.getOrSet('test-key', fetchFn, 300);
      
      assert.deepStrictEqual(result, cachedData, 'should return cached data');
      assert.strictEqual(fetchFn.mock.callCount(), 0, 'should not call fetch function');
    });

    it('should fetch and cache if not exists', async () => {
      mockRedisClient.client.get.mock.mockImplementation(() => Promise.resolve(null));
      mockRedisClient.client.setex.mock.mockImplementation(() => Promise.resolve('OK'));
      
      const freshData = { fresh: true };
      const fetchFn = mock.fn(() => Promise.resolve(freshData));
      const result = await CacheService.getOrSet('test-key', fetchFn, 300);
      
      assert.deepStrictEqual(result, freshData, 'should return fresh data');
      assert.strictEqual(fetchFn.mock.callCount(), 1, 'should call fetch function');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      mockRedisClient.healthCheck.mock.mockImplementation(() => 
        Promise.resolve({ connected: true, latency: 5 })
      );
      
      const health = await CacheService.healthCheck();
      
      assert.ok(health.connected !== undefined, 'should have connected status');
    });
  });
});
