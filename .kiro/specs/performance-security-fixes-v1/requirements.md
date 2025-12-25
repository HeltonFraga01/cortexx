# Requirements: Performance & Security Fixes + Redis Cache

## Contexto

Auditoria técnica realizada em 25/12/2025 identificou problemas de performance e oportunidades de melhoria que precisam ser corrigidos antes de escalar a aplicação.

## Requisitos Funcionais

### REQ-1: Eliminação de Requisições Duplicadas
- **Descrição:** Configurar React Query para evitar requisições duplicadas detectadas na auditoria
- **Endpoints afetados:**
  - `GET:/api/admin/plans`
  - `POST:/api/admin/users/subscriptions/batch`
  - `GET:/api/session/agents`
  - `GET:/api/session/teams`
  - `GET:/api/session/roles`
  - `GET:/api/auth/csrf-token`
- **Critério de aceite:** Zero requisições duplicadas no Network tab

### REQ-2: Cache de API com Redis
- **Descrição:** Implementar cache Redis para endpoints frequentes
- **Endpoints a cachear:**
  - `/api/admin/plans` (TTL: 5 minutos)
  - `/api/public/tenant-info` (TTL: 10 minutos)
  - `/api/branding` (TTL: 5 minutos)
- **Critério de aceite:** Redução de 80% nas queries ao banco para endpoints cacheados

### REQ-3: Atualização da Stack Docker com Redis
- **Descrição:** Adicionar Redis ao docker-compose.yml
- **Requisitos:**
  - Redis 7.x Alpine (imagem leve)
  - Persistência de dados (AOF)
  - Health check configurado
  - Rede interna com backend
- **Critério de aceite:** `docker-compose up` inicia Redis junto com a aplicação

### REQ-4: Correção do Componente Badge (forwardRef)
- **Descrição:** Corrigir warning React sobre forwardRef no Badge
- **Critério de aceite:** Zero warnings de forwardRef no console

### REQ-5: Acessibilidade de Formulários
- **Descrição:** Adicionar id/name em campos de formulário sem identificadores
- **Critério de aceite:** Zero issues de acessibilidade relacionados a formulários

### REQ-6: Otimização do Critical Path
- **Descrição:** Reduzir cadeia de dependências de rede
- **Ações:**
  - Prefetch de dados críticos
  - Lazy loading de componentes não essenciais
  - Remover preconnect não utilizado
- **Critério de aceite:** Critical path < 1.500ms

### REQ-7: Limpeza de Warnings do Console
- **Descrição:** Investigar e corrigir warnings "No JWT token available"
- **Critério de aceite:** Console limpo de warnings repetitivos

## Requisitos Não-Funcionais

### RNF-1: Performance
- LCP deve permanecer < 500ms
- Requisições de API devem ter cache hit rate > 70%
- Redis deve responder em < 5ms

### RNF-2: Disponibilidade
- Redis deve ter health check funcional
- Fallback para banco quando Redis indisponível
- Zero downtime durante deploy

### RNF-3: Segurança
- Redis não exposto externamente
- Conexão Redis via rede Docker interna
- Senha Redis configurável via env var

## Dependências

- Redis 7.x
- ioredis (npm package)
- Docker Compose v2+

## Fora de Escopo

- Migração de sessões para Redis (fase futura)
- Cache distribuído multi-node
- Redis Cluster
