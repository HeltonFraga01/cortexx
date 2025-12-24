# Requirements Document

## Introduction

Este documento especifica os requisitos para criar uma página de edição completa para usuários do Supabase Auth. Atualmente, a página `/admin/users/edit/:userId` é projetada para usuários WUZAPI (instâncias WhatsApp), mas quando um admin clica em "Editar" na lista de usuários Supabase (`/admin/multi-user`), ele é direcionado para esta mesma rota que não consegue carregar os dados corretamente.

O objetivo é criar uma página dedicada para edição de usuários Supabase Auth com todas as informações e opções de gestão disponíveis no sistema.

## Glossary

- **Supabase_User**: Usuário autenticado via Supabase Auth (tabela `auth.users`)
- **Account**: Registro na tabela `accounts` que vincula um Supabase_User a um tenant
- **WUZAPI_User**: Instância WhatsApp gerenciada pelo WUZAPI (diferente de Supabase_User)
- **Tenant**: Organização/empresa no sistema multi-tenant
- **User_Subscription**: Assinatura de plano do usuário (tabela `user_subscriptions`)
- **Plan**: Plano de assinatura com features e limites (tabela `plans`)
- **Quota_Usage**: Uso de recursos do usuário (tabela `user_quota_usage`)

## Requirements

### Requirement 1: Criar rota dedicada para edição de usuários Supabase

**User Story:** Como administrador, quero acessar uma página de edição específica para usuários Supabase Auth, para gerenciar suas informações sem conflito com a edição de instâncias WUZAPI.

#### Acceptance Criteria

1. THE System SHALL criar uma nova rota `/admin/supabase-users/edit/:userId` para edição de usuários Supabase Auth
2. THE SupabaseUsersList SHALL navegar para a nova rota ao clicar em "Editar"
3. THE System SHALL carregar os dados do usuário Supabase Auth pelo ID fornecido na URL
4. IF o usuário não existir ou não pertencer ao tenant atual, THEN THE System SHALL exibir erro e redirecionar para a lista
5. THE System SHALL validar que o usuário pertence ao tenant do admin antes de permitir edição (MULTI-TENANT)

### Requirement 2: Exibir informações completas do usuário

**User Story:** Como administrador, quero visualizar todas as informações disponíveis sobre um usuário Supabase, para ter uma visão completa do perfil e status.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL exibir as seguintes informações do Supabase Auth:
   - ID do usuário
   - Email
   - Telefone (se disponível)
   - Data de criação
   - Último login
   - Status de confirmação de email
   - Metadados do usuário (role, nome, etc.)
2. THE SupabaseUserEditPage SHALL exibir informações da conta (tabela `accounts`):
   - Nome da conta
   - Status da conta
   - Token WUZAPI associado (se houver)
   - Configurações (timezone, locale)
   - Data de criação da conta
3. THE SupabaseUserEditPage SHALL exibir informações de assinatura:
   - Plano atual (nome, preço, ciclo)
   - Status da assinatura (trial, active, canceled, etc.)
   - Data de início e expiração
   - Features incluídas no plano
4. THE SupabaseUserEditPage SHALL exibir uso de quotas:
   - Mensagens enviadas vs limite
   - Bots ativos vs limite
   - Campanhas ativas vs limite
   - Outras quotas relevantes

### Requirement 3: Permitir edição de dados do usuário

**User Story:** Como administrador, quero editar informações do usuário Supabase, para corrigir dados ou atualizar configurações.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL permitir editar:
   - Email do usuário
   - Telefone do usuário
   - Metadados (role, nome)
   - Status de confirmação de email
2. THE SupabaseUserEditPage SHALL permitir editar dados da conta:
   - Nome da conta
   - Status da conta (active, suspended, etc.)
   - Timezone
   - Locale
3. WHEN o administrador salva alterações, THE System SHALL validar os dados antes de persistir
4. WHEN a atualização for bem-sucedida, THE System SHALL exibir notificação de sucesso
5. IF houver erro na atualização, THEN THE System SHALL exibir mensagem de erro específica

### Requirement 4: Gerenciar credenciais de acesso

**User Story:** Como administrador, quero gerenciar as credenciais de acesso do usuário, para ajudar em casos de suporte ou segurança.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL permitir resetar a senha do usuário
2. WHEN resetando senha, THE System SHALL gerar uma nova senha temporária ou enviar email de reset
3. THE SupabaseUserEditPage SHALL permitir confirmar email manualmente (se não confirmado)
4. THE SupabaseUserEditPage SHALL exibir histórico de últimos logins (se disponível)
5. THE System SHALL registrar ações de segurança no log de auditoria

### Requirement 5: Gerenciar plano e assinatura

**User Story:** Como administrador, quero gerenciar o plano e assinatura do usuário, para ajustar recursos conforme necessário.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL exibir o plano atual com detalhes completos
2. THE SupabaseUserEditPage SHALL permitir atribuir ou alterar o plano do usuário
3. WHEN alterando plano, THE System SHALL exibir preview das mudanças (features, limites)
4. THE SupabaseUserEditPage SHALL permitir cancelar assinatura
5. THE SupabaseUserEditPage SHALL permitir estender período de trial (se aplicável)
6. THE System SHALL atualizar quotas automaticamente ao mudar de plano

### Requirement 6: Gerenciar vinculação com instâncias WUZAPI

**User Story:** Como administrador, quero gerenciar a vinculação entre o usuário Supabase e instâncias WUZAPI, para configurar o acesso ao WhatsApp.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL listar instâncias WUZAPI vinculadas ao usuário
2. THE SupabaseUserEditPage SHALL permitir vincular novas instâncias WUZAPI existentes
3. THE SupabaseUserEditPage SHALL permitir desvincular instâncias WUZAPI
4. WHEN vinculando instância, THE System SHALL validar que a instância pertence ao mesmo tenant
5. THE System SHALL exibir status de conexão de cada instância vinculada

### Requirement 7: Ações administrativas

**User Story:** Como administrador, quero realizar ações administrativas no usuário, para gerenciar o ciclo de vida da conta.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL permitir suspender/reativar a conta do usuário
2. THE SupabaseUserEditPage SHALL permitir deletar o usuário (com confirmação)
3. WHEN deletando usuário, THE System SHALL oferecer opção de deletar dados associados
4. THE SupabaseUserEditPage SHALL permitir enviar email de boas-vindas/reset
5. THE System SHALL registrar todas as ações administrativas no log de auditoria

### Requirement 8: Navegação e UX

**User Story:** Como administrador, quero uma experiência de navegação fluida, para gerenciar usuários de forma eficiente.

#### Acceptance Criteria

1. THE SupabaseUserEditPage SHALL exibir breadcrumb de navegação
2. THE SupabaseUserEditPage SHALL incluir botão "Voltar para lista" visível
3. THE SupabaseUserEditPage SHALL organizar informações em seções/cards colapsáveis
4. THE SupabaseUserEditPage SHALL exibir estados de loading durante operações
5. THE SupabaseUserEditPage SHALL confirmar antes de ações destrutivas
6. THE SupabaseUserEditPage SHALL manter responsividade em dispositivos móveis

### Requirement 9: Segurança e Multi-Tenant

**User Story:** Como administrador, quero que o sistema garanta isolamento de dados entre tenants, para manter a segurança.

#### Acceptance Criteria

1. THE System SHALL validar que o usuário sendo editado pertence ao tenant do admin
2. THE System SHALL bloquear acesso a usuários de outros tenants
3. THE System SHALL registrar tentativas de acesso cross-tenant como violação de segurança
4. THE Backend SHALL validar tenant_id em todas as operações de leitura e escrita
5. THE System SHALL usar mensagens de erro genéricas para não vazar informações de outros tenants

## Technical Notes

### Backend Endpoints Necessários

1. `GET /api/admin/supabase/users/:id/full` - Dados completos do usuário (auth + account + subscription + quotas)
2. `PUT /api/admin/supabase/users/:id` - Atualizar dados do usuário (já existe)
3. `POST /api/admin/supabase/users/:id/reset-password` - Resetar senha
4. `POST /api/admin/supabase/users/:id/confirm-email` - Confirmar email manualmente
5. `POST /api/admin/supabase/users/:id/suspend` - Suspender conta
6. `POST /api/admin/supabase/users/:id/reactivate` - Reativar conta
7. `GET /api/admin/supabase/users/:id/wuzapi-instances` - Listar instâncias WUZAPI vinculadas
8. `POST /api/admin/supabase/users/:id/wuzapi-instances/:instanceId` - Vincular instância
9. `DELETE /api/admin/supabase/users/:id/wuzapi-instances/:instanceId` - Desvincular instância

### Componentes Frontend

1. `SupabaseUserEditPage.tsx` - Página principal de edição
2. `SupabaseUserInfoCard.tsx` - Card com informações básicas do usuário
3. `SupabaseUserAccountCard.tsx` - Card com informações da conta
4. `SupabaseUserSubscriptionCard.tsx` - Card com informações de assinatura
5. `SupabaseUserQuotaCard.tsx` - Card com uso de quotas
6. `SupabaseUserActionsCard.tsx` - Card com ações administrativas
7. `WuzapiInstancesCard.tsx` - Card com instâncias WUZAPI vinculadas

### Referências

- Componente existente: `src/components/admin/UserEditForm.tsx` (para WUZAPI users)
- Serviço existente: `src/services/admin-users.ts`
- Rotas backend: `server/routes/adminRoutes.js` (linhas 1395-1724)
- Tabelas: `auth.users`, `accounts`, `user_subscriptions`, `plans`, `user_quota_usage`
