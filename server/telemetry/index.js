/**
 * Telemetry Module Index
 * 
 * Exports all telemetry components:
 * - Prometheus metrics (Task 5)
 * - OpenTelemetry tracing (Task 6)
 * - Alert system (Task 7)
 */

const { prometheusMetrics, PrometheusMetrics } = require('./metrics');
const { alertManager, AlertManager, AlertSeverity } = require('./alerts');
const { initializeTracing, withSpan, addSpanAttributes, recordException } = require('./tracing');

module.exports = {
  // Metrics
  prometheusMetrics,
  PrometheusMetrics,
  
  // Alerts
  alertManager,
  AlertManager,
  AlertSeverity,
  
  // Tracing
  initializeTracing,
  withSpan,
  addSpanAttributes,
  recordException,
};
