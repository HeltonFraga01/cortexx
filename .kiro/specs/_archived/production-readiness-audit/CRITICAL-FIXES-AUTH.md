# Critical Authentication Fixes - Quick Reference

**Priority:** IMMEDIATE  
**Estimated Effort:** 4-6 hours  
**Risk Level:** HIGH

---

## Fix 1: Apply Rate Limiting to Authentication Endpoints

**Files to Modify:**
- `server/routes/sessionRoutes.js`
- `server/routes/adminRoutes.js`

**Changes:**

### server/routes/sessionRoutes.js
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Apply to ALL authentication endpoints
router.get('/status', 
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/connect',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/disconnect',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/logout',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/qr',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

### server/routes/adminRoutes.js
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Apply to ALL admin endpoints
router.get('/users',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/stats',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/users/:userId',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/users',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.delete('/users/:userId',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.delete('/users/:userId/full',
  strictRateLimiter,  // ADD THIS LINE
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

---

## Fix 2: Implement Token Caching

**New File:** `server/utils/tokenCache.js`

```javascript
const { logger } = require('./logger');

/**
 * Token Cache
 * Caches token validation results to reduce WuzAPI calls
 */
class TokenCache {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached token validation result
   * @param {string} token - Token to lookup
   * @returns {Object|null} Cached result or null if not found/expired
   */
  get(token) {
    const cached = this.cache.get(token);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(token);
      return null;
    }
    
    logger.debug('Token cache hit', { 
      token_prefix: token.substring(0, 8) + '...',
      age_ms: Date.now() - cached.timestamp
    });
    
    return cached.result;
  }

  /**
   * Store token validation result in cache
   * @param {string} token - Token to cache
   * @param {Object} result - Validation result
   */
  set(token, result) {
    this.cache.set(token, {
      result,
      timestamp: Date.now()
    });
    
    logger.debug('Token cached', { 
      token_prefix: token.substring(0, 8) + '...',
      is_valid: result.isValid
    });
  }

  /**
   * Invalidate a specific token
   * @param {string} token - Token to invalidate
   */
  invalidate(token) {
    const deleted = this.cache.delete(token);
    
    if (deleted) {
      logger.info('Token invalidated from cache', { 
        token_prefix: token.substring(0, 8) + '...'
      });
    }
  }

  /**
   * Clear all cached tokens
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Token cache cleared', { entries_cleared: size });
  }

  /**
   * Remove expired entries from cache
   * @private
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Token cache cleanup', { 
        entries_removed: cleaned,
        entries_remaining: this.cache.size
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl_ms: this.CACHE_TTL
    };
  }
}

module.exports = new TokenCache();
```

**Modify:** `server/validators/sessionValidator.js`

```javascript
const wuzapiClient = require('../utils/wuzapiClient');
const { logger } = require('../utils/logger');
const tokenCache = require('../utils/tokenCache');  // ADD THIS

class SessionValidator {
  async validateUserToken(token) {
    const startTime = Date.now();
    
    try {
      // CHECK CACHE FIRST
      const cached = tokenCache.get(token);
      if (cached) {
        logger.info('Token validation from cache', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          response_time_ms: Date.now() - startTime,
          cache_hit: true
        });
        return cached;
      }
      
      // Cache miss - validate with WuzAPI
      logger.info('Iniciando validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token),
        cache_hit: false
      });

      const response = await wuzapiClient.get('/session/status', {
        headers: { 'token': token }
      });
      const responseTime = Date.now() - startTime;

      let result;
      if (response.success && response.status === 200) {
        const userData = this._extractUserData(response.data);
        
        result = {
          isValid: true,
          userData: userData
        };
        
        logger.info('Token de usuário validado com sucesso', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          connected: userData.connected,
          logged_in: userData.loggedIn
        });
      } else {
        result = {
          isValid: false,
          error: this._getErrorMessage(response.status, response.error)
        };
        
        logger.warn('Falha na validação de token de usuário', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          error: response.error
        });
      }
      
      // CACHE THE RESULT
      tokenCache.set(token, result);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token),
        response_time_ms: responseTime,
        error_message: error.message
      });

      return {
        isValid: false,
        error: 'Erro interno na validação do token'
      };
    }
  }
  
  // ... rest of the class remains the same
}

module.exports = new SessionValidator();
```

**Modify:** `server/validators/adminValidator.js`

```javascript
const wuzapiClient = require('../utils/wuzapiClient');
const { logger } = require('../utils/logger');
const tokenCache = require('../utils/tokenCache');  // ADD THIS

class AdminValidator {
  async validateAdminToken(token) {
    const startTime = Date.now();
    
    try {
      // CHECK CACHE FIRST
      const cached = tokenCache.get(token);
      if (cached) {
        logger.info('Admin token validation from cache', {
          action: 'validate_admin_token',
          token_prefix: this._maskToken(token),
          response_time_ms: Date.now() - startTime,
          cache_hit: true
        });
        return cached;
      }
      
      // Cache miss - validate with WuzAPI
      logger.info('Iniciando validação de token administrativo', {
        action: 'validate_admin_token',
        token_prefix: this._maskToken(token),
        cache_hit: false
      });

      const response = await wuzapiClient.getAdmin('/admin/users', token);
      const responseTime = Date.now() - startTime;

      logger.info('Resposta recebida da WuzAPI para validação de token', {
        action: 'wuzapi_response_log',
        token_prefix: this._maskToken(token),
        status_code: response.status,
        response_data: response.data,
        response_time_ms: responseTime
      });

      let result;
      if (response.success && response.status === 200) {
        const users = this._extractUsersData(response.data);
        
        result = {
          isValid: true,
          users: users,
          rawData: response.data
        };
        
        logger.info('Token administrativo validado com sucesso', {
          action: 'validate_admin_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          users_count: users.length
        });
      } else {
        result = {
          isValid: false,
          error: this._getErrorMessage(response.status, response.error)
        };
        
        logger.warn('Falha na validação de token administrativo', {
          action: 'validate_admin_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          error: response.error
        });
      }
      
      // CACHE THE RESULT
      tokenCache.set(token, result);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na validação de token administrativo', {
        action: 'validate_admin_token',
        token_prefix: this._maskToken(token),
        response_time_ms: responseTime,
        error_message: error.message
      });

      return {
        isValid: false,
        error: 'Erro interno na validação do token administrativo'
      };
    }
  }
  
  // ... rest of the class remains the same
}

module.exports = new AdminValidator();
```

**Modify:** `server/routes/sessionRoutes.js` - Logout endpoint

```javascript
const tokenCache = require('../utils/tokenCache');  // ADD THIS at top

router.post('/logout',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      // INVALIDATE TOKEN CACHE
      tokenCache.invalidate(token);
      
      const response = await wuzapiClient.post('/session/logout', {}, {
        headers: { 'token': token }
      });
      
      // ... rest of logout logic
    } catch (error) {
      // ... error handling
    }
  }
);
```

---

## Fix 3: Implement Failed Attempt Tracking

**New File:** `server/middleware/authenticationProtection.js`

```javascript
const { logger } = require('../utils/logger');

/**
 * Authentication Protection Middleware
 * Tracks failed authentication attempts and implements account lockout
 */
class AuthenticationProtection {
  constructor() {
    this.failedAttempts = new Map();
    this.LOCKOUT_THRESHOLD = 5;
    this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    this.ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if identifier is locked out
   * @param {string} identifier - IP address or token
   * @returns {Object} Lock status
   */
  checkLockout(identifier) {
    const attempts = this.failedAttempts.get(identifier);
    
    if (!attempts) {
      return { locked: false };
    }
    
    // Check if lockout period has expired
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMs = attempts.lockedUntil - Date.now();
      
      logger.warn('Authentication attempt while locked out', {
        identifier: this._maskIdentifier(identifier),
        remaining_seconds: Math.ceil(remainingMs / 1000)
      });
      
      return {
        locked: true,
        remainingMs: remainingMs,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    }
    
    // Lockout expired, clear it
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
      this.failedAttempts.delete(identifier);
      logger.info('Lockout period expired', {
        identifier: this._maskIdentifier(identifier)
      });
    }
    
    return { locked: false };
  }

  /**
   * Track a failed authentication attempt
   * @param {string} identifier - IP address or token
   * @returns {Object} Updated attempt status
   */
  trackFailedAttempt(identifier) {
    const lockStatus = this.checkLockout(identifier);
    
    if (lockStatus.locked) {
      return lockStatus;
    }
    
    const attempts = this.failedAttempts.get(identifier) || {
      count: 0,
      firstAttempt: Date.now(),
      lastAttempt: null,
      lockedUntil: null
    };
    
    // Reset count if outside attempt window
    if (Date.now() - attempts.firstAttempt > this.ATTEMPT_WINDOW) {
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    logger.warn('Failed authentication attempt', {
      identifier: this._maskIdentifier(identifier),
      attempt_count: attempts.count,
      threshold: this.LOCKOUT_THRESHOLD
    });
    
    // Check if threshold reached
    if (attempts.count >= this.LOCKOUT_THRESHOLD) {
      attempts.lockedUntil = Date.now() + this.LOCKOUT_DURATION;
      
      logger.error('Account locked due to failed attempts', {
        identifier: this._maskIdentifier(identifier),
        attempt_count: attempts.count,
        lockout_duration_minutes: this.LOCKOUT_DURATION / 60000
      });
      
      this.failedAttempts.set(identifier, attempts);
      
      return {
        locked: true,
        remainingMs: this.LOCKOUT_DURATION,
        remainingSeconds: Math.ceil(this.LOCKOUT_DURATION / 1000)
      };
    }
    
    this.failedAttempts.set(identifier, attempts);
    
    return {
      locked: false,
      attemptsRemaining: this.LOCKOUT_THRESHOLD - attempts.count
    };
  }

  /**
   * Clear failed attempts for identifier (on successful auth)
   * @param {string} identifier - IP address or token
   */
  clearFailedAttempts(identifier) {
    const deleted = this.failedAttempts.delete(identifier);
    
    if (deleted) {
      logger.info('Failed attempts cleared', {
        identifier: this._maskIdentifier(identifier)
      });
    }
  }

  /**
   * Express middleware to check lockout before authentication
   * @returns {Function} Express middleware
   */
  checkLockoutMiddleware() {
    return (req, res, next) => {
      const identifier = req.ip;
      const lockStatus = this.checkLockout(identifier);
      
      if (lockStatus.locked) {
        return res.status(429).json({
          success: false,
          error: 'Too Many Failed Attempts',
          message: `Account temporarily locked. Try again in ${lockStatus.remainingSeconds} seconds.`,
          code: 'ACCOUNT_LOCKED',
          retryAfter: lockStatus.remainingSeconds,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }

  /**
   * Cleanup expired entries
   * @private
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [identifier, attempts] of this.failedAttempts.entries()) {
      // Remove if lockout expired and no recent attempts
      if (attempts.lockedUntil && now > attempts.lockedUntil + this.ATTEMPT_WINDOW) {
        this.failedAttempts.delete(identifier);
        cleaned++;
      }
      // Remove if attempts are old and not locked
      else if (!attempts.lockedUntil && now - attempts.lastAttempt > this.ATTEMPT_WINDOW) {
        this.failedAttempts.delete(identifier);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Authentication protection cleanup', {
        entries_removed: cleaned,
        entries_remaining: this.failedAttempts.size
      });
    }
  }

  /**
   * Mask identifier for logging
   * @param {string} identifier
   * @returns {string}
   * @private
   */
  _maskIdentifier(identifier) {
    if (!identifier) return 'UNKNOWN';
    
    // Mask IP address
    if (identifier.includes('.') || identifier.includes(':')) {
      const parts = identifier.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }
    
    // Mask token
    if (identifier.length > 8) {
      return identifier.substring(0, 8) + '...';
    }
    
    return identifier;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    const locked = Array.from(this.failedAttempts.values())
      .filter(a => a.lockedUntil && Date.now() < a.lockedUntil).length;
    
    return {
      total_tracked: this.failedAttempts.size,
      currently_locked: locked,
      lockout_threshold: this.LOCKOUT_THRESHOLD,
      lockout_duration_minutes: this.LOCKOUT_DURATION / 60000
    };
  }
}

module.exports = new AuthenticationProtection();
```

**Modify:** `server/routes/sessionRoutes.js`

```javascript
const authProtection = require('../middleware/authenticationProtection');  // ADD THIS

router.get('/status', 
  strictRateLimiter,
  authProtection.checkLockoutMiddleware(),  // ADD THIS
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.token;
      
      if (!sessionValidator.isValidTokenFormat(token)) {
        // Track failed attempt
        authProtection.trackFailedAttempt(req.ip);
        
        logger.warn('Token com formato inválido na validação de sessão', { ... });
        return res.status(400).json({ ... });
      }

      const validationResult = await sessionValidator.validateUserToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Clear failed attempts on success
        authProtection.clearFailedAttempts(req.ip);
        
        logger.info('Validação de sessão bem-sucedida', { ... });
        return res.status(200).json({ ... });
      } else {
        // Track failed attempt
        const attemptStatus = authProtection.trackFailedAttempt(req.ip);
        
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      // ... error handling
    }
  }
);
```

**Modify:** `server/routes/adminRoutes.js`

```javascript
const authProtection = require('../middleware/authenticationProtection');  // ADD THIS

router.get('/users',
  strictRateLimiter,
  authProtection.checkLockoutMiddleware(),  // ADD THIS
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.authorization;
      
      if (!adminValidator.isValidTokenFormat(token)) {
        // Track failed attempt
        authProtection.trackFailedAttempt(req.ip);
        
        logger.warn('Token administrativo com formato inválido', { ... });
        return res.status(400).json({ ... });
      }

      const validationResult = await adminValidator.validateAdminToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Clear failed attempts on success
        authProtection.clearFailedAttempts(req.ip);
        
        // ... success logic
      } else {
        // Track failed attempt
        authProtection.trackFailedAttempt(req.ip);
        
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      // ... error handling
    }
  }
);
```

---

## Testing the Fixes

### Test Rate Limiting
```bash
# Test session endpoint rate limiting
for i in {1..15}; do
  curl -H "token: test-token" http://localhost:3000/api/session/status
  echo "Request $i"
done

# Should see 429 Too Many Requests after 10 requests
```

### Test Token Caching
```bash
# First request (cache miss)
time curl -H "token: valid-token" http://localhost:3000/api/session/status

# Second request (cache hit - should be faster)
time curl -H "token: valid-token" http://localhost:3000/api/session/status
```

### Test Failed Attempt Tracking
```bash
# Make 5 failed attempts
for i in {1..5}; do
  curl -H "token: invalid-token" http://localhost:3000/api/session/status
  echo "Attempt $i"
done

# 6th attempt should return 429 with ACCOUNT_LOCKED
curl -H "token: invalid-token" http://localhost:3000/api/session/status
```

---

## Deployment Checklist

- [ ] Create `server/utils/tokenCache.js`
- [ ] Create `server/middleware/authenticationProtection.js`
- [ ] Modify `server/validators/sessionValidator.js`
- [ ] Modify `server/validators/adminValidator.js`
- [ ] Modify `server/routes/sessionRoutes.js`
- [ ] Modify `server/routes/adminRoutes.js`
- [ ] Test rate limiting functionality
- [ ] Test token caching functionality
- [ ] Test failed attempt tracking
- [ ] Monitor logs for authentication events
- [ ] Update documentation

---

## Monitoring After Deployment

Watch for these metrics:
- Token cache hit rate (should be > 80%)
- Rate limit violations (track IPs)
- Account lockouts (investigate patterns)
- WuzAPI response times (should decrease with caching)
- Authentication failure rates

---

**End of Critical Fixes Reference**
