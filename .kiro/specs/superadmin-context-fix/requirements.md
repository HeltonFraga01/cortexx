# Requirements Document

## Introduction

O painel de superadmin ficou não funcional após as mudanças de isolamento multi-tenant. O problema principal é que o middleware `requireSuperadmin` verifica se `req.context.role === 'superadmin'`, mas quando o superadmin acessa via `localhost:8080/superadmin/*` (sem subdomain), o `subdomainRouter` define `req.context.role = 'public'` porque não detecta nenhum subdomain.

Todas as requisições para `/api/superadmin/*` estão retornando 403 (Forbidden) com a mensagem "This resource requires superadmin context."

## Glossary

- **Superadmin**: Administrador da plataforma com acesso a todos os tenants
- **Tenant**: Organização/empresa que usa a plataforma
- **Subdomain_Router**: Middleware que extrai o subdomain da URL e define o contexto do tenant
- **Superadmin_Auth**: Middleware que valida autenticação e permissões de superadmin
- **Session**: Sessão do usuário armazenada em cookie HTTP-only
- **Context**: Objeto `req.context` que contém informações do tenant ou role

## Requirements

### Requirement 1: Contexto de Superadmin Baseado em Sessão

**User Story:** Como superadmin, quero acessar o painel via `localhost:8080/superadmin/*` sem depender de subdomain, para que eu possa gerenciar todos os tenants da plataforma.

#### Acceptance Criteria

1. WHEN um usuário com sessão de superadmin acessa rotas `/api/superadmin/*` THEN THE Superadmin_Auth SHALL definir `req.context.role = 'superadmin'` baseado na sessão
2. WHEN um usuário sem sessão de superadmin acessa rotas `/api/superadmin/*` THEN THE Superadmin_Auth SHALL retornar erro 401 (Unauthorized)
3. WHEN um usuário com sessão de role diferente de superadmin acessa rotas `/api/superadmin/*` THEN THE Superadmin_Auth SHALL retornar erro 403 (Forbidden)
4. THE Superadmin_Auth SHALL priorizar a sessão sobre o contexto de subdomain para rotas de superadmin

### Requirement 2: Dashboard de Superadmin Funcional

**User Story:** Como superadmin, quero visualizar métricas da plataforma no dashboard, para que eu possa monitorar o estado geral do sistema.

#### Acceptance Criteria

1. WHEN o superadmin acessa `/superadmin/dashboard` THEN THE System SHALL carregar métricas de MRR, tenants e contas
2. WHEN a API `/api/superadmin/dashboard` é chamada com sessão válida THEN THE System SHALL retornar dados de métricas
3. IF a requisição falhar THEN THE System SHALL exibir mensagem de erro via toast
4. WHEN o superadmin clica em "Refresh" THEN THE System SHALL recarregar os dados do dashboard

### Requirement 3: Listagem de Tenants Funcional

**User Story:** Como superadmin, quero listar todos os tenants da plataforma, para que eu possa gerenciá-los.

#### Acceptance Criteria

1. WHEN o superadmin acessa `/superadmin/tenants` THEN THE System SHALL carregar a lista de tenants
2. WHEN a API `/api/superadmin/tenants` é chamada com sessão válida THEN THE System SHALL retornar lista de tenants
3. WHEN o superadmin busca por nome ou subdomain THEN THE System SHALL filtrar a lista de tenants
4. WHEN o superadmin filtra por status THEN THE System SHALL mostrar apenas tenants com o status selecionado

### Requirement 4: Criação de Tenant Funcional

**User Story:** Como superadmin, quero criar novos tenants com conta de admin, para que novas organizações possam usar a plataforma.

#### Acceptance Criteria

1. WHEN o superadmin preenche o formulário de criação THEN THE System SHALL validar o subdomain em tempo real
2. WHEN a API `/api/superadmin/tenants/validate-subdomain` é chamada THEN THE System SHALL verificar disponibilidade do subdomain
3. WHEN o superadmin submete o formulário válido THEN THE System SHALL criar o tenant e conta admin
4. IF a criação falhar THEN THE System SHALL exibir mensagem de erro específica
5. WHEN o tenant é criado com sucesso THEN THE System SHALL atualizar a lista de tenants

### Requirement 5: Gerenciamento de Contas de Superadmin

**User Story:** Como superadmin, quero gerenciar outras contas de superadmin, para que eu possa controlar quem tem acesso à plataforma.

#### Acceptance Criteria

1. WHEN o superadmin acessa `/superadmin/settings` THEN THE System SHALL carregar lista de contas de superadmin
2. WHEN a API `/api/superadmin/accounts` é chamada com sessão válida THEN THE System SHALL retornar lista de superadmins
3. WHEN o superadmin adiciona nova conta THEN THE System SHALL criar conta com role superadmin
4. WHEN o superadmin altera sua senha THEN THE System SHALL validar senha atual e atualizar

### Requirement 6: Impersonação de Tenant

**User Story:** Como superadmin, quero impersonar um tenant para acessar seu painel admin, para que eu possa ajudar com suporte e diagnóstico.

#### Acceptance Criteria

1. WHEN o superadmin clica em "Manage" em um tenant THEN THE System SHALL iniciar sessão de impersonação
2. WHEN a API `/api/superadmin/impersonate/:tenantId` é chamada THEN THE System SHALL criar token de impersonação
3. WHEN a impersonação é iniciada THEN THE System SHALL redirecionar para o painel admin do tenant
4. WHEN o superadmin encerra impersonação THEN THE System SHALL retornar ao painel de superadmin
