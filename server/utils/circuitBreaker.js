/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by blocking requests after repeated failures
 * Requirements: 9.4
 */

const { logger } = require('./logger');

/**
 * Circuit breaker configuration
 */
const DEFAULT_CONFIG = {
  failureThreshold: 5,    // Number of failures before opening circuit
  failureWindow: 60000,   // Time window for counting failures (1 minute)
  resetTimeout: 30000,    // Time to wait before allowing retry (30 seconds)
};

/**
 * Circuit states
 */
const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Blocking requests
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
};

/**
 * Circuit breaker instances by key
 */
const circuits = new Map();

/**
 * Circuit Breaker class
 */
class CircuitBreaker {
  constructor(key, config = {}) {
    this.key = key;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.lastFailureTime = null;
    this.openedAt = null;
  }

  /**
   * Check if circuit allows request
   * @returns {{ allowed: boolean, reason?: string }}
   */
  canExecute() {
    this.cleanOldFailures();

    if (this.state === CircuitState.CLOSED) {
      return { allowed: true };
    }

    if (this.state === CircuitState.OPEN) {
      const timeSinceOpen = Date.now() - this.openedAt;
      
      if (timeSinceOpen >= this.config.resetTimeout) {
        // Transition to half-open
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker half-open', { 
          key: this.key,
          timeSinceOpen 
        });
        return { allowed: true };
      }

      const remainingTime = Math.ceil((this.config.resetTimeout - timeSinceOpen) / 1000);
      return { 
        allowed: false, 
        reason: `Circuito aberto. Aguarde ${remainingTime} segundos antes de tentar novamente.`
      };
    }

    // HALF_OPEN - allow one request to test
    return { allowed: true };
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      // Service recovered, close circuit
      this.state = CircuitState.CLOSED;
      this.failures = [];
      this.openedAt = null;
      
      logger.info('Circuit breaker closed (recovered)', { key: this.key });
    }
  }

  /**
   * Record a failed operation
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    this.cleanOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during test, reopen circuit
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      
      logger.warn('Circuit breaker reopened (test failed)', { 
        key: this.key,
        error: error?.message 
      });
      return;
    }

    if (this.failures.length >= this.config.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      this.openedAt = now;
      
      logger.warn('Circuit breaker opened', { 
        key: this.key,
        failureCount: this.failures.length,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * Remove failures outside the time window
   */
  cleanOldFailures() {
    const cutoff = Date.now() - this.config.failureWindow;
    this.failures = this.failures.filter(time => time > cutoff);
  }

  /**
   * Get current circuit status
   * @returns {{ state: string, failures: number, openedAt: number | null }}
   */
  getStatus() {
    this.cleanOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      openedAt: this.openedAt,
      threshold: this.config.failureThreshold,
      resetTimeout: this.config.resetTimeout,
    };
  }

  /**
   * Reset circuit to closed state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.openedAt = null;
    this.lastFailureTime = null;
    
    logger.info('Circuit breaker reset', { key: this.key });
  }
}

/**
 * Get or create a circuit breaker for a key
 * @param {string} key - Unique identifier (e.g., connection ID)
 * @param {Object} config - Optional configuration override
 * @returns {CircuitBreaker}
 */
function getCircuitBreaker(key, config = {}) {
  if (!circuits.has(key)) {
    circuits.set(key, new CircuitBreaker(key, config));
  }
  return circuits.get(key);
}

/**
 * Execute a function with circuit breaker protection
 * @param {string} key - Circuit breaker key
 * @param {Function} fn - Async function to execute
 * @param {Object} config - Optional configuration
 * @returns {Promise<any>}
 */
async function withCircuitBreaker(key, fn, config = {}) {
  const breaker = getCircuitBreaker(key, config);
  const { allowed, reason } = breaker.canExecute();

  if (!allowed) {
    const error = new Error(reason);
    error.code = 'CIRCUIT_OPEN';
    error.userMessage = reason;
    throw error;
  }

  try {
    const result = await fn();
    breaker.recordSuccess();
    return result;
  } catch (error) {
    breaker.recordFailure(error);
    throw error;
  }
}

/**
 * Reset a specific circuit breaker
 * @param {string} key - Circuit breaker key
 */
function resetCircuitBreaker(key) {
  const breaker = circuits.get(key);
  if (breaker) {
    breaker.reset();
  }
}

/**
 * Get status of all circuit breakers
 * @returns {Object}
 */
function getAllCircuitStatus() {
  const status = {};
  for (const [key, breaker] of circuits) {
    status[key] = breaker.getStatus();
  }
  return status;
}

/**
 * Clear all circuit breakers
 */
function clearAllCircuits() {
  circuits.clear();
  logger.info('All circuit breakers cleared');
}

module.exports = {
  CircuitBreaker,
  CircuitState,
  getCircuitBreaker,
  withCircuitBreaker,
  resetCircuitBreaker,
  getAllCircuitStatus,
  clearAllCircuits,
  DEFAULT_CONFIG,
};
