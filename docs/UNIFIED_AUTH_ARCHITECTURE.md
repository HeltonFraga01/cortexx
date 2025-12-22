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
| `setRlsContext` | rlsContext.js | Define contexto RLS para queries |
| `setSuperadminContext` | rlsContext.js | Define contexto superadmin para RLS |
| `withRlsContext` | auth.js | Combina auth + RLS context |
| `withTenantRlsContext` | tenantAuth.js | Combina tenant auth + RLS |

## Supabase Realtime

### Configuração

Tabelas com Realtime habilitado:
- `conversations` - Atualizações de conversas em tempo real
- `chat_messages` - Novas mensagens em tempo real
- `inboxes` - Status de inboxes
- `agents` - Presença de agentes
- `bulk_campaigns` - Status de campanhas
- `webhook_events` - Eventos de webhook

### Subscriptions com RLS

```typescript
// src/lib/supabase-realtime.ts
import { subscribeToConversations, subscribeToMessages } from '@/lib/supabase-realtime';

// RLS filtra automaticamente por tenant
const unsubscribe = subscribeToConversations(accountId, {
  onInsert: (payload) => console.log('Nova conversa:', payload.new),
  onUpdate: (payload) => console.log('Conversa atualizada:', payload.new),
});

// Cleanup
unsubscribe();
```

### Broadcast Channels (Isolados por Tenant)

```typescript
// Notificações em tempo real para todo o tenant
subscribeToTenantBroadcast(tenantId, (event) => {
  console.log('Notificação:', event);
});

// Presença de usuários no tenant
subscribeToTenantPresence(tenantId, userId, userName, {
  onSync: (state) => console.log('Usuários online:', state),
  onJoin: (key, current, newPresences) => console.log('Entrou:', newPresences),
  onLeave: (key, current, leftPresences) => console.log('Saiu:', leftPresences),
});
```

## Isolamento Multi-Tenant

### Row Level Security (RLS)

O sistema utiliza Row Level Security (RLS) do PostgreSQL para garantir isolamento de dados entre tenants no nível do banco de dados.

#### Tabelas com RLS Habilitado (73 total)

**Tabelas Core (já tinham RLS):**
- `accounts` - Isolamento por `tenant_id`
- `agents` - Isolamento via `account_id` → `tenant_id`
- `inboxes` - Isolamento via `account_id` → `tenant_id`
- `conversations` - Isolamento via `account_id` → `tenant_id`
- `chat_messages` - Isolamento via `conversation_id` → `account_id` → `tenant_id`
- `bulk_campaigns` - Isolamento via `account_id` → `tenant_id`

**Tabelas Críticas (RLS habilitado na migração):**
- `superadmins` - Acesso apenas para superadmins
- `tenants` - Tenant admin vê apenas próprio tenant
- `superadmin_audit_log` - Acesso apenas para superadmins
- `tenant_branding` - Isolamento por `tenant_id`
- `tenant_credit_packages` - Isolamento por `tenant_id`
- `campaign_audit_logs` - Isolamento por `tenant_id`
- `webhook_deliveries` - Isolamento por `tenant_id`

**Tabelas com Policies Criadas:**
- `affiliate_referrals` - Isolamento por `user_id`
- `credit_transactions` - Isolamento por `user_id`
- `reseller_pricing` - Isolamento por `tenant_id`
- `stripe_webhook_events` - Acesso apenas para service_role

### Funções SQL para RLS

```sql
-- Função para extrair tenant_id do contexto
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- 1. Tentar extrair do contexto da aplicação
  BEGIN
    RETURN current_setting('app.tenant_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- 2. Fallback: buscar do usuário autenticado
  IF auth.uid() IS NOT NULL THEN
    -- Tentar tabela users
    RETURN (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Trigger para auto-inserção de tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_tenant_id();
  END IF;
  
  -- Validar que usuário não pode inserir em tenant diferente
  IF NEW.tenant_id != public.get_tenant_id() 
     AND current_setting('role', true) != 'service_role'
     AND current_setting('app.user_role', true) != 'superadmin' THEN
    RAISE EXCEPTION 'Cannot insert data for another tenant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Policies de Isolamento

```sql
-- Exemplo: Policy para accounts
CREATE POLICY "accounts_tenant_isolation" ON accounts
FOR ALL USING (tenant_id = public.get_tenant_id());

-- Service role tem acesso total
CREATE POLICY "accounts_service_role_access" ON accounts
FOR ALL TO service_role USING (true);

-- Superadmin bypass
CREATE POLICY "accounts_superadmin_bypass" ON accounts
FOR ALL USING (current_setting('app.user_role', true) = 'superadmin');
```

### Middleware RLS Context

O middleware `rlsContext.js` define variáveis de sessão PostgreSQL para RLS:

```javascript
// server/middleware/rlsContext.js
const { setRlsContext, setSuperadminContext, getClientWithRlsContext } = require('./rlsContext');

// Uso em rotas
router.get('/data', requireAuth, setRlsContext, async (req, res) => {
  // RLS filtra automaticamente por tenant
  const { data } = await SupabaseService.queryAsUser(token, 'accounts', q => q.select('*'));
});

// Ou usando helper combinado
const { withRlsContext } = require('../middleware/auth');
router.get('/data', ...withRlsContext('admin'), async (req, res) => {
  // Auth + RLS context em uma chamada
});
```

### Variáveis de Contexto RLS

| Variável | Descrição | Uso |
|----------|-----------|-----|
| `app.tenant_id` | ID do tenant atual | Filtro principal de RLS |
| `app.user_role` | Role do usuário | Bypass para superadmin |
| `app.user_id` | ID do usuário | Auditoria e logs |

### Índices Otimizados para Multi-Tenant

```sql
-- Índices compostos para queries eficientes
CREATE INDEX idx_accounts_tenant_status ON accounts(tenant_id, status);
CREATE INDEX idx_conversations_account_updated ON conversations(account_id, updated_at DESC);
CREATE INDEX idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_bulk_campaigns_account_status ON bulk_campaigns(account_id, status);
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
