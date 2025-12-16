/**
 * TTL Cache with LRU eviction
 * Provides in-memory caching with automatic expiration and size limits
 */

interface CacheEntry<T> {
  value: T
  expires: number
  lastAccessed: number
  size: number
}

interface CacheOptions {
  maxSize?: number
  defaultTTL?: number
  cleanupInterval?: number
  onEvict?: (key: string, value: unknown) => void
}

const DEFAULT_MAX_SIZE = 100
const DEFAULT_TTL = 300000 // 5 minutes
const DEFAULT_CLEANUP_INTERVAL = 60000 // 1 minute

/**
 * Generic TTL Cache with LRU eviction strategy
 * 
 * @example
 * ```typescript
 * const cache = new TTLCache<User>({ maxSize: 50, defaultTTL: 60000 })
 * cache.set('user:123', userData)
 * const user = cache.get('user:123')
 * ```
 */
export class TTLCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private defaultTTL: number
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null
  private onEvict?: (key: string, value: unknown) => void

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE
    this.defaultTTL = options.defaultTTL || DEFAULT_TTL
    this.onEvict = options.onEvict

    // Start cleanup interval
    this.startCleanupInterval(options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL)
  }

  /**
   * Store a value with optional TTL
   */
  set(key: string, value: T, ttl: number = this.defaultTTL): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      expires: Date.now() + ttl,
      lastAccessed: Date.now(),
      size: this.estimateSize(value)
    }

    this.cache.set(key, entry)
  }

  /**
   * Get a value, returns undefined if expired or not found
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check expiration
    if (Date.now() > entry.expires) {
      this.delete(key)
      return undefined
    }

    // Update last accessed time (LRU)
    entry.lastAccessed = Date.now()
    return entry.value
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expires) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry && this.onEvict) {
      this.onEvict(key, entry.value)
    }
    return this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache) {
        this.onEvict(key, entry.value)
      }
    }
    this.cache.clear()
  }

  /**
   * Get the number of entries
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get or set a value (useful for caching expensive operations)
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestKey = key
        oldestTime = entry.lastAccessed
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): number {
    let removed = 0
    const now = Date.now()

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(interval: number): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpired()
    }, interval)
  }

  /**
   * Stop cleanup interval (call on destroy)
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
    }
    this.clear()
  }

  /**
   * Estimate the size of a value in bytes
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2 // UTF-16
    } catch {
      return 100 // Default estimate
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalSize: number
  } {
    let totalSize = 0
    for (const entry of this.cache.values()) {
      totalSize += entry.size
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
      totalSize
    }
  }
}

// Create typed cache factories
export function createCache<T>(options?: CacheOptions): TTLCache<T> {
  return new TTLCache<T>(options)
}

// Default singleton for general use
export const defaultCache = new TTLCache()

export default TTLCache
