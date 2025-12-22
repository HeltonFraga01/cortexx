# Auditoria: Vinculação User-Account-Subscription

## Data: 2025-12-22

## Resumo Executivo

Foram encontradas **inconsistências críticas** na vinculação entre accounts, tenants e subscriptions:
- **8 accounts** sem `tenant_id` (órfãs)
- **11 accounts** sem subscription
- **3 accounts** com tenant mas sem subscription

---

## Queries de Diagnóstico

### 5.1 Accounts sem owner_user_id válido
```sql
SELECT * FROM accounts WHERE owner_user_id IS NULL;
```
**Resultado:** ✅ 0 registros - Todas as accounts têm owner_user_id

### 5.2 Subscriptions sem account válida
```sql
SELECT s.* FROM user_subscriptions s
LEFT JOIN accounts a ON s.account_id = a.id
WHERE a.id IS NULL;
```
**Resultado:** ✅ 0 registros - Todas as subscriptions têm account válida

### 5.3 Accounts sem subscription
```sql
SELECT a.* FROM accounts a
LEFT JOIN user_subscriptions s ON a.id = s.account_id
WHERE s.id IS NULL;
```
**Resultado:** ⚠️ **11 accounts sem subscription**

| Account ID | Nome | Tenant ID | Status |
|------------|------|-----------|--------|
| 2d3404ba-... | Acme Corp - Principal | 46d3366f-... (acmecorp) | active |
| 957be90a-... | Account for User 3f044b3b... | 00000000-...-000001 (default) | active |
| 89597108-... | Cortexx - Principal | 47c1b641-... (cortexx) | active |
| 64bc2155-... | HeltonFraga's Account | **NULL** | active |
| 7c668113-... | HeltonFraga's Account | **NULL** | active |
| 839c7407-... | HeltonFraga's Account | **NULL** | active |
| 22d5cd9d-... | HeltonFraga's Account | **NULL** | active |
| ff9ae2a7-... | new.user.test...'s Account | **NULL** | active |
| 44b843d8-... | cortexx1's Account | **NULL** | active |
| 0de3bb18-... | cortexx3's Account | **NULL** | active |
| c09080ed-... | Account - 0c0f6b53 | **NULL** | active |

### 5.4 Accounts com tenant_id = NULL
```sql
SELECT * FROM accounts WHERE tenant_id IS NULL;
```
**Resultado:** ⚠️ **8 accounts órfãs (sem tenant)**

---

## Problemas Identificados

### Problema 1: Accounts Órfãs (sem tenant_id)

**8 accounts** não estão vinculadas a nenhum tenant:
- 4x "HeltonFraga's Account"
- 1x "new.user.test...'s Account"
- 1x "cortexx1's Account"
- 1x "cortexx3's Account"
- 1x "Account - 0c0f6b53"

**Causa Provável:**
- Accounts criadas antes da implementação multi-tenant
- Accounts criadas via WUZAPI sem passar tenant_id

**Impacto:**
- Essas accounts não podem ter subscriptions (FK para tenant_plans requer tenant)
- Quotas não podem ser aplicadas corretamente
- Isolamento multi-tenant comprometido

### Problema 2: SubscriptionEnsurer Usa Planos Globais

**Arquivo:** `server/services/SubscriptionEnsurer.js`

```javascript
// Problema: Busca plano default na tabela global 'plans'
const defaultPlan = await this.planService.getDefaultPlan();
```

O `PlanService.getDefaultPlan()` busca na tabela `plans` (global), não em `tenant_plans`.

**Impacto:**
- Subscriptions criadas automaticamente não respeitam o tenant
- Plano default pode não existir no tenant da account

### Problema 3: Accounts Principais dos Tenants sem Subscription

As accounts principais dos tenants (Acme Corp, Cortexx) não têm subscription:
- `Acme Corp - Principal` (tenant: acmecorp)
- `Cortexx - Principal` (tenant: cortexx)

**Causa Provável:**
- Accounts criadas manualmente sem passar pelo fluxo de subscription
- SubscriptionEnsurer não foi executado para essas accounts

---

## Regras de Vinculação (Esperadas)

### Hierarquia Correta
```
Tenant
  └── tenant_plans (planos do tenant)
  └── Account (cliente do tenant)
        └── user_subscriptions (subscription da account)
              └── plan_id → tenant_plans.id
```

### Invariantes
1. **Toda account DEVE ter tenant_id** (não pode ser NULL)
2. **Toda account ativa DEVE ter subscription**
3. **subscription.plan_id DEVE referenciar tenant_plans do mesmo tenant**
4. **tenant_plans.tenant_id DEVE ser igual a account.tenant_id**

### Validação de Integridade
```sql
-- Verificar integridade: subscription.plan_id deve ser do mesmo tenant
SELECT 
  s.id as subscription_id,
  a.id as account_id,
  a.tenant_id as account_tenant,
  tp.tenant_id as plan_tenant,
  CASE WHEN a.tenant_id = tp.tenant_id THEN 'OK' ELSE 'MISMATCH' END as status
FROM user_subscriptions s
JOIN accounts a ON s.account_id = a.id
JOIN tenant_plans tp ON s.plan_id = tp.id;
```

---

## Script de Correção

### Passo 1: Atribuir tenant_id às accounts órfãs

```sql
-- Opção A: Atribuir ao tenant 'default'
UPDATE accounts 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Opção B: Identificar tenant pelo nome da account
-- (requer análise manual)
```

### Passo 2: Criar subscriptions para accounts sem subscription

```javascript
// server/scripts/fix-missing-subscriptions.js
const SupabaseService = require('../services/SupabaseService');
const { logger } = require('../utils/logger');

async function fixMissingSubscriptions() {
  // 1. Buscar accounts sem subscription
  const { data: accounts } = await SupabaseService.adminClient
    .from('accounts')
    .select('id, tenant_id, name')
    .is('tenant_id', 'not.null')
    .not('id', 'in', 
      SupabaseService.adminClient
        .from('user_subscriptions')
        .select('account_id')
    );

  for (const account of accounts) {
    // 2. Buscar plano default do tenant
    const { data: defaultPlan } = await SupabaseService.adminClient
      .from('tenant_plans')
      .select('id')
      .eq('tenant_id', account.tenant_id)
      .eq('is_default', true)
      .single();

    if (!defaultPlan) {
      logger.warn('No default plan for tenant', { 
        accountId: account.id, 
        tenantId: account.tenant_id 
      });
      continue;
    }

    // 3. Criar subscription
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .insert({
        account_id: account.id,
        plan_id: defaultPlan.id,
        status: 'active',
        created_by: 'system-fix'
      });

    logger.info('Created subscription', { 
      accountId: account.id, 
      planId: defaultPlan.id 
    });
  }
}
```

### Passo 3: Corrigir SubscriptionEnsurer

```javascript
// Modificar para usar tenant_plans ao invés de plans
async ensureSubscription(userId, tenantId) {
  // Buscar plano default do TENANT, não global
  const { data: defaultPlan } = await SupabaseService.adminClient
    .from('tenant_plans')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single();
  
  // ... resto da lógica
}
```

---

## Recomendações

### 1. Correção Imediata (Prioridade Alta)

1. **Atribuir tenant_id** às 8 accounts órfãs
2. **Criar subscriptions** para as 11 accounts sem subscription
3. **Corrigir SubscriptionEnsurer** para usar `tenant_plans`

### 2. Prevenção (Prioridade Média)

1. **Adicionar constraint NOT NULL** em `accounts.tenant_id`
2. **Adicionar trigger** para criar subscription automaticamente ao criar account
3. **Validar tenant_id** em todas as operações de criação de account

### 3. Monitoramento (Prioridade Baixa)

1. **Criar job de verificação** de integridade diário
2. **Alertar** quando account for criada sem tenant_id
3. **Dashboard** de saúde do sistema multi-tenant

---

## Próximos Passos

- [ ] Executar script de correção para accounts órfãs
- [ ] Executar script de correção para subscriptions faltantes
- [ ] Refatorar SubscriptionEnsurer para usar tenant_plans
- [ ] Adicionar constraint NOT NULL em accounts.tenant_id
- [ ] Criar testes de integridade
