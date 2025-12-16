import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionCache } from './connectionCache';

describe('ConnectionCache', () => {
  let cache: ConnectionCache;

  beforeEach(() => {
    cache = new ConnectionCache();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const testData = { id: 1, name: 'Test Connection' };
      cache.set('test-key', testData);

      const retrieved = cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should store different types of data', () => {
      cache.set('string', 'test string');
      cache.set('number', 42);
      cache.set('array', [1, 2, 3]);
      cache.set('object', { nested: { value: true } });

      expect(cache.get('string')).toBe('test string');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('object')).toEqual({ nested: { value: true } });
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should overwrite existing data with same key', () => {
      cache.set('key', 'first value');
      cache.set('key', 'second value');

      expect(cache.get('key')).toBe('second value');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL', () => {
      cache.set('short-lived', 'data', 100); // 100ms TTL
      
      // Should exist immediately
      expect(cache.get('short-lived')).toBe('data');
    });

    it('should expire data after TTL', async () => {
      cache.set('expires-soon', 'data', 50); // 50ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should be expired
      expect(cache.get('expires-soon')).toBeNull();
    });

    it('should use default TTL of 5 minutes when not specified', () => {
      const testData = { value: 'test' };
      cache.set('default-ttl', testData);

      // Should still exist after a short time
      expect(cache.get('default-ttl')).toEqual(testData);
    });

    it('should not expire data before TTL', async () => {
      cache.set('long-lived', 'data', 1000); // 1 second TTL
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still exist
      expect(cache.get('long-lived')).toBe('data');
    });
  });

  describe('invalidate', () => {
    it('should remove specific cache entry', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should handle invalidating non-existent keys', () => {
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });

    it('should allow re-setting after invalidation', () => {
      cache.set('key', 'first');
      cache.invalidate('key');
      cache.set('key', 'second');

      expect(cache.get('key')).toBe('second');
    });
  });

  describe('invalidatePattern', () => {
    beforeEach(() => {
      cache.set('user-connections:token1', ['conn1', 'conn2']);
      cache.set('user-connections:token2', ['conn3']);
      cache.set('user-record:token1:1', { id: 1 });
      cache.set('user-record:token1:2', { id: 2 });
      cache.set('other-data', 'value');
    });

    it('should invalidate all entries matching pattern', () => {
      cache.invalidatePattern(/^user-connections:/);

      expect(cache.get('user-connections:token1')).toBeNull();
      expect(cache.get('user-connections:token2')).toBeNull();
      expect(cache.get('user-record:token1:1')).toEqual({ id: 1 });
      expect(cache.get('other-data')).toBe('value');
    });

    it('should invalidate user-specific records', () => {
      cache.invalidatePattern(/^user-record:token1:/);

      expect(cache.get('user-record:token1:1')).toBeNull();
      expect(cache.get('user-record:token1:2')).toBeNull();
      expect(cache.get('user-connections:token1')).toEqual(['conn1', 'conn2']);
    });

    it('should handle patterns that match nothing', () => {
      const sizeBefore = cache.size();
      cache.invalidatePattern(/^non-matching-pattern:/);
      
      expect(cache.size()).toBe(sizeBefore);
    });

    it('should handle complex regex patterns', () => {
      cache.invalidatePattern(/token1/);

      expect(cache.get('user-connections:token1')).toBeNull();
      expect(cache.get('user-record:token1:1')).toBeNull();
      expect(cache.get('user-record:token1:2')).toBeNull();
      expect(cache.get('user-connections:token2')).toEqual(['conn3']);
    });
  });

  describe('clear', () => {
    it('should remove all cache entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.size()).toBe(0);
    });

    it('should allow setting data after clear', () => {
      cache.set('key', 'value');
      cache.clear();
      cache.set('new-key', 'new-value');

      expect(cache.get('new-key')).toBe('new-value');
    });
  });

  describe('size', () => {
    it('should return correct number of entries', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.invalidate('key1');
      expect(cache.size()).toBe(1);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return true even for expired entries', async () => {
      cache.set('expires', 'value', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // has() checks existence, not expiration
      expect(cache.has('expires')).toBe(true);
      // but get() should return null
      expect(cache.get('expires')).toBeNull();
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array when cache is empty', () => {
      expect(cache.keys()).toEqual([]);
    });
  });

  describe('real-world usage scenarios', () => {
    it('should cache user connections with appropriate TTL', () => {
      const userToken = 'abc123';
      const connections = [
        { id: 1, name: 'Connection 1' },
        { id: 2, name: 'Connection 2' }
      ];

      // Cache for 5 minutes (default)
      cache.set(`user-connections:${userToken}`, connections);

      const cached = cache.get(`user-connections:${userToken}`);
      expect(cached).toEqual(connections);
    });

    it('should cache user records with shorter TTL', () => {
      const userToken = 'abc123';
      const connectionId = 1;
      const record = { id: 1, name: 'User Record' };

      // Cache for 2 minutes
      cache.set(`user-record:${userToken}:${connectionId}`, record, 120000);

      const cached = cache.get(`user-record:${userToken}:${connectionId}`);
      expect(cached).toEqual(record);
    });

    it('should invalidate user record cache after update', () => {
      const userToken = 'abc123';
      const connectionId = 1;
      const record = { id: 1, name: 'Original' };

      cache.set(`user-record:${userToken}:${connectionId}`, record);

      // Simulate update
      cache.invalidate(`user-record:${userToken}:${connectionId}`);

      expect(cache.get(`user-record:${userToken}:${connectionId}`)).toBeNull();
    });

    it('should invalidate all user data on logout', () => {
      const userToken = 'abc123';
      
      cache.set(`user-connections:${userToken}`, []);
      cache.set(`user-record:${userToken}:1`, {});
      cache.set(`user-record:${userToken}:2`, {});
      cache.set(`other-data`, 'should remain');

      // Invalidate all user-specific data
      cache.invalidatePattern(new RegExp(`^user-.*:${userToken}`));

      expect(cache.get(`user-connections:${userToken}`)).toBeNull();
      expect(cache.get(`user-record:${userToken}:1`)).toBeNull();
      expect(cache.get(`user-record:${userToken}:2`)).toBeNull();
      expect(cache.get('other-data')).toBe('should remain');
    });
  });
});
