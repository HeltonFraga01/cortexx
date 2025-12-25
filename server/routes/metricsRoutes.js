/**
 * Metrics Routes (Task 4.2, 4.3)
 * Handles performance metrics collection and Prometheus-compatible endpoint
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

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
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 */
router.get('/', (req, res) => {
  try {
    const lines = [];
    const now = Date.now();
    
    // Add header
    lines.push('# HELP wuzapi_web_vitals Core Web Vitals metrics');
    lines.push('# TYPE wuzapi_web_vitals gauge');
    
    // Web Vitals metrics
    for (const [key, data] of metricsStore.webVitals.entries()) {
      const [metric, rating] = key.split(':');
      const avg = data.count > 0 ? data.sum / data.count : 0;
      
      lines.push(`wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="count"} ${data.count}`);
      lines.push(`wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="avg"} ${avg.toFixed(2)}`);
      lines.push(`wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="min"} ${data.min === Infinity ? 0 : data.min.toFixed(2)}`);
      lines.push(`wuzapi_web_vitals{metric="${metric}",rating="${rating}",stat="max"} ${data.max === -Infinity ? 0 : data.max.toFixed(2)}`);
    }
    
    // HTTP request metrics
    lines.push('');
    lines.push('# HELP wuzapi_http_requests_total Total HTTP requests');
    lines.push('# TYPE wuzapi_http_requests_total counter');
    lines.push(`wuzapi_http_requests_total ${metricsStore.httpRequests.total}`);
    
    // Requests by status code
    lines.push('');
    lines.push('# HELP wuzapi_http_requests_by_status HTTP requests by status code');
    lines.push('# TYPE wuzapi_http_requests_by_status counter');
    for (const [status, count] of metricsStore.httpRequests.byStatus.entries()) {
      lines.push(`wuzapi_http_requests_by_status{status="${status}"} ${count}`);
    }
    
    // Request duration histogram
    if (metricsStore.httpRequests.durations.length > 0) {
      const durations = metricsStore.httpRequests.durations;
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      
      lines.push('');
      lines.push('# HELP wuzapi_http_request_duration_seconds HTTP request duration');
      lines.push('# TYPE wuzapi_http_request_duration_seconds summary');
      lines.push(`wuzapi_http_request_duration_seconds{quantile="0.5"} ${(p50 / 1000).toFixed(4)}`);
      lines.push(`wuzapi_http_request_duration_seconds{quantile="0.9"} ${(p90 / 1000).toFixed(4)}`);
      lines.push(`wuzapi_http_request_duration_seconds{quantile="0.99"} ${(p99 / 1000).toFixed(4)}`);
      lines.push(`wuzapi_http_request_duration_seconds_sum ${(durations.reduce((a, b) => a + b, 0) / 1000).toFixed(4)}`);
      lines.push(`wuzapi_http_request_duration_seconds_count ${durations.length}`);
      lines.push(`wuzapi_http_request_duration_seconds_avg ${(avg / 1000).toFixed(4)}`);
    }
    
    // Process metrics
    const memUsage = process.memoryUsage();
    lines.push('');
    lines.push('# HELP wuzapi_process_memory_bytes Process memory usage');
    lines.push('# TYPE wuzapi_process_memory_bytes gauge');
    lines.push(`wuzapi_process_memory_bytes{type="heapUsed"} ${memUsage.heapUsed}`);
    lines.push(`wuzapi_process_memory_bytes{type="heapTotal"} ${memUsage.heapTotal}`);
    lines.push(`wuzapi_process_memory_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`wuzapi_process_memory_bytes{type="external"} ${memUsage.external}`);
    
    // Uptime
    lines.push('');
    lines.push('# HELP wuzapi_process_uptime_seconds Process uptime');
    lines.push('# TYPE wuzapi_process_uptime_seconds gauge');
    lines.push(`wuzapi_process_uptime_seconds ${process.uptime().toFixed(0)}`);
    
    // Metrics collection age
    lines.push('');
    lines.push('# HELP wuzapi_metrics_age_seconds Time since metrics were last reset');
    lines.push('# TYPE wuzapi_metrics_age_seconds gauge');
    lines.push(`wuzapi_metrics_age_seconds ${((now - metricsStore.lastReset) / 1000).toFixed(0)}`);
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n'));
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).send('# Error generating metrics');
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
}

module.exports = router;
module.exports.httpMetricsMiddleware = httpMetricsMiddleware;
module.exports.resetMetrics = resetMetrics;
