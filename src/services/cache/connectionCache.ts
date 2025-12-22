/**
 * ConnectionCache - Service for caching database connections and user records
 * 
 * Implements a simple in-memory cache with TTL (Time To Live) support.
 * Used to reduce API calls and improve performance when navigating between
 * database connections in the sidebar.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class ConnectionCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Store data in cache with optional TTL
   * @param key - Unique identifier for the cached data
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Retrieve data from cache if not expired
   * @param key - Unique identifier for the cached data
   * @returns Cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Remove a specific entry from cache
   * @param key - Unique identifier for the cached data
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Remove all entries matching a pattern
   * @param pattern - Regular expression to match cache keys
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in cache
   * @returns Number of cached entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists in cache (regardless of expiration)
   * @param key - Unique identifier to check
   * @returns True if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all cache keys
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Singleton instance
export const connectionCache = new ConnectionCache();
