/**
 * Redis Client Singleton
 * 
 * Provides a centralized Redis connection with:
 * - Lazy connection (connects on first use)
 * - Automatic reconnection
 * - Graceful fallback when Redis is unavailable
 * - JSON serialization/deserialization
 */

const Redis = require('ioredis');
const { logger } = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
  }

  /**
   * Get Redis configuration from environment
   */
  getConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryStrategy: (times) => {
        if (times > this.maxConnectionAttempts) {
          logger.warn('Redis max connection attempts reached, disabling cache', {
            attempts: times
          });
          this.isEnabled = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
    };
  }

  /**
   * Connect to Redis
   * @returns {Redis|null} Redis client or null if disabled
   */
  connect() {
    if (!this.isEnabled) {
      logger.debug('Redis is disabled, skipping connection');
      return null;
    }

    if (this.client) {
      return this.client;
    }

    const config = this.getConfig();
    
    logger.info('Connecting to Redis', {
      host: config.host,
      port: config.port,
      db: config.db
    });

    this.client = new Redis(config);

    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      logger.info('Redis connected successfully', {
        host: config.host,
        port: config.port
      });
    });

    this.client.on('ready', () => {
      logger.debug('Redis client ready');
    });

    this.client.on('error', (err) => {
      this.connectionAttempts++;
      logger.error('Redis connection error', { 
        error: err.message,
        code: err.code,
        attempt: this.connectionAttempts
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (delay) => {
      logger.debug('Redis reconnecting', { delay });
    });

    // Attempt initial connection
    this.client.connect().catch((err) => {
      logger.warn('Redis initial connection failed', { error: err.message });
    });

    return this.client;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Parsed value or null
   */
  async get(key) {
    if (!this.isEnabled || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        logger.debug('Redis GET', { key, hit: true });
        return JSON.parse(value);
      }
      logger.debug('Redis GET', { key, hit: false });
      return null;
    } catch (error) {
      logger.warn('Redis GET error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttlSeconds - Time to live in seconds (default: 300)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isEnabled || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      logger.debug('Redis SET', { key, ttl: ttlSeconds });
      return true;
    } catch (error) {
      logger.warn('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.isEnabled || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      logger.debug('Redis DEL', { key });
      return true;
    } catch (error) {
      logger.warn('Redis DEL error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param {string} pattern - Pattern to match (e.g., 'plans:*')
   * @returns {Promise<boolean>} Success status
   */
  async invalidatePattern(pattern) {
    if (!this.isEnabled || !this.isConnected) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.debug('Redis invalidatePattern', { pattern, keysDeleted: keys.length });
      }
      return true;
    } catch (error) {
      logger.warn('Redis invalidatePattern error', { pattern, error: error.message });
      return false;
    }
  }

  /**
   * Check if Redis is healthy
   * @returns {Promise<{connected: boolean, latency?: number, error?: string}>}
   */
  async healthCheck() {
    if (!this.isEnabled) {
      return { connected: false, error: 'Redis disabled' };
    }

    if (!this.client || !this.isConnected) {
      return { connected: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        connected: pong === 'PONG',
        latency
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      logger.info('Disconnecting from Redis');
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
module.exports = new RedisClient();
