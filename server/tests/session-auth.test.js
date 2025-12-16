/**
 * Tests for session and authentication middleware
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { requireAuth, requireAdmin } = require('../middleware/auth');

describe('Authentication Middleware', () => {
  describe('requireAuth', () => {
    it('should reject request without session', () => {
      const req = { 
        session: null,
        sessionID: 'test-session-id',
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        status: (code) => {
          assert.strictEqual(code, 401);
          return {
            json: (data) => {
              assert.strictEqual(data.error, 'Autenticação necessária');
              assert.strictEqual(data.code, 'AUTH_REQUIRED');
            }
          };
        }
      };
      const next = () => {
        assert.fail('next() should not be called');
      };

      requireAuth(req, res, next);
    });

    it('should reject request with empty session', () => {
      const req = { 
        session: {},
        sessionID: 'test-session-id',
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        status: (code) => {
          assert.strictEqual(code, 401);
          return {
            json: (data) => {
              assert.strictEqual(data.error, 'Autenticação necessária');
              assert.strictEqual(data.code, 'AUTH_REQUIRED');
            }
          };
        }
      };
      const next = () => {
        assert.fail('next() should not be called');
      };

      requireAuth(req, res, next);
    });

    it('should allow request with valid session', () => {
      const req = { 
        session: { 
          userId: 'user123',
          role: 'user'
        },
        sessionID: 'test-session-id',
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {};
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      requireAuth(req, res, next);
      
      assert.strictEqual(nextCalled, true);
      assert.ok(req.session.lastActivity);
    });
  });

  describe('requireAdmin', () => {
    it('should reject request without session', () => {
      const req = { 
        session: null,
        sessionID: 'test-session-id',
        path: '/api/admin/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        status: (code) => {
          assert.strictEqual(code, 401);
          return {
            json: (data) => {
              assert.strictEqual(data.error, 'Autenticação necessária');
              assert.strictEqual(data.code, 'AUTH_REQUIRED');
            }
          };
        }
      };
      const next = () => {
        assert.fail('next() should not be called');
      };

      requireAdmin(req, res, next);
    });

    it('should reject user role accessing admin endpoint', () => {
      const req = { 
        session: { 
          userId: 'user123',
          role: 'user'
        },
        sessionID: 'test-session-id',
        ip: '127.0.0.1',
        path: '/api/admin/users',
        method: 'GET',
        get: () => 'test-user-agent'
      };
      const res = {
        status: (code) => {
          assert.strictEqual(code, 403);
          return {
            json: (data) => {
              assert.strictEqual(data.error, 'Acesso de administrador necessário');
              assert.strictEqual(data.code, 'FORBIDDEN');
            }
          };
        }
      };
      const next = () => {
        assert.fail('next() should not be called');
      };

      requireAdmin(req, res, next);
    });

    it('should allow admin role accessing admin endpoint', () => {
      const req = { 
        session: { 
          userId: 'admin123',
          role: 'admin'
        },
        sessionID: 'test-session-id',
        path: '/api/admin/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {};
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      requireAdmin(req, res, next);
      
      assert.strictEqual(nextCalled, true);
      assert.ok(req.session.lastActivity);
    });
  });
});

describe('Session Configuration', () => {
  it('should have correct session configuration', () => {
    const sessionConfig = require('../middleware/session');
    
    assert.ok(sessionConfig.store, 'Session store should be configured');
    assert.ok(sessionConfig.secret, 'Session secret should be configured');
    assert.strictEqual(sessionConfig.name, 'wuzapi.sid', 'Session cookie name should be wuzapi.sid');
    assert.strictEqual(sessionConfig.resave, false, 'resave should be false');
    assert.strictEqual(sessionConfig.saveUninitialized, false, 'saveUninitialized should be false');
    assert.strictEqual(sessionConfig.cookie.httpOnly, true, 'Cookie should be httpOnly');
    // sameSite pode ser 'lax' ou 'strict' dependendo da configuração
    assert.ok(['lax', 'strict'].includes(sessionConfig.cookie.sameSite), 'Cookie should have valid sameSite');
    assert.strictEqual(sessionConfig.cookie.maxAge, 24 * 60 * 60 * 1000, 'Cookie maxAge should be 24 hours');
  });

  it('should use secure cookie based on COOKIE_SECURE env var', () => {
    const originalCookieSecure = process.env.COOKIE_SECURE;
    
    // Test with COOKIE_SECURE=true
    process.env.COOKIE_SECURE = 'true';
    delete require.cache[require.resolve('../middleware/session')];
    const secureConfig = require('../middleware/session');
    assert.strictEqual(secureConfig.cookie.secure, true, 'Cookie should be secure when COOKIE_SECURE=true');
    
    // Test with COOKIE_SECURE not set
    delete process.env.COOKIE_SECURE;
    delete require.cache[require.resolve('../middleware/session')];
    const defaultConfig = require('../middleware/session');
    assert.strictEqual(defaultConfig.cookie.secure, false, 'Cookie should not be secure by default');
    
    // Restore
    if (originalCookieSecure !== undefined) {
      process.env.COOKIE_SECURE = originalCookieSecure;
    }
    delete require.cache[require.resolve('../middleware/session')];
  });
});
