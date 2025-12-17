# Integração com Stripe

## Visão Geral

O WUZAPI Manager utiliza Stripe para gerenciamento de assinaturas e pagamentos. Esta documentação descreve como configurar e utilizar a integração.

## Configuração

### Variáveis de Ambiente

```bash
# Backend (server/.env)
STRIPE_SECRET_KEY=sk_live_xxx  # ou sk_test_xxx para desenvolvimento
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Obter Credenciais

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Vá em **Developers > API Keys**
3. Copie a **Secret key** (sk_live_xxx ou sk_test_xxx)
4. Para webhooks, vá em **Developers > Webhooks**
5. Crie um endpoint apontando para `https://seu-dominio.com/api/webhooks/stripe`
6. Copie o **Signing secret** (whsec_xxx)

## Arquitetura

### Tabelas do Banco de Dados (Supabase)

```sql
-- Planos disponíveis
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  stripe_price_id VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  interval VARCHAR(20) DEFAULT 'month',
  features JSONB,
  limits JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assinaturas dos usuários
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  plan_id UUID REFERENCES plans(id),
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uso de quotas
CREATE TABLE user_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  quota_type VARCHAR(50) NOT NULL,
  used INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Serviços Backend

```
server/services/
├── StripeService.js      # Integração com API Stripe
├── SubscriptionService.js # Lógica de assinaturas
└── QuotaService.js       # Controle de quotas
```

## Fluxos

### 1. Checkout de Assinatura

```javascript
// POST /api/user/subscriptions/checkout
const { sessionUrl } = await StripeService.createCheckoutSession({
  accountId: req.user.accountId,
  priceId: 'price_xxx',
  successUrl: 'https://app.exemplo.com/success',
  cancelUrl: 'https://app.exemplo.com/cancel'
});

// Redirecionar usuário para sessionUrl
```

### 2. Webhook de Pagamento

```javascript
// POST /api/webhooks/stripe
// Eventos tratados:
// - checkout.session.completed
// - invoice.paid
// - invoice.payment_failed
// - customer.subscription.updated
// - customer.subscription.deleted
```

### 3. Verificação de Quota

```javascript
// Antes de enviar mensagem
const canSend = await QuotaService.checkQuota(accountId, 'messages');
if (!canSend) {
  throw new Error('Quota de mensagens excedida');
}

// Após enviar mensagem
await QuotaService.incrementUsage(accountId, 'messages');
```

## Tipos de Quota

| Tipo | Descrição | Período |
|------|-----------|---------|
| `messages` | Mensagens enviadas | Mensal |
| `bots` | Bots ativos | Contínuo |
| `campaigns` | Campanhas em massa | Mensal |
| `contacts` | Contatos armazenados | Contínuo |

## Planos Padrão

```javascript
const defaultPlans = [
  {
    name: 'Free',
    price: 0,
    limits: {
      messages: 100,
      bots: 1,
      campaigns: 0,
      contacts: 100
    }
  },
  {
    name: 'Starter',
    price: 49.90,
    limits: {
      messages: 1000,
      bots: 3,
      campaigns: 5,
      contacts: 500
    }
  },
  {
    name: 'Pro',
    price: 149.90,
    limits: {
      messages: 10000,
      bots: 10,
      campaigns: 50,
      contacts: 5000
    }
  },
  {
    name: 'Enterprise',
    price: 499.90,
    limits: {
      messages: -1, // Ilimitado
      bots: -1,
      campaigns: -1,
      contacts: -1
    }
  }
];
```

## Desenvolvimento Local

### Testar Webhooks

1. Instale o Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Faça login: `stripe login`
3. Encaminhe webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Use a chave de webhook fornecida pelo CLI

### Testar Checkout

1. Use cartões de teste do Stripe:
   - Sucesso: `4242 4242 4242 4242`
   - Falha: `4000 0000 0000 0002`
2. Data de expiração: qualquer data futura
3. CVC: qualquer 3 dígitos

## Troubleshooting

### Webhook não recebido

1. Verifique se o endpoint está acessível publicamente
2. Verifique os logs em Stripe Dashboard > Developers > Webhooks
3. Confirme que `STRIPE_WEBHOOK_SECRET` está correto

### Assinatura não atualizada

1. Verifique logs do servidor para erros no webhook
2. Confirme que o evento está sendo processado
3. Verifique se o `stripe_subscription_id` está correto no banco

### Quota não resetando

1. Verifique se o cron job de reset está rodando
2. Confirme as datas de `period_start` e `period_end`
3. Execute reset manual se necessário

## Referências

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
