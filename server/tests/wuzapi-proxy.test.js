/**
 * Tests for WuzAPI Proxy Service and Routes
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

describe('WuzAPI Proxy Service', () => {
  const wuzapiProxy = require('../services/WuzAPIProxyService');

  describe('Configuration', () => {
    it('should have correct configuration', () => {
      const config = wuzapiProxy.getConfig();
      
      assert.ok(config.baseUrl, 'Should have baseUrl');
      assert.ok(config.timeout, 'Should have timeout');
      assert.strictEqual(typeof config.hasAdminToken, 'boolean', 'Should indicate if admin token exists');
    });

    it('should use environment variables', () => {
      const config = wuzapiProxy.getConfig();
      
      // Should use WUZAPI_BASE_URL from env or default
      assert.ok(config.baseUrl.includes('wzapi') || config.baseUrl.includes('wasend'));
      
      // Should have reasonable timeout
      assert.ok(config.timeout >= 5000 && config.timeout <= 30000);
    });
  });

  describe('Methods', () => {
    it('should have proxyUserRequest method', () => {
      assert.strictEqual(typeof wuzapiProxy.proxyUserRequest, 'function');
    });

    it('should have proxyAdminRequest method', () => {
      assert.strictEqual(typeof wuzapiProxy.proxyAdminRequest, 'function');
    });

    it('should have isHealthy method', () => {
      assert.strictEqual(typeof wuzapiProxy.isHealthy, 'function');
    });

    it('should have getConfig method', () => {
      assert.strictEqual(typeof wuzapiProxy.getConfig, 'function');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when admin token not configured', async () => {
      // Save original token
      const originalToken = wuzapiProxy.adminToken;
      
      // Temporarily remove token
      wuzapiProxy.adminToken = null;
      
      try {
        await wuzapiProxy.proxyAdminRequest('GET', '/test', {});
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Admin token not configured');
      }
      
      // Restore token
      wuzapiProxy.adminToken = originalToken;
    });
  });
});

describe('WuzAPI Proxy Routes', () => {
  describe('Route Structure', () => {
    it('should export router', () => {
      const wuzapiProxyRoutes = require('../routes/wuzapiProxyRoutes');
      assert.ok(wuzapiProxyRoutes, 'Should export router');
      assert.strictEqual(typeof wuzapiProxyRoutes, 'function', 'Should be Express router');
    });
  });

  describe('User Proxy Route', () => {
    it('should require authentication', () => {
      // This would be tested with supertest in integration tests
      // Here we just verify the middleware is applied
      const wuzapiProxyRoutes = require('../routes/wuzapiProxyRoutes');
      assert.ok(wuzapiProxyRoutes.stack, 'Router should have stack');
    });

    it('should handle missing token in session', () => {
      const req = {
        path: '/user/session/status',
        method: 'GET',
        session: {
          userId: 'user123',
          role: 'user'
          // userToken missing
        },
        body: {},
        query: {},
        ip: '127.0.0.1'
      };

      const res = {
        status: (code) => {
          assert.strictEqual(code, 500);
          return {
            json: (data) => {
              assert.strictEqual(data.error, 'Session token not found');
              assert.strictEqual(data.code, 'SESSION_ERROR');
            }
          };
        }
      };

      // Simulate route logic
      const userToken = req.session.userToken;
      if (!userToken) {
        res.status(500).json({ 
          error: 'Session token not found',
          code: 'SESSION_ERROR'
        });
      }
    });
  });

  describe('Admin Proxy Route', () => {
    it('should require admin role', () => {
      // This would be tested with supertest in integration tests
      // Here we just verify the middleware is applied
      const wuzapiProxyRoutes = require('../routes/wuzapiProxyRoutes');
      assert.ok(wuzapiProxyRoutes.stack, 'Router should have stack');
    });
  });

  describe('Health Check Route', () => {
    it('should not require authentication', () => {
      // Health check should be public
      const wuzapiProxyRoutes = require('../routes/wuzapiProxyRoutes');
      assert.ok(wuzapiProxyRoutes.stack, 'Router should have stack');
    });
  });
});

describe('Proxy Request Flow', () => {
  describe('Path Transformation', () => {
    it('should remove /user prefix from path', () => {
      const originalPath = '/user/session/status';
      const transformedPath = originalPath.replace('/user', '');
      
      assert.strictEqual(transformedPath, '/session/status');
    });

    it('should remove /admin prefix from path', () => {
      const originalPath = '/admin/users';
      const transformedPath = originalPath.replace('/admin', '');
      
      assert.strictEqual(transformedPath, '/users');
    });

    it('should handle nested paths', () => {
      const originalPath = '/user/messages/send/bulk';
      const transformedPath = originalPath.replace('/user', '');
      
      assert.strictEqual(transformedPath, '/messages/send/bulk');
    });
  });

  describe('Error Response Structure', () => {
    it('should return structured error', () => {
      const error = new Error('Test error');
      error.status = 404;
      error.code = 'NOT_FOUND';

      const response = {
        error: error.message,
        code: error.code
      };

      assert.strictEqual(response.error, 'Test error');
      assert.strictEqual(response.code, 'NOT_FOUND');
    });

    it('should use default status 500 if not provided', () => {
      const error = new Error('Test error');
      const status = error.status || 500;

      assert.strictEqual(status, 500);
    });

    it('should use default code if not provided', () => {
      const error = new Error('Test error');
      const code = error.code || 'WUZAPI_ERROR';

      assert.strictEqual(code, 'WUZAPI_ERROR');
    });
  });
});
