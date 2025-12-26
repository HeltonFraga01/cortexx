/**
 * Prometheus Metrics Module
 * 
 * Task 5: Enhanced metrics collection with Prometheus format
 * Provides HTTP, cache, queue, and system metrics
 */

const { logger } = require('../utils/logger');

/**
 * Prometheus-compatible metrics collector
 */
class PrometheusMetrics {
  constructor() {
    this.counters = new Map();
    this.histograms = new Map();
    this.gauges = new Map();
    this.startTime = Date.now();
    
    this.initializeMetrics();
    this.startSystemMetricsCollection();
  }

  /**
   * Task 5.3-5.8: Initialize all metrics
   */
  initializeMetrics() {
    // Task 5.3: HTTP requests total
    this.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'route', 'status_code']);
    
    // Task 5.4: HTTP request duration
    this.registerHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', 
      ['method', 'route'], [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
    
    // Task 5.5: Redis cache hits
    this.registerCounter('redis_cache_hits_total', 'Total Redis cache hits', ['key_prefix']);
    
    // Task 5.6: Redis cache misses
    this.registerCounter('redis_cache_misses_total', 'Total Redis cache misses', ['key_prefix']);
    
    // Task 5.7: Active sessions
    this.registerGauge('active_sessions_total', 'Total active sessions', []);
    
    // Task 5.8: Queue jobs
    this.registerCounter('queue_jobs_total', 'Total queue jobs', ['queue', 'status']);
    this.registerGauge('queue_jobs_waiting', 'Waiting queue jobs', ['queue']);
    this.registerGauge('queue_jobs_active', 'Active queue jobs', ['queue']);
    
    // System metrics
    this.registerGauge('nodejs_memory_heap_used_bytes', 'Node.js heap used', []);
    this.registerGauge('nodejs_memory_heap_total_bytes', 'Node.js heap total', []);
    this.registerGauge('nodejs_memory_rss_bytes', 'Node.js RSS memory', []);
    this.registerGauge('nodejs_cpu_usage_percent', 'Node.js CPU usage', []);
    this.registerGauge('process_uptime_seconds', 'Process uptime in seconds', []);
    
    // Database metrics
    this.registerCounter('database_queries_total', 'Total database queries', ['operation', 'success']);
    this.registerHistogram('database_query_duration_seconds', 'Database query duration',
      ['operation'], [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]);
    
    // External API metrics
    this.registerCounter('external_api_requests_total', 'Total external API requests', ['service', 'success']);
    this.registerHistogram('external_api_duration_seconds', 'External API request duration',
      ['service'], [0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
  }

  /**
   * Register a counter metric
   */
  registerCounter(name, help, labelNames) {
    this.counters.set(name, {
      name,
      help,
      labelNames,
      values: new Map(),
    });
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(name, help, labelNames, buckets) {
    this.histograms.set(name, {
      name,
      help,
      labelNames,
      buckets,
      values: new Map(),
    });
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name, help, labelNames) {
    this.gauges.set(name, {
      name,
      help,
      labelNames,
      values: new Map(),
    });
  }

  /**
   * Increment a counter
   */
  incCounter(name, labels = {}, value = 1) {
    const counter = this.counters.get(name);
    if (!counter) return;
    
    const key = this.labelsToKey(labels);
    const current = counter.values.get(key) || { labels, value: 0 };
    current.value += value;
    counter.values.set(key, current);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name, labels = {}, value) {
    const histogram = this.histograms.get(name);
    if (!histogram) return;
    
    const key = this.labelsToKey(labels);
    if (!histogram.values.has(key)) {
      histogram.values.set(key, { labels, observations: [], sum: 0, count: 0 });
    }
    
    const data = histogram.values.get(key);
    data.observations.push(value);
    data.sum += value;
    data.count++;
    
    // Keep only last 10000 observations to prevent memory issues
    if (data.observations.length > 10000) {
      data.observations = data.observations.slice(-10000);
    }
  }

  /**
   * Set a gauge value
   */
  setGauge(name, labels = {}, value) {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    
    const key = this.labelsToKey(labels);
    gauge.values.set(key, { labels, value });
  }

  /**
   * Convert labels object to string key
   */
  labelsToKey(labels) {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Format labels for Prometheus output
   */
  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) return '';
    const pairs = Object.entries(labels)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
      .join(',');
    return `{${pairs}}`;
  }

  /**
   * Task 5.9: Generate Prometheus format output
   */
  generatePrometheusOutput() {
    let output = '';
    
    // Counters
    for (const [name, counter] of this.counters) {
      output += `# HELP ${name} ${counter.help}\n`;
      output += `# TYPE ${name} counter\n`;
      for (const [, data] of counter.values) {
        output += `${name}${this.formatLabels(data.labels)} ${data.value}\n`;
      }
      output += '\n';
    }
    
    // Gauges
    for (const [name, gauge] of this.gauges) {
      output += `# HELP ${name} ${gauge.help}\n`;
      output += `# TYPE ${name} gauge\n`;
      for (const [, data] of gauge.values) {
        output += `${name}${this.formatLabels(data.labels)} ${data.value}\n`;
      }
      output += '\n';
    }
    
    // Histograms
    for (const [name, histogram] of this.histograms) {
      output += `# HELP ${name} ${histogram.help}\n`;
      output += `# TYPE ${name} histogram\n`;
      
      for (const [, data] of histogram.values) {
        const labels = this.formatLabels(data.labels);
        
        // Bucket values
        let cumulative = 0;
        for (const bucket of histogram.buckets) {
          cumulative = data.observations.filter(v => v <= bucket).length;
          const bucketLabels = this.formatLabels({ ...data.labels, le: bucket });
          output += `${name}_bucket${bucketLabels} ${cumulative}\n`;
        }
        
        // +Inf bucket
        const infLabels = this.formatLabels({ ...data.labels, le: '+Inf' });
        output += `${name}_bucket${infLabels} ${data.count}\n`;
        
        // Sum and count
        output += `${name}_sum${labels} ${data.sum}\n`;
        output += `${name}_count${labels} ${data.count}\n`;
      }
      output += '\n';
    }
    
    return output;
  }

  /**
   * Task 5.10: HTTP metrics middleware
   */
  httpMetricsMiddleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e9; // Convert to seconds
        const route = req.route?.path || req.path || 'unknown';
        const method = req.method;
        const statusCode = res.statusCode.toString();
        
        // Increment request counter
        this.incCounter('http_requests_total', { method, route, status_code: statusCode });
        
        // Observe duration
        this.observeHistogram('http_request_duration_seconds', { method, route }, duration);
        
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  /**
   * Collect system metrics periodically
   */
  startSystemMetricsCollection() {
    const collectMetrics = () => {
      const memUsage = process.memoryUsage();
      
      this.setGauge('nodejs_memory_heap_used_bytes', {}, memUsage.heapUsed);
      this.setGauge('nodejs_memory_heap_total_bytes', {}, memUsage.heapTotal);
      this.setGauge('nodejs_memory_rss_bytes', {}, memUsage.rss);
      this.setGauge('process_uptime_seconds', {}, process.uptime());
    };
    
    // Collect immediately and then every 15 seconds
    collectMetrics();
    setInterval(collectMetrics, 15000);
  }

  /**
   * Get metrics summary as JSON
   */
  getSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      counters: {},
      gauges: {},
      histograms: {},
    };
    
    for (const [name, counter] of this.counters) {
      summary.counters[name] = {};
      for (const [key, data] of counter.values) {
        summary.counters[name][key || 'default'] = data.value;
      }
    }
    
    for (const [name, gauge] of this.gauges) {
      summary.gauges[name] = {};
      for (const [key, data] of gauge.values) {
        summary.gauges[name][key || 'default'] = data.value;
      }
    }
    
    for (const [name, histogram] of this.histograms) {
      summary.histograms[name] = {};
      for (const [key, data] of histogram.values) {
        const sorted = [...data.observations].sort((a, b) => a - b);
        const count = sorted.length;
        summary.histograms[name][key || 'default'] = {
          count: data.count,
          sum: data.sum,
          avg: count > 0 ? data.sum / count : 0,
          p50: count > 0 ? sorted[Math.floor(count * 0.5)] : 0,
          p90: count > 0 ? sorted[Math.floor(count * 0.9)] : 0,
          p95: count > 0 ? sorted[Math.floor(count * 0.95)] : 0,
          p99: count > 0 ? sorted[Math.floor(count * 0.99)] : 0,
        };
      }
    }
    
    return summary;
  }

  /**
   * Reset all metrics
   */
  reset() {
    for (const counter of this.counters.values()) {
      counter.values.clear();
    }
    for (const gauge of this.gauges.values()) {
      gauge.values.clear();
    }
    for (const histogram of this.histograms.values()) {
      histogram.values.clear();
    }
  }
}

// Singleton instance
const prometheusMetrics = new PrometheusMetrics();

module.exports = {
  PrometheusMetrics,
  prometheusMetrics,
};
