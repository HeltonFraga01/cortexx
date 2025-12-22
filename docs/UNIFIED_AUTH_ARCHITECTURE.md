# Arquitetura de Autenticação Unificada

## Visão Geral

Este documento descreve a arquitetura de autenticação do WUZAPI Manager após a migração para Supabase Auth, incluindo a hierarquia multi-tenant e os fluxos de autenticação.

## Hierarquia Multi-Tenant

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
└─────────────────────────────────────────────────────────────────────────────┘
```

## Métodos de Autenticação

### 1. SuperAdmin (Nível Plataforma)

```
Rota: /api/superadmin/login
Middleware: requireSuperadmin (superadminAuth.js)
Tabela: superadmins
```

**Fluxo:**
1. SuperAdmin envia email/password
2. Valida contra tabela `superadmins`
3. Cria sessão com role='superadmin'
4. Acesso a todas as rotas `/api/superadmin/*`

### 2. Tenant Admin (Nível Tenant)

```
Rota: /api/auth/login
Middleware: requireAdmin (auth.js)
Tabela: accounts (via session)
```

**Fluxo:**
1. Admin envia WUZAPI token ou JWT
2. Valida token com WUZAPI ou Supabase
3. Cria sessão com role='admin', tenantId
4. Acesso a rotas `/api/admin/*` do tenant

### 3. User (Nível Account)

```
Rota: /api/auth/login
Middleware: requireUser (auth.js)
Tabela: accounts (via session)
```

**Fluxo:**
1. User envia WUZAPI token ou JWT
2. Valida token com WUZAPI ou Supabase
3. Cria sessão com role='user', tenantId
4. Acesso a rotas `/api/user/*`

### 4. Agent (Nível Account)

```
Rota: /api/agent/login
Middleware: requireAgentAuth (agentAuth.js)
Tabela: agents, agent_sessions
```

**Fluxo:**
1. Agent envia email/password
2. Valida contra tabela `agents`
3. Cria sessão em `agent_sessions`
4. Acesso baseado em role (owner/admin/agent/viewer)

### 5. Usuário Independente (Nível Tenant)

```
Rota: /api/auth/user-login
Middleware: requireUserAuth (userAuth.js)
Tabela: users, user_sessions
```

**Fluxo:**
1. User envia email/password
2. Valida contra tabela `users`
3. Cria sessão em `user_sessions`
4. Acesso a inboxes via `user_inboxes`

## Middlewares de Autenticação

| Middleware | Arquivo | Uso |
|------------|---------|-----|
| `requireAuth` | auth.js | Autenticação básica (admin ou user) |
| `requireAdmin` | auth.js | Apenas admins de tenant |
| `requireUser` | auth.js | Apenas users de tenant |
| `requireSuperadmin` | superadminAuth.js | Apenas superadmins |
| `requireTenantAdmin` | tenantAuth.js | Admin com contexto de tenant |
| `requireTenantUser` | tenantAuth.js | User com contexto de tenant |
| `requireAgentAuth` | agentAuth.js | Agents de account |
| `requireUserAuth` | userAuth.js | Usuários independentes |
| `validateSupabaseToken` | supabaseAuth.js | Validação de JWT Supabase |

## Isolamento Multi-Tenant

### Row Level Security (RLS)

Tabelas com RLS habilitado:
- `users` - Isolamento por `tenant_id`
- `user_sessions` - Isolamento por `user_id` → `tenant_id`
- `user_inboxes` - Isolamento por `user_id` → `tenant_id`
- `tenant_settings` - Isolamento por `tenant_id`
- `tenant_plans` - Isolamento por `tenant_id`
- `accounts` - Isolamento por `tenant_id`

### Policies de Isolamento

```sql
-- Exemplo: Policy para accounts
CREATE POLICY "accounts_tenant_isolation" ON accounts
FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Service role tem acesso total
CREATE POLICY "accounts_service_role_access" ON accounts
FOR ALL TO service_role USING (true);
```

## Identificadores de Usuário

### Formatos

| Formato | Exemplo | Uso |
|---------|---------|-----|
| UUID | `12345678-1234-1234-1234-123456789012` | Supabase Auth, accounts.owner_user_id |
| Hash 32-char | `12345678123412341234123456789012` | WUZAPI token, sessão legada |

### Helper de Conversão

```javascript
const { normalizeToUUID, normalizeToHash, areEqual } = require('./utils/userIdHelper');

// Converter hash para UUID
const uuid = normalizeToUUID('12345678123412341234123456789012');
// → '12345678-1234-1234-1234-123456789012'

// Comparar IDs em formatos diferentes
areEqual(uuid, hash); // → true
```

## Sistema de Quotas

### Fluxo de Verificação

```
Request → quotaMiddleware → QuotaService.checkQuota()
                                    │
                                    ▼
                          tenant_plans.quotas
                                    │
                                    ▼
                          user_quota_usage
                                    │
                                    ▼
                          Permitir/Bloquear
```

### Tipos de Quota

- `max_agents` - Máximo de agents por account
- `max_inboxes` - Máximo de inboxes por account
- `max_messages_per_day` - Mensagens diárias
- `max_messages_per_month` - Mensagens mensais
- `max_bots` - Máximo de bots
- `max_campaigns` - Máximo de campanhas

## Integração Stripe

### Modelo de Pagamentos

```
Plataforma (Stripe Principal)
    │
    └── Tenants (Stripe Connect)
            │
            └── Accounts (Customers)
                    │
                    └── Subscriptions (tenant_plans)
```

### Webhooks

| Evento | Handler |
|--------|---------|
| `checkout.session.completed` | Ativa subscription |
| `customer.subscription.updated` | Sincroniza status |
| `customer.subscription.deleted` | Cancela subscription |
| `invoice.payment_failed` | Marca como past_due |

## Troubleshooting

### Problema: Usuário não consegue fazer login

1. Verificar se token WUZAPI é válido
2. Verificar se account existe e tem tenant_id
3. Verificar se subscription está ativa
4. Verificar logs em `server/logs/`

### Problema: Acesso negado a recurso

1. Verificar role do usuário (admin/user)
2. Verificar tenant_id do recurso
3. Verificar se RLS está habilitado
4. Verificar policies de isolamento

### Problema: Quota excedida

1. Verificar `user_quota_usage` para account
2. Verificar `tenant_plans.quotas` para limites
3. Verificar se `user_quota_overrides` existe
4. Considerar upgrade de plano

## Status de Produção

### Correções Aplicadas (Fase 2)

| Problema | Severidade | Status | Data |
|----------|------------|--------|------|
| 8 accounts sem tenant_id | Crítico | ✅ Corrigido | 2025-12-22 |
| 11 accounts sem subscription | Crítico | ✅ Corrigido | 2025-12-22 |
| SubscriptionEnsurer usa `plans` global | Alto | ✅ Corrigido | 2025-12-22 |
| Quotas não incrementadas (0 registros) | Alto | ✅ Corrigido | 2025-12-22 |
| Stripe não utilizado ativamente | Médio | ⏳ Pendente | - |
| user_inboxes não utilizado | Baixo | ⏳ Pendente | - |
| Middlewares duplicados | Baixo | ⏳ Pendente | - |
| Testes de integração falhando | Médio | ⏳ Em progresso | - |

### Detalhes das Correções

**Task 13 - Accounts Órfãs:**
- Migration `fix_orphan_accounts_tenant_id` aplicada
- 8 accounts atualizadas com tenant_id = Default Tenant

**Task 14 - Subscriptions Faltantes:**
- Migration `create_missing_subscriptions` aplicada
- 11 subscriptions criadas usando tenant_plans

**Task 15 - SubscriptionEnsurer:**
- Refatorado para usar `tenant_plans` ao invés de `plans` global
- Adicionados métodos `getDefaultPlanForTenant()` e `getAccountByUserId()`

**Task 16 - Incremento de Quotas:**
- Corrigido `chatRoutes.js` - 2 endpoints (text, image)
- Corrigido `botProxyRoutes.js` - 6 endpoints (text, image, audio, document, video, sticker)
- Criadas funções helper `incrementMessageQuota()` e `incrementBotMessageQuota()`

### Métricas do Sistema (Atualizado)

| Entidade | Quantidade | Status |
|----------|------------|--------|
| SuperAdmins | 6 | ✅ OK |
| Tenants | 5 | ✅ OK |
| Accounts | 20 | ✅ Todos com tenant_id |
| Agents | 13 | ✅ OK |
| Users | 0 | ⚠️ Não utilizado |
| Subscriptions | 20 | ✅ Todos com subscription |
| Inboxes | 3 | ✅ OK |
| Conversations | 1924 | ✅ OK |
| user_quota_usage | 0 | ⏳ Será populado ao enviar mensagens |

### Tenants Configurados

| Tenant | Subdomain | Stripe Connect | Plano Default |
|--------|-----------|----------------|---------------|
| Default Tenant | default | ❌ | free |
| Acme Corp | acmecorp | ❌ | free |
| Cortexx | cortexx | ❌ | free |

## Documentos Relacionados

- [Auditoria SuperAdmin](audit/01-superadmin-auth-audit.md)
- [Auditoria de Endpoints](audit/02-endpoint-auth-audit.md)
- [Auditoria Plans vs Tenant Plans](audit/03-plans-vs-tenant-plans-audit.md)
- [Auditoria User-Account](audit/04-user-account-audit.md)
- [Auditoria Stripe](audit/05-stripe-integration-audit.md)
- [Auditoria Inboxes](audit/06-inboxes-messages-audit.md)
- [Auditoria Código Legado](audit/07-legacy-code-audit.md)
- [Resumo da Auditoria](audit/AUDIT_SUMMARY.md)
