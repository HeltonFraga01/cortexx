# Scaling Guide

This document describes the scaling features implemented in WUZAPI Manager, including rate limiting, queue processing, and caching strategies.

## Architecture Overview

WUZAPI Manager is designed as a single-instance application with the following scaling features:

- **Redis Caching**: Reduces database load and improves response times
- **Tenant Rate Limiting**: Prevents abuse and ensures fair resource usage
- **BullMQ Queues**: Async processing for heavy operations
- **Bundle Splitting**: Optimized frontend loading

> **Note**: This is a single-instance architecture. For horizontal scaling, consider using a load balancer with sticky sessions.

## Redis Caching

### Cache Keys and TTLs

| Cache Key | TTL | Description |
|-----------|-----|-------------|
| `branding:{tenantId}` | 5 min | Tenant branding configuration |
| `stripe_settings:{tenantId}` | 5 min | Stripe configuration |
| `stripe_analytics:{tenantId}` | 2 min | Stripe analytics data |
| `user_subscription:{userId}` | 5 min | User subscription details |
| `session_agents:{accountId}` | 5 min | Account agents list |
| `session_teams:{accountId}` | 5 min | Account teams list |
| `session_roles:{accountId}` | 10 min | Account roles list |
| `session_inboxes:{accountId}` | 5 min | Account inboxes list |
| `user_quotas:{userId}` | 5 min | User quota usage |
| `user_features:{userId}` | 10 min | User feature flags |

### Cache Invalidation

Cache is automatically invalidated when:
- Data is updated via API
- TTL expires
- Manual invalidation is triggered

```javascript
const CacheService = require('./services/CacheService');

// Invalidate specific cache
await CacheService.invalidateStripeSettings(tenantId);
await CacheService.invalidateUserSubscription(userId);

// Invalidate all caches for a tenant
await CacheService.invalidateTenantCache(tenantId);
```

### Cache Statistics

Monitor cache performance:

```bash
curl http://localhost:3000/metrics | grep redis_cache
```

Target: **>70% cache hit rate**

## Tenant Rate Limiting

### Rate Limits by Plan

| Plan | Requests/Minute | Burst Limit |
|------|-----------------|-------------|
| Free | 100 | 150 |
| Pro | 500 | 750 |
| Enterprise | 2000 | 3000 |

### Configuration

```env
RATE_LIMIT_FREE=100
RATE_LIMIT_PRO=500
RATE_LIMIT_ENTERPRISE=2000
```

### Response Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 450
X-RateLimit-Reset: 1705312800
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

HTTP Status: `429 Too Many Requests`

## BullMQ Queue System

### Available Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `campaign` | Bulk message sending | 5 |
| `import` | Contact imports | 2 |
| `report` | Report generation | 3 |
| `notification` | Push notifications | 10 |
| `webhook` | Webhook delivery | 5 |

### Adding Jobs

```javascript
const { addCampaignJob } = require('./queues/campaignQueue');

const job = await addCampaignJob({
  campaignId: 'camp-123',
  userId: 'user-456',
  tenantId: 'tenant-789',
  contacts: [...],
  messageTemplate: 'Hello {{name}}!'
});
```

### Job Status API

```bash
# Get job status
curl http://localhost:3000/api/jobs/campaign/camp-123/status

# Get queue statistics
curl http://localhost:3000/api/jobs/queues/stats

# Get workers status
curl http://localhost:3000/api/jobs/workers/status
```

### Job Lifecycle

1. **Waiting**: Job added to queue
2. **Active**: Worker processing job
3. **Completed**: Job finished successfully
4. **Failed**: Job failed (will retry based on config)
5. **Delayed**: Job scheduled for future execution

### Retry Configuration

```javascript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
}
```

## Bundle Optimization

### Chunk Strategy

| Chunk | Contents | Size Target |
|-------|----------|-------------|
| `vendor-react` | React, ReactDOM, Router | ~150KB |
| `vendor-query` | TanStack Query | ~50KB |
| `vendor-ui-radix` | Radix UI components | ~100KB |
| `vendor-forms` | React Hook Form, Zod | ~40KB |
| `vendor-utils` | date-fns, lodash | ~60KB |
| `chunk-admin` | Admin pages/components | ~80KB |
| `chunk-user` | User pages/components | ~100KB |

### Lazy Loading

Routes are lazy-loaded to reduce initial bundle:

```typescript
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const UserDashboard = lazy(() => import('@/pages/user/Dashboard'));
```

### Build Analysis

```bash
npm run build -- --analyze
```

Target: **<200KB initial bundle (gzipped)**

## Compression

### Brotli Compression

Brotli compression is enabled for all responses:

```javascript
// server/middleware/compression.js
const shrinkRay = require('shrink-ray-current');

app.use(shrinkRay({
  brotli: { quality: 4 },
  gzip: { level: 6 }
}));
```

### Compression Savings

| Content Type | Gzip | Brotli |
|--------------|------|--------|
| JavaScript | ~70% | ~75% |
| CSS | ~80% | ~85% |
| JSON | ~85% | ~90% |

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (P95) | <200ms | Prometheus histogram |
| Cache Hit Rate | >70% | Redis metrics |
| Initial Bundle Size | <200KB | Build output |
| Time to First Byte | <100ms | Lighthouse |
| Queue Processing Time | <5s | Job metrics |

## Monitoring Performance

### Key Metrics to Watch

1. **Response Time**: `http_request_duration_seconds`
2. **Error Rate**: `http_requests_total{status=~"5.."}`
3. **Cache Efficiency**: `redis_cache_hits_total / (hits + misses)`
4. **Queue Depth**: `queue_jobs_total{status="waiting"}`
5. **Memory Usage**: `process_resident_memory_bytes`

### Alerts

Configure alerts for:
- Response time P95 > 2s
- Error rate > 1%
- Cache hit rate < 50%
- Queue depth > 1000
- Memory usage > 80%

## Best Practices

### Database Queries

1. Always use pagination for list endpoints
2. Use indexes for frequently queried columns
3. Avoid N+1 queries - use joins or batch loading
4. Cache expensive queries

### API Design

1. Use ETags for conditional requests
2. Implement cursor-based pagination
3. Return minimal data by default
4. Support field selection (`?fields=id,name`)

### Frontend

1. Use React.memo for expensive components
2. Implement virtual scrolling for long lists
3. Lazy load images and heavy components
4. Use service workers for offline support

## Troubleshooting

### High Response Times

1. Check cache hit rate
2. Review slow query logs
3. Check queue backlog
4. Monitor memory usage

### Queue Backlog

1. Increase worker concurrency
2. Check for failed jobs
3. Review job processing time
4. Scale workers if needed

### Memory Issues

1. Check for memory leaks
2. Review cache size
3. Optimize large data processing
4. Implement pagination

## Environment Variables

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_QUEUE_DB=1

# Rate Limiting
RATE_LIMIT_FREE=100
RATE_LIMIT_PRO=500
RATE_LIMIT_ENTERPRISE=2000

# Queue Workers
WORKER_CAMPAIGN_CONCURRENCY=5
WORKER_IMPORT_CONCURRENCY=2
WORKER_REPORT_CONCURRENCY=3

# Cache
CACHE_DEFAULT_TTL=300
CACHE_BRANDING_TTL=300
CACHE_SUBSCRIPTION_TTL=300
```
