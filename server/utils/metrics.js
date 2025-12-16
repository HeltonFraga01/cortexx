/**
 * Sistema de métricas de performance para WUZAPI Manager
 * Coleta e expõe métricas para Prometheus
 */

const { logger } = require('./logger');

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.histograms = new Map();
    this.gauges = new Map();
    this.startTime = Date.now();
    
    // Inicializar métricas básicas
    this.initializeBasicMetrics();
    
    // Coletar métricas do sistema periodicamente
    this.startSystemMetricsCollection();
  }

  initializeBasicMetrics() {
    // Contadores
    this.counters.set('http_requests_total', { value: 0, labels: {} });
    this.counters.set('http_errors_total', { value: 0, labels: {} });
    this.counters.set('database_queries_total', { value: 0, labels: {} });
    this.counters.set('wuzapi_requests_total', { value: 0, labels: {} });
    this.counters.set('nocodb_requests_total', { value: 0, labels: {} });
    
    // Histogramas para latência
    this.histograms.set('http_request_duration_ms', { buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000], values: [] });
    this.histograms.set('database_query_duration_ms', { buckets: [1, 5, 10, 25, 50, 100, 250, 500], values: [] });
    this.histograms.set('wuzapi_request_duration_ms', { buckets: [100, 250, 500, 1000, 2500, 5000, 10000], values: [] });
    
    // Gauges para valores atuais
    this.gauges.set('nodejs_memory_usage_bytes', { value: 0, type: 'heap_used' });
    this.gauges.set('nodejs_memory_total_bytes', { value: 0, type: 'heap_total' });
    this.gauges.set('nodejs_cpu_usage_percent', { value: 0 });
    this.gauges.set('active_connections', { value: 0 });
    this.gauges.set('database_connections', { value: 0 });
  }

  // Incrementar contador
  incrementCounter(name, labels = {}, value = 1) {
    const key = this.getMetricKey(name, labels);
    
    if (!this.counters.has(key)) {
      this.counters.set(key, { value: 0, labels });
    }
    
    const counter = this.counters.get(key);
    counter.value += value;
    
    // Não logar métricas para evitar loop infinito
  }

  // Observar valor em histograma
  observeHistogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, { 
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000], 
        values: [],
        labels 
      });
    }
    
    const histogram = this.histograms.get(key);
    histogram.values.push(value);
    
    // Manter apenas os últimos 1000 valores para evitar uso excessivo de memória
    if (histogram.values.length > 1000) {
      histogram.values = histogram.values.slice(-1000);
    }
    
    // Não logar métricas para evitar loop infinito
  }

  // Definir valor de gauge
  setGauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    
    if (!this.gauges.has(key)) {
      this.gauges.set(key, { value: 0, labels });
    }
    
    const gauge = this.gauges.get(key);
    gauge.value = value;
    
    // Não logar métricas para evitar loop infinito
  }

  // Gerar chave única para métrica com labels
  getMetricKey(name, labels) {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelString ? `${name}{${labelString}}` : name;
  }

  // Coletar métricas do sistema
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Métricas de memória
    this.setGauge('nodejs_memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
    this.setGauge('nodejs_memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
    this.setGauge('nodejs_memory_usage_bytes', memUsage.rss, { type: 'rss' });
    this.setGauge('nodejs_memory_usage_bytes', memUsage.external, { type: 'external' });
    
    // Uptime
    this.setGauge('nodejs_process_uptime_seconds', process.uptime());
    
    // Versão do Node.js
    this.setGauge('nodejs_version_info', 1, { version: process.version });
  }

  // Iniciar coleta periódica de métricas do sistema
  startSystemMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 15000); // A cada 15 segundos
  }

  // Middleware para métricas HTTP
  httpMetricsMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Incrementar contador de requisições
      this.incrementCounter('http_requests_total', {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: 'pending'
      });
      
      // Override do res.end para capturar métricas de resposta
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode.toString();
        
        // Atualizar contador com status code correto
        this.incrementCounter('http_requests_total', {
          method: req.method,
          route: req.route?.path || req.path,
          status_code: statusCode
        });
        
        // Contar erros
        if (res.statusCode >= 400) {
          this.incrementCounter('http_errors_total', {
            method: req.method,
            route: req.route?.path || req.path,
            status_code: statusCode
          });
        }
        
        // Observar duração
        this.observeHistogram('http_request_duration_ms', duration, {
          method: req.method,
          route: req.route?.path || req.path
        });
        
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  // Métricas para queries de banco de dados
  recordDatabaseQuery(operation, duration, success = true) {
    this.incrementCounter('database_queries_total', {
      operation,
      success: success.toString()
    });
    
    this.observeHistogram('database_query_duration_ms', duration, {
      operation
    });
  }

  // Métricas para requisições WUZAPI
  recordWuzapiRequest(endpoint, duration, success = true, statusCode = 200) {
    this.incrementCounter('wuzapi_requests_total', {
      endpoint,
      success: success.toString(),
      status_code: statusCode.toString()
    });
    
    this.observeHistogram('wuzapi_request_duration_ms', duration, {
      endpoint
    });
  }

  // Métricas para requisições NocoDB
  recordNocodbRequest(operation, duration, success = true) {
    this.incrementCounter('nocodb_requests_total', {
      operation,
      success: success.toString()
    });
    
    this.observeHistogram('nocodb_request_duration_ms', duration, {
      operation
    });
  }

  // Calcular percentis para histograma
  calculatePercentiles(values, percentiles = [50, 90, 95, 99]) {
    if (values.length === 0) return {};
    
    const sorted = [...values].sort((a, b) => a - b);
    const result = {};
    
    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    });
    
    return result;
  }

  // Gerar métricas no formato Prometheus
  generatePrometheusMetrics() {
    let output = '';
    
    // Informações básicas
    output += `# HELP wuzapi_manager_info Information about WUZAPI Manager\n`;
    output += `# TYPE wuzapi_manager_info gauge\n`;
    output += `wuzapi_manager_info{version="${process.env.npm_package_version || '1.0.0'}"} 1\n\n`;
    
    // Contadores
    for (const [key, counter] of this.counters) {
      const metricName = key.split('{')[0];
      const labels = this.formatLabels(counter.labels);
      
      output += `# HELP ${metricName} Total number of ${metricName.replace(/_/g, ' ')}\n`;
      output += `# TYPE ${metricName} counter\n`;
      output += `${metricName}${labels} ${counter.value}\n\n`;
    }
    
    // Gauges
    for (const [key, gauge] of this.gauges) {
      const metricName = key.split('{')[0];
      const labels = this.formatLabels(gauge.labels);
      
      output += `# HELP ${metricName} Current value of ${metricName.replace(/_/g, ' ')}\n`;
      output += `# TYPE ${metricName} gauge\n`;
      output += `${metricName}${labels} ${gauge.value}\n\n`;
    }
    
    // Histogramas
    for (const [key, histogram] of this.histograms) {
      const metricName = key.split('{')[0];
      const labels = this.formatLabels(histogram.labels);
      
      if (histogram.values.length === 0) continue;
      
      output += `# HELP ${metricName} Histogram of ${metricName.replace(/_/g, ' ')}\n`;
      output += `# TYPE ${metricName} histogram\n`;
      
      // Buckets
      let cumulativeCount = 0;
      for (const bucket of histogram.buckets) {
        const count = histogram.values.filter(v => v <= bucket).length;
        cumulativeCount = Math.max(cumulativeCount, count);
        const bucketLabels = this.formatLabels({...histogram.labels, le: bucket.toString()});
        output += `${metricName}_bucket${bucketLabels} ${count}\n`;
      }
      
      // +Inf bucket
      const infLabels = this.formatLabels({...histogram.labels, le: '+Inf'});
      output += `${metricName}_bucket${infLabels} ${histogram.values.length}\n`;
      
      // Count e sum
      const sum = histogram.values.reduce((a, b) => a + b, 0);
      output += `${metricName}_count${labels} ${histogram.values.length}\n`;
      output += `${metricName}_sum${labels} ${sum}\n\n`;
    }
    
    return output;
  }

  // Formatar labels para Prometheus
  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `{${labelPairs}}`;
  }

  // Obter resumo das métricas
  getSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      counters: {},
      gauges: {},
      histograms: {}
    };
    
    // Resumo dos contadores
    for (const [key, counter] of this.counters) {
      summary.counters[key] = counter.value;
    }
    
    // Resumo dos gauges
    for (const [key, gauge] of this.gauges) {
      summary.gauges[key] = gauge.value;
    }
    
    // Resumo dos histogramas
    for (const [key, histogram] of this.histograms) {
      if (histogram.values.length > 0) {
        summary.histograms[key] = {
          count: histogram.values.length,
          sum: histogram.values.reduce((a, b) => a + b, 0),
          avg: histogram.values.reduce((a, b) => a + b, 0) / histogram.values.length,
          min: Math.min(...histogram.values),
          max: Math.max(...histogram.values),
          ...this.calculatePercentiles(histogram.values)
        };
      }
    }
    
    return summary;
  }

  // Reset de métricas (útil para testes)
  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.initializeBasicMetrics();
  }
}

// Instância singleton
const metrics = new MetricsCollector();

module.exports = {
  MetricsCollector,
  metrics
};