# Auditoria: Integração Stripe

## Data: 2025-12-22

## Resumo Executivo

A integração Stripe está **parcialmente configurada** mas **não está sendo utilizada ativamente**:
- ✅ StripeService bem estruturado e completo
- ✅ Webhooks implementados corretamente
- ✅ Configuração global presente em `global_settings`
- ⚠️ **0 subscriptions** com `stripe_subscription_id`
- ⚠️ **0 eventos** na tabela `stripe_webhook_events`
- ⚠️ **Nenhum tenant** com Stripe Connect configurado

---

## Arquitetura Stripe

### Modelo de Pagamentos Multi-Tenant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE PAGAMENTOS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PLATAFORMA (wasendgo.com)                                                  │
│  ├── Stripe Account Principal (configurado em global_settings)              │
│  ├── stripe_secret_key: sk_test_***                                         │
│  ├── stripe_publishable_key: pk_test_***                                    │
│  └── stripe_connect_enabled: true                                           │
│                                                                             │
│  TENANTS (Stripe Connect)                                                   │
│  ├── Cada tenant pode ter seu próprio Stripe Connect account                │
│  ├── tenants.stripe_connect_id → ID da conta Connect                        │
│  └── Pagamentos dos clientes vão para o tenant                              │
│                                                                             │
│  ACCOUNTS (Clientes)                                                        │
│  ├── accounts.stripe_customer_id → Customer no Stripe                       │
│  └── user_subscriptions.stripe_subscription_id → Subscription no Stripe     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tabelas Envolvidas

| Tabela | Campo Stripe | Descrição |
|--------|--------------|-----------|
| `global_settings` | `stripe_secret_key` | Chave secreta da plataforma |
| `global_settings` | `stripe_publishable_key` | Chave pública da plataforma |
| `global_settings` | `stripe_webhook_secret` | Secret para validar webhooks |
| `global_settings` | `stripe_connect_enabled` | Se Connect está habilitado |
| `tenants` | `stripe_connect_id` | ID da conta Connect do tenant |
| `accounts` | `stripe_customer_id` | ID do customer no Stripe |
| `user_subscriptions` | `stripe_subscription_id` | ID da subscription no Stripe |
| `stripe_webhook_events` | - | Log de eventos recebidos |

---

## Análise do StripeService

### Métodos Disponíveis

| Método | Descrição | Status |
|--------|-----------|--------|
| `validateApiKeys()` | Valida chaves API | ✅ Implementado |
| `getAccountInfo()` | Info da conta Stripe | ✅ Implementado |
| `createCustomer()` | Cria customer | ✅ Implementado |
| `getCustomer()` | Busca customer | ✅ Implementado |
| `updateCustomer()` | Atualiza customer | ✅ Implementado |
| `createProduct()` | Cria produto | ✅ Implementado |
| `archiveProduct()` | Arquiva produto | ✅ Implementado |
| `createPrice()` | Cria preço | ✅ Implementado |
| `archivePrice()` | Arquiva preço | ✅ Implementado |
| `createCheckoutSession()` | Cria sessão checkout | ✅ Implementado |
| `createBillingPortalSession()` | Portal de billing | ✅ Implementado |
| `getSubscription()` | Busca subscription | ✅ Implementado |
| `cancelSubscription()` | Cancela subscription | ✅ Implementado |
| `reactivateSubscription()` | Reativa subscription | ✅ Implementado |
| `listInvoices()` | Lista faturas | ✅ Implementado |
| `verifyWebhookSignature()` | Valida webhook | ✅ Implementado |
| `saveSettings()` | Salva configurações | ✅ Implementado |
| `getSettings()` | Busca configurações | ✅ Implementado |

### Webhooks Implementados

| Evento | Handler | Descrição |
|--------|---------|-----------|
| `checkout.session.completed` | `handleCheckoutCompleted()` | Ativa subscription após pagamento |
| `customer.subscription.updated` | `handleSubscriptionUpdated()` | Sincroniza status da subscription |
| `customer.subscription.deleted` | `handleSubscriptionDeleted()` | Marca subscription como cancelada |
| `invoice.payment_failed` | `handlePaymentFailed()` | Marca subscription como past_due |
| `invoice.paid` | `handleInvoicePaid()` | Processa compra de créditos |

---

## Estado Atual dos Dados

### Configuração Global

```
stripe_secret_key: ✅ Configurado (sk_test_***)
stripe_publishable_key: ✅ Configurado (pk_test_***)
stripe_webhook_secret: ❌ Não configurado
stripe_connect_enabled: ✅ true
```

### Tenants e Stripe Connect

| Tenant | Subdomain | stripe_connect_id | Status |
|--------|-----------|-------------------|--------|
| Default Tenant | default | NULL | ⚠️ Não configurado |
| Acme Corp | acmecorp | NULL | ⚠️ Não configurado |
| Cortexx | cortexx | NULL | ⚠️ Não configurado |

### Subscriptions com Stripe

```sql
-- Subscriptions com stripe_subscription_id
SELECT COUNT(*) FROM user_subscriptions WHERE stripe_subscription_id IS NOT NULL;
-- Resultado: 0

-- Accounts com stripe_customer_id
SELECT COUNT(*) FROM accounts WHERE stripe_customer_id IS NOT NULL;
-- Resultado: 1 (Account - 6b2d14f8)
```

### Webhook Events

```sql
SELECT COUNT(*) FROM stripe_webhook_events;
-- Resultado: 0
```

---

## Problemas Identificados

### Problema 1: Webhook Secret Não Configurado

O `stripe_webhook_secret` não está presente em `global_settings`, o que significa que webhooks não podem ser validados.

**Impacto:**
- Webhooks do Stripe serão rejeitados
- Subscriptions não serão sincronizadas automaticamente

**Solução:**
1. Criar webhook endpoint no Stripe Dashboard
2. Copiar o signing secret
3. Salvar em `global_settings` via admin panel

### Problema 2: Nenhum Tenant com Stripe Connect

Todos os tenants têm `stripe_connect_id = NULL`, indicando que Stripe Connect não foi configurado para nenhum.

**Impacto:**
- Tenants não podem receber pagamentos diretamente
- Todos os pagamentos iriam para a conta principal da plataforma

**Solução:**
1. Implementar fluxo de onboarding Stripe Connect
2. Cada tenant deve completar o onboarding
3. Salvar `stripe_connect_id` após onboarding

### Problema 3: Subscriptions Sem Vínculo com Stripe

Todas as 9 subscriptions existentes têm `stripe_subscription_id = NULL`.

**Impacto:**
- Subscriptions são gerenciadas apenas localmente
- Não há cobrança automática
- Não há sincronização de status

**Causa Provável:**
- Subscriptions criadas manualmente ou via SubscriptionEnsurer
- Fluxo de checkout nunca foi utilizado

### Problema 4: Apenas 1 Account com Customer ID

Apenas 1 account tem `stripe_customer_id` configurado.

**Impacto:**
- Não é possível criar checkout sessions para outras accounts
- Billing portal não funciona para essas accounts

---

## Fluxos de Pagamento

### Fluxo 1: Checkout de Subscription

```
┌─────────┐     POST /api/billing/checkout     ┌─────────────────┐
│ Cliente │ ─────────────────────────────────▶│ billingRoutes   │
└─────────┘     { planId, successUrl }        └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ StripeService   │
                                              │ .createCheckout │
                                              │  Session()      │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Stripe API      │
                                              │ Checkout Session│
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Retorna URL     │
                                              │ do checkout     │
                                              └─────────────────┘
```

### Fluxo 2: Webhook de Subscription

```
┌─────────┐     POST /api/webhooks/stripe     ┌─────────────────┐
│ Stripe  │ ─────────────────────────────────▶│ stripeWebhook   │
└─────────┘     { event }                     │ Routes          │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Verify signature│
                                              │ (webhook secret)│
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Handle event    │
                                              │ by type         │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Update local    │
                                              │ subscription    │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Log to          │
                                              │ webhook_events  │
                                              └─────────────────┘
```

---

## Recomendações

### 1. Configuração Imediata (Prioridade Alta)

1. **Configurar webhook secret:**
   ```javascript
   // Via admin panel ou diretamente
   await StripeService.saveSettings({
     secretKey: 'sk_test_***',
     publishableKey: 'pk_test_***',
     webhookSecret: 'whsec_***',
     connectEnabled: true
   });
   ```

2. **Criar webhook endpoint no Stripe:**
   - URL: `https://seu-dominio.com/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### 2. Stripe Connect para Tenants (Prioridade Média)

1. **Implementar fluxo de onboarding:**
   ```javascript
   // Criar account link para onboarding
   const accountLink = await stripe.accountLinks.create({
     account: stripeAccountId,
     refresh_url: 'https://tenant.wasendgo.com/settings/stripe/refresh',
     return_url: 'https://tenant.wasendgo.com/settings/stripe/complete',
     type: 'account_onboarding',
   });
   ```

2. **Salvar stripe_connect_id após onboarding**

### 3. Migrar Subscriptions Existentes (Prioridade Baixa)

Para subscriptions que devem ser cobradas:
1. Criar customer no Stripe para cada account
2. Criar subscription no Stripe
3. Atualizar `stripe_subscription_id` local

---

## Checklist de Verificação

- [x] StripeService implementado e funcional
- [x] Webhooks implementados corretamente
- [x] Configuração global presente
- [x] Documentação de configuração de webhooks criada (`docs/STRIPE_WEBHOOK_SETUP.md`)
- [ ] Webhook secret configurado (requer ação manual no Stripe Dashboard)
- [ ] Stripe Connect configurado para tenants
- [ ] Subscriptions vinculadas ao Stripe
- [ ] Fluxo de checkout testado
- [ ] Fluxo de cancelamento testado
- [ ] Fluxo de reativação testado

---

## Próximos Passos

1. [x] Documentar configuração de webhooks - Ver `docs/STRIPE_WEBHOOK_SETUP.md`
2. [ ] Configurar webhook secret em `global_settings` (requer acesso ao Stripe Dashboard)
3. [ ] Criar webhook endpoint no Stripe Dashboard
4. [ ] Testar fluxo de checkout completo
5. [ ] Implementar onboarding Stripe Connect para tenants
6. [ ] Documentar fluxo de pagamentos para usuários

---

## Documentação Relacionada

- [Configuração de Stripe Webhooks](../STRIPE_WEBHOOK_SETUP.md)
- [Integração Stripe](../STRIPE_INTEGRATION.md)
