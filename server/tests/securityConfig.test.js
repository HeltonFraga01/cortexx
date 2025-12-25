/**
 * Security Config Tests (Task 6.1)
 * Tests for session security and CSP configuration
 */
const assert = require('assert');
const { describe, it, beforeEach, afterEach, mock } = require('node:test');

// Store original env values
let originalEnv;

// Mock logger before requiring securityConfig
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

describe('Security Config', () => {
  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    
    // Clear module cache to reload with new env
    delete require.cache[require.resolve('../middleware/securityConfig')];
    
    // Mock the logger module
    require.cache[require.resolve('../utils/logger')] = {
      id: require.resolve('../utils/logger'),
      filename: require.resolve('../utils/logger'),
      loaded: true,
      exports: mockLogger
    };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    // Clear module cache
    delete require.cache[require.resolve('../middleware/securityConfig')];
    delete require.cache[require.resolve('../utils/logger')];
  });

  describe('getSessionConfig', () => {
    it('should return secure config when SESSION_SECRET is valid', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      
      const { getSessionConfig } = require('../middleware/securityConfig');
      const config = getSessionConfig();
      
      assert.strictEqual(config.isSecure, true);
      assert.strictEqual(config.secret, 'a'.repeat(32));
      assert.strictEqual(config.cookie.httpOnly, true);
    });

    it('should generate random secret in development when not set', () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'development';
      
      const { getSessionConfig } = require('../middleware/securityConfig');
      const config = getSessionConfig();
      
      assert.strictEqual(config.isSecure, false);
      assert.ok(config.secret.length >= 32);
      assert.strictEqual(config.cookie.secure, false);
    });

    it('should set secure cookie options in production', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'production';
      
      const { getSessionConfig } = require('../middleware/securityConfig');
      const config = getSessionConfig();
      
      assert.strictEqual(config.cookie.secure, true);
      assert.strictEqual(config.cookie.sameSite, 'strict');
    });

    it('should set lax sameSite in development', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';
      
      const { getSessionConfig } = require('../middleware/securityConfig');
      const config = getSessionConfig();
      
      assert.strictEqual(config.cookie.sameSite, 'lax');
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const { generateNonce } = require('../middleware/securityConfig');
      
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      assert.notStrictEqual(nonce1, nonce2);
    });

    it('should generate base64 encoded nonces', () => {
      const { generateNonce } = require('../middleware/securityConfig');
      
      const nonce = generateNonce();
      
      // Base64 pattern
      assert.ok(/^[A-Za-z0-9+/=]+$/.test(nonce));
    });
  });

  describe('generateCSP', () => {
    it('should generate CSP with default directives', () => {
      process.env.NODE_ENV = 'development';
      
      const { generateCSP } = require('../middleware/securityConfig');
      const csp = generateCSP();
      
      assert.ok(csp.headerValue.includes("default-src 'self'"));
      assert.ok(csp.headerValue.includes("object-src 'none'"));
      assert.ok(csp.headerValue.includes("frame-ancestors 'none'"));
    });

    it('should include nonce in script-src for production', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { generateCSP } = require('../middleware/securityConfig');
      const nonce = 'test-nonce-123';
      const csp = generateCSP(nonce);
      
      assert.ok(csp.headerValue.includes(`'nonce-${nonce}'`));
      assert.strictEqual(csp.nonce, nonce);
    });

    it('should use report-only header when specified', () => {
      const { generateCSP } = require('../middleware/securityConfig');
      const csp = generateCSP(null, { reportOnly: true });
      
      assert.strictEqual(csp.headerName, 'Content-Security-Policy-Report-Only');
    });

    it('should use enforcement header by default', () => {
      const { generateCSP } = require('../middleware/securityConfig');
      const csp = generateCSP();
      
      assert.strictEqual(csp.headerName, 'Content-Security-Policy');
    });

    it('should include SUPABASE_URL in connect-src when set', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { generateCSP } = require('../middleware/securityConfig');
      const csp = generateCSP();
      
      assert.ok(csp.headerValue.includes('https://test.supabase.co'));
    });

    it('should include WUZAPI_BASE_URL in connect-src when set', () => {
      process.env.WUZAPI_BASE_URL = 'https://wuzapi.example.com';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { generateCSP } = require('../middleware/securityConfig');
      const csp = generateCSP();
      
      assert.ok(csp.headerValue.includes('https://wuzapi.example.com'));
    });
  });

  describe('validateSecurityEnv', () => {
    it('should return valid when all required vars are set', () => {
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { validateSecurityEnv } = require('../middleware/securityConfig');
      const result = validateSecurityEnv();
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should return errors when SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL;
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { validateSecurityEnv } = require('../middleware/securityConfig');
      const result = validateSecurityEnv();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SUPABASE_URL')));
    });

    it('should return warnings for short SESSION_SECRET in development', () => {
      process.env.SESSION_SECRET = 'short';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../middleware/securityConfig')];
      
      const { validateSecurityEnv } = require('../middleware/securityConfig');
      const result = validateSecurityEnv();
      
      assert.ok(result.warnings.some(w => w.includes('32 characters')));
    });
  });

  describe('cspMiddleware', () => {
    it('should set CSP header on response', () => {
      const { cspMiddleware } = require('../middleware/securityConfig');
      const middleware = cspMiddleware();
      
      const req = {};
      const res = {
        locals: {},
        setHeader: function(name, value) {
          this.headers = this.headers || {};
          this.headers[name] = value;
        }
      };
      const next = () => {};
      
      middleware(req, res, next);
      
      assert.ok(res.headers['Content-Security-Policy']);
      assert.ok(res.locals.cspNonce);
    });

    it('should generate unique nonce per request', () => {
      const { cspMiddleware } = require('../middleware/securityConfig');
      const middleware = cspMiddleware();
      
      const res1 = { locals: {}, setHeader: () => {} };
      const res2 = { locals: {}, setHeader: () => {} };
      
      middleware({}, res1, () => {});
      middleware({}, res2, () => {});
      
      assert.notStrictEqual(res1.locals.cspNonce, res2.locals.cspNonce);
    });
  });
});
