# Auditoria: `plans` vs `tenant_plans`

## Data: 2025-12-22

## Resumo Executivo

O sistema possui duas tabelas de planos:
1. **`plans`** - Tabela global (4 registros) - Usada para templates e pacotes de crédito
2. **`tenant_plans`** - Tabela por tenant (12 registros) - Usada para subscriptions

**Conclusão:** Ambas as tabelas são necessárias, mas com propósitos diferentes.

---

## Estrutura das Tabelas

### Tabela `plans` (Global)

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | NO | PK |
| name | text | NO | Nome do plano |
| description | text | YES | Descrição |
| price_cents | integer | NO | Preço em centavos |
| billing_cycle | text | NO | Ciclo de cobrança |
| status | text | NO | Status (active/inactive) |
| is_default | boolean | YES | Plano padrão |
| trial_days | integer | YES | Dias de trial |
| quotas | jsonb | NO | Limites de recursos |
| features | jsonb | NO | Features habilitadas |
| stripe_product_id | varchar | YES | ID do produto Stripe |
| stripe_price_id | varchar | YES | ID do preço Stripe |
| **is_credit_package** | boolean | YES | **Se é pacote de crédito** |
| **credit_amount** | integer | YES | **Quantidade de créditos** |
| created_at | timestamptz | YES | Data de criação |
| updated_at | timestamptz | YES | Data de atualização |

**Dados Atuais:**
| ID | Nome | Preço | Status | É Pacote de Crédito |
|----|------|-------|--------|---------------------|
| d3036e3c-... | starter | R$ 200,00 | active | false |
| eed88151-... | professional | R$ 300,00 | active | false |
| 896667fa-... | enterprise | R$ 450,90 | active | false |
| 0fb32462-... | free | R$ 0,00 | active | false |

### Tabela `tenant_plans` (Por Tenant)

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | NO | PK |
| **tenant_id** | uuid | NO | **FK → tenants** |
| name | text | NO | Nome do plano |
| description | text | YES | Descrição |
| price_cents | integer | YES | Preço em centavos |
| billing_cycle | text | YES | Ciclo de cobrança |
| status | text | YES | Status |
| is_default | boolean | YES | Plano padrão do tenant |
| trial_days | integer | YES | Dias de trial |
| quotas | jsonb | YES | Limites de recursos |
| features | jsonb | YES | Features habilitadas |
| stripe_product_id | text | YES | ID do produto Stripe |
| stripe_price_id | text | YES | ID do preço Stripe |
| created_at | timestamptz | YES | Data de criação |
| updated_at | timestamptz | YES | Data de atualização |

---

## Foreign Keys

### `user_subscriptions.plan_id` → `tenant_plans.id` ✅
- Subscriptions de usuários referenciam `tenant_plans`
- **Correto:** Cada tenant tem seus próprios planos

### `reseller_pricing.base_package_id` → `plans.id` ⚠️
- Preços de revenda referenciam `plans` global
- **Atenção:** Sistema de revenda usa planos globais como base

---

## Uso no Código

### Backend - Referências a `plans`

| Arquivo | Uso | Propósito |
|---------|-----|-----------|
| `SuperadminService.js` | `from('plans')` | Copiar planos default para novos tenants |
| `PlanService.js` | CRUD em `plans` | Gerenciar planos globais (admin) |
| `CreditService.js` | `from('plans')` | Buscar pacotes de crédito |
| `resellerRoutes.js` | `from('plans')` | Sistema de revenda |
| `userBillingRoutes.js` | `from('plans')` | Listar pacotes de crédito |
| `SupabaseService.js` | `from('plans')` | Verificar conexão DB |

### Backend - Referências a `tenant_plans`

| Arquivo | Uso | Propósito |
|---------|-----|-----------|
| `SubscriptionService.js` | `from('tenant_plans')` | Gerenciar subscriptions |
| `SuperadminService.js` | `from('tenant_plans')` | Criar planos para tenant |
| `QuotaService.js` | `JOIN tenant_plans` | Buscar quotas do plano |
| `TenantService.js` | `from('tenant_plans')` | CRUD de planos do tenant |
| `TenantPlanService.js` | `from('tenant_plans')` | Serviço dedicado |
| `adminReportRoutes.js` | `tenant_plans` | Relatórios |
| `adminStripeRoutes.js` | `tenant_plans` | Métricas Stripe |
| `adminDashboardRoutes.js` | `tenant_plans` | Dashboard |

### Frontend - Referências

| Arquivo | Uso | Propósito |
|---------|-----|-----------|
| `admin-plans.ts` | `/api/admin/plans` | Gerenciar planos globais |
| `stripe.ts` | `/api/admin/plans` | Sync com Stripe |
| `supabase.ts` | `from('plans')` | Listar planos (direto) |
| `PlansManagementPage.tsx` | Admin UI | Gerenciar planos |
| `TenantPlans.tsx` | Tenant UI | Gerenciar planos do tenant |

---

## Análise de Propósito

### `plans` - Tabela Global

**Propósito:**
1. **Templates de Planos** - Servem como base para criar `tenant_plans`
2. **Pacotes de Crédito** - Usados pelo sistema de créditos (`is_credit_package = true`)
3. **Sistema de Revenda** - Base para preços de revenda (`reseller_pricing`)

**Fluxo:**
```
SuperAdmin cria plano em `plans`
    ↓
Ao criar novo Tenant, copia planos de `plans` para `tenant_plans`
    ↓
Tenant customiza seus planos em `tenant_plans`
```

### `tenant_plans` - Tabela Por Tenant

**Propósito:**
1. **Planos de Subscription** - Usados por `user_subscriptions`
2. **Quotas** - Definem limites de recursos por tenant
3. **Stripe Integration** - Cada tenant tem seus próprios produtos Stripe

**Fluxo:**
```
Account assina plano do Tenant
    ↓
user_subscriptions.plan_id → tenant_plans.id
    ↓
Quotas aplicadas via tenant_plans.quotas
```

---

## Problemas Identificados

### Problema 1: Acesso Direto via Supabase Client (Frontend)

**Arquivo:** `src/lib/supabase.ts`
```typescript
plans: {
  async list() {
    const { data, error } = await supabase
      .from('plans')  // ⚠️ Acesso direto à tabela global
      .select('*')
      .eq('status', 'active')
```

**Risco:** Frontend acessa `plans` diretamente, bypassando backend.

**Recomendação:** Usar API backend para listar planos.

### Problema 2: PlanService Opera em `plans` Global

**Arquivo:** `server/services/PlanService.js`

O `PlanService` opera exclusivamente na tabela `plans` global. Isso é correto para:
- SuperAdmin gerenciando templates
- Pacotes de crédito

Mas pode causar confusão se usado para operações de tenant.

**Recomendação:** Documentar claramente que `PlanService` é para planos globais.

### Problema 3: Falta de Validação de Tenant em Algumas Queries

Algumas queries em `tenant_plans` não validam se o plano pertence ao tenant correto.

**Exemplo em `SubscriptionService.js`:**
```javascript
const { data: plan } = await SupabaseService.getById('tenant_plans', planId);
// ⚠️ Não valida se plan.tenant_id === account.tenant_id
```

**Recomendação:** Sempre validar `tenant_id` ao buscar planos.

---

## Recomendações

### 1. Manter Ambas as Tabelas ✅

Ambas são necessárias:
- `plans` → Templates globais + pacotes de crédito
- `tenant_plans` → Planos específicos por tenant

### 2. Documentar Propósitos

Adicionar comentários nos serviços:
```javascript
// PlanService.js - Gerencia planos GLOBAIS (templates e créditos)
// TenantPlanService.js - Gerencia planos POR TENANT (subscriptions)
```

### 3. Remover Acesso Direto no Frontend

Migrar `src/lib/supabase.ts` para usar API backend:
```typescript
// Antes
const { data } = await supabase.from('plans').select('*')

// Depois
const { data } = await api.get('/api/admin/plans')
```

### 4. Adicionar Validação de Tenant

Em todas as operações com `tenant_plans`, validar:
```javascript
if (plan.tenant_id !== account.tenant_id) {
  throw new Error('Plan does not belong to this tenant');
}
```

### 5. Habilitar RLS em `tenant_plans`

```sql
ALTER TABLE tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can only see own plans"
ON tenant_plans FOR SELECT
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Decisão Final

| Tabela | Manter? | Motivo |
|--------|---------|--------|
| `plans` | ✅ Sim | Templates + pacotes de crédito + revenda |
| `tenant_plans` | ✅ Sim | Subscriptions por tenant |

**Ação:** Não remover nenhuma tabela. Apenas:
1. Documentar propósitos
2. Adicionar validações de tenant
3. Habilitar RLS em `tenant_plans`
4. Remover acesso direto no frontend

---

## Próximos Passos

- [ ] Adicionar comentários de documentação nos serviços
- [ ] Migrar `src/lib/supabase.ts` para usar API
- [ ] Adicionar validação de `tenant_id` em `SubscriptionService`
- [ ] Habilitar RLS em `tenant_plans` (Task 6)
- [ ] Criar testes de isolamento multi-tenant
