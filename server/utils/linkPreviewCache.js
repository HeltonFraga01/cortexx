/**
 * Link Preview Cache
 * 
 * LRU cache for storing link preview metadata
 * - TTL: 24 hours
 * - Max entries: 1000
 * - Automatic eviction of oldest entries
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

const { logger } = require('./logger');

const MAX_ENTRIES = 1000;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class LinkPreviewCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached preview data for a URL
   * @param {string} url - The URL to look up
   * @returns {object|null} - Cached data or null if not found/expired
   */
  get(url) {
    const entry = this.cache.get(url);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(url);
      logger.debug('Cache entry expired', { url });
      return null;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(url);
    this.cache.set(url, entry);
    
    return entry.data;
  }

  /**
   * Store preview data for a URL
   * @param {string} url - The URL key
   * @param {object} data - The preview data to cache
   */
  set(url, data) {
    // If URL already exists, delete it first (to update position)
    if (this.cache.has(url)) {
      this.cache.delete(url);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      logger.debug('Cache evicted oldest entry', { evictedUrl: oldestKey });
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Check if URL exists in cache (and is not expired)
   * @param {string} url - The URL to check
   * @returns {boolean}
   */
  has(url) {
    const entry = this.cache.get(url);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(url);
      return false;
    }

    return true;
  }

  /**
   * Get current cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    logger.debug('Cache cleared');
  }
}

// Export singleton instance
const linkPreviewCache = new LinkPreviewCache();

module.exports = linkPreviewCache;
