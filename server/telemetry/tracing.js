/**
 * OpenTelemetry Tracing Module
 * 
 * Task 6: Distributed tracing with OpenTelemetry
 * Provides automatic instrumentation for Express, HTTP, and Redis
 * 
 * IMPORTANT: This file must be imported BEFORE any other modules
 * to ensure proper instrumentation.
 */

const { logger } = require('../utils/logger');

/**
 * Initialize OpenTelemetry tracing
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.serviceName - Service name for traces
 * @param {string} options.exporterEndpoint - OTLP exporter endpoint
 * @param {boolean} options.enabled - Whether tracing is enabled
 */
function initializeTracing(options = {}) {
  const {
    serviceName = process.env.OTEL_SERVICE_NAME || 'wuzapi-manager',
    exporterEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    enabled = process.env.OTEL_ENABLED !== 'false',
  } = options;

  if (!enabled) {
    logger.info('OpenTelemetry tracing disabled');
    return null;
  }

  try {
    // Task 6.1: Import OpenTelemetry dependencies
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

    // Task 6.2: Create trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: exporterEndpoint,
    });

    // Task 6.3-6.5: Configure auto-instrumentation
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Task 6.3: Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          // Task 6.4: HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingPaths: ['/health', '/metrics'],
          },
          // Task 6.5: Redis instrumentation
          '@opentelemetry/instrumentation-redis-4': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-ioredis': {
            enabled: true,
          },
          // Disable some instrumentations we don't need
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-dns': {
            enabled: false,
          },
        }),
      ],
    });

    // Task 6.7: Start the SDK
    sdk.start();

    logger.info('OpenTelemetry tracing initialized', {
      serviceName,
      exporterEndpoint,
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => logger.info('OpenTelemetry SDK shut down'))
        .catch((error) => logger.error('Error shutting down OpenTelemetry SDK', { error: error.message }));
    });

    return sdk;
  } catch (error) {
    logger.warn('OpenTelemetry initialization failed, tracing disabled', {
      error: error.message,
      hint: 'Install @opentelemetry/sdk-node and related packages to enable tracing',
    });
    return null;
  }
}

/**
 * Create a custom span for manual instrumentation
 * 
 * @param {string} name - Span name
 * @param {Function} fn - Function to execute within the span
 * @returns {Promise<any>} Result of the function
 */
async function withSpan(name, fn) {
  try {
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer('wuzapi-manager');
    
    return await tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: error.message }); // ERROR
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  } catch {
    // OpenTelemetry not available, just run the function
    return await fn();
  }
}

/**
 * Add attributes to the current span
 * 
 * @param {Object} attributes - Key-value pairs to add
 */
function addSpanAttributes(attributes) {
  try {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (span) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
  } catch {
    // OpenTelemetry not available, ignore
  }
}

/**
 * Record an exception on the current span
 * 
 * @param {Error} error - Error to record
 */
function recordException(error) {
  try {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
    }
  } catch {
    // OpenTelemetry not available, ignore
  }
}

module.exports = {
  initializeTracing,
  withSpan,
  addSpanAttributes,
  recordException,
};
