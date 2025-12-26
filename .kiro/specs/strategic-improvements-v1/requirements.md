# Requirements: Melhorias Estratégicas - Performance, Observabilidade e Escala

## Contexto

Auditoria técnica realizada em 25/12/2025 na página `/admin/stripe` identificou oportunidades de melhorias estratégicas para preparar a aplicação para escala e produção. Este spec cobre as melhorias de médio/longo prazo identificadas na seção "4. Melhorias Estratégicas" do relatório.

## Requisitos Funcionais

### 4.1 Performance

#### REQ-1: Implementar Redis Cache para Queries Frequentes
- **Descrição:** Expandir uso do Redis para cachear queries frequentes além dos endpoints já implementados
- **Endpoints adicionais a cachear:**
  - `/api/admin/stripe/settings` (TTL: 5 minutos)
  - `/api/admin/stripe/analytics` (TTL: 2 minutos)
  - `/api/user/subscription` (TTL: 5 minutos)
  - `/api/session/agents` (TTL: 5 minutos)
  - `/api/session/teams` (TTL: 5 minutos)
  - `/api/session/roles` (TTL: 10 minutos)
- **Critério de aceite:** Cache hit rate > 70% para endpoints configurados

#### REQ-2: Bundle Splitting por Rota Admin/User
- **Descrição:** Separar bundles JavaScript por área da aplicação
- **Bundles a criar:**
  - `admin.bundle.js` - Componentes exclusivos de admin
  - `user.bundle.js` - Componentes exclusivos de usuário
  - `shared.bundle.js` - Componentes compartilhados
  - `vendor.bundle.js` - Dependências externas
- **Critério de aceite:** Redução de 40% no tamanho do bundle inicial

#### REQ-3: Service Worker para Cache de Assets Estáticos
- **Descrição:** Implementar Service Worker para cache offline de assets
- **Assets a cachear:**
  - Arquivos CSS
  - Arquivos JavaScript (bundles)
  - Imagens e ícones
  - Fontes
- **Estratégia:** Cache-first para assets versionados, Network-first para API
- **Critério de aceite:** Assets servidos do cache em < 50ms

#### REQ-4: Compressão Brotli além de Gzip
- **Descrição:** Adicionar suporte a compressão Brotli no servidor
- **Configuração:**
  - Brotli para browsers modernos (Accept-Encoding: br)
  - Gzip como fallback
  - Compressão nível 4 (balanceado)
- **Critério de aceite:** Redução adicional de 15-20% no tamanho de transferência

### 4.2 Observabilidade

#### REQ-5: Adicionar Tracing com OpenTelemetry
- **Descrição:** Implementar distributed tracing para rastrear requisições
- **Componentes:**
  - Instrumentação automática de Express
  - Spans customizados para operações críticas
  - Propagação de contexto entre serviços
  - Exportação para Jaeger/Zipkin (configurável)
- **Critério de aceite:** Traces disponíveis para 100% das requisições HTTP

#### REQ-6: Dashboard de Métricas com Prometheus/Grafana
- **Descrição:** Expor métricas no formato Prometheus e criar dashboards
- **Métricas a expor:**
  - `http_requests_total` - Total de requisições por rota/método/status
  - `http_request_duration_seconds` - Latência de requisições
  - `redis_cache_hits_total` - Cache hits
  - `redis_cache_misses_total` - Cache misses
  - `supabase_query_duration_seconds` - Latência de queries
  - `active_sessions_total` - Sessões ativas
  - `websocket_connections_total` - Conexões WebSocket
- **Critério de aceite:** Endpoint `/metrics` retornando métricas Prometheus

#### REQ-7: Sistema de Alertas para Erros 5xx e Latência Alta
- **Descrição:** Configurar alertas automáticos para problemas críticos
- **Alertas a configurar:**
  - Taxa de erros 5xx > 1% em 5 minutos
  - Latência P95 > 2 segundos
  - Redis indisponível por > 30 segundos
  - Supabase indisponível por > 30 segundos
  - Uso de memória > 80%
- **Canais de notificação:** Webhook (Discord/Slack), Email
- **Critério de aceite:** Alertas disparados em < 1 minuto após condição

### 4.3 Preparação para Escala

#### REQ-8: Rate Limiting por Tenant
- **Descrição:** Implementar rate limiting isolado por tenant
- **Configuração:**
  - Limites configuráveis por plano de assinatura
  - Contadores isolados por tenant_id
  - Headers de rate limit na resposta (X-RateLimit-*)
  - Fallback graceful quando limite atingido
- **Limites padrão:**
  - Free: 100 req/min
  - Pro: 500 req/min
  - Enterprise: 2000 req/min
- **Critério de aceite:** Tenants isolados não afetam uns aos outros

#### REQ-9: Queue para Operações Pesadas (Bulk Campaigns)
- **Descrição:** Implementar sistema de filas para operações assíncronas
- **Operações a enfileirar:**
  - Envio de campanhas em massa
  - Importação de contatos
  - Geração de relatórios
  - Sincronização de webhooks
- **Tecnologia:** Bull/BullMQ com Redis
- **Critério de aceite:** Operações pesadas não bloqueiam API

#### REQ-10: CDN para Assets (Cloudflare)
- **Descrição:** Configurar CDN para servir assets estáticos
- **Configuração:**
  - Cache de assets estáticos (JS, CSS, imagens)
  - Headers de cache otimizados
  - Compressão automática
  - Proteção DDoS
- **Critério de aceite:** Assets servidos via CDN com latência < 100ms global

## Requisitos Não-Funcionais

### RNF-1: Performance
- LCP < 500ms (já atingido, manter)
- TTFB < 200ms
- Bundle inicial < 200KB gzipped
- Cache hit rate > 70%

### RNF-2: Observabilidade
- 100% das requisições com trace
- Métricas com granularidade de 15 segundos
- Alertas em < 1 minuto
- Retenção de logs: 30 dias

### RNF-3: Escala
- Suportar 1000 req/s por tenant
- Queue com capacidade de 10.000 jobs
- Zero downtime em deploys
- Graceful degradation quando serviços indisponíveis

### RNF-4: Segurança
- Métricas não expõem dados sensíveis
- Traces sanitizados (sem PII)
- CDN com HTTPS obrigatório
- Rate limiting não bypassável

## Dependências

### Novas Dependências (Backend)
- `@opentelemetry/api` - API de tracing
- `@opentelemetry/sdk-node` - SDK Node.js
- `@opentelemetry/auto-instrumentations-node` - Instrumentação automática
- `prom-client` - Cliente Prometheus
- `bullmq` - Sistema de filas
- `shrink-ray-current` - Compressão Brotli

### Novas Dependências (Frontend)
- `workbox-webpack-plugin` - Service Worker
- `vite-plugin-pwa` - PWA para Vite

### Infraestrutura
- Grafana (opcional, para dashboards)
- Jaeger/Zipkin (opcional, para traces)
- Cloudflare (CDN)

## Fora de Escopo

- Migração para Kubernetes
- Multi-region deployment
- Database sharding
- Real-time analytics (fase futura)

## Priorização

| Requisito | Prioridade | Esforço | Impacto |
|-----------|------------|---------|---------|
| REQ-1 Redis Cache | Alta | Baixo | Alto |
| REQ-2 Bundle Splitting | Alta | Médio | Alto |
| REQ-6 Métricas Prometheus | Alta | Médio | Alto |
| REQ-8 Rate Limit Tenant | Alta | Médio | Alto |
| REQ-9 Queue BullMQ | Alta | Alto | Alto |
| REQ-4 Brotli | Média | Baixo | Médio |
| REQ-5 OpenTelemetry | Média | Alto | Médio |
| REQ-7 Alertas | Média | Médio | Alto |
| REQ-3 Service Worker | Baixa | Médio | Médio |
| REQ-10 CDN | Baixa | Baixo | Médio |
