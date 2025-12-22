# Resumo da Auditoria do Sistema de Autenticação Unificado

## Data: 2025-12-22

## Visão Geral

Esta auditoria foi realizada para verificar a consistência do sistema de autenticação após a migração de WUZAPI token-based auth para Supabase Auth, em uma arquitetura multi-tenant.

## Documentos de Auditoria

| # | Documento | Status | Problemas |
|---|-----------|--------|-----------|
| 1 | [SuperAdmin Auth](01-superadmin-auth-audit.md) | ✅ Completo | Nenhum crítico |
| 2 | [Endpoint Auth](02-endpoint-auth-audit.md) | ✅ Completo | Inconsistências identificadas |
| 3 | [Plans vs Tenant Plans](03-plans-vs-tenant-plans-audit.md) | ✅ Completo | Decisão: manter ambas |
| 4 | [User-Account](04-user-account-audit.md) | ✅ Completo | 8 accounts órfãs |
| 5 | [Stripe Integration](05-stripe-integration-audit.md) | ✅ Completo | Não utilizado ativamente |
| 6 | [Inboxes & Messages](06-inboxes-messages-audit.md) | ✅ Completo | Quotas não incrementadas |
| 7 | [Legacy Code](07-legacy-code-audit.md) | ✅ Completo | Middlewares duplicados |

## Principais Descobertas

### ✅ Funcionando Corretamente

1. **Hierarquia Multi-Tenant**
   - SuperAdmin → Tenant → Account → Agent/User
   - Isolamento por tenant_id implementado

2. **RLS Habilitado**
   - `users`, `user_sessions`, `user_inboxes`
   - `tenant_settings`, `tenant_plans`
   - Policies de isolamento criadas

3. **Sistema de Subscriptions**
   - `user_subscriptions.plan_id` → `tenant_plans.id` (correto)
   - QuotaService usa `tenant_plans` corretamente

4. **Inboxes e Conversations**
   - Todas vinculadas a accounts com tenant_id
   - WUZAPI tokens configurados

### ⚠️ Problemas Identificados

1. **Dados Inconsistentes**
   - 8 accounts sem `tenant_id` (órfãs)
   - 11 accounts sem subscription
   - SubscriptionEnsurer usa `plans` global

2. **Stripe Não Utilizado**
   - 0 subscriptions com `stripe_subscription_id`
   - 0 eventos em `stripe_webhook_events`
   - Webhook secret não configurado
   - Nenhum tenant com Stripe Connect

3. **Quotas Não Incrementadas**
   - 0 registros em `user_quota_usage`
   - `incrementQuotaUsage()` pode não estar sendo chamado

4. **Código Legado**
   - `verifyUserToken.js` marcado como legado
   - `requireAdmin` duplicado em dois arquivos
   - Múltiplas formas de resolver userId

5. **Usuários Independentes**
   - 0 registros em `user_inboxes`
   - Fluxo não implementado/utilizado

## Ações Recomendadas

### Prioridade Alta

1. **Corrigir Accounts Órfãs**
   ```sql
   UPDATE accounts 
   SET tenant_id = '00000000-0000-0000-0000-000000000001'
   WHERE tenant_id IS NULL;
   ```

2. **Criar Subscriptions Faltantes**
   - Executar script para criar subscriptions
   - Usar plano default do tenant

3. **Corrigir SubscriptionEnsurer**
   - Modificar para usar `tenant_plans` ao invés de `plans`

4. **Configurar Stripe Webhook**
   - Criar endpoint no Stripe Dashboard
   - Salvar webhook secret em `global_settings`

### Prioridade Média

5. **Investigar Quotas**
   - Verificar se `incrementQuotaUsage()` está sendo chamado
   - Adicionar logs de debug

6. **Consolidar Middlewares**
   - Renomear `supabaseAuth.requireAdmin`
   - Deprecar `verifyUserToken.js`

7. **Implementar user_inboxes**
   - Criar fluxo de vinculação user → inbox
   - Atualizar middleware para verificar acesso

### Prioridade Baixa

8. **Limpeza de Código**
   - Remover código duplicado
   - Executar linter
   - Atualizar imports

## Métricas do Sistema

| Entidade | Quantidade | Status |
|----------|------------|--------|
| SuperAdmins | 5 | ✅ OK |
| Tenants | 3 | ✅ OK |
| Accounts | 20 | ⚠️ 8 órfãs |
| Agents | 13 | ✅ OK |
| Users | 0 | ⚠️ Não utilizado |
| Subscriptions | 9 | ⚠️ 11 faltando |
| Inboxes | 3 | ✅ OK |
| Conversations | Múltiplas | ✅ OK |

## Arquivos Criados/Modificados

### Documentação
- `docs/audit/01-superadmin-auth-audit.md`
- `docs/audit/02-endpoint-auth-audit.md`
- `docs/audit/03-plans-vs-tenant-plans-audit.md`
- `docs/audit/04-user-account-audit.md`
- `docs/audit/05-stripe-integration-audit.md`
- `docs/audit/06-inboxes-messages-audit.md`
- `docs/audit/07-legacy-code-audit.md`
- `docs/UNIFIED_AUTH_ARCHITECTURE.md`

### Código
- `server/utils/userIdHelper.js` - Helper de conversão de IDs
- `server/utils/userIdHelper.test.js` - Testes do helper
- `server/tests/unified-auth-audit.test.js` - Testes de autenticação

### Migrations (RLS)
- `enable_rls_users`
- `enable_rls_user_sessions`
- `enable_rls_user_inboxes`
- `enable_rls_tenant_settings`
- `enable_rls_tenant_plans`

## Conclusão

O sistema de autenticação está **funcionalmente correto** mas possui **inconsistências de dados** que precisam ser corrigidas. As principais áreas de atenção são:

1. **Dados órfãos** - Accounts sem tenant_id e subscriptions
2. **Stripe** - Configurado mas não utilizado
3. **Quotas** - Não estão sendo incrementadas
4. **Código legado** - Precisa de consolidação

Recomenda-se executar as ações de prioridade alta antes de colocar o sistema em produção.
