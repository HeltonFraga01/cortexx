# Auditoria: Código Legado e Duplicações

## Data: 2025-12-22

## Resumo Executivo

Foram identificados **middlewares duplicados** e **código legado** que podem ser consolidados:
- 8 middlewares de autenticação diferentes
- `verifyUserToken.js` marcado como legado
- Múltiplas formas de resolver userId
- Serviços potencialmente não utilizados

---

## Middlewares de Autenticação

### Inventário de Middlewares

| Arquivo | Exports | Uso |
|---------|---------|-----|
| `auth.js` | `requireAuth`, `requireAdmin`, `requireUser`, `requireAdminToken` | Principal - sessão/JWT |
| `supabaseAuth.js` | `validateSupabaseToken`, `requireRole`, `requireUserRole`, `requireAdmin` | Supabase JWT |
| `superadminAuth.js` | `requireSuperadmin`, `validateSuperadminSession` | SuperAdmin |
| `tenantAuth.js` | `requireTenantAdmin`, `requireTenantUser`, `validateAccountOwnership` | Multi-tenant |
| `agentAuth.js` | `requireAgentAuth`, `requireAgentRole` | Agents |
| `userAuth.js` | `requireUserAuth` | Usuários independentes |
| `verifyUserToken.js` | `verifyUserToken` | **LEGADO** - compatibilidade |
| `tokenValidator.js` | `validateToken`, `validateTokenStrict` | Validação de tokens |

### Duplicações Identificadas

#### 1. `requireAdmin` duplicado

```javascript
// auth.js
async function requireAdmin(req, res, next) { ... }

// supabaseAuth.js
function requireAdmin(req, res, next) {
  return requireRole('owner', 'administrator')(req, res, next);
}
```

**Problema:** Dois middlewares com mesmo nome, comportamentos diferentes.

**Solução:** Renomear `supabaseAuth.requireAdmin` para `requireSupabaseAdmin`.

#### 2. `verifyUserToken.js` é legado

O próprio código indica:
```javascript
/**
 * NOTA: Este middleware é para compatibilidade com código legado.
 * O novo sistema usa autenticação baseada em sessão (requireAuth, requireUser).
 */
```

**Ação:** Identificar onde ainda é usado e migrar para `requireUser`.

#### 3. Múltiplas formas de resolver userId

```javascript
// auth.js
function getUserId(req) { ... }

// userIdResolver.js
function resolveUserId(req) { ... }

// quotaEnforcement.js
function resolveUserId(req) { ... }
```

**Solução:** Centralizar em `userIdResolver.js` e remover duplicações.

---

## Serviços Potencialmente Não Utilizados

### Verificação de Uso

| Serviço | Referências | Status |
|---------|-------------|--------|
| `StateSynchronizer.js` | Poucos | ⚠️ Verificar |
| `RandomSelector.js` | Poucos | ⚠️ Verificar |
| `LinkPreviewService.js` | Poucos | ⚠️ Verificar |
| `AffiliateService.js` | Poucos | ⚠️ Verificar |
| `ConnectService.js` | Poucos | ⚠️ Verificar |

### Serviços Ativos (Confirmados)

- `SupabaseService.js` - Abstração de banco de dados
- `SubscriptionService.js` - Gestão de subscriptions
- `QuotaService.js` - Verificação de quotas
- `StripeService.js` - Integração Stripe
- `ChatService.js` - Mensagens e conversas
- `AgentService.js` - Gestão de agents
- `TenantService.js` - Gestão de tenants
- `UserService.js` - Usuários independentes

---

## Tabelas Obsoletas

### Verificação de Tabelas

| Tabela | Status | Observação |
|--------|--------|------------|
| `sessions` | ⚠️ Verificar | Pode ser substituída por `agent_sessions` |
| `session_token_mapping` | ⚠️ Verificar | Usado para webhooks |

---

## Código Duplicado

### 1. Conversão de User ID

```javascript
// Duplicado em múltiplos arquivos
if (userId && userId.length === 32 && !userId.includes('-')) {
  uuidUserId = `${userId.slice(0, 8)}-${userId.slice(8, 12)}-...`;
}
```

**Solução:** ✅ Já criado `userIdHelper.js` na Task 3.

### 2. Validação de JWT

```javascript
// Duplicado em auth.js, supabaseAuth.js, verifyUserToken.js
if (token.startsWith('eyJ') && token.split('.').length === 3) {
  // É JWT
}
```

**Solução:** Centralizar em `supabaseAuth.js`.

### 3. Resolução de Tenant ID

```javascript
// Duplicado em múltiplos middlewares
const tenantId = req.user?.tenantId || req.session?.tenantId || req.headers['x-tenant-id'];
```

**Solução:** Criar helper `resolveTenantId(req)`.

---

## Recomendações

### 1. Consolidar Middlewares de Auth (Prioridade Alta)

```
auth.js (principal)
├── requireAuth - Autenticação básica
├── requireAdmin - Admin de tenant
├── requireUser - Usuário de tenant
└── requireAdminToken - Token de integração

supabaseAuth.js (JWT)
├── validateSupabaseToken - Validação de JWT
├── requireSupabaseRole - Roles via JWT (renomear)
└── optionalSupabaseAuth - Auth opcional

superadminAuth.js (SuperAdmin)
├── requireSuperadmin
└── validateSuperadminSession

tenantAuth.js (Multi-tenant)
├── requireTenantAdmin
├── requireTenantUser
└── validateAccountOwnership

agentAuth.js (Agents)
├── requireAgentAuth
└── requireAgentRole

userAuth.js (Usuários independentes)
└── requireUserAuth

verifyUserToken.js → DEPRECAR
```

### 2. Deprecar verifyUserToken.js (Prioridade Média)

1. Identificar todos os usos de `verifyUserToken`
2. Migrar para `requireUser` ou `validateSupabaseToken`
3. Adicionar warning de deprecação
4. Remover após migração completa

### 3. Centralizar Resolução de IDs (Prioridade Média)

```javascript
// server/utils/requestResolver.js
module.exports = {
  resolveUserId(req) { ... },
  resolveTenantId(req) { ... },
  resolveAccountId(req) { ... },
  getUserToken(req) { ... }
};
```

### 4. Limpar Imports Não Utilizados (Prioridade Baixa)

Executar linter para identificar imports não utilizados:
```bash
cd server && npm run lint
```

---

## Checklist de Limpeza

- [ ] Renomear `supabaseAuth.requireAdmin` para evitar conflito
- [ ] Deprecar `verifyUserToken.js`
- [ ] Centralizar resolução de IDs em `requestResolver.js`
- [ ] Verificar serviços não utilizados
- [ ] Executar linter e corrigir warnings
- [ ] Remover código comentado
- [ ] Atualizar imports após consolidação

---

## Próximos Passos

1. [ ] Criar `requestResolver.js` com funções centralizadas
2. [ ] Adicionar deprecation warning em `verifyUserToken.js`
3. [ ] Identificar e migrar usos de `verifyUserToken`
4. [ ] Executar linter e corrigir warnings
5. [ ] Documentar middlewares de auth no README
