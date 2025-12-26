/**
 * Metrics Routes (Task 4.2, 4.3, Task 5.9)
 * Handles performance metrics collection and Prometheus-compatible endpoint
 * 
 * Task 5.9: Enhanced Prometheus metrics endpoint
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { prometheusMetrics } = require('../telemetry/metrics');
const CacheService = require('../services/CacheService');

// In-memory metrics storage (for simplicity - use Redis in production for persistence)
const metricsStore = {
  webVitals: new Map(),
  httpRequests: {
    total: 0,
    byStatus: new Map(),
    byRoute: new Map(),
    durations: []
  },
  lastReset: Date.now()
};

// Keep only last 1000 duration samples
const MAX_DURATION_SAMPLES = 1000;

/**
 * POST /api/metrics
 * Receives performance metrics from frontend
 */
router.post('/', express.json(), (req, res) => {
  try {
    const { type, name, value, rating, url, timestamp } = req.body;
    
    if (type === 'web-vital' && name && typeof value === 'number') {
      // Store web vital metric
      const key = `${name}:${rating}`;
      const current = metricsStore.webVitals.get(key) || { count: 0, sum: 0, min: Infinity, max: -Infinity };
      
      metricsStore.webVitals.set(key, {
        count: current.count + 1,
        sum: current.sum + value,
        min: Math.min(current.min, value),
        max: Math.max(current.max, value)
      });
      
      // Log poor metrics
      if (rating === 'poor') {
        logger.warn('Poor web vital detected', {
          metric: name,
          value,
          rating,
          url,
          timestamp
        });
      }
    }
    
    res.status(204).end();
  } catch (error) {
    logger.error('Error processing metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to process metrics' });
  }
});

/**
 * GET /metrics or GET /api/metrics
 * Task 5.9: Prometheus-compatible metrics endpoint
 */
router.get('/', (req, res) => {
  try {
    // Get Prometheus format output from telemetry module
    let output = prometheusMetrics.generatePrometheusOutput();
    
    // Add cache statistics
    const cacheStats = CacheService.getStats();
    output += '# HELP wuzapi_cache_hit_rate Cache hit rate percentage\n';
    output += '# TYPE wuzapi_cache_hit_rate gauge\n';
    output += `wuzapi_cache_hit_rate ${cacheStats.hitRateValue.toFixed(2)}\n\n`;
    
    output += '# HELP wuzapi_cache_hits_total Total cache hits\n';
    output += '# TYPE wuzapi_cache_hits_total counter\n';
    output += `wuzapi_cache_hits_total ${cacheStats.hits}\n\n`;
    
    output += '# HELP wuzapi_cache_misses_total Total cache misses\n';
    output += '# TYPE wuzapi_cache_misses_total counter\n';
    output += `wuzapi_cache_misses_total ${cacheStats.misses}\n\n`;
    
    // Add web vitals from frontend
    output += '# HELP wuzapi_web_vitals Core Web Vitals metrics\n';
    output += '# TYPE wuzapi_web_vitals gauge\n';
    for (const [key, data] of metricsStore.webVitals.entries()) {
      const [metric, rating] = key.split(':');
      const avg = data.count > 0 ? data.sum / data.count : 0;
      output += `wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="count"} ${data.count}\n`;
      output += `wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="avg"} ${avg.toFixed(2)}\n`;
    }
    output += '\n';
    
    // Add legacy HTTP metrics for backward compatibility
    output += '# HELP wuzapi_http_requests_legacy_total Legacy HTTP requests counter\n';
    output += '# TYPE wuzapi_http_requests_legacy_total counter\n';
    output += `wuzapi_http_requests_legacy_total ${metricsStore.httpRequests.total}\n\n`;
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(output);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).send('# Error generating metrics');
  }
});

/**
 * GET /api/metrics/summary
 * JSON summary of all metrics
 */
router.get('/summary', (req, res) => {
  try {
    const summary = prometheusMetrics.getSummary();
    const cacheStats = CacheService.getStats();
    
    res.json({
      success: true,
      data: {
        ...summary,
        cache: cacheStats,
        webVitals: Object.fromEntries(metricsStore.webVitals),
        legacyHttp: {
          total: metricsStore.httpRequests.total,
          byStatus: Object.fromEntries(metricsStore.httpRequests.byStatus),
        },
      },
    });
  } catch (error) {
    logger.error('Error generating metrics summary', { error: error.message });
    res.status(500).json({ error: 'Failed to generate metrics summary' });
  }
});

/**
 * Middleware to track HTTP request metrics
 */
function httpMetricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    
    // Track response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      // Update totals
      metricsStore.httpRequests.total++;
      
      // Update by status
      const statusCount = metricsStore.httpRequests.byStatus.get(status) || 0;
      metricsStore.httpRequests.byStatus.set(status, statusCount + 1);
      
      // Update durations (keep only recent samples)
      metricsStore.httpRequests.durations.push(duration);
      if (metricsStore.httpRequests.durations.length > MAX_DURATION_SAMPLES) {
        metricsStore.httpRequests.durations.shift();
      }
    });
    
    next();
  };
}

/**
 * Reset metrics (useful for testing)
 */
function resetMetrics() {
  metricsStore.webVitals.clear();
  metricsStore.httpRequests.total = 0;
  metricsStore.httpRequests.byStatus.clear();
  metricsStore.httpRequests.byRoute.clear();
  metricsStore.httpRequests.durations = [];
  metricsStore.lastReset = Date.now();
  prometheusMetrics.reset();
}

module.exports = router;
module.exports.httpMetricsMiddleware = httpMetricsMiddleware;
module.exports.resetMetrics = resetMetrics;
