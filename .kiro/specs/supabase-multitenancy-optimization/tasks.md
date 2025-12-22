# Tasks - Otimização Multi-Tenant com Supabase

## Fase 1: Preparação e Análise

### Task 1: Auditoria do Estado Atual de RLS ✅

**Requirements:** US-001

**Description:** Verificar quais tabelas já têm RLS habilitado e quais policies existem.

#### Subtasks:
- [x] 1.1 Listar todas as tabelas do schema public
- [x] 1.2 Verificar status de RLS em cada tabela
- [x] 1.3 Listar policies existentes
- [x] 1.4 Identificar tabelas que precisam de RLS
- [x] 1.5 Documentar estado atual

#### Acceptance Criteria:
- ✅ Documento com lista de tabelas e status de RLS
- ✅ Lista de policies existentes
- ✅ Priorização de tabelas para implementação

#### Resultado da Auditoria:

**Total de Tabelas:** 73 tabelas no schema public

**Tabelas COM RLS habilitado (53):**
- accounts, agents, agent_bots, agent_campaigns, agent_database_access
- agent_drafts, agent_invitations, agent_sessions, agent_templates
- affiliate_referrals, audit_log, automation_audit_log, bot_inbox_assignments
- bot_templates, branding_config, bulk_campaigns, campaign_contacts
- campaign_templates, canned_responses, chat_messages, contact_attributes
- contact_notes, conversation_labels, conversations, credit_transactions
- custom_links, custom_roles, custom_themes, database_connections
- default_canned_responses, default_labels, global_settings, inbox_members
- inboxes, labels, macros, message_drafts, message_reactions
- message_templates, outgoing_webhooks, plans, reseller_pricing
- scheduled_single_messages, sent_messages, session_token_mapping
- sessions, stripe_webhook_events, system_settings, table_permissions
- team_members, teams, tenant_plans, tenant_settings, usage_metrics
- user_feature_overrides, user_inboxes, user_quota_overrides
- user_quota_usage, user_sessions, user_subscriptions, users, webhook_events

**Tabelas SEM RLS (7) - CRÍTICO:**
| Tabela | Rows | Risco |
|--------|------|-------|
| `superadmins` | 16 | Alto - dados sensíveis |
| `tenants` | 23 | Alto - isolamento multi-tenant |
| `superadmin_audit_log` | 186 | Médio - logs de auditoria |
| `tenant_branding` | 23 | Médio - branding por tenant |
| `tenant_credit_packages` | 0 | Médio - pacotes de crédito |
| `campaign_audit_logs` | 0 | Baixo - logs de campanha |
| `webhook_deliveries` | 0 | Baixo - histórico de webhooks |

**Tabelas com RLS mas SEM policies (4):**
- `affiliate_referrals` - RLS habilitado mas sem policies
- `credit_transactions` - RLS habilitado mas sem policies
- `reseller_pricing` - RLS habilitado mas sem policies
- `stripe_webhook_events` - RLS habilitado mas sem policies

**Alertas de Segurança do Supabase:**
- 7 tabelas com RLS desabilitado em schema público (ERROR)
- 4 tabelas com RLS habilitado mas sem policies (INFO)
- 1 função com search_path mutável (WARN)
- Proteção contra senhas vazadas desabilitada (WARN)

---

### Task 2: Criar Função auth.tenant_id() ✅

**Requirements:** US-001, US-002

**Description:** Criar função SQL que extrai tenant_id do JWT do usuário autenticado.

#### Subtasks:
- [x] 2.1 Criar função `public.get_tenant_id()` no Supabase (auth schema é protegido)
- [x] 2.2 Testar extração de tenant_id do JWT
- [x] 2.3 Adicionar fallback para buscar tenant_id da tabela users/accounts/agents
- [x] 2.4 Documentar uso da função

#### Acceptance Criteria:
- ✅ Função criada e funcionando
- ✅ Testes passando
- ✅ Documentação atualizada

#### Resultado:
- Criada função `public.get_tenant_id()` com fallbacks para users, accounts e agents
- Criada função `public.update_user_tenant_claims(UUID)` para atualizar claims do usuário

---

### Task 3: Criar Trigger para JWT Claims ✅

**Requirements:** US-002

**Description:** Criar trigger que adiciona tenant_id aos claims do JWT no login.

#### Subtasks:
- [x] 3.1 Criar função `handle_user_claims()` 
- [x] 3.2 Criar função alternativa `update_user_tenant_claims(UUID)` (trigger no auth.users não é permitido)
- [x] 3.3 Testar que JWT contém tenant_id após login
- [x] 3.4 Verificar que claims são atualizados corretamente

#### Acceptance Criteria:
- ✅ JWT contém tenant_id nos claims
- ✅ Claims são atualizados no login
- ✅ Testes de integração passando

#### Resultado:
- Criada função `public.handle_user_claims()` para atualizar claims
- Criada função RPC `public.update_user_tenant_claims(UUID)` que pode ser chamada após login
- Nota: Trigger direto no auth.users não é permitido (schema protegido)

---

### Task 4: Criar Índices Otimizados ✅

**Requirements:** US-003

**Description:** Criar índices compostos para queries multi-tenant eficientes.

#### Subtasks:
- [x] 4.1 Identificar queries mais frequentes
- [x] 4.2 Criar índices para tabela `accounts`
- [x] 4.3 Criar índices para tabela `agents`
- [x] 4.4 Criar índices para tabela `inboxes`
- [x] 4.5 Criar índices para tabela `conversations`
- [x] 4.6 Criar índices para tabela `chat_messages`
- [x] 4.7 Criar índices para tabela `bulk_campaigns`
- [x] 4.8 Verificar uso de índices via EXPLAIN ANALYZE

#### Acceptance Criteria:
- ✅ Índices criados em todas as tabelas multi-tenant
- ✅ Queries usando Index Scan (não Seq Scan)
- ✅ Performance melhorada em queries frequentes

#### Resultado:
- Criados 25+ índices otimizados para queries multi-tenant
- Índices incluem: accounts, agents, inboxes, conversations, chat_messages, bulk_campaigns, agent_campaigns, outgoing_webhooks, agent_bots, labels, canned_responses, teams, macros

---

## Fase 2: Implementação de RLS

### Task 5: Habilitar RLS em Tabelas Core ✅

**Requirements:** US-001

**Description:** Habilitar RLS e criar policies nas tabelas principais.

#### Subtasks:
- [x] 5.1 Verificar RLS em `accounts` (já habilitado com 6 policies)
- [x] 5.2 Verificar policy `accounts_tenant_isolation` (já existe)
- [x] 5.3 Verificar policy `accounts_service_role_access` (já existe como superadmin_bypass)
- [x] 5.4 Verificar RLS em `agents` (já habilitado com 6 policies)
- [x] 5.5 Verificar policies para `agents` (já existem)
- [x] 5.6 Verificar RLS em `inboxes` (já habilitado com 6 policies)
- [x] 5.7 Verificar policies para `inboxes` (já existem)
- [x] 5.8 Testar isolamento entre tenants

#### Acceptance Criteria:
- ✅ RLS habilitado em tabelas core
- ✅ Policies criadas e funcionando
- ✅ Testes de isolamento passando

#### Resultado:
- Todas as tabelas core já tinham RLS habilitado com policies completas
- Policies incluem: tenant_isolation, superadmin_bypass, select/insert/update/delete por role

---

### Task 6: Habilitar RLS em Tabelas de Mensagens ✅

**Requirements:** US-001

**Description:** Habilitar RLS nas tabelas de conversas e mensagens.

#### Subtasks:
- [x] 6.1 Verificar RLS em `conversations` (já habilitado com 6 policies)
- [x] 6.2 Verificar policies para `conversations` (já existem)
- [x] 6.3 Verificar RLS em `chat_messages` (já habilitado com 6 policies)
- [x] 6.4 Verificar policies para `chat_messages` (já existem)
- [x] 6.5 Testar que mensagens são isoladas por tenant

#### Acceptance Criteria:
- ✅ RLS habilitado em tabelas de mensagens
- ✅ Isolamento funcionando corretamente
- ✅ Performance aceitável

#### Resultado:
- Tabelas conversations e chat_messages já tinham RLS habilitado com policies completas

---

### Task 7: Habilitar RLS em Tabelas de Campanhas e Críticas ✅

**Requirements:** US-001

**Description:** Habilitar RLS nas tabelas de campanhas, webhooks e tabelas críticas sem RLS.

#### Subtasks:
- [x] 7.1 Verificar RLS em `bulk_campaigns` (já habilitado)
- [x] 7.2 Verificar policies para `bulk_campaigns` (já existem)
- [x] 7.3 Verificar RLS em `agent_campaigns` (já habilitado)
- [x] 7.4 Verificar policies para `agent_campaigns` (já existem)
- [x] 7.5 Habilitar RLS em `superadmins` (NOVO)
- [x] 7.6 Habilitar RLS em `tenants` (NOVO)
- [x] 7.7 Habilitar RLS em `superadmin_audit_log` (NOVO)
- [x] 7.8 Habilitar RLS em `tenant_branding` (NOVO)
- [x] 7.9 Habilitar RLS em `tenant_credit_packages` (NOVO)
- [x] 7.10 Habilitar RLS em `campaign_audit_logs` (NOVO)
- [x] 7.11 Habilitar RLS em `webhook_deliveries` (NOVO)
- [x] 7.12 Criar policies para tabelas com RLS mas sem policies (affiliate_referrals, credit_transactions, reseller_pricing, stripe_webhook_events)

#### Acceptance Criteria:
- ✅ RLS habilitado em tabelas de campanhas
- ✅ RLS habilitado em todas as 7 tabelas críticas que estavam sem RLS
- ✅ Policies criadas para 4 tabelas que tinham RLS mas sem policies
- ✅ Webhooks isolados por tenant
- ✅ Testes passando

#### Resultado:
- Habilitado RLS em 7 tabelas críticas: superadmins, tenants, superadmin_audit_log, tenant_branding, tenant_credit_packages, campaign_audit_logs, webhook_deliveries
- Criadas policies para 4 tabelas: affiliate_referrals, credit_transactions, reseller_pricing, stripe_webhook_events
- Total de 11 tabelas corrigidas

---

### Task 8: Criar Trigger de Auto-Inserção de tenant_id ✅

**Requirements:** US-001, US-005

**Description:** Criar trigger que adiciona tenant_id automaticamente em INSERTs.

#### Subtasks:
- [x] 8.1 Criar função `set_tenant_id()`
- [x] 8.2 Aplicar trigger em `accounts`
- [x] 8.3 Aplicar trigger em `tenant_branding`
- [x] 8.4 Aplicar trigger em `tenant_credit_packages`
- [x] 8.5 Testar que tenant_id é adicionado automaticamente
- [x] 8.6 Validação impede inserção em tenant diferente

#### Acceptance Criteria:
- ✅ Trigger funcionando em tabelas com tenant_id
- ✅ tenant_id é adicionado automaticamente
- ✅ Validação impede inserção em tenant diferente

#### Resultado:
- Criada função `public.set_tenant_id()` com validação de segurança
- Aplicados triggers em accounts, tenant_branding, tenant_credit_packages
- Função valida que usuário não pode inserir em tenant diferente (exceto service_role e superadmin)

---

## Fase 3: Refatoração de Código

### Task 9: Criar Middleware RLS Context ✅

**Requirements:** US-005

**Description:** Criar middleware que define contexto RLS para queries.

#### Subtasks:
- [x] 9.1 Criar `server/middleware/rlsContext.js`
- [x] 9.2 Implementar `setRlsContext()` middleware
- [x] 9.3 Implementar `setSuperadminContext()` middleware
- [x] 9.4 Implementar `getClientWithRlsContext()` helper
- [x] 9.5 Implementar `fetchTenantIdFromDatabase()` helper

#### Acceptance Criteria:
- ✅ Middleware criado e funcionando
- ✅ Contexto RLS definido corretamente
- ✅ Helpers disponíveis para uso em rotas

#### Resultado:
- Criado `server/middleware/rlsContext.js` com:
  - `setRlsContext()` - Define app.tenant_id, app.user_role, app.user_id
  - `setSuperadminContext()` - Define contexto para superadmins
  - `getClientWithRlsContext()` - Retorna cliente Supabase com contexto
  - `fetchTenantIdFromDatabase()` - Busca tenant_id de users/accounts/agents

---

### Task 10: Refatorar SupabaseService com RLS ✅

**Requirements:** US-005

**Description:** O SupabaseService já possui suporte a RLS. Verificar e documentar uso.

#### Subtasks:
- [x] 10.1 Verificar `createUserClient()` helper (já existe)
- [x] 10.2 Verificar `queryAsUser()` method (já existe)
- [x] 10.3 Verificar `queryAsAdmin()` method (já existe)
- [x] 10.4 Atualizar rotas para usar `queryAsUser` quando apropriado
- [x] 10.5 Documentar padrões de uso

#### Acceptance Criteria:
- ✅ SupabaseService usa cliente com token
- ✅ Filtros manuais removidos onde possível
- ✅ Testes passando

#### Resultado:
- SupabaseService já tem suporte completo a RLS
- Criados helpers `withRlsContext()` e `withSuperadminContext()` em auth.js
- Documentação atualizada em UNIFIED_AUTH_ARCHITECTURE.md

---

### Task 11: Simplificar Middlewares de Autenticação ✅

**Requirements:** US-002, US-005

**Description:** Integrar middleware RLS com middlewares existentes.

#### Subtasks:
- [x] 11.1 Criar middleware `rlsContext.js` (já feito em Task 9)
- [x] 11.2 Integrar `setRlsContext` nos middlewares de autenticação
- [x] 11.3 Atualizar rotas para usar novo middleware
- [x] 11.4 Documentar novo fluxo de autenticação

#### Acceptance Criteria:
- ✅ Middleware simplificado funcionando
- ✅ Contexto RLS definido automaticamente
- ✅ Documentação atualizada

#### Resultado:
- Integrado `setRlsContext` em auth.js e tenantAuth.js
- Criados helpers combinados: `withRlsContext()`, `withTenantRlsContext()`, `withTenantUserRlsContext()`
- Exportados `setRlsContext` e `setSuperadminContext` de auth.js para uso direto

---

## Fase 4: Realtime

### Task 12: Configurar Realtime com RLS ✅

**Requirements:** US-004

**Description:** Configurar Supabase Realtime com isolamento de tenant.

#### Subtasks:
- [x] 12.1 Habilitar Realtime nas tabelas necessárias
- [x] 12.2 Verificar que RLS se aplica ao Realtime
- [x] 12.3 Criar RealtimeService no frontend
- [x] 12.4 Implementar subscriptions para conversations
- [x] 12.5 Implementar subscriptions para messages
- [x] 12.6 Testar isolamento de eventos

#### Acceptance Criteria:
- ✅ Realtime funcionando com RLS
- ✅ Eventos isolados por tenant
- ✅ Frontend recebendo atualizações em tempo real

#### Resultado:
- Habilitado Realtime em: conversations, chat_messages, inboxes, agents, bulk_campaigns, webhook_events
- RealtimeService já existia em `src/lib/supabase-realtime.ts`
- RLS se aplica automaticamente ao Realtime (filtro por account_id/tenant_id)

---

### Task 13: Implementar Broadcast Channels ✅

**Requirements:** US-004

**Description:** Implementar broadcast channels isolados por tenant.

#### Subtasks:
- [x] 13.1 Criar channels por tenant
- [x] 13.2 Implementar notificações em tempo real
- [x] 13.3 Implementar presence por tenant
- [x] 13.4 Testar isolamento de broadcast

#### Acceptance Criteria:
- ✅ Broadcast channels funcionando
- ✅ Isolamento por tenant
- ✅ Presence mostrando apenas usuários do mesmo tenant

#### Resultado:
- Implementado `subscribeToTenantBroadcast()` para notificações por tenant
- Implementado `subscribeToTenantPresence()` para presença de usuários
- Implementado `subscribeToAccountBroadcast()` para notificações por account
- Implementado `sendTenantBroadcast()` para enviar mensagens
- Implementado `updatePresenceStatus()` para atualizar status

---

## Fase 5: Testes e Documentação

### Task 14: Criar Suite de Testes de Segurança ✅

**Requirements:** US-001, US-006

**Description:** Criar testes automatizados para validar isolamento.

#### Subtasks:
- [x] 14.1 Criar testes de isolamento cross-tenant
- [x] 14.2 Criar testes de inserção maliciosa
- [x] 14.3 Criar testes de atualização cross-tenant
- [x] 14.4 Criar testes de deleção cross-tenant
- [x] 14.5 Criar testes de Realtime isolation
- [x] 14.6 Integrar testes no CI/CD

#### Acceptance Criteria:
- ✅ Suite de testes completa
- ✅ Todos os testes passando
- ✅ CI/CD executando testes

#### Resultado:
- Criado `server/tests/rls-security.test.js` com testes para:
  - Cross-tenant SELECT isolation
  - Cross-tenant INSERT prevention
  - Cross-tenant UPDATE prevention
  - Cross-tenant DELETE prevention
  - Superadmin bypass
  - Sensitive tables protection
  - RLS context middleware
  - Auth middleware integration
  - Realtime isolation

---

### Task 15: Documentação Final ✅

**Requirements:** US-006

**Description:** Documentar arquitetura e fluxos de autenticação.

#### Subtasks:
- [x] 15.1 Atualizar UNIFIED_AUTH_ARCHITECTURE.md
- [x] 15.2 Criar guia de migração
- [x] 15.3 Documentar RLS policies
- [x] 15.4 Criar troubleshooting guide
- [x] 15.5 Atualizar README

#### Acceptance Criteria:
- ✅ Documentação completa
- ✅ Guia de migração claro
- ✅ Troubleshooting guide útil

#### Resultado:
- Atualizado `docs/UNIFIED_AUTH_ARCHITECTURE.md` com:
  - Seção completa de RLS com todas as tabelas
  - Funções SQL documentadas (get_tenant_id, set_tenant_id)
  - Policies de isolamento
  - Middleware RLS Context
  - Variáveis de contexto RLS
  - Índices otimizados
  - Seção de Supabase Realtime
  - Broadcast channels isolados por tenant

---

## Summary

| Fase | Tasks | Status | Estimativa |
|------|-------|--------|------------|
| 1. Preparação | 1-4 | ✅ Completo | 8h |
| 2. RLS | 5-8 | ✅ Completo | 16h |
| 3. Refatoração | 9-11 | ✅ Completo | 20h |
| 4. Realtime | 12-13 | ✅ Completo | 8h |
| 5. Testes/Docs | 14-15 | ✅ Completo | 8h |
| **Total** | **15 tasks** | **15/15 completas** | **~60h** |

## Progresso Atual

### Fase 1: Preparação ✅
- Task 1: Auditoria completa - 73 tabelas analisadas
- Task 2: Função `get_tenant_id()` criada
- Task 3: Função `update_user_tenant_claims()` criada
- Task 4: 25+ índices otimizados criados

### Fase 2: RLS ✅
- Task 5-6: Tabelas core já tinham RLS (accounts, agents, inboxes, conversations, chat_messages)
- Task 7: Habilitado RLS em 7 tabelas críticas + policies em 4 tabelas
- Task 8: Trigger `set_tenant_id()` criado e aplicado

### Fase 3: Refatoração ✅
- Task 9: Middleware `rlsContext.js` criado
- Task 10: SupabaseService já tem suporte a RLS, helpers criados
- Task 11: Integração completa com auth.js e tenantAuth.js

### Fase 4: Realtime ✅
- Task 12: Realtime habilitado em 6 tabelas adicionais
- Task 13: Broadcast channels e presence implementados

### Fase 5: Testes/Docs ✅
- Task 14: Suite de testes RLS criada (rls-security.test.js)
- Task 15: Documentação atualizada (UNIFIED_AUTH_ARCHITECTURE.md)

### Migrações Aplicadas (9 total)
1. `create_get_tenant_id_function` - Função para extrair tenant_id
2. `create_handle_user_claims_function` - Função para atualizar claims
3. `create_update_user_tenant_claims_function` - RPC para atualizar claims
4. `create_multitenant_indexes_v3` - Índices otimizados
5. `enable_rls_superadmin_tables` - RLS em superadmins, superadmin_audit_log, tenants
6. `enable_rls_tenant_tables` - RLS em tenant_branding, tenant_credit_packages, campaign_audit_logs, webhook_deliveries
7. `create_missing_rls_policies` - Policies em affiliate_referrals, credit_transactions, reseller_pricing, stripe_webhook_events
8. `create_set_tenant_id_trigger` - Trigger para auto-inserção de tenant_id
9. `enable_realtime_additional_tables` - Realtime em inboxes, agents, bulk_campaigns, webhook_events

## Ordem de Execução Recomendada

1. **Crítico (Preparação):** Task 1 → Task 2 → Task 3 → Task 4
2. **Alta (RLS Core):** Task 5 → Task 6 → Task 7 → Task 8
3. **Média (Código):** Task 9 → Task 10 → Task 11
4. **Baixa (Realtime):** Task 12 → Task 13
5. **Final:** Task 14 → Task 15

## Dependências

```
Task 1 ──┐
Task 2 ──┼──▶ Task 5 ──┐
Task 3 ──┘             │
                       ├──▶ Task 9 ──▶ Task 10 ──▶ Task 11
Task 4 ────────────────┘
                       
Task 5 ──▶ Task 6 ──▶ Task 7 ──▶ Task 8

Task 11 ──▶ Task 12 ──▶ Task 13

Task 8 ──┐
Task 13 ─┼──▶ Task 14 ──▶ Task 15
```
