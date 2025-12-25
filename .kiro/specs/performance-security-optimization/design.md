# Design Document

## Introduction

Este documento descreve a arquitetura e design técnico para implementar as otimizações de performance e segurança definidas nos requisitos. O design prioriza mudanças incrementais e retrocompatíveis, permitindo rollback seguro.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CORTEXX PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (Vite + React)                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ Lazy Routes │  │ Query Cache │  │ Performance Observer    │  │   │
│  │  │ (Suspense)  │  │ (TanStack)  │  │ (Core Web Vitals)       │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Vite Build Pipeline                       ││   │
│  │  │  • Code Splitting (manualChunks)                            ││   │
│  │  │  • Tree Shaking (sideEffects: false)                        ││   │
│  │  │  • Bundle Analyzer (rollup-plugin-visualizer)               ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    BACKEND (Express + Node.js)                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ Security    │  │ Rate        │  │ Health Check            │  │   │
│  │  │ Middleware  │  │ Limiter     │  │ (Enhanced)              │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Observability Layer                       ││   │
│  │  │  • Prometheus Metrics (/metrics)                            ││   │
│  │  │  • Structured Logging (pino)                                ││   │
│  │  │  • CSP Violation Reports                                    ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Design Details

### Component 1: Lazy Route System

**Requirement Coverage:** REQ-1 (Code Splitting), REQ-7 (Bundle Size)

**Design:**

```typescript
// src/routes/LazyRoutes.tsx
import { lazy, Suspense } from 'react'
import { RouteLoadingSkeleton } from '@/components/shared/RouteLoadingSkeleton'

// Lazy load all route components
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const SuperAdminDashboard = lazy(() => import('@/pages/superadmin/Dashboard'))
const UserManagement = lazy(() => import('@/pages/superadmin/UserManagement'))
const TenantManagement = lazy(() => import('@/pages/superadmin/TenantManagement'))
const Settings = lazy(() => import('@/pages/Settings'))

// Route wrapper with Suspense
export function LazyRoute({ component: Component }: { component: React.LazyExoticComponent<any> }) {
  return (
    <Suspense fallback={<RouteLoadingSkeleton />}>
      <Component />
    </Suspense>
  )
}
```

**Vite Configuration:**

```typescript
// vite.config.ts - manualChunks configuration
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        'vendor-utils': ['date-fns', 'zod', 'axios']
      }
    }
  }
}
```

**Correctness Properties:**
- P1: Cada chunk deve ser carregado no máximo uma vez por sessão
- P2: Fallback deve ser exibido em menos de 100ms após navegação
- P3: Erro de carregamento deve exibir ErrorBoundary, não tela branca

---

### Component 2: TanStack Query Configuration

**Requirement Coverage:** REQ-3 (API Deduplication)

**Design:**

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status
          if (status >= 400 && status < 500) return false
        }
        return failureCount < 3
      }
    }
  }
})

// Development mode: log duplicate calls
if (import.meta.env.DEV) {
  const originalFetch = window.fetch
  const pendingRequests = new Map<string, number>()
  
  window.fetch = async (input, init) => {
    const key = typeof input === 'string' ? input : input.url
    const count = pendingRequests.get(key) || 0
    
    if (count > 0) {
      console.warn(`[Query] Duplicate request detected: ${key}`)
    }
    
    pendingRequests.set(key, count + 1)
    try {
      return await originalFetch(input, init)
    } finally {
      pendingRequests.set(key, (pendingRequests.get(key) || 1) - 1)
    }
  }
}
```

**Correctness Properties:**
- P1: Requisições idênticas dentro de staleTime devem retornar cache
- P2: Erro de rede deve disparar retry com backoff exponencial
- P3: Dados stale devem ser exibidos enquanto refetch ocorre

---

### Component 3: Security Middleware Enhancement

**Requirement Coverage:** REQ-4 (Session Security), REQ-5 (CSP)

**Design:**

```javascript
// server/middleware/securityConfig.js
const crypto = require('crypto')
const logger = require('../utils/logger')

/**
 * Validates and returns session configuration
 * @throws {Error} If SESSION_SECRET is invalid in production
 */
function getSessionConfig() {
  const secret = process.env.SESSION_SECRET
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Validation
  if (!secret) {
    if (isProduction) {
      logger.error('FATAL: SESSION_SECRET is required in production')
      process.exit(1)
    }
    logger.warn('SESSION_SECRET not set - using insecure default for development')
    return { secret: crypto.randomBytes(32).toString('hex'), isSecure: false }
  }
  
  if (secret.length < 32) {
    logger.error('SESSION_SECRET must be at least 32 characters', { length: secret.length })
    if (isProduction) process.exit(1)
  }
  
  return {
    secret,
    isSecure: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }
}

/**
 * Generates CSP header with nonce support
 */
function generateCSP(nonce) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const directives = {
    'default-src': ["'self'"],
    'script-src': isProduction 
      ? ["'self'", `'nonce-${nonce}'`]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Dev needs HMR
    'style-src': ["'self'", "'unsafe-inline'"], // Required for UI libraries
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", process.env.SUPABASE_URL, process.env.WUZAPI_BASE_URL].filter(Boolean),
    'font-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'report-uri': ['/api/csp-report']
  }
  
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

module.exports = { getSessionConfig, generateCSP }
```

**CSP Report Endpoint:**

```javascript
// server/routes/securityRoutes.js
router.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report']
  logger.warn('CSP Violation', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    documentUri: report['document-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number']
  })
  res.status(204).end()
})
```

**Correctness Properties:**
- P1: Produção NUNCA deve iniciar sem SESSION_SECRET válido
- P2: CSP violations devem ser logadas com contexto completo
- P3: Cookies de sessão devem ter flags httpOnly e secure em produção

---

### Component 4: React Router v7 Migration

**Requirement Coverage:** REQ-6 (Router Compatibility)

**Design:**

```typescript
// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
})

export function App() {
  return <RouterProvider router={router} />
}
```

**Correctness Properties:**
- P1: Console não deve exibir warnings de deprecação do React Router
- P2: Navegação deve usar startTransition para evitar blocking

---

### Component 5: Performance Monitoring

**Requirement Coverage:** REQ-8 (Observability), REQ-9 (Reflow Prevention)

**Design:**

```typescript
// src/lib/performance.ts
import { onLCP, onFID, onCLS, onTTFB, onINP } from 'web-vitals'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 }
}

function reportMetric(metric: PerformanceMetric) {
  // Log warning for poor metrics
  if (metric.rating === 'poor') {
    console.warn(`[Performance] ${metric.name} is poor: ${metric.value}`)
  }
  
  // Send to backend in production
  if (import.meta.env.PROD) {
    navigator.sendBeacon('/api/metrics', JSON.stringify({
      type: 'web-vital',
      ...metric,
      timestamp: Date.now(),
      url: window.location.pathname
    }))
  }
}

export function initPerformanceMonitoring() {
  onLCP((metric) => reportMetric({ 
    name: 'LCP', 
    value: metric.value,
    rating: metric.rating 
  }))
  onFID((metric) => reportMetric({ 
    name: 'FID', 
    value: metric.value,
    rating: metric.rating 
  }))
  onCLS((metric) => reportMetric({ 
    name: 'CLS', 
    value: metric.value,
    rating: metric.rating 
  }))
  onINP((metric) => reportMetric({ 
    name: 'INP', 
    value: metric.value,
    rating: metric.rating 
  }))
}
```

**Prometheus Metrics Endpoint:**

```javascript
// server/routes/metricsRoutes.js
const promClient = require('prom-client')

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5]
})

const webVitals = new promClient.Gauge({
  name: 'web_vitals',
  help: 'Core Web Vitals metrics',
  labelNames: ['metric', 'rating']
})

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType)
  res.end(await promClient.register.metrics())
})

router.post('/api/metrics', express.json(), (req, res) => {
  const { type, name, value, rating } = req.body
  if (type === 'web-vital') {
    webVitals.labels(name, rating).set(value)
  }
  res.status(204).end()
})
```

**Correctness Properties:**
- P1: Métricas devem ser coletadas sem impactar performance (< 1ms overhead)
- P2: sendBeacon deve ser usado para não bloquear unload
- P3: Endpoint /metrics deve responder em < 100ms

---

### Component 6: Enhanced Health Check

**Requirement Coverage:** REQ-10 (Production Readiness)

**Design:**

```javascript
// server/routes/healthRoutes.js
const SupabaseService = require('../services/SupabaseService')
const logger = require('../utils/logger')

const HEALTH_TIMEOUT = 5000 // 5 seconds

async function checkDatabase() {
  const start = Date.now()
  try {
    await Promise.race([
      SupabaseService.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), HEALTH_TIMEOUT)
      )
    ])
    return { status: 'healthy', latency: Date.now() - start }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}

async function checkMemory() {
  const used = process.memoryUsage()
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024)
  const percentage = Math.round((used.heapUsed / used.heapTotal) * 100)
  
  return {
    status: percentage > 90 ? 'warning' : 'healthy',
    heapUsedMB,
    heapTotalMB,
    percentage
  }
}

async function checkExternalAPIs() {
  const checks = []
  
  if (process.env.WUZAPI_BASE_URL) {
    const start = Date.now()
    try {
      const response = await fetch(`${process.env.WUZAPI_BASE_URL}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT)
      })
      checks.push({
        name: 'wuzapi',
        status: response.ok ? 'healthy' : 'unhealthy',
        latency: Date.now() - start
      })
    } catch (error) {
      checks.push({ name: 'wuzapi', status: 'unhealthy', error: error.message })
    }
  }
  
  return checks
}

router.get('/health', async (req, res) => {
  const [database, memory, externalAPIs] = await Promise.all([
    checkDatabase(),
    checkMemory(),
    checkExternalAPIs()
  ])
  
  const isHealthy = database.status === 'healthy' && 
                    memory.status !== 'unhealthy' &&
                    externalAPIs.every(api => api.status !== 'unhealthy')
  
  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: { database, memory, externalAPIs }
  }
  
  res.status(isHealthy ? 200 : 503).json(response)
})
```

**Graceful Shutdown:**

```javascript
// server/index.js - graceful shutdown
const SHUTDOWN_TIMEOUT = 30000 // 30 seconds

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`)
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed')
  })
  
  // Wait for existing requests to complete
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)
  
  // Close database connections
  try {
    await SupabaseService.close()
    logger.info('Database connections closed')
  } catch (error) {
    logger.error('Error closing database', { error: error.message })
  }
  
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
```

**Correctness Properties:**
- P1: Health check deve completar em < 10 segundos
- P2: Shutdown deve aguardar requests em andamento
- P3: Variáveis obrigatórias ausentes devem causar falha imediata

---

### Component 7: Network Optimization (index.html)

**Requirement Coverage:** REQ-2 (Network Optimization)

**Design:**

```html
<!-- index.html - resource hints -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Preconnect to external origins -->
  <link rel="preconnect" href="https://your-project.supabase.co" crossorigin />
  <link rel="dns-prefetch" href="https://your-project.supabase.co" />
  
  <!-- Preload critical resources -->
  <link rel="preload" href="/src/main.tsx" as="script" type="module" />
  
  <title>Cortexx</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Vite Plugin for Dynamic Preconnect:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'inject-preconnect',
      transformIndexHtml(html) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL
        if (supabaseUrl) {
          const origin = new URL(supabaseUrl).origin
          return html.replace(
            '</head>',
            `<link rel="preconnect" href="${origin}" crossorigin />\n</head>`
          )
        }
        return html
      }
    }
  ]
})
```

---

## Data Models

### Performance Metrics Schema

```typescript
interface WebVitalMetric {
  id: string
  metric: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url: string
  userAgent: string
  timestamp: Date
}

interface APIMetric {
  id: string
  method: string
  route: string
  statusCode: number
  duration: number
  timestamp: Date
}
```

### CSP Report Schema

```typescript
interface CSPReport {
  id: string
  blockedUri: string
  violatedDirective: string
  documentUri: string
  sourceFile?: string
  lineNumber?: number
  timestamp: Date
}
```

---

## Error Handling

| Error Type | Handling Strategy | User Feedback |
|------------|-------------------|---------------|
| Chunk load failure | Retry 3x with exponential backoff, then show ErrorBoundary | "Erro ao carregar página. Tente novamente." |
| API timeout | Cancel request after 30s, show toast | "Servidor demorou para responder." |
| Session expired | Redirect to login, clear local state | "Sessão expirada. Faça login novamente." |
| CSP violation | Log to backend, no user feedback | None (silent logging) |
| Health check failure | Return 503, trigger alerts | None (infrastructure level) |

---

## Testing Strategy

### Unit Tests

| Component | Test Focus | Tool |
|-----------|------------|------|
| queryClient config | staleTime, retry logic | Vitest |
| securityConfig | validation, CSP generation | Vitest |
| performance.ts | metric collection | Vitest |

### Integration Tests

| Flow | Test Focus | Tool |
|------|------------|------|
| Lazy loading | Chunk loading, Suspense | Cypress |
| Health check | All checks pass/fail | Supertest |
| CSP | Violations reported | Cypress |

### Performance Tests

| Metric | Target | Tool |
|--------|--------|------|
| LCP | < 500ms | Lighthouse CI |
| Bundle size | < 500KB gzip | rollup-plugin-visualizer |
| API deduplication | 0 duplicates | Custom logging |

---

## Migration Plan

### Phase 1: Low-Risk Changes (Week 1)
1. Add preconnect hints to index.html
2. Configure TanStack Query defaults
3. Enable React Router v7 future flags

### Phase 2: Code Splitting (Week 2)
1. Implement lazy routes
2. Add loading skeletons
3. Configure Vite manualChunks

### Phase 3: Security Hardening (Week 3)
1. Implement session validation
2. Add CSP with report-only mode
3. Test CSP in staging

### Phase 4: Observability (Week 4)
1. Add web-vitals collection
2. Implement /metrics endpoint
3. Enhance health check

### Phase 5: Production Rollout
1. Enable CSP enforcement
2. Monitor metrics
3. Iterate based on data

---

## Rollback Strategy

Each change is designed to be independently reversible:

| Change | Rollback Method |
|--------|-----------------|
| Lazy routes | Revert to static imports |
| Query config | Reset to defaults |
| CSP | Remove header or switch to report-only |
| Metrics | Disable collection endpoint |
| Health check | Revert to simple ping |

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "web-vitals": "^3.5.0"
  },
  "devDependencies": {
    "rollup-plugin-visualizer": "^5.12.0",
    "prom-client": "^15.1.0"
  }
}
```

### Compatibility Notes

- `web-vitals` requires browser support for PerformanceObserver
- `prom-client` is backend-only (Node.js)
- All changes are backward compatible with existing code
