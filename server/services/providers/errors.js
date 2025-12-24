/**
 * Provider Errors - Custom error classes for provider operations
 * 
 * Requirements: 2.6 (wuzapi-status-source-of-truth spec)
 */

/**
 * Error thrown when a method is not supported by a provider
 */
class MethodNotSupportedError extends Error {
  constructor(providerType, methodName) {
    super(`Method '${methodName}' is not supported by provider '${providerType}'`);
    this.name = 'MethodNotSupportedError';
    this.code = 'METHOD_NOT_SUPPORTED';
    this.providerType = providerType;
    this.methodName = methodName;
  }
}

/**
 * Error thrown when provider is unavailable
 */
class ProviderUnavailableError extends Error {
  constructor(providerType, originalError) {
    super(`Provider '${providerType}' is unavailable: ${originalError?.message || 'Unknown error'}`);
    this.name = 'ProviderUnavailableError';
    this.code = 'PROVIDER_UNAVAILABLE';
    this.providerType = providerType;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when provider returns invalid token
 */
class InvalidTokenError extends Error {
  constructor(providerType) {
    super(`Invalid or expired token for provider '${providerType}'`);
    this.name = 'InvalidTokenError';
    this.code = 'INVALID_TOKEN';
    this.providerType = providerType;
  }
}

/**
 * Error thrown when provider rate limits requests
 */
class RateLimitedError extends Error {
  constructor(providerType, retryAfter = null) {
    super(`Rate limited by provider '${providerType}'${retryAfter ? `, retry after ${retryAfter}s` : ''}`);
    this.name = 'RateLimitedError';
    this.code = 'RATE_LIMITED';
    this.providerType = providerType;
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when provider times out
 */
class ProviderTimeoutError extends Error {
  constructor(providerType, timeout) {
    super(`Provider '${providerType}' request timed out after ${timeout}ms`);
    this.name = 'ProviderTimeoutError';
    this.code = 'TIMEOUT';
    this.providerType = providerType;
    this.timeout = timeout;
  }
}

module.exports = {
  MethodNotSupportedError,
  ProviderUnavailableError,
  InvalidTokenError,
  RateLimitedError,
  ProviderTimeoutError
};
