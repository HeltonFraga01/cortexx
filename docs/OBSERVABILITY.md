# Observability Guide

This document describes the observability stack implemented in WUZAPI Manager, including metrics, tracing, and alerting.

## Overview

The observability stack consists of:

- **Prometheus Metrics**: Application metrics exposed at `/metrics`
- **OpenTelemetry Tracing**: Distributed tracing with Jaeger export
- **Alert System**: Automated alerts via webhooks (Discord/Slack)
- **Grafana Dashboards**: Visual monitoring dashboards

## Prometheus Metrics

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request duration distribution |
| `redis_cache_hits_total` | Counter | Cache hit count by key type |
| `redis_cache_misses_total` | Counter | Cache miss count by key type |
| `active_sessions_total` | Gauge | Current active sessions |
| `queue_jobs_total` | Counter | Queue jobs by queue and status |

### Accessing Metrics

```bash
# Local development
curl http://localhost:3000/metrics

# Production
curl https://your-domain.com/metrics
```

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'wuzapi-manager'
    static_configs:
      - targets: ['wuzapi-manager:3000']
    scrape_interval: 15s
    metrics_path: /metrics
```

## OpenTelemetry Tracing

### Configuration

Set environment variables:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
OTEL_SERVICE_NAME=wuzapi-manager
```

### Auto-Instrumentation

The following are automatically instrumented:
- Express HTTP requests
- HTTP client requests
- Redis operations

### Custom Spans

```javascript
const { withSpan, addSpanAttributes } = require('./telemetry');

async function myFunction() {
  return withSpan('my-operation', async (span) => {
    addSpanAttributes({ 'custom.attribute': 'value' });
    // Your code here
  });
}
```

### Viewing Traces

Access Jaeger UI at `http://localhost:16686` (default port).

## Alert System

### Alert Types

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | 5xx errors > 1% | Critical |
| High Latency | P95 > 2 seconds | Warning |
| Redis Unavailable | Connection failed | Critical |
| Supabase Unavailable | Connection failed | Critical |
| High Memory Usage | > 80% | Warning |

### Webhook Configuration

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
# or
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Alert Cooldown

Alerts have a 5-minute cooldown to prevent spam. The same alert won't fire again within this period.

### Alert Payload Format

```json
{
  "embeds": [{
    "title": "🚨 Alert: High Error Rate",
    "description": "Error rate exceeded 1% threshold",
    "color": 15158332,
    "fields": [
      { "name": "Severity", "value": "critical", "inline": true },
      { "name": "Current Value", "value": "2.5%", "inline": true }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }]
}
```

## Grafana Dashboards

### Available Dashboards

1. **HTTP Metrics Dashboard** (`http-metrics.json`)
   - Request rate by endpoint
   - Response time percentiles
   - Error rate trends
   - Status code distribution

2. **Cache Metrics Dashboard** (`cache-metrics.json`)
   - Cache hit/miss ratio
   - Cache operations by key type
   - Redis connection status

3. **Queue Metrics Dashboard** (`queue-metrics.json`)
   - Jobs processed per queue
   - Job success/failure rates
   - Queue depth over time

### Importing Dashboards

1. Open Grafana UI
2. Go to Dashboards → Import
3. Upload JSON file from `monitoring/grafana/dashboards/`
4. Select Prometheus data source
5. Click Import

### Dashboard Variables

Dashboards support the following variables:
- `$interval`: Time aggregation interval
- `$endpoint`: Filter by API endpoint
- `$status`: Filter by HTTP status code

## Docker Compose Setup

Add monitoring services to your `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP

volumes:
  prometheus_data:
  grafana_data:
```

## Health Checks

### Application Health

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  }
}
```

### Job System Health

```bash
curl http://localhost:3000/api/jobs/health
```

Response:
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "queues": {
      "campaign": { "available": true, "waiting": 0, "active": 0 },
      "import": { "available": true, "waiting": 0, "active": 0 },
      "report": { "available": true, "waiting": 0, "active": 0 }
    },
    "workers": {
      "campaign": { "active": true, "running": true },
      "import": { "active": true, "running": true },
      "report": { "active": true, "running": true }
    }
  }
}
```

## Troubleshooting

### Metrics Not Appearing

1. Check if `/metrics` endpoint is accessible
2. Verify Prometheus scrape config
3. Check for firewall/network issues

### Traces Not Showing in Jaeger

1. Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is correct
2. Check Jaeger container is running
3. Look for errors in application logs

### Alerts Not Firing

1. Check `ALERT_WEBHOOK_URL` is configured
2. Verify webhook URL is valid
3. Check alert cooldown hasn't been triggered

## Environment Variables Reference

```env
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
OTEL_SERVICE_NAME=wuzapi-manager

# Alerts
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL_ENABLED=false

# Grafana
GRAFANA_PASSWORD=admin

# Metrics
METRICS_ENABLED=true
METRICS_PATH=/metrics
```
