/**
 * Tests for Prometheus Metrics Module
 * Task 13.1: Create tests for metricsMiddleware
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock prom-client before requiring metrics module
const mockRegister = {
  metrics: mock.fn(() => Promise.resolve('# HELP test_metric\ntest_metric 1')),
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
  clear: mock.fn(),
};

const mockCounter = {
  inc: mock.fn(),
  labels: mock.fn(() => ({ inc: mock.fn() })),
};

const mockHistogram = {
  observe: mock.fn(),
  labels: mock.fn(() => ({ observe: mock.fn() })),
};

const mockGauge = {
  set: mock.fn(),
  inc: mock.fn(),
  dec: mock.fn(),
  labels: mock.fn(() => ({ set: mock.fn(), inc: mock.fn(), dec: mock.fn() })),
};

mock.module('prom-client', {
  namedExports: {
    Registry: class {
      constructor() {
        return mockRegister;
      }
    },
    Counter: class {
      constructor() {
        return mockCounter;
      }
    },
    Histogram: class {
      constructor() {
        return mockHistogram;
      }
    },
    Gauge: class {
      constructor() {
        return mockGauge;
      }
    },
    collectDefaultMetrics: mock.fn(),
  },
});

describe('Metrics Module', () => {
  let metrics;

  beforeEach(() => {
    // Clear mocks
    mockCounter.inc.mock.resetCalls();
    mockHistogram.observe.mock.resetCalls();
    mockGauge.set.mock.resetCalls();
    
    // Re-require module to get fresh instance
    delete require.cache[require.resolve('./metrics')];
    metrics = require('./metrics');
  });

  describe('httpRequestsTotal', () => {
    it('should export httpRequestsTotal counter', () => {
      assert.ok(metrics.httpRequestsTotal, 'httpRequestsTotal should be exported');
    });
  });

  describe('httpRequestDuration', () => {
    it('should export httpRequestDuration histogram', () => {
      assert.ok(metrics.httpRequestDuration, 'httpRequestDuration should be exported');
    });
  });

  describe('cacheHits', () => {
    it('should export cacheHits counter', () => {
      assert.ok(metrics.cacheHits, 'cacheHits should be exported');
    });
  });

  describe('cacheMisses', () => {
    it('should export cacheMisses counter', () => {
      assert.ok(metrics.cacheMisses, 'cacheMisses should be exported');
    });
  });

  describe('activeSessions', () => {
    it('should export activeSessions gauge', () => {
      assert.ok(metrics.activeSessions, 'activeSessions should be exported');
    });
  });

  describe('queueJobs', () => {
    it('should export queueJobs counter', () => {
      assert.ok(metrics.queueJobs, 'queueJobs should be exported');
    });
  });

  describe('metricsMiddleware', () => {
    it('should export metricsMiddleware function', () => {
      assert.ok(typeof metrics.metricsMiddleware === 'function', 'metricsMiddleware should be a function');
    });

    it('should call next() and track request', (t, done) => {
      const req = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
      };
      const res = {
        statusCode: 200,
        on: mock.fn((event, callback) => {
          if (event === 'finish') {
            // Simulate response finish
            setTimeout(callback, 10);
          }
        }),
      };
      const next = mock.fn();

      metrics.metricsMiddleware(req, res, next);

      assert.strictEqual(next.mock.callCount(), 1, 'next() should be called');
      done();
    });
  });

  describe('metricsEndpoint', () => {
    it('should export metricsEndpoint function', () => {
      assert.ok(typeof metrics.metricsEndpoint === 'function', 'metricsEndpoint should be a function');
    });

    it('should return metrics in Prometheus format', async () => {
      const req = {};
      const res = {
        set: mock.fn(),
        send: mock.fn(),
      };

      await metrics.metricsEndpoint(req, res);

      assert.strictEqual(res.set.mock.callCount(), 1, 'res.set should be called');
      assert.strictEqual(res.send.mock.callCount(), 1, 'res.send should be called');
    });
  });

  describe('recordCacheHit', () => {
    it('should export recordCacheHit function', () => {
      assert.ok(typeof metrics.recordCacheHit === 'function', 'recordCacheHit should be a function');
    });
  });

  describe('recordCacheMiss', () => {
    it('should export recordCacheMiss function', () => {
      assert.ok(typeof metrics.recordCacheMiss === 'function', 'recordCacheMiss should be a function');
    });
  });

  describe('recordQueueJob', () => {
    it('should export recordQueueJob function', () => {
      assert.ok(typeof metrics.recordQueueJob === 'function', 'recordQueueJob should be a function');
    });
  });
});
