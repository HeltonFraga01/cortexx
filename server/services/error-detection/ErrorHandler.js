/**
 * Error Handler
 * 
 * Provides comprehensive error handling, graceful degradation,
 * retry logic, and fallback mechanisms for the error detection system.
 * 
 * @module error-detection/ErrorHandler
 */

const { EventEmitter } = require('events');

/**
 * Error types for the error detection system itself
 */
const SystemErrorType = {
  FILE_ACCESS: 'file_access',
  PARSER: 'parser',
  MEMORY: 'memory',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  DATABASE: 'database',
  ANALYZER: 'analyzer',
  UNKNOWN: 'unknown'
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    SystemErrorType.FILE_ACCESS,
    SystemErrorType.NETWORK,
    SystemErrorType.TIMEOUT
  ]
};

class ErrorHandler extends EventEmitter {
  /**
   * Creates a new ErrorHandler instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    this.errorLog = [];
    this.maxLogSize = options.maxLogSize || 1000;
    this.fallbackHandlers = new Map();
    this.recoveryStrategies = new Map();
    
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Sets up default recovery strategies
   */
  setupDefaultRecoveryStrategies() {
    // File access recovery
    this.recoveryStrategies.set(SystemErrorType.FILE_ACCESS, async (error, context) => {
      // Try to read with different encoding
      if (context.operation === 'read') {
        return { action: 'skip', reason: 'File not accessible' };
      }
      return { action: 'retry', delay: 100 };
    });
    
    // Parser recovery
    this.recoveryStrategies.set(SystemErrorType.PARSER, async (error, context) => {
      // Return partial results if available
      if (context.partialResult) {
        return { action: 'partial', result: context.partialResult };
      }
      return { action: 'skip', reason: 'Unable to parse file' };
    });
    
    // Memory recovery
    this.recoveryStrategies.set(SystemErrorType.MEMORY, async (error, context) => {
      // Suggest garbage collection and retry
      if (global.gc) {
        global.gc();
      }
      return { action: 'retry', delay: 1000 };
    });
    
    // Timeout recovery
    this.recoveryStrategies.set(SystemErrorType.TIMEOUT, async (error, context) => {
      // Increase timeout and retry
      return { 
        action: 'retry', 
        delay: 500,
        modifyContext: { timeout: (context.timeout || 5000) * 2 }
      };
    });
    
    // Analyzer recovery
    this.recoveryStrategies.set(SystemErrorType.ANALYZER, async (error, context) => {
      // Skip the failing analyzer and continue with others
      return { 
        action: 'skip_component', 
        component: context.analyzerName,
        reason: `Analyzer ${context.analyzerName} failed: ${error.message}`
      };
    });
  }

  /**
   * Handles an error with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   */
  async handleError(error, context = {}) {
    const errorType = this.classifyError(error);
    const errorEntry = this.logError(error, errorType, context);
    
    this.emit('error', { error, type: errorType, context });
    
    // Check for recovery strategy
    const strategy = this.recoveryStrategies.get(errorType);
    if (strategy) {
      try {
        const recovery = await strategy(error, context);
        this.emit('recovery', { error, type: errorType, recovery });
        return recovery;
      } catch (recoveryError) {
        this.emit('recovery_failed', { error, recoveryError });
      }
    }
    
    // Check for fallback handler
    const fallback = this.fallbackHandlers.get(context.operation);
    if (fallback) {
      try {
        const result = await fallback(error, context);
        this.emit('fallback', { error, result });
        return { action: 'fallback', result };
      } catch (fallbackError) {
        this.emit('fallback_failed', { error, fallbackError });
      }
    }
    
    // Default: skip and continue
    return { action: 'skip', reason: error.message };
  }

  /**
   * Classifies an error into a system error type
   * @param {Error} error - Error to classify
   * @returns {string} Error type
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    
    // File access errors
    if (code.includes('enoent') || code.includes('eacces') || 
        message.includes('no such file') || message.includes('permission denied')) {
      return SystemErrorType.FILE_ACCESS;
    }
    
    // Parser errors
    if (message.includes('parse') || message.includes('syntax') ||
        message.includes('unexpected token') || error.name === 'SyntaxError') {
      return SystemErrorType.PARSER;
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('heap') ||
        code.includes('enomem') || error.name === 'RangeError') {
      return SystemErrorType.MEMORY;
    }
    
    // Timeout errors
    if (message.includes('timeout') || code.includes('etimedout') ||
        error.name === 'TimeoutError') {
      return SystemErrorType.TIMEOUT;
    }
    
    // Network errors
    if (code.includes('econnrefused') || code.includes('enotfound') ||
        message.includes('network') || message.includes('connection')) {
      return SystemErrorType.NETWORK;
    }
    
    // Database errors
    if (message.includes('database') || message.includes('sqlite') ||
        message.includes('query')) {
      return SystemErrorType.DATABASE;
    }
    
    return SystemErrorType.UNKNOWN;
  }

  /**
   * Logs an error
   * @param {Error} error - Error to log
   * @param {string} type - Error type
   * @param {Object} context - Error context
   * @returns {Object} Error entry
   */
  logError(error, type, context) {
    const entry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message: error.message,
      stack: error.stack,
      code: error.code,
      context,
      timestamp: new Date()
    };
    
    this.errorLog.push(entry);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    return entry;
  }

  /**
   * Executes an operation with retry logic
   * @param {Function} operation - Operation to execute
   * @param {Object} context - Operation context
   * @returns {Promise<any>} Operation result
   */
  async withRetry(operation, context = {}) {
    const config = { ...this.retryConfig, ...context.retryConfig };
    let lastError;
    let delay = config.initialDelay;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation(context);
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        
        // Check if error is retryable
        if (!config.retryableErrors.includes(errorType)) {
          throw error;
        }
        
        // Check if we have retries left
        if (attempt >= config.maxRetries) {
          break;
        }
        
        this.emit('retry', { 
          error, 
          attempt: attempt + 1, 
          maxRetries: config.maxRetries,
          delay 
        });
        
        // Wait before retry
        await this.sleep(delay);
        
        // Increase delay with exponential backoff
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
    
    // All retries exhausted
    const recovery = await this.handleError(lastError, context);
    
    if (recovery.action === 'partial' && recovery.result) {
      return recovery.result;
    }
    
    throw lastError;
  }

  /**
   * Executes an operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {Object} context - Operation context
   * @returns {Promise<any>} Operation result
   */
  async withTimeout(operation, timeout, context = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeout}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
      
      operation(context)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Executes an operation with graceful degradation
   * @param {Function} operation - Primary operation
   * @param {Function} fallback - Fallback operation
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Result with degradation info
   */
  async withGracefulDegradation(operation, fallback, context = {}) {
    try {
      const result = await operation(context);
      return { result, degraded: false };
    } catch (error) {
      this.emit('degradation', { error, context });
      
      try {
        const fallbackResult = await fallback(context);
        return { 
          result: fallbackResult, 
          degraded: true, 
          originalError: error.message 
        };
      } catch (fallbackError) {
        // Both failed
        throw error;
      }
    }
  }

  /**
   * Registers a fallback handler for an operation
   * @param {string} operation - Operation name
   * @param {Function} handler - Fallback handler
   */
  registerFallback(operation, handler) {
    this.fallbackHandlers.set(operation, handler);
  }

  /**
   * Registers a custom recovery strategy
   * @param {string} errorType - Error type
   * @param {Function} strategy - Recovery strategy
   */
  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Gets error statistics
   * @returns {Object} Error statistics
   */
  getStatistics() {
    const byType = {};
    const byHour = {};
    
    for (const entry of this.errorLog) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      
      const hour = entry.timestamp.toISOString().slice(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    }
    
    return {
      total: this.errorLog.length,
      byType,
      byHour,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  /**
   * Clears error log
   */
  clearLog() {
    this.errorLog = [];
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a safe wrapper for an async function
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Wrapper options
   * @returns {Function} Wrapped function
   */
  createSafeWrapper(fn, options = {}) {
    const handler = this;
    
    return async function(...args) {
      const context = {
        functionName: fn.name || 'anonymous',
        args,
        ...options.context
      };
      
      try {
        if (options.timeout) {
          return await handler.withTimeout(
            () => fn.apply(this, args),
            options.timeout,
            context
          );
        }
        
        if (options.retry) {
          return await handler.withRetry(
            () => fn.apply(this, args),
            { ...context, retryConfig: options.retry }
          );
        }
        
        return await fn.apply(this, args);
      } catch (error) {
        const recovery = await handler.handleError(error, context);
        
        if (recovery.action === 'partial' && recovery.result) {
          return recovery.result;
        }
        
        if (options.defaultValue !== undefined) {
          return options.defaultValue;
        }
        
        throw error;
      }
    };
  }
}

// Export error types
ErrorHandler.SystemErrorType = SystemErrorType;

module.exports = ErrorHandler;
