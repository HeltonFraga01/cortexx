# Requirements Document

## Introduction

Este documento especifica os requisitos para uma auditoria e correção completa do sistema de autenticação unificado após a migração para Supabase. O sistema possui uma arquitetura multi-tenant com a seguinte hierarquia:

**SuperAdmin → Tenants (Admins) → Accounts → Agents/Users**

Cada Tenant opera como um sistema independente com:
- Subdomain próprio (ex: `acmecorp.wasendgo.com`)
- Branding personalizado
- Planos próprios (`tenant_plans`)
- Sistema de pagamento independente (Stripe Connect)

O sistema suporta múltiplos métodos de autenticação:
1. **SuperAdmin Auth** - Para administradores da plataforma
2. **Supabase Auth (JWT)** - Para usuários modernos
3. **Sessão tradicional (WUZAPI Token)** - Para compatibilidade legada
4. **Usuários independentes** - Tabela `users` para usuários sem WUZAPI

A auditoria visa identificar inconsistências, código legado, e problemas de integração entre os diferentes sistemas de autenticação, pagamentos, quotas e recursos.

## Glossary

- **SuperAdmin**: Administrador da plataforma. Cria e gerencia Tenants. Acesso via `/superadmin/*`.
- **Tenant**: Organização independente (Admin). Possui subdomain, branding, planos e Stripe Connect próprios.
- **Account**: Cliente de um Tenant. Agrupa recursos (inboxes, agents, conversations). Vinculada a um `owner_user_id`.
- **Agent**: Usuário operador dentro de uma account (pode ser owner, administrator, agent, viewer).
- **User**: Usuário independente na tabela `users` que não requer token WUZAPI.
- **Tenant_Plan**: Plano específico de um tenant com quotas e features.
- **Subscription**: Assinatura de um plano vinculada a uma account via `user_subscriptions`.
- **WUZAPI_Token**: Token de autenticação legado usado para integração com WhatsApp API.
- **JWT**: JSON Web Token emitido pelo Supabase Auth.
- **Session**: Sessão HTTP tradicional armazenada no servidor.
- **RLS**: Row Level Security do PostgreSQL para isolamento de dados.
- **Stripe_Connect**: Conta Stripe do Tenant para receber pagamentos de seus clientes (Accounts).

## Requirements

### Requirement 1: Auditoria de Autenticação SuperAdmin

**User Story:** Como SuperAdmin, quero garantir que meu acesso à plataforma esteja seguro e isolado dos Tenants, para que eu possa gerenciar a plataforma sem riscos.

#### Acceptance Criteria

1. WHEN um SuperAdmin faz login via `/api/superadmin/login`, THE System SHALL validar credenciais na tabela `superadmins`
2. WHEN um SuperAdmin está autenticado, THE System SHALL permitir acesso apenas a rotas `/superadmin/*`
3. THE System SHALL garantir que SuperAdmins não possam acessar dados de Accounts diretamente
4. WHEN um SuperAdmin cria um Tenant, THE System SHALL registrar `owner_superadmin_id` corretamente
5. THE System SHALL registrar todas as ações de SuperAdmin em `superadmin_audit_log`

### Requirement 2: Auditoria de Consistência de Autenticação de Tenant

**User Story:** Como desenvolvedor, quero identificar todas as inconsistências no sistema de autenticação, para que eu possa garantir que todos os fluxos de login funcionem corretamente.

#### Acceptance Criteria

1. WHEN o sistema recebe uma requisição com JWT válido, THE Auth_Middleware SHALL extrair corretamente o `user_id`, `role` e `tenant_id` do token
2. WHEN o sistema recebe uma requisição com sessão válida, THE Auth_Middleware SHALL validar que `userId`, `role` e `userToken` estão presentes na sessão
3. WHEN um usuário faz login via `/api/auth/login` com token WUZAPI, THE System SHALL criar uma sessão com `userId` derivado do hash do token
4. WHEN um usuário faz login via `/api/auth/admin-login` com email/senha, THE System SHALL criar uma sessão com `userId` do agent e `role` como 'admin'
5. WHEN um usuário faz login via `/api/auth/user-login` com email/senha, THE System SHALL criar uma sessão na tabela `user_sessions` e retornar um token de sessão
6. IF uma sessão existe mas está corrompida (faltando `userId` ou `role`), THEN THE System SHALL destruir a sessão e retornar erro 401

### Requirement 3: Auditoria de Vinculação User-Account

**User Story:** Como desenvolvedor, quero garantir que a vinculação entre usuários e accounts esteja consistente, para que recursos sejam corretamente atribuídos.

#### Acceptance Criteria

1. WHEN um usuário autenticado via JWT acessa recursos, THE System SHALL resolver o `account_id` através do `owner_user_id` na tabela `accounts`
2. WHEN um usuário autenticado via sessão WUZAPI acessa recursos, THE System SHALL resolver o `account_id` através do `wuzapi_token` na tabela `accounts`
3. WHEN não existe account para um usuário, THE System SHALL criar automaticamente uma account com os dados do usuário
4. THE System SHALL garantir que cada account tenha exatamente um `owner_user_id` válido
5. WHEN um usuário independente (tabela `users`) acessa recursos, THE System SHALL usar a vinculação via `user_inboxes` para determinar acesso

### Requirement 4: Auditoria de Sistema de Planos e Subscriptions

**User Story:** Como desenvolvedor, quero garantir que o sistema de planos e assinaturas funcione corretamente com a nova arquitetura, para que quotas e features sejam aplicadas corretamente.

#### Acceptance Criteria

1. WHEN uma subscription é criada, THE System SHALL vincular ao `account_id` (não ao `user_id` diretamente)
2. WHEN uma subscription é consultada por `userId`, THE System SHALL primeiro resolver o `account_id` via `owner_user_id` ou `wuzapi_token`
3. THE System SHALL garantir que subscriptions referenciem `tenant_plans` (não a tabela `plans` global)
4. WHEN um plano é atribuído, THE System SHALL validar que o plano pertence ao mesmo tenant da account
5. IF uma account não tem subscription, THEN THE System SHALL atribuir automaticamente o plano default do tenant

### Requirement 5: Auditoria de Quotas e Usage

**User Story:** Como desenvolvedor, quero garantir que o sistema de quotas funcione corretamente, para que limites sejam aplicados por account.

#### Acceptance Criteria

1. WHEN quotas são verificadas, THE System SHALL usar o `account_id` como chave principal
2. WHEN usage é incrementado, THE System SHALL registrar na tabela `user_quota_usage` com `account_id`
3. THE System SHALL garantir que quotas sejam lidas do `tenant_plans.quotas` JSONB
4. WHEN um usuário excede quota, THE System SHALL bloquear a ação e retornar erro apropriado
5. THE System SHALL suportar overrides de quota por account via `user_quota_overrides`

### Requirement 6: Auditoria de Isolamento Multi-Tenant

**User Story:** Como desenvolvedor, quero garantir que o isolamento multi-tenant esteja funcionando corretamente, para que dados de um tenant não vazem para outro.

#### Acceptance Criteria

1. WHEN uma requisição é feita em um subdomain, THE System SHALL resolver o `tenant_id` e filtrar dados
2. THE System SHALL garantir que RLS policies estejam ativas em todas as tabelas sensíveis
3. WHEN um usuário tenta acessar dados de outro tenant, THE System SHALL retornar erro 403
4. THE System SHALL validar que `accounts.tenant_id` corresponde ao tenant do subdomain
5. WHEN um JWT contém `tenant_id` diferente do subdomain, THE System SHALL rejeitar a requisição

### Requirement 7: Limpeza de Código Legado

**User Story:** Como desenvolvedor, quero identificar e remover código legado que não é mais necessário, para simplificar a manutenção.

#### Acceptance Criteria

1. THE System SHALL identificar referências a `user_id` que deveriam ser `account_id`
2. THE System SHALL identificar queries que usam `plans` ao invés de `tenant_plans`
3. THE System SHALL identificar middlewares duplicados ou conflitantes de autenticação
4. THE System SHALL identificar rotas que não validam corretamente o tenant context
5. THE System SHALL identificar serviços que misturam lógica de autenticação JWT e sessão

### Requirement 8: Correção de Fluxos de Pagamento

**User Story:** Como desenvolvedor, quero garantir que os fluxos de pagamento Stripe funcionem corretamente com a nova arquitetura, para que assinaturas sejam processadas corretamente.

#### Acceptance Criteria

1. WHEN um checkout é criado, THE System SHALL vincular o `stripe_customer_id` à account
2. WHEN um webhook Stripe é recebido, THE System SHALL resolver a account via `stripe_customer_id`
3. THE System SHALL garantir que `user_subscriptions.stripe_subscription_id` seja atualizado corretamente
4. WHEN uma subscription é cancelada via Stripe, THE System SHALL atualizar o status local
5. THE System SHALL garantir que planos Stripe (`stripe_price_id`) estejam sincronizados com `tenant_plans`

### Requirement 9: Auditoria de Inboxes e Mensagens

**User Story:** Como desenvolvedor, quero garantir que inboxes e mensagens estejam corretamente vinculadas, para que o sistema de chat funcione corretamente.

#### Acceptance Criteria

1. WHEN uma inbox é criada, THE System SHALL vincular ao `account_id` correto
2. WHEN uma mensagem é enviada, THE System SHALL incrementar quotas usando o `owner_user_id` da account
3. THE System SHALL garantir que `conversations.account_id` seja sempre preenchido
4. WHEN um usuário independente acessa inbox, THE System SHALL usar `user_inboxes` para validar acesso
5. THE System SHALL garantir que `inboxes.wuzapi_token` seja usado para autenticação com WUZAPI

### Requirement 10: Documentação e Testes

**User Story:** Como desenvolvedor, quero documentação clara e testes para o sistema de autenticação, para facilitar manutenção futura.

#### Acceptance Criteria

1. THE System SHALL ter documentação clara dos fluxos de autenticação suportados
2. THE System SHALL ter testes unitários para cada middleware de autenticação
3. THE System SHALL ter testes de integração para fluxos de login
4. THE System SHALL ter testes para validar isolamento multi-tenant
5. THE System SHALL ter testes para validar vinculação user-account-subscription
