# Design Document

## Introduction

Este documento descreve a arquitetura atual do sistema de autenticação após a migração para Supabase, identificando os componentes, fluxos de dados, e problemas de consistência que precisam ser corrigidos.

## Architecture Overview

### Modelo de Entidades Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HIERARQUIA MULTI-TENANT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   SUPERADMINS   │ ← Administradores da plataforma (nível mais alto)      │
│  └────────┬────────┘   Criam e gerenciam Tenants                            │
│           │                                                                 │
│           │ (1:N) owner_superadmin_id                                       │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │     TENANTS     │ ← Organizações independentes (Admins)                  │
│  │    (Admins)     │   Cada tenant = subdomain próprio + branding +         │
│  └────────┬────────┘   sistema de pagamento (Stripe Connect) independente   │
│           │                                                                 │
│           ├─────────────────────────────────────────────────────┐           │
│           │                                                     │           │
│           │ (1:N) tenant_id                                     │ (1:N)     │
│           ▼                                                     ▼           │
│  ┌─────────────────┐                                   ┌─────────────────┐  │
│  │  TENANT_PLANS   │ ← Planos específicos do tenant    │ TENANT_BRANDING │  │
│  │  (quotas/features)                                  │ (logo/cores)    │  │
│  └─────────────────┘                                   └─────────────────┘  │
│           │                                                                 │
│           │ plan_id (via user_subscriptions)                                │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │    ACCOUNTS     │ ← Contas de clientes do tenant                         │
│  │                 │   (owner_user_id, wuzapi_token, stripe_customer_id)    │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ├─────────────────────────────────────────────────────┐           │
│           │ (1:N) account_id                                    │           │
│           ▼                                                     ▼           │
│  ┌─────────────────┐                                   ┌─────────────────┐  │
│  │     AGENTS      │ ← Operadores da account           │    INBOXES      │  │
│  │ (owner/admin/   │   (roles: owner, administrator,   │ (wuzapi_token)  │  │
│  │  agent/viewer)  │    agent, viewer)                 └────────┬────────┘  │
│  └────────┬────────┘                                            │           │
│           │                                                     │           │
│           │ (1:N)                                               │ (1:N)     │
│           ▼                                                     ▼           │
│  ┌─────────────────┐                                   ┌─────────────────┐  │
│  │ AGENT_SESSIONS  │                                   │  CONVERSATIONS  │  │
│  └─────────────────┘                                   └─────────────────┘  │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  USUÁRIOS INDEPENDENTES (Fluxo Alternativo)                                 │
│  ┌─────────────────┐                                                        │
│  │      USERS      │ ← Usuários que não precisam de WUZAPI token            │
│  │  (tenant_id)    │   Acessam inboxes via user_inboxes                     │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ (1:N)                                                           │
│           ▼                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐                            │
│  │  USER_SESSIONS  │         │  USER_INBOXES   │ ← Vincula users a inboxes  │
│  └─────────────────┘         └─────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relacionamentos Chave

| Tabela Origem | FK | Tabela Destino | Descrição |
|---------------|-----|----------------|-----------|
| `tenants` | `owner_superadmin_id` | `superadmins` | SuperAdmin que criou o tenant |
| `accounts` | `tenant_id` | `tenants` | Tenant ao qual a account pertence |
| `agents` | `account_id` | `accounts` | Account à qual o agent pertence |
| `user_subscriptions` | `account_id` | `accounts` | Subscription da account |
| `user_subscriptions` | `plan_id` | `tenant_plans` | Plano do tenant |
| `tenant_plans` | `tenant_id` | `tenants` | Planos específicos do tenant |
| `inboxes` | `account_id` | `accounts` | Inbox da account |
| `users` | `tenant_id` | `tenants` | Usuário independente do tenant |
| `user_inboxes` | `user_id` | `users` | Acesso de user a inbox |

### Dados Atuais no Sistema

| Entidade | Quantidade | Observações |
|----------|------------|-------------|
| SuperAdmins | 5 | Administradores da plataforma |
| Tenants | 3 | `default`, `acmecorp`, `cortexx` |
| Accounts | 20 | Distribuídas entre os tenants |
| Agents | 13 | Operadores das accounts |
| Users | 0 | Tabela ainda não utilizada |
| Tenant Plans | 12 | 4 planos por tenant |
| User Subscriptions | 9 | Vinculam accounts a planos |


### Três Métodos de Autenticação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MÉTODOS DE AUTENTICAÇÃO                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NÍVEL SUPERADMIN                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Rota: /api/superadmin/login                                         │    │
│  │ Middleware: requireSuperadminAuth (superadminAuth.js)               │    │
│  │ Tabela: superadmins                                                 │    │
│  │ Uso: Administradores da plataforma                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  NÍVEL TENANT (3 métodos)                                                   │
│                                                                             │
│  1. SUPABASE AUTH (JWT)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Header: Authorization: Bearer <jwt_token>                           │    │
│  │ Middleware: validateSupabaseToken (supabaseAuth.js)                 │    │
│  │ Dados extraídos: user_id, role, tenant_id, user_metadata            │    │
│  │ Uso: Usuários modernos via Supabase Auth                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  2. SESSÃO TRADICIONAL (WUZAPI Token)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Cookie: connect.sid (express-session)                               │    │
│  │ Middleware: requireAuth, requireAdmin, requireUser (auth.js)        │    │
│  │ Dados na sessão: userId (hash 32-char), role, userToken             │    │
│  │ Uso: Compatibilidade com tokens WUZAPI legados                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. USUÁRIOS INDEPENDENTES (tabela users)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Header: Authorization: Bearer <session_token>                       │    │
│  │ Middleware: requireUserAuth (userAuth.js)                           │    │
│  │ Tabelas: users, user_sessions, user_inboxes                         │    │
│  │ Uso: Usuários que não precisam de WUZAPI token                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Negócio Multi-Tenant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODELO DE NEGÓCIO                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PLATAFORMA (wasendgo.com)                                                  │
│  ├── Gerenciada por SuperAdmins                                             │
│  ├── Cria e monitora Tenants                                                │
│  └── Cobra dos Tenants (B2B)                                                │
│                                                                             │
│  TENANT (ex: acmecorp.wasendgo.com)                                         │
│  ├── Operado pelo Admin do Tenant                                           │
│  ├── Subdomain próprio                                                      │
│  ├── Branding personalizado (logo, cores)                                   │
│  ├── Planos próprios (tenant_plans)                                         │
│  ├── Stripe Connect para receber pagamentos                                 │
│  ├── Clientes = Accounts                                                    │
│  └── Totalmente independente de outros Tenants                              │
│                                                                             │
│  ACCOUNT (cliente do Tenant)                                                │
│  ├── Assina um plano do Tenant                                              │
│  ├── Tem Agents (operadores)                                                │
│  ├── Tem Inboxes (conexões WhatsApp)                                        │
│  ├── Quotas baseadas no plano                                               │
│  └── Paga para o Tenant (não para a plataforma)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 0. Tabela `superadmins` (Nível Mais Alto)

```sql
superadmins
├── id: UUID (PK)
├── email: VARCHAR (UNIQUE)
├── password_hash: VARCHAR
├── name: VARCHAR
├── status: VARCHAR (active/inactive)
├── permissions: JSONB
├── last_login_at: TIMESTAMPTZ
└── created_at: TIMESTAMPTZ
```

**Responsabilidades:**
- Criar e gerenciar Tenants
- Configurar planos globais
- Monitorar toda a plataforma
- Acesso via `/superadmin/*` routes

### 0.1 Tabela `tenants` (Organizações Independentes)

```sql
tenants
├── id: UUID (PK)
├── name: VARCHAR
├── slug: VARCHAR (UNIQUE)           ← Usado para subdomain
├── owner_superadmin_id: UUID (FK)   ← SuperAdmin que criou
├── status: VARCHAR (active/inactive/suspended)
├── settings: JSONB
├── stripe_account_id: VARCHAR       ← Stripe Connect account
├── stripe_onboarding_complete: BOOLEAN
└── created_at: TIMESTAMPTZ
```

**Características:**
- Cada tenant opera como sistema independente
- Subdomain próprio (ex: `acmecorp.wasendgo.com`)
- Branding personalizado via `tenant_branding`
- Planos próprios via `tenant_plans`
- Integração Stripe Connect para pagamentos

### 1. Tabela `accounts` (Clientes do Tenant)

```sql
accounts
├── id: UUID (PK)
├── name: TEXT
├── owner_user_id: UUID (NOT NULL) ← Supabase Auth user ID
├── wuzapi_token: TEXT (UNIQUE)    ← Token WUZAPI (32-char hash)
├── tenant_id: UUID (FK → tenants) ← Isolamento multi-tenant
├── stripe_customer_id: VARCHAR    ← Customer no Stripe do tenant
├── status: TEXT (active/inactive/suspended)
└── settings: JSONB
```

**Contexto:**
- Accounts são clientes de um Tenant específico
- Cada account pode ter múltiplos Agents (operadores)
- Subscription vinculada via `user_subscriptions`
- Quotas aplicadas por account

**Problema Identificado:** `owner_user_id` é UUID, mas em muitos lugares o código usa o hash de 32 caracteres do `wuzapi_token` como `userId`. O `SubscriptionService.getAccountIdFromUserId()` converte entre os dois formatos.

### 2. Tabela `users` (Usuários Independentes)

```sql
users
├── id: UUID (PK)
├── tenant_id: UUID (FK → tenants) ← Isolamento multi-tenant
├── email: VARCHAR (UNIQUE por tenant)
├── password_hash: VARCHAR
├── name: VARCHAR
├── status: VARCHAR (active/inactive/pending)
├── permissions: JSONB
└── failed_login_attempts: INTEGER
```

**Relacionamentos:**
- `user_sessions` → Sessões de autenticação
- `user_inboxes` → Acesso a inboxes específicas

### 3. Tabela `agents` (Operadores de Account)

```sql
agents
├── id: UUID (PK)
├── account_id: UUID (FK → accounts)
├── user_id: UUID (nullable)       ← Pode vincular a Supabase Auth
├── email: TEXT
├── password_hash: TEXT
├── role: TEXT (owner/administrator/agent/viewer)
└── status: TEXT (active/inactive/pending)
```

**Relacionamentos:**
- `agent_sessions` → Sessões de autenticação
- `inbox_members` → Acesso a inboxes
- `team_members` → Participação em times


### 4. Sistema de Subscriptions

```sql
user_subscriptions
├── id: UUID (PK)
├── account_id: UUID (FK → accounts, UNIQUE) ← Uma subscription por account
├── plan_id: UUID (FK → tenant_plans)        ← Plano específico do tenant
├── status: TEXT (active/cancelled/expired/trial)
├── stripe_subscription_id: VARCHAR
├── current_period_start: TIMESTAMPTZ
├── current_period_end: TIMESTAMPTZ
└── cancel_at_period_end: BOOLEAN

tenant_plans
├── id: UUID (PK)
├── tenant_id: UUID (FK → tenants)  ← Planos são por tenant
├── name: TEXT
├── price_cents: INTEGER
├── quotas: JSONB                   ← Limites de recursos
├── features: JSONB                 ← Features habilitadas
├── stripe_product_id: TEXT
└── stripe_price_id: TEXT
```

**Fluxo de Resolução de Subscription:**
```
userId (32-char hash ou UUID)
    │
    ▼
SubscriptionService.getAccountIdFromUserId()
    │
    ├── Converte hash 32-char → UUID format
    │
    ├── Busca em accounts.owner_user_id
    │
    └── Fallback: Busca em accounts.wuzapi_token
    │
    ▼
account_id
    │
    ▼
user_subscriptions.account_id
    │
    ▼
tenant_plans (via plan_id)
```

## Data Flow Diagrams

### Fluxo 1: Login via WUZAPI Token (Sessão Tradicional)

```
┌─────────┐     POST /api/auth/login      ┌─────────────┐
│ Cliente │ ─────────────────────────────▶│ authRoutes  │
└─────────┘     { token: "abc123..." }    └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ wuzapiClient│
                                          │ .getUser()  │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │   WUZAPI    │
                                          │   Server    │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ Cria sessão │
                                          │ userId=hash │
                                          │ role='user' │
                                          │ userToken   │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ Cria/Update │
                                          │  accounts   │
                                          └─────────────┘
```

### Fluxo 2: Login via Supabase Auth (JWT)

```
┌─────────┐     POST /api/auth/supabase-login    ┌─────────────┐
│ Cliente │ ─────────────────────────────────────▶│ authRoutes  │
└─────────┘     { email, password }              └──────┬──────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │  Supabase   │
                                                 │    Auth     │
                                                 └──────┬──────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │ Retorna JWT │
                                                 │ com claims  │
                                                 └──────┬──────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │ Middleware  │
                                                 │ extrai:     │
                                                 │ - user_id   │
                                                 │ - role      │
                                                 │ - tenant_id │
                                                 └─────────────┘
```

### Fluxo 3: Login de Usuário Independente

```
┌─────────┐     POST /api/auth/user-login    ┌─────────────────┐
│ Cliente │ ─────────────────────────────────▶│ userAuthRoutes  │
└─────────┘     { email, password }          └────────┬────────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │ UserService │
                                               │ .login()    │
                                               └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │ Valida em   │
                                               │ tabela users│
                                               └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────────┐
                                               │UserSessionService│
                                               │.createSession() │
                                               └────────┬────────┘
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │ user_sessions│
                                               │ session_token│
                                               └─────────────┘
```


## Problemas Identificados

### Problema 1: Inconsistência de Identificadores de Usuário

**Situação Atual:**
- `accounts.owner_user_id` → UUID format (ex: `12345678-1234-1234-1234-123456789012`)
- `accounts.wuzapi_token` → Hash 32-char (ex: `12345678123412341234123456789012`)
- Sessão tradicional usa `userId` = hash 32-char
- JWT usa `user_id` = UUID

**Código Afetado:**
```javascript
// SubscriptionService.js - Conversão manual
async getAccountIdFromUserId(userId) {
  let uuidUserId = userId;
  if (userId && userId.length === 32 && !userId.includes('-')) {
    uuidUserId = `${userId.slice(0, 8)}-${userId.slice(8, 12)}-...`;
  }
  // Busca por owner_user_id OU wuzapi_token
}
```

**Impacto:** Código duplicado de conversão em múltiplos serviços.

### Problema 2: Tabela `plans` vs `tenant_plans`

**Situação Atual:**
- Existe tabela `plans` (global) com 4 registros
- Existe tabela `tenant_plans` (por tenant) com 12 registros
- `user_subscriptions.plan_id` referencia `tenant_plans`
- Alguns serviços podem ainda referenciar `plans`

**Verificação Necessária:**
- Identificar código que usa `plans` ao invés de `tenant_plans`
- Migrar referências para `tenant_plans`

### Problema 3: RLS Desabilitado em Tabelas Críticas

**Tabelas sem RLS:**
- `users` (RLS disabled)
- `user_sessions` (RLS disabled)
- `tenant_plans` (RLS disabled)
- `tenant_settings` (RLS disabled)
- `tenant_credit_packages` (RLS disabled)
- `user_inboxes` (RLS disabled)
- `superadmin_audit_log` (RLS disabled)
- `tenants` (RLS disabled)
- `superadmins` (RLS disabled)

**Risco:** Acesso direto via Supabase client pode vazar dados entre tenants.

### Problema 4: Múltiplas Tabelas de Sessão

**Tabelas de Sessão:**
1. `sessions` → Account sessions (account_id)
2. `agent_sessions` → Agent sessions (agent_id)
3. `user_sessions` → Independent user sessions (user_id)
4. Express session store (memória/Redis)

**Problema:** Não há unificação ou limpeza automática de sessões expiradas.

### Problema 5: Usuários Independentes sem Subscription

**Situação:**
- Tabela `users` não tem vínculo direto com `accounts`
- `user_subscriptions` vincula a `accounts`, não a `users`
- Usuários independentes acessam inboxes via `user_inboxes`

**Questão:** Como aplicar quotas para usuários independentes?

## Correctness Properties

### CP1: Consistência de Autenticação
```
PARA TODA requisição autenticada:
  SE header Authorization contém "Bearer <jwt>"
    ENTÃO validateSupabaseToken DEVE extrair user_id, role, tenant_id
  SE cookie connect.sid existe
    ENTÃO sessão DEVE conter userId, role, userToken
  SE header Authorization contém session_token de user_sessions
    ENTÃO requireUserAuth DEVE validar e extrair user_id, tenant_id
```

### CP2: Isolamento Multi-Tenant
```
PARA TODA operação de dados:
  SE usuário pertence a tenant_id = X
    ENTÃO SOMENTE dados com tenant_id = X são acessíveis
  SE RLS está habilitado na tabela
    ENTÃO policy DEVE filtrar por tenant_id
  SE RLS está desabilitado
    ENTÃO código DEVE filtrar explicitamente por tenant_id
```

### CP3: Vinculação User-Account-Subscription
```
PARA TODO usuário com subscription:
  EXISTE account A tal que:
    A.owner_user_id = user_id OU A.wuzapi_token = userId_hash
  EXISTE subscription S tal que:
    S.account_id = A.id
  EXISTE plan P tal que:
    P.id = S.plan_id E P.tenant_id = A.tenant_id
```

### CP4: Quotas por Account
```
PARA TODA verificação de quota:
  quota_limit = tenant_plans.quotas[quota_key]
  quota_used = user_quota_usage WHERE account_id = A.id
  SE quota_used >= quota_limit
    ENTÃO operação DEVE ser bloqueada
```

### CP5: Stripe Sync
```
PARA TODA subscription com stripe_subscription_id:
  status local DEVE corresponder a status no Stripe
  current_period_end DEVE corresponder ao Stripe
  cancel_at_period_end DEVE corresponder ao Stripe
```


## Proposed Solutions

### Solução 1: Normalizar Identificadores de Usuário

**Abordagem:** Criar helper centralizado para conversão de IDs.

```javascript
// server/utils/userIdHelper.js
function normalizeUserId(userId) {
  if (!userId) return null;
  // Se já é UUID, retorna como está
  if (userId.includes('-')) return userId;
  // Se é hash 32-char, converte para UUID
  if (userId.length === 32) {
    return `${userId.slice(0, 8)}-${userId.slice(8, 12)}-${userId.slice(12, 16)}-${userId.slice(16, 20)}-${userId.slice(20)}`;
  }
  return userId;
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
```

### Solução 2: Deprecar Tabela `plans` Global

**Abordagem:**
1. Verificar se `plans` ainda é usada em código
2. Migrar dados para `tenant_plans` se necessário
3. Remover referências a `plans`
4. Manter tabela para histórico ou remover

### Solução 3: Habilitar RLS em Tabelas Críticas

**Tabelas Prioritárias:**
1. `users` - Adicionar policy por `tenant_id`
2. `user_sessions` - Adicionar policy por `user_id` → `tenant_id`
3. `tenant_plans` - Adicionar policy por `tenant_id`
4. `user_inboxes` - Adicionar policy por `user_id` → `tenant_id`

**Exemplo de Policy:**
```sql
-- Para tabela users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own tenant users"
ON users FOR SELECT
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Solução 4: Unificar Gestão de Sessões

**Abordagem:**
1. Criar job de limpeza de sessões expiradas
2. Padronizar formato de sessão entre os três tipos
3. Considerar migrar para JWT stateless onde possível

### Solução 5: Quotas para Usuários Independentes

**Opções:**
1. Vincular `users` a uma `account` (via nova coluna `account_id`)
2. Criar tabela `user_quotas` separada para usuários independentes
3. Usar quotas da inbox via `user_inboxes`

## Implementation Phases

### Fase 1: Auditoria e Documentação (Semana 1)
- [ ] Mapear todos os endpoints e seus métodos de autenticação
- [ ] Identificar código que usa `plans` vs `tenant_plans`
- [ ] Documentar fluxos de autenticação atuais
- [ ] Criar testes para validar comportamento atual

### Fase 2: Normalização de IDs (Semana 2)
- [ ] Criar `userIdHelper.js`
- [ ] Refatorar `SubscriptionService` para usar helper
- [ ] Refatorar outros serviços que fazem conversão manual
- [ ] Adicionar testes unitários

### Fase 3: Correção de Planos (Semana 2-3)
- [ ] Auditar uso de `plans` vs `tenant_plans`
- [ ] Migrar código para usar apenas `tenant_plans`
- [ ] Deprecar/remover tabela `plans` se não usada

### Fase 4: RLS e Segurança (Semana 3-4)
- [ ] Habilitar RLS em tabelas críticas
- [ ] Criar policies de isolamento por tenant
- [ ] Testar isolamento multi-tenant
- [ ] Auditar endpoints para vazamento de dados

### Fase 5: Stripe Integration (Semana 4)
- [ ] Verificar sync de subscriptions
- [ ] Corrigir webhooks se necessário
- [ ] Testar fluxo completo de checkout

### Fase 6: Documentação e Testes (Semana 5)
- [ ] Documentar arquitetura final
- [ ] Criar testes de integração
- [ ] Criar testes E2E para fluxos de login
- [ ] Atualizar README e guias

## Dependencies

### Serviços Externos
- Supabase Auth (JWT validation)
- WUZAPI (token validation)
- Stripe (subscription management)

### Módulos Internos
- `server/middleware/auth.js` - Middlewares de autenticação
- `server/middleware/supabaseAuth.js` - Validação JWT
- `server/middleware/userAuth.js` - Auth de usuários independentes
- `server/services/SubscriptionService.js` - Gestão de subscriptions
- `server/services/UserService.js` - Gestão de usuários independentes
- `server/services/SupabaseService.js` - Abstração de banco de dados

## Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra de autenticação existente | Média | Alto | Testes extensivos antes de deploy |
| Vazamento de dados entre tenants | Baixa | Crítico | RLS + testes de isolamento |
| Inconsistência de subscriptions | Média | Alto | Sync com Stripe + validação |
| Downtime durante migração | Baixa | Médio | Deploy gradual + rollback plan |
