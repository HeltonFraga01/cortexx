/**
 * Tests for TokenValidator Middleware
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const {
  createTokenValidator,
  extractToken,
  clearTokenCache
} = require('./tokenValidator');

describe('TokenValidator Middleware', () => {
  beforeEach(() => {
    clearTokenCache();
  });

  describe('extractToken', () => {
    it('should extract token from Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer test-token-123'
        },
        body: {},
        session: {}
      };

      const token = extractToken(req);
      assert.strictEqual(token, 'test-token-123');
    });

    it('should extract token from token header', () => {
      const req = {
        headers: {
          token: 'header-token-456'
        },
        body: {},
        session: {}
      };

      const token = extractToken(req);
      assert.strictEqual(token, 'header-token-456');
    });

    it('should extract token from body instance field', () => {
      const req = {
        headers: {},
        body: {
          instance: 'body-instance-token'
        },
        session: {}
      };

      const token = extractToken(req);
      assert.strictEqual(token, 'body-instance-token');
    });

    it('should extract token from session', () => {
      const req = {
        headers: {},
        body: {},
        session: {
          userToken: 'session-token-789'
        }
      };

      const token = extractToken(req);
      assert.strictEqual(token, 'session-token-789');
    });

    it('should return null when no token found', () => {
      const req = {
        headers: {},
        body: {},
        session: {}
      };

      const token = extractToken(req);
      assert.strictEqual(token, null);
    });

    it('should prioritize Authorization header over other sources', () => {
      const req = {
        headers: {
          authorization: 'Bearer auth-token',
          token: 'header-token'
        },
        body: {
          instance: 'body-token'
        },
        session: {
          userToken: 'session-token'
        }
      };

      const token = extractToken(req);
      assert.strictEqual(token, 'auth-token');
    });
  });

  describe('createTokenValidator', () => {
    it('should return 401 when no token provided', async () => {
      const middleware = createTokenValidator();
      const req = {
        headers: {},
        body: {},
        session: { userId: 'user-123' }
      };
      const res = {
        status: (code) => {
          res.statusCode = code;
          return res;
        },
        json: (data) => {
          res.body = data;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'NO_TOKEN');
      assert.strictEqual(nextCalled, false);
    });

    it('should return 401 when no session and requireSession is true', async () => {
      const middleware = createTokenValidator({ requireSession: true });
      const req = {
        headers: {
          token: 'some-token'
        },
        body: {},
        session: {},
        ip: '127.0.0.1',
        path: '/test'
      };
      const res = {
        status: (code) => {
          res.statusCode = code;
          return res;
        },
        json: (data) => {
          res.body = data;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.code, 'SESSION_REQUIRED');
      assert.strictEqual(nextCalled, false);
    });

    it('should allow admin to use any token when allowAdminBypass is true', async () => {
      const middleware = createTokenValidator({ allowAdminBypass: true });
      const req = {
        headers: {
          token: 'any-token'
        },
        body: {},
        session: {
          userId: 'admin-user',
          role: 'admin',
          userToken: 'admin-token'
        },
        path: '/test'
      };
      const res = {
        status: (code) => {
          res.statusCode = code;
          return res;
        },
        json: (data) => {
          res.body = data;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.userToken, 'any-token');
      assert.strictEqual(req.tokenValidated, true);
    });

    it('should allow user to use their own session token', async () => {
      const middleware = createTokenValidator();
      const req = {
        headers: {
          token: 'user-session-token'
        },
        body: {},
        session: {
          userId: 'user-123',
          role: 'user',
          userToken: 'user-session-token'
        },
        path: '/test'
      };
      const res = {
        status: (code) => {
          res.statusCode = code;
          return res;
        },
        json: (data) => {
          res.body = data;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.userToken, 'user-session-token');
      assert.strictEqual(req.tokenValidated, true);
    });
  });

  describe('Error Response Privacy', () => {
    it('should not expose token in error response', async () => {
      const middleware = createTokenValidator();
      const sensitiveToken = 'super-secret-token-12345';
      const req = {
        headers: {
          token: sensitiveToken
        },
        body: {},
        session: {
          userId: 'user-123',
          role: 'user',
          userToken: 'different-token'
        },
        ip: '127.0.0.1',
        path: '/test',
        method: 'POST'
      };
      const res = {
        status: (code) => {
          res.statusCode = code;
          return res;
        },
        json: (data) => {
          res.body = data;
          return res;
        }
      };
      const next = () => {};

      await middleware(req, res, next);

      // Verify error response does not contain the token
      const responseStr = JSON.stringify(res.body);
      assert.strictEqual(responseStr.includes(sensitiveToken), false);
      assert.strictEqual(responseStr.includes('super-secret'), false);
    });
  });
});
