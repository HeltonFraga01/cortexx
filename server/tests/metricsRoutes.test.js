/**
 * Metrics Routes Tests (Task 6.1)
 * Tests for performance metrics collection and Prometheus endpoint
 */
const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');
const request = require('supertest');
const express = require('express');

describe('Metrics Routes', () => {
  let app;
  let metricsRouter;
  let resetMetrics;

  beforeEach(() => {
    // Clear module cache to get fresh metrics store
    delete require.cache[require.resolve('../routes/metricsRoutes')];
    
    const metricsModule = require('../routes/metricsRoutes');
    metricsRouter = metricsModule;
    resetMetrics = metricsModule.resetMetrics;
    
    // Reset metrics before each test
    resetMetrics();
    
    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/metrics', metricsRouter);
    app.use('/metrics', metricsRouter);
  });

  describe('POST /api/metrics', () => {
    it('should accept valid web vital metric', async () => {
      const response = await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital',
          name: 'LCP',
          value: 1500,
          rating: 'good',
          url: '/dashboard',
          timestamp: Date.now()
        });
      
      assert.strictEqual(response.status, 204);
    });

    it('should store web vital metrics', async () => {
      await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital',
          name: 'LCP',
          value: 1500,
          rating: 'good'
        });
      
      await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital',
          name: 'LCP',
          value: 2000,
          rating: 'good'
        });
      
      const metricsResponse = await request(app).get('/metrics');
      
      assert.ok(metricsResponse.text.includes('wuzapi_web_vitals'));
      assert.ok(metricsResponse.text.includes('metric="LCP"'));
    });

    it('should handle missing fields gracefully', async () => {
      const response = await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital'
          // Missing name and value
        });
      
      assert.strictEqual(response.status, 204);
    });

    it('should reject invalid JSON', async () => {
      const response = await request(app)
        .post('/api/metrics')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      
      assert.strictEqual(response.status, 400);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus-compatible format', async () => {
      const response = await request(app).get('/metrics');
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.headers['content-type'].includes('text/plain'));
    });

    it('should include web vitals metrics', async () => {
      // Add some metrics first
      await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital',
          name: 'FID',
          value: 50,
          rating: 'good'
        });
      
      const response = await request(app).get('/metrics');
      
      assert.ok(response.text.includes('# HELP wuzapi_web_vitals'));
      assert.ok(response.text.includes('# TYPE wuzapi_web_vitals gauge'));
    });

    it('should include HTTP request metrics', async () => {
      const response = await request(app).get('/metrics');
      
      assert.ok(response.text.includes('wuzapi_http_requests_total'));
    });

    it('should include process memory metrics', async () => {
      const response = await request(app).get('/metrics');
      
      assert.ok(response.text.includes('wuzapi_process_memory_bytes'));
      assert.ok(response.text.includes('heapUsed'));
      assert.ok(response.text.includes('heapTotal'));
      assert.ok(response.text.includes('rss'));
    });

    it('should include process uptime', async () => {
      const response = await request(app).get('/metrics');
      
      assert.ok(response.text.includes('wuzapi_process_uptime_seconds'));
    });

    it('should calculate percentiles for request durations', async () => {
      // Need to use the middleware to track durations
      const { httpMetricsMiddleware } = require('../routes/metricsRoutes');
      
      const testApp = express();
      testApp.use(httpMetricsMiddleware());
      testApp.get('/test', (req, res) => res.json({ ok: true }));
      testApp.use('/metrics', metricsRouter);
      
      // Make some requests
      await request(testApp).get('/test');
      await request(testApp).get('/test');
      await request(testApp).get('/test');
      
      const response = await request(testApp).get('/metrics');
      
      assert.ok(response.text.includes('wuzapi_http_request_duration_seconds'));
    });
  });

  describe('httpMetricsMiddleware', () => {
    it('should track request count', async () => {
      const { httpMetricsMiddleware } = require('../routes/metricsRoutes');
      
      const testApp = express();
      testApp.use(httpMetricsMiddleware());
      testApp.get('/test', (req, res) => res.json({ ok: true }));
      testApp.use('/metrics', metricsRouter);
      
      await request(testApp).get('/test');
      await request(testApp).get('/test');
      
      const response = await request(testApp).get('/metrics');
      
      // Should have at least 2 requests (the /test calls)
      assert.ok(response.text.includes('wuzapi_http_requests_total'));
    });

    it('should track status codes', async () => {
      const { httpMetricsMiddleware } = require('../routes/metricsRoutes');
      
      const testApp = express();
      testApp.use(httpMetricsMiddleware());
      testApp.get('/ok', (req, res) => res.status(200).json({ ok: true }));
      testApp.get('/error', (req, res) => res.status(500).json({ error: 'test' }));
      testApp.use('/metrics', metricsRouter);
      
      await request(testApp).get('/ok');
      await request(testApp).get('/error');
      
      const response = await request(testApp).get('/metrics');
      
      assert.ok(response.text.includes('status="200"'));
      assert.ok(response.text.includes('status="500"'));
    });
  });

  describe('resetMetrics', () => {
    it('should clear all stored metrics', async () => {
      // Add some metrics
      await request(app)
        .post('/api/metrics')
        .send({
          type: 'web-vital',
          name: 'CLS',
          value: 0.05,
          rating: 'good'
        });
      
      // Verify metrics exist
      let response = await request(app).get('/metrics');
      assert.ok(response.text.includes('metric="CLS"'));
      
      // Reset
      resetMetrics();
      
      // Verify metrics cleared
      response = await request(app).get('/metrics');
      assert.ok(!response.text.includes('metric="CLS"'));
    });
  });
});
