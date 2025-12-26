# Tasks: Melhorias Estratégicas - Performance, Observabilidade e Escala

## Fase 1: Performance (Prioridade Alta)

### Task 1: Expandir Cache Redis para Endpoints Adicionais
- [x] 1.1 Adicionar cache em `/api/admin/stripe/settings` (TTL: 5 min)
- [x] 1.2 Adicionar cache em `/api/admin/stripe/analytics` (TTL: 2 min)
- [x] 1.3 Adicionar cache em `/api/user/subscription` (TTL: 5 min)
- [x] 1.4 Adicionar cache em `/api/session/agents` (TTL: 5 min)
- [x] 1.5 Adicionar cache em `/api/session/teams` (TTL: 5 min)
- [x] 1.6 Adicionar cache em `/api/session/roles` (TTL: 10 min)
- [x] 1.7 Implementar invalidação de cache nas mutations correspondentes
- [ ] 1.8 Testar cache hit rate (meta: > 70%)

### Task 2: Bundle Splitting por Rota
- [x] 2.1 Configurar `manualChunks` no `vite.config.ts`
- [x] 2.2 Criar chunk `vendor-react` (react, react-dom, react-router-dom)
- [x] 2.3 Criar chunk `vendor-ui` (radix-ui components)
- [x] 2.4 Criar chunk `vendor-query` (@tanstack/react-query)
- [x] 2.5 Criar chunk `vendor-forms` (react-hook-form, zod)
- [x] 2.6 Criar chunk `admin` (páginas e componentes admin)
- [x] 2.7 Criar chunk `user` (páginas e componentes user)
- [x] 2.8 Analisar bundle com `vite-bundle-visualizer`
- [ ] 2.9 Verificar redução de 40% no bundle inicial

### Task 3: Service Worker para Cache de Assets
- [x] 3.1 Instalar `vite-plugin-pwa`
- [x] 3.2 Configurar PWA no `vite.config.ts`
- [x] 3.3 Criar estratégia Cache-first para assets estáticos
- [x] 3.4 Criar estratégia Network-first para API
- [x] 3.5 Criar estratégia Stale-while-revalidate para imagens
- [ ] 3.6 Testar funcionamento offline
- [ ] 3.7 Verificar tempo de resposta < 50ms para assets cacheados

### Task 4: Compressão Brotli
- [x] 4.1 Instalar `shrink-ray-current`
- [x] 4.2 Criar `server/middleware/compression.js`
- [x] 4.3 Substituir `compression()` por `shrink-ray` no `server/index.js`
- [x] 4.4 Configurar nível de compressão (Brotli: 4, Gzip: 6)
- [ ] 4.5 Testar headers Accept-Encoding: br
- [ ] 4.6 Verificar redução de 15-20% no tamanho de transferência

## Fase 2: Observabilidade (Prioridade Alta)

### Task 5: Métricas Prometheus
- [x] 5.1 Instalar `prom-client`
- [x] 5.2 Criar `server/telemetry/metrics.js`
- [x] 5.3 Implementar métrica `http_requests_total`
- [x] 5.4 Implementar métrica `http_request_duration_seconds`
- [x] 5.5 Implementar métrica `redis_cache_hits_total`
- [x] 5.6 Implementar métrica `redis_cache_misses_total`
- [x] 5.7 Implementar métrica `active_sessions_total`
- [x] 5.8 Implementar métrica `queue_jobs_total`
- [x] 5.9 Criar endpoint `/metrics` no formato Prometheus
- [x] 5.10 Criar middleware `metricsMiddleware` para coleta automática
- [ ] 5.11 Testar scraping com Prometheus

### Task 6: OpenTelemetry Tracing
- [x] 6.1 Instalar dependências OpenTelemetry
  - `@opentelemetry/api`
  - `@opentelemetry/sdk-node`
  - `@opentelemetry/auto-instrumentations-node`
  - `@opentelemetry/exporter-trace-otlp-http`
- [x] 6.2 Criar `server/telemetry/tracing.js`
- [x] 6.3 Configurar instrumentação automática de Express
- [x] 6.4 Configurar instrumentação de HTTP
- [x] 6.5 Configurar instrumentação de Redis
- [x] 6.6 Configurar exportação para Jaeger
- [x] 6.7 Inicializar tracing antes de outros imports
- [ ] 6.8 Testar traces no Jaeger UI

### Task 7: Sistema de Alertas
- [x] 7.1 Criar `server/telemetry/alerts.js`
- [x] 7.2 Implementar alerta para taxa de erros 5xx > 1%
- [x] 7.3 Implementar alerta para latência P95 > 2s
- [x] 7.4 Implementar alerta para Redis indisponível
- [x] 7.5 Implementar alerta para Supabase indisponível
- [x] 7.6 Implementar alerta para uso de memória > 80%
- [x] 7.7 Configurar envio via webhook (Discord/Slack)
- [x] 7.8 Implementar cooldown de 5 minutos entre alertas
- [ ] 7.9 Testar disparo de alertas

### Task 8: Dashboard Grafana
- [x] 8.1 Criar `monitoring/prometheus.yml` com scrape config
- [x] 8.2 Adicionar Prometheus ao `docker-compose.yml`
- [x] 8.3 Adicionar Grafana ao `docker-compose.yml`
- [x] 8.4 Criar dashboard de métricas HTTP
- [x] 8.5 Criar dashboard de métricas de cache
- [x] 8.6 Criar dashboard de métricas de queue
- [x] 8.7 Exportar dashboards como JSON

## Fase 3: Preparação para Escala (Prioridade Média)

### Task 9: Rate Limiting por Tenant
- [x] 9.1 Instalar `rate-limit-redis`
- [x] 9.2 Criar `server/middleware/tenantRateLimiter.js`
- [x] 9.3 Definir limites por plano (free: 100, pro: 500, enterprise: 2000)
- [x] 9.4 Implementar cache de plano por tenant
- [x] 9.5 Configurar Redis como store para rate limit
- [x] 9.6 Adicionar headers X-RateLimit-* nas respostas
- [x] 9.7 Aplicar middleware nas rotas de API
- [ ] 9.8 Testar isolamento entre tenants

### Task 10: Queue com BullMQ
- [x] 10.1 Instalar `bullmq`
- [x] 10.2 Criar estrutura `server/queues/`
- [x] 10.3 Criar `server/queues/index.js` com configuração central
- [x] 10.4 Criar `server/queues/campaignQueue.js`
- [x] 10.5 Criar `server/queues/importQueue.js`
- [x] 10.6 Criar `server/queues/reportQueue.js`
- [x] 10.7 Criar estrutura `server/workers/`
- [x] 10.8 Criar `server/workers/campaignWorker.js`
- [x] 10.9 Criar `server/workers/importWorker.js`
- [x] 10.10 Criar `server/workers/reportWorker.js`
- [x] 10.11 Atualizar rotas de bulk campaigns para usar queue
- [x] 10.12 Criar endpoint `/api/jobs/:id/status`
- [ ] 10.13 Testar processamento assíncrono

### Task 11: CDN Cloudflare (Opcional)
- [ ] 11.1 Configurar domínio no Cloudflare
- [ ] 11.2 Configurar regras de cache para assets
- [ ] 11.3 Configurar headers Cache-Control
- [ ] 11.4 Habilitar compressão automática
- [ ] 11.5 Configurar proteção DDoS
- [ ] 11.6 Testar latência global

## Fase 4: Documentação e Testes

### Task 12: Documentação
- [x] 12.1 Atualizar README com novas features
- [x] 12.2 Criar `docs/OBSERVABILITY.md`
- [x] 12.3 Criar `docs/SCALING.md`
- [x] 12.4 Documentar variáveis de ambiente novas
- [x] 12.5 Criar runbook de alertas

### Task 13: Testes
- [x] 13.1 Criar testes para metricsMiddleware
- [x] 13.2 Criar testes para tenantRateLimiter
- [x] 13.3 Criar testes para queue workers
- [x] 13.4 Criar testes de integração para cache
- [x] 13.5 Testar graceful shutdown

---

## Resumo de Progresso

| Fase | Task | Status | Progresso |
|------|------|--------|-----------|
| 1 | Task 1 - Cache Redis | ✅ Quase Completo | 7/8 |
| 1 | Task 2 - Bundle Splitting | ✅ Quase Completo | 8/9 |
| 1 | Task 3 - Service Worker | ✅ Quase Completo | 5/7 |
| 1 | Task 4 - Brotli | ✅ Quase Completo | 4/6 |
| 2 | Task 5 - Prometheus | ✅ Quase Completo | 10/11 |
| 2 | Task 6 - OpenTelemetry | ✅ Quase Completo | 7/8 |
| 2 | Task 7 - Alertas | ✅ Quase Completo | 8/9 |
| 2 | Task 8 - Grafana | ✅ Completo | 7/7 |
| 3 | Task 9 - Rate Limit Tenant | ✅ Quase Completo | 7/8 |
| 3 | Task 10 - BullMQ | ✅ Quase Completo | 12/13 |
| 3 | Task 11 - CDN | ⬜ Pendente (Opcional) | 0/6 |
| 4 | Task 12 - Documentação | ✅ Completo | 5/5 |
| 4 | Task 13 - Testes | ✅ Completo | 5/5 |

## Dependências entre Tasks

```
Task 1 (Cache) ──────────────────────────────────────────┐
                                                         │
Task 2 (Bundle) ─────────────────────────────────────────┤
                                                         │
Task 3 (SW) ─────────────────────────────────────────────┼──▶ Task 12 (Docs)
                                                         │
Task 4 (Brotli) ─────────────────────────────────────────┤
                                                         │
Task 5 (Prometheus) ──┬──▶ Task 8 (Grafana) ─────────────┤
                      │                                  │
Task 6 (OTEL) ────────┤                                  │
                      │                                  │
Task 7 (Alertas) ─────┘                                  │
                                                         │
Task 9 (Rate Limit) ─────────────────────────────────────┤
                                                         │
Task 10 (BullMQ) ────────────────────────────────────────┤
                                                         │
Task 11 (CDN) ───────────────────────────────────────────┘
```

## Critérios de Conclusão

### Performance
- [ ] Cache hit rate > 70% (requer teste manual)
- [ ] Bundle inicial < 200KB gzipped (requer build e verificação)
- [ ] Assets servidos em < 50ms do cache (requer teste manual)
- [x] Compressão Brotli configurada

### Observabilidade
- [x] Endpoint /metrics retornando métricas Prometheus
- [x] Tracing configurado com Jaeger
- [x] Sistema de alertas implementado
- [x] Dashboard Grafana configurado

### Escala
- [x] Rate limiting isolado por tenant
- [x] Queue processando jobs assíncronos
- [ ] Zero downtime em deploys (requer teste manual)

## Variáveis de Ambiente Novas

```env
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
OTEL_SERVICE_NAME=wuzapi-manager

# Alertas
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_EMAIL_ENABLED=false

# Grafana
GRAFANA_PASSWORD=admin

# Rate Limiting
RATE_LIMIT_FREE=100
RATE_LIMIT_PRO=500
RATE_LIMIT_ENTERPRISE=2000
```

## Arquivos a Criar

```
server/
├── telemetry/
│   ├── tracing.js
│   ├── metrics.js
│   └── alerts.js
├── middleware/
│   ├── compression.js
│   └── tenantRateLimiter.js
├── queues/
│   ├── index.js
│   ├── campaignQueue.js
│   ├── importQueue.js
│   └── reportQueue.js
└── workers/
    ├── campaignWorker.js
    ├── importWorker.js
    └── reportWorker.js

monitoring/
├── prometheus.yml
└── grafana/
    └── dashboards/
        ├── http-metrics.json
        ├── cache-metrics.json
        └── queue-metrics.json

docs/
├── OBSERVABILITY.md
└── SCALING.md
```
