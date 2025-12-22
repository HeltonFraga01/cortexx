# Configuração de Stripe Webhooks

## Visão Geral

Este documento descreve como configurar os webhooks do Stripe para sincronização automática de subscriptions e pagamentos.

## Pré-requisitos

1. Conta Stripe ativa (test ou live)
2. Acesso ao Stripe Dashboard
3. Acesso de admin ao sistema

## Passo 1: Criar Webhook Endpoint no Stripe Dashboard

1. Acesse [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL:** `https://seu-dominio.com/api/webhooks/stripe`
   - **Description:** WUZAPI Manager Webhooks
   - **Events to send:** Selecione os seguintes eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`

4. Clique em **"Add endpoint"**
5. Copie o **Signing secret** (começa com `whsec_`)

## Passo 2: Configurar Webhook Secret no Sistema

### Opção A: Via Admin Panel (Recomendado)

1. Acesse o painel de administração
2. Vá para **Configurações > Stripe**
3. Preencha o campo **Webhook Secret** com o valor copiado
4. Clique em **Salvar**

### Opção B: Via API

```bash
curl -X POST https://seu-dominio.com/api/admin/stripe/settings \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "secretKey": "sk_test_xxx",
    "publishableKey": "pk_test_xxx",
    "webhookSecret": "whsec_xxx",
    "connectEnabled": true
  }'
```

### Opção C: Diretamente no Banco de Dados

```sql
-- Inserir ou atualizar webhook secret
INSERT INTO global_settings (key, value, created_at, updated_at)
VALUES (
  'stripe_webhook_secret',
  '{"key": "whsec_xxx"}',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
```

## Passo 3: Testar Webhook

### No Stripe Dashboard

1. Vá para o webhook endpoint criado
2. Clique em **"Send test webhook"**
3. Selecione `checkout.session.completed`
4. Clique em **"Send test webhook"**

### Verificar no Sistema

```sql
-- Verificar eventos recebidos
SELECT * FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 10;
```

### Usando Stripe CLI (Desenvolvimento Local)

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Encaminhar webhooks para localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Em outro terminal, disparar evento de teste
stripe trigger checkout.session.completed
```

## Eventos Suportados

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Ativa subscription após pagamento bem-sucedido |
| `customer.subscription.updated` | Sincroniza status da subscription (active, past_due, etc.) |
| `customer.subscription.deleted` | Marca subscription como cancelada |
| `invoice.paid` | Processa compra de créditos |
| `invoice.payment_failed` | Marca subscription como past_due |

## Fluxo de Processamento

```
Stripe → POST /api/webhooks/stripe
         │
         ├── Verifica assinatura (webhook secret)
         │
         ├── Verifica duplicidade (stripe_event_id)
         │
         ├── Processa evento por tipo
         │   ├── checkout.session.completed → Ativa subscription
         │   ├── customer.subscription.* → Sincroniza status
         │   └── invoice.* → Processa pagamento/falha
         │
         └── Registra em stripe_webhook_events
```

## Troubleshooting

### Erro: "Webhook not configured"

O webhook secret não está configurado. Siga o Passo 2.

### Erro: "Invalid signature"

1. Verifique se o webhook secret está correto
2. Certifique-se de que o body da requisição não foi modificado
3. Verifique se está usando o secret correto (test vs live)

### Erro: "Duplicate webhook event ignored"

Isso é normal - o sistema ignora eventos duplicados para evitar processamento duplo.

### Webhook não está sendo recebido

1. Verifique se a URL está acessível publicamente
2. Verifique os logs no Stripe Dashboard > Webhooks > [seu endpoint] > Logs
3. Verifique se o firewall permite requisições do Stripe

### Verificar Logs do Sistema

```bash
# Ver logs do servidor
tail -f logs/combined.log | grep -i stripe

# Ou via Docker
docker logs -f wuzapi-manager 2>&1 | grep -i stripe
```

## Segurança

- **NUNCA** exponha o webhook secret no frontend
- O webhook secret deve ser armazenado de forma segura (criptografado)
- O endpoint `/api/webhooks/stripe` não usa autenticação tradicional - usa verificação de assinatura
- Todos os eventos são logados em `stripe_webhook_events` para auditoria

## Variáveis de Ambiente

Para desenvolvimento local, você pode usar variáveis de ambiente:

```env
# .env ou server/.env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Nota:** Em produção, recomenda-se usar `global_settings` no banco de dados para facilitar rotação de chaves sem restart.

## Referências

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)
