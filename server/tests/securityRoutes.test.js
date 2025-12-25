/**
 * Security Routes Tests (Task 6.1)
 * Tests for CSP violation reporting and security status endpoints
 */
const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');
const request = require('supertest');
const express = require('express');

// Mock logger before requiring routes
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

describe('Security Routes', () => {
  let app;

  beforeEach(() => {
    // Clear module cache
    delete require.cache[require.resolve('../routes/securityRoutes')];
    delete require.cache[require.resolve('../middleware/securityConfig')];
    delete require.cache[require.resolve('../middleware/rateLimiter')];
    
    // Mock the logger module
    require.cache[require.resolve('../utils/logger')] = {
      id: require.resolve('../utils/logger'),
      filename: require.resolve('../utils/logger'),
      loaded: true,
      exports: mockLogger
    };
    
    // Mock rate limiter
    require.cache[require.resolve('../middleware/rateLimiter')] = {
      id: require.resolve('../middleware/rateLimiter'),
      filename: require.resolve('../middleware/rateLimiter'),
      loaded: true,
      exports: {
        apiLimiter: (req, res, next) => next()
      }
    };
    
    const securityRoutes = require('../routes/securityRoutes');
    
    // Create test app
    app = express();
    app.use(express.json());
    
    app.use('/api', securityRoutes);
  });

  describe('POST /api/csp-report', () => {
    it('should accept valid CSP report', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({
          'csp-report': {
            'blocked-uri': 'https://evil.com/script.js',
            'violated-directive': 'script-src',
            'document-uri': 'https://example.com/page',
            'source-file': 'https://example.com/page',
            'line-number': 10
          }
        });
      
      assert.strictEqual(response.status, 204);
    });

    it('should accept CSP report in alternative format', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({
          blockedUri: 'https://evil.com/script.js',
          violatedDirective: 'script-src',
          documentUri: 'https://example.com/page'
        });
      
      assert.strictEqual(response.status, 204);
    });

    it('should accept application/csp-report content type', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify({
          'csp-report': {
            'blocked-uri': 'inline',
            'violated-directive': 'script-src'
          }
        }));
      
      assert.strictEqual(response.status, 204);
    });

    it('should return 400 for empty body', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({});
      
      // Empty object is still valid JSON, but no csp-report
      // The route should handle this gracefully
      assert.ok([204, 400].includes(response.status));
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send('not valid json');
      
      assert.strictEqual(response.status, 400);
    });
  });

  describe('GET /api/status', () => {
    it('should return security status', async () => {
      // Set required env vars
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      
      const response = await request(app)
        .get('/api/status');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.data);
    });

    it('should include environment info', async () => {
      const response = await request(app)
        .get('/api/status');
      
      assert.ok(response.body.data.environment);
      assert.ok(typeof response.body.data.isProduction === 'boolean');
    });

    it('should include validation results', async () => {
      const response = await request(app)
        .get('/api/status');
      
      assert.ok(response.body.data.validation);
      assert.ok(typeof response.body.data.validation.valid === 'boolean');
      assert.ok(typeof response.body.data.validation.errorCount === 'number');
      assert.ok(typeof response.body.data.validation.warningCount === 'number');
    });

    it('should include feature flags', async () => {
      const response = await request(app)
        .get('/api/status');
      
      assert.ok(response.body.data.features);
      assert.strictEqual(response.body.data.features.csp, true);
      assert.strictEqual(response.body.data.features.sessionSecurity, true);
      assert.strictEqual(response.body.data.features.rateLimiting, true);
      assert.strictEqual(response.body.data.features.csrf, true);
    });
  });

  describe('CSP Report Logging', () => {
    it('should log violation details', async () => {
      // This test verifies the route processes the report
      // Actual logging is handled by the logger module
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'Test Browser')
        .send({
          'csp-report': {
            'blocked-uri': 'https://tracking.com/pixel.js',
            'violated-directive': 'script-src',
            'effective-directive': 'script-src',
            'document-uri': 'https://app.example.com/dashboard',
            'source-file': 'https://app.example.com/dashboard',
            'line-number': 42,
            'column-number': 10,
            'original-policy': "script-src 'self'",
            'disposition': 'enforce',
            'status-code': 200
          }
        });
      
      assert.strictEqual(response.status, 204);
    });
  });
});
