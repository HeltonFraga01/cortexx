# Auditoria de Endpoints e Métodos de Autenticação

## Data: 2025-12-22

## Resumo

Este documento mapeia todos os endpoints do sistema e seus respectivos métodos de autenticação.

## Middlewares de Autenticação Disponíveis

| Middleware | Arquivo | Descrição | Suporta JWT | Suporta Sessão |
|------------|---------|-----------|-------------|----------------|
| `requireSuperadmin` | `superadminAuth.js` | SuperAdmin apenas | ✅ | ✅ (fallback) |
| `requireAdmin` | `auth.js` | Admin (tenant_admin, owner, administrator) | ✅ | ✅ |
| `requireAuth` | `auth.js` | Qualquer usuário autenticado | ✅ | ✅ |
| `requireUser` | `auth.js` | Usuário com role='user' | ✅ | ✅ |
| `requireTenantAdmin` | `tenantAuth.js` | Admin do tenant específico | ✅ | ✅ |
| `requireAgentAuth` | `agentAuth.js` | Agent autenticado | ❌ | ✅ (token próprio) |
| `requireUserAuth` | `userAuth.js` | Usuário independente | ❌ | ✅ (token próprio) |
| `verifyUserToken` | `verifyUserToken.js` | Valida WUZAPI token | ❌ | ✅ |
| `validateSupabaseToken` | `supabaseAuth.js` | Valida JWT Supabase | ✅ | ❌ |

## Mapeamento de Endpoints por Categoria

### 1. SuperAdmin Routes (`/api/superadmin/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/superadmin/login` | POST | Nenhum (público) | Login de superadmin |
| `/api/superadmin/logout` | POST | `requireSuperadmin` | Logout |
| `/api/superadmin/me` | GET | `requireSuperadmin` | Dados do superadmin |
| `/api/superadmin/tenants` | GET/POST | `requireSuperadmin` | CRUD de tenants |
| `/api/superadmin/tenants/:id` | GET/PUT/DELETE | `requireSuperadmin` | Tenant específico |
| `/api/superadmin/tenants/:id/accounts` | GET | `requireSuperadmin` | Accounts do tenant |
| `/api/superadmin/tenants/:id/agents` | GET | `requireSuperadmin` | Agents do tenant |
| `/api/superadmin/dashboard` | GET | `requireSuperadmin` | Métricas do dashboard |
| `/api/superadmin/metrics/*` | GET | `requireSuperadmin` | Métricas e analytics |
| `/api/superadmin/impersonate/*` | POST | `requireSuperadmin` | Impersonação |

**Status:** ✅ Todos os endpoints protegidos corretamente

---

### 2. Tenant Admin Routes (`/api/tenant/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/tenant/branding` | GET/PUT | `requireTenantAdmin` | Branding do tenant |
| `/api/tenant/plans` | GET/POST | `requireTenantAdmin` | Planos do tenant |
| `/api/tenant/plans/:id` | GET/PUT/DELETE | `requireTenantAdmin` | Plano específico |
| `/api/tenant/accounts` | GET | `requireTenantAdmin` | Listar accounts |
| `/api/tenant/accounts/:id` | GET/PUT | `requireTenantAdmin` | Account específica |
| `/api/tenant/accounts/:id/activate` | POST | `requireTenantAdmin` | Ativar account |
| `/api/tenant/accounts/:id/deactivate` | POST | `requireTenantAdmin` | Desativar account |
| `/api/tenant/accounts/stats` | GET | `requireTenantAdmin` | Estatísticas |

**Status:** ✅ Todos os endpoints protegidos corretamente

---

### 3. Admin Routes (`/api/admin/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/admin/users` | GET | Nenhum ⚠️ | Lista usuários WUZAPI |
| `/api/admin/users/:userId` | GET | Nenhum ⚠️ | Usuário específico |
| `/api/admin/users` | POST | Nenhum ⚠️ | Criar usuário WUZAPI |
| `/api/admin/stats` | GET | Nenhum ⚠️ | Estatísticas |
| `/api/admin/dashboard-stats` | GET | Verificação manual | Dashboard stats |
| `/api/admin/health` | GET | Nenhum (público) | Health check |
| `/api/admin/s3/status` | GET | Nenhum (público) | Status S3 |
| `/api/admin/s3/test` | POST | Nenhum ⚠️ | Teste S3 |
| `/api/admin/plans/*` | * | `requireAdmin` | Gestão de planos |
| `/api/admin/users/:userId/subscription` | GET/PUT | `requireAdmin` | Subscription |
| `/api/admin/users/:userId/quota` | GET/PUT | `requireAdmin` | Quotas |
| `/api/admin/users/:userId/features` | GET/PUT | `requireAdmin` | Features |
| `/api/admin/stripe/*` | * | `requireAuth + requireAdmin` | Config Stripe |
| `/api/admin/settings/*` | * | `requireAdmin` | Configurações |
| `/api/admin/audit/*` | * | `requireAdmin` | Logs de auditoria |
| `/api/admin/reports/*` | * | `requireAdmin` | Relatórios |

**Status:** ⚠️ Alguns endpoints em `adminRoutes.js` não têm middleware de auth

**Problema Identificado:**
- `GET /api/admin/users` - Usa validação de token WUZAPI, não middleware de auth
- `POST /api/admin/users` - Usa validação de token WUZAPI, não middleware de auth
- `GET /api/admin/stats` - Usa validação de token WUZAPI, não middleware de auth
- `POST /api/admin/s3/test` - Sem autenticação

---

### 4. User Routes (`/api/user/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/user/messages` | GET/DELETE | `verifyUserToken` | Histórico de mensagens |
| `/api/user/dashboard-stats` | GET | `verifyUserToken` | Stats do dashboard |
| `/api/user/database-connections` | GET | `verifyUserToken` | Conexões de DB |
| `/api/user/database-connections/:id/*` | * | `verifyUserToken` | Operações em conexão |
| `/api/user/scheduled-messages` | GET/DELETE | `verifyUserToken` | Mensagens agendadas |
| `/api/user/templates` | GET/POST/PUT/DELETE | `verifyUserToken` | Templates |
| `/api/user/messages/validate-variations` | POST | `verifyUserToken` | Validar variações |
| `/api/user/messages/preview-variations` | POST | `verifyUserToken` | Preview variações |
| `/api/user/campaigns/:id/variation-stats` | GET | `verifyUserToken` | Stats de variações |
| `/api/user/subscription` | GET | `requireUser` | Subscription do usuário |
| `/api/user/quotas` | GET | `requireUser` | Quotas do usuário |
| `/api/user/features` | GET | `requireUser` | Features do usuário |
| `/api/user/plans` | GET | `requireUser` | Planos disponíveis |
| `/api/user/billing/*` | * | `requireUser` | Billing/Stripe |
| `/api/user/bots/*` | * | `verifyUserToken` | Gestão de bots |
| `/api/user/outgoing-webhooks/*` | * | `verifyUserToken` | Webhooks |
| `/api/user/custom-themes/*` | * | `requireUser` | Temas customizados |
| `/api/user/drafts/*` | * | `verifyUserToken` | Rascunhos |
| `/api/user/contacts/*` | * | `verifyUserToken` | Importação de contatos |

**Status:** ✅ Todos os endpoints protegidos (mix de `verifyUserToken` e `requireUser`)

**Observação:** Há dois tipos de autenticação de usuário:
1. `verifyUserToken` - Valida token WUZAPI (hash 32-char)
2. `requireUser` - Valida sessão/JWT com role='user'

---

### 5. Agent Routes (`/api/agent/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/agent/login` | POST | Nenhum (público) | Login de agent |
| `/api/agent/logout` | POST | `requireAgentAuth` | Logout |
| `/api/agent/me` | GET | `requireAgentAuth` | Dados do agent |
| `/api/agent/invitation/:token` | GET | Nenhum (público) | Validar convite |
| `/api/agent/register/:token` | POST | Nenhum (público) | Registro via convite |
| `/api/agent/availability` | PUT | `requireAgentAuth` | Atualizar disponibilidade |
| `/api/agent/profile` | PUT | `requireAgentAuth` | Atualizar perfil |
| `/api/agent/password` | PUT | `requireAgentAuth` | Alterar senha |
| `/api/agent/request-password-reset` | POST | Nenhum (público) | Solicitar reset |
| `/api/agent/reset-password` | POST | Nenhum (público) | Reset de senha |

**Status:** ✅ Endpoints públicos e protegidos corretamente separados

---

### 6. Account Routes (`/api/account/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/account/inboxes` | GET | `requireAgentAuth + requirePermission` | Listar inboxes |
| `/api/account/inboxes/my` | GET | `requireAgentAuth` | Minhas inboxes |
| `/api/account/inboxes/:id` | GET/PUT/DELETE | `requireAgentAuth + requirePermission` | Inbox específica |
| `/api/account/inboxes/:id/agents` | POST/DELETE | `requireAgentAuth + requirePermission` | Agents da inbox |
| `/api/account/teams/*` | * | `requireAgentAuth + requirePermission` | Gestão de times |
| `/api/account/roles/*` | * | `requireAgentAuth + requirePermission` | Gestão de roles |
| `/api/account/audit/*` | * | `requireAgentAuth + requirePermission` | Logs de auditoria |

**Status:** ✅ Todos os endpoints protegidos com auth + permissões

---

### 7. Auth Routes (`/api/auth/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/auth/login` | POST | Nenhum (público) | Login WUZAPI token |
| `/api/auth/logout` | POST | `requireAuth` | Logout |
| `/api/auth/me` | GET | `requireAuth` | Dados do usuário |
| `/api/auth/supabase-login` | POST | Nenhum (público) | Login Supabase |
| `/api/auth/user-login` | POST | Nenhum (público) | Login usuário independente |
| `/api/auth/user-logout` | POST | `requireUserAuth` | Logout usuário independente |
| `/api/auth/user-me` | GET | `requireUserAuth` | Dados usuário independente |

**Status:** ✅ Endpoints públicos e protegidos corretamente separados

---

### 8. Public Routes (`/api/public/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/public/branding` | GET | Nenhum | Branding público |
| `/api/public/health` | GET | Nenhum | Health check |
| `/api/public/tenant-info` | GET | Nenhum | Info do tenant |

**Status:** ✅ Todos os endpoints públicos (correto)

---

### 9. Webhook Routes

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/webhook/*` | POST | Verificação de assinatura | Webhooks WUZAPI |
| `/api/webhooks/stripe` | POST | Verificação de assinatura Stripe | Webhooks Stripe |

**Status:** ✅ Webhooks usam verificação de assinatura (correto)

---

### 10. Bot Proxy Routes (`/api/bot/*`)

| Endpoint | Método | Middleware | Descrição |
|----------|--------|------------|-----------|
| `/api/bot/send/text` | POST | `verifyUserToken` + quotas | Enviar texto |
| `/api/bot/send/image` | POST | `verifyUserToken` + quotas | Enviar imagem |
| `/api/bot/send/audio` | POST | `verifyUserToken` + quotas | Enviar áudio |
| `/api/bot/send/document` | POST | `verifyUserToken` + quotas | Enviar documento |
| `/api/bot/send/video` | POST | `verifyUserToken` + quotas | Enviar vídeo |
| `/api/bot/send/sticker` | POST | `verifyUserToken` + quotas | Enviar sticker |

**Status:** ✅ Todos os endpoints protegidos com token + quotas

---

## Problemas Identificados

### Problema 1: Endpoints Admin sem Middleware de Auth

**Arquivos afetados:** `server/routes/adminRoutes.js`

**Endpoints sem proteção adequada:**
```
GET  /api/admin/users          - Usa validação WUZAPI, não middleware
POST /api/admin/users          - Usa validação WUZAPI, não middleware
GET  /api/admin/users/:userId  - Usa validação WUZAPI, não middleware
GET  /api/admin/stats          - Usa validação WUZAPI, não middleware
POST /api/admin/s3/test        - Sem autenticação
```

**Risco:** Médio - Estes endpoints dependem de token WUZAPI válido, mas não verificam se o usuário tem permissão de admin no sistema.

**Recomendação:** Adicionar `requireAdmin` middleware a estes endpoints.

### Problema 2: Inconsistência entre `verifyUserToken` e `requireUser`

**Descrição:** Alguns endpoints de usuário usam `verifyUserToken` (valida token WUZAPI) enquanto outros usam `requireUser` (valida sessão/JWT com role='user').

**Impacto:** Usuários autenticados via Supabase JWT podem não ter acesso a endpoints que usam `verifyUserToken`.

**Recomendação:** Padronizar para suportar ambos os métodos ou migrar para `requireUser` com fallback para token WUZAPI.

### Problema 3: Múltiplos Sistemas de Autenticação

**Sistemas identificados:**
1. SuperAdmin Auth (JWT + sessão)
2. Supabase Auth (JWT)
3. Sessão tradicional (WUZAPI token)
4. Agent Auth (token próprio)
5. User Auth (token próprio)

**Impacto:** Complexidade de manutenção e potencial confusão sobre qual método usar.

**Recomendação:** Documentar claramente quando usar cada método e considerar consolidação futura.

---

## Resumo por Tipo de Autenticação

| Tipo | Quantidade de Endpoints | Status |
|------|------------------------|--------|
| SuperAdmin (`requireSuperadmin`) | ~15 | ✅ OK |
| Tenant Admin (`requireTenantAdmin`) | ~10 | ✅ OK |
| Admin (`requireAdmin`) | ~30 | ⚠️ Alguns sem middleware |
| User (`requireUser`) | ~15 | ✅ OK |
| User Token (`verifyUserToken`) | ~40 | ✅ OK |
| Agent (`requireAgentAuth`) | ~20 | ✅ OK |
| User Independente (`requireUserAuth`) | ~5 | ✅ OK |
| Público (sem auth) | ~15 | ✅ OK |
| Webhook (assinatura) | ~5 | ✅ OK |

---

## Recomendações

1. **Prioridade Alta:** Adicionar `requireAdmin` aos endpoints em `adminRoutes.js` que usam apenas validação WUZAPI
2. **Prioridade Média:** Padronizar autenticação de usuário para suportar JWT e token WUZAPI
3. **Prioridade Baixa:** Documentar fluxos de autenticação para cada tipo de usuário
4. **Prioridade Baixa:** Considerar consolidação de sistemas de autenticação no futuro

---

## Próximos Passos

- [ ] Corrigir endpoints admin sem middleware
- [ ] Criar helper unificado para autenticação de usuário
- [ ] Documentar fluxos de autenticação
- [ ] Criar testes de autenticação para cada tipo
