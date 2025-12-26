# Design: Melhorias Estratégicas - Performance, Observabilidade e Escala

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Cloudflare CDN                                 │
│                    (Assets estáticos, DDoS protection)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Docker Network                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────────┐│
│  │   Frontend  │    │                    Backend                          ││
│  │   (React)   │    │  ┌─────────────────────────────────────────────┐   ││
│  │             │───▶│  │              Express Server                  │   ││
│  │ • Bundles   │    │  │  • OpenTelemetry Instrumentation            │   ││
│  │ • SW Cache  │    │  │  • Prometheus Metrics                       │   ││
│  │ • Brotli    │    │  │  • Rate Limiting per Tenant                 │   ││
│  └─────────────┘    │  └──────────────┬──────────────────────────────┘   ││
│                     │                 │                                   ││
│                     │    ┌────────────┼────────────┐                     ││
│                     │    ▼            ▼            ▼                     ││
│                     │ ┌──────┐   ┌──────────┐  ┌──────────┐              ││
│                     │ │Redis │   │ BullMQ   │  │ Supabase │              ││
│                     │ │Cache │   │  Queue   │  │   DB     │              ││
│                     │ └──────┘   └──────────┘  └──────────┘              ││
│                     └─────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Observability Stack                              ││
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         ││
│  │  │Prometheus│───▶│ Grafana  │    │  Jaeger  │    │  Alerts  │         ││
│  │  │ Metrics  │    │Dashboard │    │ Tracing  │    │ Webhook  │         ││
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Performance - Bundle Splitting

### Configuração Vite (vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
          
          // Feature chunks
          'admin': [
            './src/pages/AdminDashboard.tsx',
            './src/components/admin/AdminLayout.tsx',
          ],
          'user': [
            './src/pages/UserDashboard.tsx',
            './src/components/user/UserLayout.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
```

### Service Worker (sw.ts)

```typescript
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST)

// Cache-first for static assets
registerRoute(
  ({ request }) => request.destination === 'style' ||
                   request.destination === 'script' ||
                   request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// Network-first for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
)

// Stale-while-revalidate for images
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
)
```

## 2. Performance - Compressão Brotli

### Middleware de Compressão (server/middleware/compression.js)

```javascript
const shrinkRay = require('shrink-ray-current');

const compressionMiddleware = shrinkRay({
  // Usar Brotli quando disponível, fallback para gzip
  brotli: {
    quality: 4, // Balanceado entre velocidade e compressão
  },
  zlib: {
    level: 6,
  },
  // Comprimir apenas respostas > 1KB
  threshold: 1024,
  // Filtrar tipos de conteúdo
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return shrinkRay.filter(req, res);
  },
});

module.exports = compressionMiddleware;
```

### Uso no server/index.js

```javascript
const compressionMiddleware = require('./middleware/compression');

// Substituir compression() por shrink-ray
app.use(compressionMiddleware);
```

## 3. Observabilidade - OpenTelemetry

### Estrutura de Arquivos

```
server/
├── telemetry/
│   ├── tracing.js       # Configuração OpenTelemetry
│   ├── metrics.js       # Métricas Prometheus
│   └── alerts.js        # Sistema de alertas
```

### tracing.js

```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'wuzapi-manager',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
    }),
  ],
});

// Iniciar SDK antes de qualquer outro código
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
```

### metrics.js (Prometheus)

```javascript
const client = require('prom-client');
const { logger } = require('../utils/logger');

// Criar registro
const register = new client.Registry();

// Adicionar métricas padrão (CPU, memória, etc.)
client.collectDefaultMetrics({ register });

// Métricas customizadas
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const cacheHitsTotal = new client.Counter({
  name: 'redis_cache_hits_total',
  help: 'Total number of Redis cache hits',
  labelNames: ['cache_key'],
  registers: [register],
});

const cacheMissesTotal = new client.Counter({
  name: 'redis_cache_misses_total',
  help: 'Total number of Redis cache misses',
  labelNames: ['cache_key'],
  registers: [register],
});

const activeSessionsGauge = new client.Gauge({
  name: 'active_sessions_total',
  help: 'Number of active sessions',
  registers: [register],
});

const queueJobsGauge = new client.Gauge({
  name: 'queue_jobs_total',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name', 'status'],
  registers: [register],
});

// Middleware para coletar métricas HTTP
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const tenantId = req.context?.tenantId || 'unknown';
    
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
      tenant_id: tenantId,
    });
    
    httpRequestDuration.observe({
      method: req.method,
      route,
      status_code: res.statusCode,
    }, duration);
  });
  
  next();
}

// Endpoint /metrics
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).end();
  }
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  httpRequestsTotal,
  httpRequestDuration,
  cacheHitsTotal,
  cacheMissesTotal,
  activeSessionsGauge,
  queueJobsGauge,
};
```

### alerts.js

```javascript
const { logger } = require('../utils/logger');
const axios = require('axios');

class AlertManager {
  constructor() {
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL;
    this.emailEnabled = process.env.ALERT_EMAIL_ENABLED === 'true';
    this.thresholds = {
      errorRate: 0.01, // 1%
      latencyP95: 2000, // 2 seconds
      memoryUsage: 0.8, // 80%
    };
    this.cooldowns = new Map(); // Evitar spam de alertas
  }

  async sendAlert(type, message, severity = 'warning') {
    // Verificar cooldown (5 minutos entre alertas do mesmo tipo)
    const cooldownKey = `${type}:${severity}`;
    const lastAlert = this.cooldowns.get(cooldownKey);
    if (lastAlert && Date.now() - lastAlert < 5 * 60 * 1000) {
      return;
    }
    this.cooldowns.set(cooldownKey, Date.now());

    const alert = {
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      service: 'wuzapi-manager',
      environment: process.env.NODE_ENV,
    };

    logger.warn('Alert triggered', alert);

    // Enviar para webhook (Discord/Slack)
    if (this.webhookUrl) {
      try {
        await axios.post(this.webhookUrl, {
          content: `🚨 **${severity.toUpperCase()}** - ${type}\n${message}`,
          embeds: [{
            title: type,
            description: message,
            color: severity === 'critical' ? 0xff0000 : 0xffaa00,
            timestamp: alert.timestamp,
          }],
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', { error: error.message });
      }
    }
  }

  checkErrorRate(errorCount, totalCount, windowMinutes = 5) {
    const rate = totalCount > 0 ? errorCount / totalCount : 0;
    if (rate > this.thresholds.errorRate) {
      this.sendAlert(
        'High Error Rate',
        `Error rate is ${(rate * 100).toFixed(2)}% in the last ${windowMinutes} minutes`,
        rate > 0.05 ? 'critical' : 'warning'
      );
    }
  }

  checkLatency(p95Latency) {
    if (p95Latency > this.thresholds.latencyP95) {
      this.sendAlert(
        'High Latency',
        `P95 latency is ${p95Latency}ms (threshold: ${this.thresholds.latencyP95}ms)`,
        p95Latency > 5000 ? 'critical' : 'warning'
      );
    }
  }

  checkServiceHealth(service, isHealthy) {
    if (!isHealthy) {
      this.sendAlert(
        `${service} Unavailable`,
        `${service} is not responding`,
        'critical'
      );
    }
  }

  checkMemoryUsage() {
    const used = process.memoryUsage();
    const heapUsedPercent = used.heapUsed / used.heapTotal;
    
    if (heapUsedPercent > this.thresholds.memoryUsage) {
      this.sendAlert(
        'High Memory Usage',
        `Heap usage is ${(heapUsedPercent * 100).toFixed(1)}%`,
        heapUsedPercent > 0.9 ? 'critical' : 'warning'
      );
    }
  }
}

module.exports = new AlertManager();
```

## 4. Rate Limiting por Tenant

### tenantRateLimiter.js

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../utils/redisClient');
const { logger } = require('../utils/logger');

// Limites por plano
const PLAN_LIMITS = {
  free: { windowMs: 60000, max: 100 },      // 100 req/min
  pro: { windowMs: 60000, max: 500 },       // 500 req/min
  enterprise: { windowMs: 60000, max: 2000 }, // 2000 req/min
};

// Cache de planos por tenant (evita query a cada request)
const tenantPlanCache = new Map();

async function getTenantPlan(tenantId) {
  if (tenantPlanCache.has(tenantId)) {
    return tenantPlanCache.get(tenantId);
  }
  
  // Buscar do banco (com cache Redis)
  const CacheService = require('../services/CacheService');
  const SupabaseService = require('../services/SupabaseService');
  
  const cacheKey = `tenant:plan:${tenantId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    tenantPlanCache.set(tenantId, cached);
    return cached;
  }
  
  const { data: tenant } = await SupabaseService.adminClient
    .from('tenants')
    .select('plan_type')
    .eq('id', tenantId)
    .single();
  
  const plan = tenant?.plan_type || 'free';
  tenantPlanCache.set(tenantId, plan);
  await redisClient.set(cacheKey, plan, 300); // 5 min cache
  
  return plan;
}

function createTenantRateLimiter() {
  return rateLimit({
    windowMs: 60000, // 1 minuto
    max: async (req) => {
      const tenantId = req.context?.tenantId;
      if (!tenantId) return 100; // Default para requests sem tenant
      
      const plan = await getTenantPlan(tenantId);
      return PLAN_LIMITS[plan]?.max || 100;
    },
    keyGenerator: (req) => {
      // Chave única por tenant
      return `tenant:${req.context?.tenantId || req.ip}`;
    },
    store: new RedisStore({
      sendCommand: (...args) => redisClient.client.call(...args),
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        tenantId: req.context?.tenantId,
        ip: req.ip,
        path: req.path,
      });
      
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      });
    },
  });
}

module.exports = { createTenantRateLimiter, getTenantPlan };
```

## 5. Queue com BullMQ

### Estrutura de Arquivos

```
server/
├── queues/
│   ├── index.js           # Configuração central
│   ├── campaignQueue.js   # Fila de campanhas
│   ├── importQueue.js     # Fila de importação
│   └── reportQueue.js     # Fila de relatórios
├── workers/
│   ├── campaignWorker.js  # Worker de campanhas
│   ├── importWorker.js    # Worker de importação
│   └── reportWorker.js    # Worker de relatórios
```

### queues/index.js

```javascript
const { Queue, Worker, QueueScheduler } = require('bullmq');
const { logger } = require('../utils/logger');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
};

// Criar filas
const campaignQueue = new Queue('campaigns', { connection });
const importQueue = new Queue('imports', { connection });
const reportQueue = new Queue('reports', { connection });

// Schedulers (necessários para delayed jobs)
new QueueScheduler('campaigns', { connection });
new QueueScheduler('imports', { connection });
new QueueScheduler('reports', { connection });

// Eventos de monitoramento
[campaignQueue, importQueue, reportQueue].forEach(queue => {
  queue.on('error', (error) => {
    logger.error(`Queue ${queue.name} error`, { error: error.message });
  });
});

module.exports = {
  campaignQueue,
  importQueue,
  reportQueue,
  connection,
};
```

### workers/campaignWorker.js

```javascript
const { Worker } = require('bullmq');
const { connection } = require('../queues');
const { logger } = require('../utils/logger');
const CampaignService = require('../services/CampaignService');

const campaignWorker = new Worker('campaigns', async (job) => {
  const { campaignId, tenantId, contacts, message } = job.data;
  
  logger.info('Processing campaign', { campaignId, contactCount: contacts.length });
  
  let processed = 0;
  let failed = 0;
  
  for (const contact of contacts) {
    try {
      await CampaignService.sendMessage(contact, message);
      processed++;
      
      // Atualizar progresso
      await job.updateProgress(Math.round((processed / contacts.length) * 100));
      
      // Rate limiting interno (evitar spam)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failed++;
      logger.warn('Failed to send message', { contact, error: error.message });
    }
  }
  
  return { processed, failed, total: contacts.length };
}, {
  connection,
  concurrency: 5, // 5 jobs simultâneos
  limiter: {
    max: 100,
    duration: 60000, // 100 mensagens por minuto
  },
});

campaignWorker.on('completed', (job, result) => {
  logger.info('Campaign completed', { jobId: job.id, result });
});

campaignWorker.on('failed', (job, error) => {
  logger.error('Campaign failed', { jobId: job.id, error: error.message });
});

module.exports = campaignWorker;
```

### Uso nas Rotas

```javascript
// routes/bulkCampaignRoutes.js
const { campaignQueue } = require('../queues');

router.post('/send', requireAuth, async (req, res) => {
  try {
    const { contacts, message, scheduledAt } = req.body;
    const tenantId = req.context?.tenantId;
    
    // Criar job na fila
    const job = await campaignQueue.add('send-campaign', {
      campaignId: generateId(),
      tenantId,
      contacts,
      message,
    }, {
      delay: scheduledAt ? new Date(scheduledAt) - Date.now() : 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    
    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        contactCount: contacts.length,
      },
    });
  } catch (error) {
    logger.error('Failed to queue campaign', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  const job = await campaignQueue.getJob(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const state = await job.getState();
  const progress = job.progress;
  
  res.json({
    success: true,
    data: {
      jobId: job.id,
      state,
      progress,
      result: job.returnvalue,
    },
  });
});
```

## 6. Docker Compose Atualizado

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - wuzapi-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wuzapi-network

  # Observabilidade (opcional)
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - wuzapi-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - wuzapi-network

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP
    networks:
      - wuzapi-network

volumes:
  redis_data:
  grafana_data:

networks:
  wuzapi-network:
    driver: bridge
```

## Diagrama de Fluxo - Queue

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Backend │────▶│  BullMQ  │────▶│  Worker  │
└──────────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
                      │                │                │
                      │  1. POST       │                │
                      │  /campaigns    │                │
                      │                │                │
                      │  2. Add Job    │                │
                      │───────────────▶│                │
                      │                │                │
                      │  3. Return     │                │
                      │  jobId         │                │
                      │◀───────────────│                │
                      │                │                │
                      │                │  4. Process    │
                      │                │───────────────▶│
                      │                │                │
                      │                │  5. Update     │
                      │                │  Progress      │
                      │                │◀───────────────│
                      │                │                │
                      │  6. GET        │                │
                      │  /status/:id   │                │
                      │───────────────▶│                │
                      │                │                │
```
