# Auditoria: Inboxes e Mensagens

## Data: 2025-12-22

## Resumo Executivo

A estrutura de inboxes e mensagens está **corretamente configurada** com isolamento por account:
- ✅ Inboxes vinculadas a accounts com tenant_id
- ✅ Conversations vinculadas a accounts e inboxes
- ✅ Sistema de quotas implementado (mas não sendo usado)
- ⚠️ **0 registros** em `user_inboxes` (usuários independentes)
- ⚠️ **0 registros** em `user_quota_usage` (quotas não incrementadas)

---

## Estrutura de Dados

### Hierarquia de Inboxes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HIERARQUIA DE INBOXES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TENANT                                                                     │
│  └── ACCOUNT (cliente do tenant)                                            │
│       ├── INBOXES (conexões WhatsApp)                                       │
│       │    ├── wuzapi_token (token para WUZAPI)                             │
│       │    ├── phone_number (número do WhatsApp)                            │
│       │    └── settings (configurações)                                     │
│       │                                                                     │
│       ├── INBOX_MEMBERS (agents com acesso)                                 │
│       │    └── agent_id → agents                                            │
│       │                                                                     │
│       └── CONVERSATIONS (conversas)                                         │
│            ├── inbox_id → inboxes                                           │
│            ├── contact_jid (JID do contato)                                 │
│            └── CHAT_MESSAGES (mensagens)                                    │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  USUÁRIOS INDEPENDENTES (Fluxo Alternativo)                                 │
│  └── USER_INBOXES (vincula users a inboxes)                                 │
│       ├── user_id → users                                                   │
│       ├── inbox_id → inboxes                                                │
│       └── is_primary (inbox principal)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tabelas Envolvidas

| Tabela | Campos Chave | Descrição |
|--------|--------------|-----------|
| `inboxes` | `id`, `account_id`, `wuzapi_token` | Conexões WhatsApp |
| `inbox_members` | `inbox_id`, `agent_id` | Agents com acesso à inbox |
| `conversations` | `id`, `account_id`, `inbox_id` | Conversas com contatos |
| `chat_messages` | `id`, `conversation_id` | Mensagens das conversas |
| `user_inboxes` | `user_id`, `inbox_id` | Acesso de users independentes |
| `user_quota_usage` | `account_id`, `quota_key` | Uso de quotas |

---

## Estado Atual dos Dados

### Inboxes

| Inbox | Account | Tenant | WUZAPI Token | Status |
|-------|---------|--------|--------------|--------|
| WhatsApp HeltonFraga | Account for User 9815d... | cortexx | ✅ Sim | active |
| WhatsApp HeltonFraga | Account - 6b2d14f8 | default | ✅ Sim | active |
| WhatsApp Usuário | Account - Usuário | default | ✅ Sim | active |

**Total:** 3 inboxes, todas com `wuzapi_token` configurado

### Conversations

```sql
SELECT COUNT(*) FROM conversations;
-- Resultado: Múltiplas conversas (amostra de 10 mostrada)
```

Todas as conversas verificadas têm:
- ✅ `account_id` válido
- ✅ `inbox_id` válido
- ✅ `tenant_id` via account

### Chat Messages

```
Total de mensagens: 3
Conversas únicas: 2
Período: 2025-12-20 17:56 a 2025-12-20 22:01
```

### Inbox Members

| Inbox | Agent | Email |
|-------|-------|-------|
| WhatsApp HeltonFraga | d3d86cb5-... | agente@teste.com |

**Total:** 1 agent vinculado a 1 inbox

### User Inboxes (Usuários Independentes)

```sql
SELECT COUNT(*) FROM user_inboxes;
-- Resultado: 0
```

**Observação:** Tabela `user_inboxes` está vazia. Usuários independentes ainda não estão utilizando o sistema.

### Quota Usage

```sql
SELECT COUNT(*) FROM user_quota_usage;
-- Resultado: 0
```

**Problema:** Quotas não estão sendo incrementadas ao enviar mensagens.

---

## Análise de Código

### Fluxo de Envio de Mensagem

```
┌─────────┐     POST /api/bot/send     ┌─────────────────┐
│ Cliente │ ─────────────────────────▶│ botProxyRoutes  │
└─────────┘                           └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ quotaMiddleware │
                                      │ .messages       │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ QuotaService    │
                                      │ .checkQuota()   │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ wuzapiClient    │
                                      │ .sendMessage()  │
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ incrementQuota  │
                                      │ Usage()         │
                                      └─────────────────┘
```

### Middleware de Quota

O middleware `quotaEnforcement.js` está implementado corretamente:

1. **`enforceQuota(quotaType)`** - Verifica se quota permite operação
2. **`incrementQuotaUsage()`** - Incrementa uso após sucesso
3. **`quotaMiddleware.messages`** - Pré-configurado para mensagens

### Problema: Quotas Não Incrementadas

O `incrementQuotaUsage()` é chamado após a resposta, mas:
- Depende de `req.quotaInfo` estar definido
- Depende de `res.statusCode` estar entre 200-299
- Pode não estar sendo chamado em todos os fluxos

**Verificação necessária:** Confirmar se `incrementQuotaUsage()` está sendo chamado após envio de mensagens.

---

## Verificações Realizadas

### 9.1 Inboxes têm account_id correto ✅

```sql
SELECT COUNT(*) FROM inboxes WHERE account_id IS NULL;
-- Resultado: 0
```

Todas as inboxes têm `account_id` válido.

### 9.2 Conversations têm account_id correto ✅

```sql
SELECT COUNT(*) FROM conversations WHERE account_id IS NULL;
-- Resultado: 0
```

Todas as conversations têm `account_id` válido.

### 9.3 user_inboxes está sendo usado ⚠️

```sql
SELECT COUNT(*) FROM user_inboxes;
-- Resultado: 0
```

Tabela vazia - usuários independentes não estão utilizando o sistema.

### 9.4 Incremento de quotas ao enviar mensagem ⚠️

```sql
SELECT COUNT(*) FROM user_quota_usage;
-- Resultado: 0
```

Quotas não estão sendo incrementadas. Possíveis causas:
- `incrementQuotaUsage()` não está sendo chamado
- Fluxo de mensagens não passa pelo middleware de quota
- QuotaService não está inicializado

### 9.5 inboxes.wuzapi_token é usado para WUZAPI ✅

Todas as 3 inboxes têm `wuzapi_token` configurado.

### 9.6 Acesso de usuário independente a inbox ⚠️

Não há dados para testar - `user_inboxes` está vazia.

---

## Problemas Identificados

### Problema 1: Quotas Não Sendo Incrementadas

**Sintoma:** `user_quota_usage` tem 0 registros apesar de mensagens terem sido enviadas.

**Possíveis Causas:**
1. `incrementQuotaUsage()` não está sendo chamado após envio
2. QuotaService não está inicializado (`app.locals.db` não definido)
3. Fluxo de mensagens não passa pelo middleware de quota

**Impacto:**
- Usuários podem exceder quotas sem bloqueio
- Relatórios de uso incorretos
- Billing incorreto

**Solução:**
1. Verificar se `incrementQuotaUsage()` está sendo chamado
2. Adicionar logs para debug
3. Garantir que `app.locals.db` está definido

### Problema 2: user_inboxes Não Utilizado

**Sintoma:** Tabela `user_inboxes` está vazia.

**Causa:** Fluxo de usuários independentes não está implementado ou não está sendo usado.

**Impacto:**
- Usuários independentes não podem acessar inboxes
- Funcionalidade de multi-user por inbox não disponível

**Solução:**
1. Implementar fluxo de vinculação user → inbox
2. Criar UI para admin vincular users a inboxes
3. Atualizar middleware para verificar `user_inboxes`

### Problema 3: Falta de Isolamento por Tenant em Queries

**Observação:** Algumas queries não filtram por `tenant_id`, dependendo apenas de `account_id`.

**Risco:** Se um usuário conseguir manipular `account_id`, pode acessar dados de outro tenant.

**Solução:**
1. Sempre incluir `tenant_id` em queries
2. Usar RLS para garantir isolamento
3. Validar `tenant_id` no middleware

---

## Recomendações

### 1. Corrigir Incremento de Quotas (Prioridade Alta)

```javascript
// Verificar se incrementQuotaUsage está sendo chamado
router.post('/send', 
  quotaMiddleware.messages,
  async (req, res) => {
    try {
      // ... enviar mensagem
      res.json({ success: true });
      
      // Chamar após resposta
      await incrementQuotaUsage(req, res);
    } catch (error) {
      // ...
    }
  }
);
```

### 2. Implementar Fluxo de user_inboxes (Prioridade Média)

```javascript
// Vincular user a inbox
async function linkUserToInbox(userId, inboxId, isPrimary = false) {
  await SupabaseService.adminClient
    .from('user_inboxes')
    .insert({
      user_id: userId,
      inbox_id: inboxId,
      is_primary: isPrimary
    });
}
```

### 3. Adicionar Validação de Tenant (Prioridade Alta)

```javascript
// Middleware para validar tenant
function validateTenantAccess(req, res, next) {
  const userTenantId = req.user?.tenant_id;
  const resourceTenantId = req.resource?.tenant_id;
  
  if (userTenantId !== resourceTenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
}
```

---

## Checklist de Verificação

- [x] Inboxes têm account_id correto
- [x] Conversations têm account_id correto
- [x] Inboxes têm wuzapi_token configurado
- [x] inbox_members vincula agents a inboxes
- [ ] user_inboxes está sendo utilizado
- [ ] Quotas estão sendo incrementadas
- [ ] Isolamento por tenant validado em todas as queries

---

## Próximos Passos

1. [ ] Investigar por que quotas não estão sendo incrementadas
2. [ ] Adicionar logs de debug no fluxo de envio de mensagens
3. [ ] Implementar fluxo de user_inboxes
4. [ ] Adicionar validação de tenant_id em queries críticas
5. [ ] Criar testes de isolamento multi-tenant para inboxes
