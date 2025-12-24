# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o bug de atribuição de plano na página de administração de usuários. Atualmente, ao tentar atribuir um plano a um usuário Supabase Auth que não possui uma conta na tabela `accounts`, o sistema retorna erro "User not found". O sistema deve criar automaticamente a conta quando necessário.

## Glossary

- **Supabase_Auth_User**: Usuário registrado na tabela `auth.users` do Supabase Auth
- **Account**: Registro na tabela `accounts` que vincula um usuário a um tenant e permite subscriptions
- **Plan_Assignment**: Processo de atribuir um plano de assinatura a um usuário
- **Tenant**: Organização/empresa que possui usuários e planos
- **User_Subscription**: Registro na tabela `user_subscriptions` que vincula uma conta a um plano

## Requirements

### Requirement 1: Validação de usuário deve considerar usuários Supabase Auth

**User Story:** Como administrador, quero atribuir planos a qualquer usuário Supabase Auth do meu tenant, mesmo que ele ainda não tenha uma conta na tabela accounts.

#### Acceptance Criteria

1. WHEN validando um usuário para atribuição de plano, THE System SHALL verificar primeiro na tabela `accounts` por `owner_user_id`
2. IF o usuário não for encontrado na tabela `accounts`, THEN THE System SHALL verificar se o ID corresponde a um usuário válido na tabela `auth.users`
3. WHEN um usuário Supabase Auth válido é encontrado sem conta, THE System SHALL criar automaticamente uma conta vinculada ao tenant do admin
4. THE System SHALL garantir que a conta criada automaticamente tenha o `tenant_id` correto do administrador

### Requirement 2: Criação automática de conta deve preservar dados do usuário

**User Story:** Como administrador, quero que ao atribuir um plano a um novo usuário, os dados do usuário Supabase Auth sejam preservados na conta criada.

#### Acceptance Criteria

1. WHEN criando uma conta automaticamente, THE System SHALL usar o email do usuário Supabase Auth como nome da conta
2. WHEN criando uma conta automaticamente, THE System SHALL vincular o `owner_user_id` ao ID do usuário Supabase Auth
3. THE System SHALL definir o status da conta como 'active' por padrão
4. THE System SHALL registrar a criação automática da conta nos logs para auditoria

### Requirement 3: Navegação para edição de usuário deve funcionar corretamente

**User Story:** Como administrador, quero navegar para a página de edição de um usuário Supabase Auth e ver suas informações corretamente.

#### Acceptance Criteria

1. WHEN navegando para `/admin/users/edit/:userId` com um ID de usuário Supabase Auth, THE System SHALL carregar os dados do usuário corretamente
2. IF o usuário não existir no Supabase Auth, THEN THE System SHALL exibir mensagem de erro apropriada
3. THE System SHALL exibir informações do plano atual do usuário quando disponível
4. THE System SHALL permitir atribuir plano diretamente da página de edição

### Requirement 4: Feedback de erro deve ser claro e acionável

**User Story:** Como administrador, quero receber mensagens de erro claras quando algo falhar na atribuição de plano.

#### Acceptance Criteria

1. IF a atribuição de plano falhar por falta de tenant context, THEN THE System SHALL exibir "Contexto de tenant não encontrado"
2. IF o plano não pertencer ao tenant do admin, THEN THE System SHALL exibir "Plano não encontrado ou não pertence ao seu tenant"
3. IF houver erro de banco de dados, THEN THE System SHALL exibir mensagem genérica sem expor detalhes técnicos
4. THE System SHALL logar todos os erros com contexto completo para debugging

