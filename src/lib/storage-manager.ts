/**
 * Storage Manager with TTL and LRU eviction
 * Prevents memory leaks by implementing size limits and automatic cleanup
 */

interface StorageEntry<T> {
  value: T
  expires: number
  created: number
  size: number
}

interface StorageManagerOptions {
  prefix?: string
  maxSize?: number // in bytes
  defaultTTL?: number // in milliseconds
  cleanupInterval?: number // in milliseconds
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TTL = 3600000 // 1 hour
const DEFAULT_CLEANUP_INTERVAL = 60000 // 1 minute

/**
 * LocalStorage manager with TTL, size limits, and LRU eviction
 */
export class StorageManager {
  private prefix: string
  private maxSize: number
  private defaultTTL: number
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null

  constructor(options: StorageManagerOptions = {}) {
    this.prefix = options.prefix || 'wasendgo_'
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE
    this.defaultTTL = options.defaultTTL || DEFAULT_TTL

    // Start cleanup interval
    if (typeof window !== 'undefined') {
      this.startCleanupInterval(options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL)
    }
  }

  /**
   * Store a value with optional TTL
   */
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): boolean {
    try {
      const entry: StorageEntry<T> = {
        value,
        expires: Date.now() + ttl,
        created: Date.now(),
        size: 0
      }

      const serialized = JSON.stringify(entry)
      entry.size = serialized.length

      // Check if we need to evict
      const currentSize = this.getSize()
      const newSize = currentSize + entry.size

      if (newSize > this.maxSize) {
        this.evictUntilFits(entry.size)
      }

      localStorage.setItem(this.prefix + key, serialized)
      return true
    } catch (error) {
      // Storage full or other error
      console.warn('StorageManager: Failed to store item', { key, error })
      
      // Try to evict and retry once
      try {
        this.evictOldest()
        const entry: StorageEntry<T> = {
          value,
          expires: Date.now() + ttl,
          created: Date.now(),
          size: 0
        }
        const serialized = JSON.stringify(entry)
        localStorage.setItem(this.prefix + key, serialized)
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Get a value, returns null if expired or not found
   */
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + key)
      if (!raw) return null

      const entry: StorageEntry<T> = JSON.parse(raw)

      // Check expiration
      if (Date.now() > entry.expires) {
        this.remove(key)
        return null
      }

      return entry.value
    } catch {
      return null
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Remove a specific key
   */
  remove(key: string): void {
    localStorage.removeItem(this.prefix + key)
  }

  /**
   * Clear all items with this prefix
   */
  clear(): void {
    const keys = this.getAllKeys()
    keys.forEach(key => {
      localStorage.removeItem(key)
    })
  }

  /**
   * Get total size of stored items (in bytes)
   */
  getSize(): number {
    let totalSize = 0
    const keys = this.getAllKeys()

    keys.forEach(key => {
      const item = localStorage.getItem(key)
      if (item) {
        totalSize += item.length * 2 // UTF-16 encoding
      }
    })

    return totalSize
  }

  /**
   * Get all keys with this prefix
   */
  private getAllKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.prefix)) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Get all entries sorted by creation time (oldest first)
   */
  private getEntriesSortedByAge(): { key: string; entry: StorageEntry<unknown> }[] {
    const entries: { key: string; entry: StorageEntry<unknown> }[] = []
    const keys = this.getAllKeys()

    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const entry = JSON.parse(raw) as StorageEntry<unknown>
          entries.push({ key, entry })
        }
      } catch {
        // Invalid entry, will be cleaned up
      }
    })

    // Sort by created time (oldest first for LRU)
    return entries.sort((a, b) => a.entry.created - b.entry.created)
  }

  /**
   * Evict oldest entries until we have enough space
   */
  private evictUntilFits(neededSize: number): void {
    const entries = this.getEntriesSortedByAge()
    let freedSize = 0
    const targetFree = neededSize + (this.maxSize * 0.1) // Free 10% extra

    for (const { key, entry } of entries) {
      if (freedSize >= targetFree) break

      localStorage.removeItem(key)
      freedSize += entry.size || 100 // Estimate if size not stored
    }
  }

  /**
   * Evict the oldest entry
   */
  private evictOldest(): void {
    const entries = this.getEntriesSortedByAge()
    if (entries.length > 0) {
      localStorage.removeItem(entries[0].key)
    }
  }

  /**
   * Remove all expired entries
   */
  cleanupExpired(): number {
    let removed = 0
    const keys = this.getAllKeys()
    const now = Date.now()

    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const entry = JSON.parse(raw) as StorageEntry<unknown>
          if (now > entry.expires) {
            localStorage.removeItem(key)
            removed++
          }
        }
      } catch {
        // Invalid entry, remove it
        localStorage.removeItem(key)
        removed++
      }
    })

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
      const removed = this.cleanupExpired()
      if (removed > 0) {
        console.debug(`StorageManager: Cleaned up ${removed} expired entries`)
      }

      // Check size and warn if approaching limit
      const currentSize = this.getSize()
      const usagePercent = (currentSize / this.maxSize) * 100
      if (usagePercent > 80) {
        console.warn(`StorageManager: Storage usage at ${usagePercent.toFixed(1)}%`)
      }
    }, interval)
  }

  /**
   * Stop cleanup interval (call on app unmount)
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { size: number; maxSize: number; itemCount: number; usagePercent: number } {
    const size = this.getSize()
    const itemCount = this.getAllKeys().length

    return {
      size,
      maxSize: this.maxSize,
      itemCount,
      usagePercent: (size / this.maxSize) * 100
    }
  }
}

// Default singleton instance
export const storageManager = new StorageManager()

export default StorageManager
