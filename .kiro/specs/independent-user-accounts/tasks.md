# Implementation Plan: Independent User Accounts

## Overview

Este plano implementa o sistema de contas de usuário independentes em fases incrementais, começando pela infraestrutura de banco de dados, seguido pelos serviços backend, rotas de API, e finalmente a interface de usuário.

## Tasks

- [x] 1. Criar migrations de banco de dados
  - [x] 1.1 Criar migration para tabela `users`
    - Criar tabela com campos: id, tenant_id, email, password_hash, name, avatar_url, status, permissions, failed_login_attempts, locked_until, last_login_at, created_at, updated_at
    - Criar índices para tenant_id, email, status
    - Adicionar constraint UNIQUE(tenant_id, email)
    - _Requirements: 1.1, 1.5, 1.6_

  - [x] 1.2 Criar migration para tabela `user_inboxes`
    - Criar tabela com campos: id, user_id, inbox_id, is_primary, created_at
    - Criar foreign keys para users e inboxes
    - Criar índices para user_id e inbox_id
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Criar migration para tabela `user_sessions`
    - Criar tabela com campos: id, user_id, session_token, ip_address, user_agent, expires_at, created_at, last_activity_at
    - Criar índices para user_id, session_token, expires_at
    - _Requirements: 2.1, 2.4_

- [x] 2. Implementar UserService
  - [x] 2.1 Criar estrutura base do UserService
    - Criar arquivo `server/services/UserService.js`
    - Implementar métodos de hash e verificação de senha
    - Implementar formatUser para conversão de dados
    - _Requirements: 1.4_

  - [ ]* 2.2 Write property test for password hashing
    - **Property 2: Password Hashing Round-Trip**
    - **Validates: Requirements 1.4**

  - [x] 2.3 Implementar createUser
    - Validar email único no tenant
    - Hash da senha antes de salvar
    - Atribuir tenant_id e permissões padrão
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 2.4 Write property test for user creation
    - **Property 1: User Creation Without WUZAPI Dependencies**
    - **Property 3: Email Uniqueness Per Tenant**
    - **Validates: Requirements 1.2, 1.3, 1.6**

  - [x] 2.5 Implementar getUserById e getUserByEmail
    - Buscar usuário com validação de tenant
    - Retornar null se não encontrado
    - _Requirements: 2.1_

  - [x] 2.6 Implementar authenticateUser
    - Verificar credenciais
    - Controlar tentativas de login
    - Bloquear após 5 tentativas por 15 minutos
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [ ]* 2.7 Write property test for authentication
    - **Property 4: Valid Credentials Create Session**
    - **Property 5: Invalid Credentials Return Error**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [x] 2.8 Implementar linkInbox e unlinkInbox
    - Validar que inbox pertence ao mesmo tenant
    - Preservar dados do usuário ao desvincular
    - _Requirements: 3.2, 3.5, 3.6_

  - [ ]* 2.9 Write property test for inbox linking
    - **Property 7: Inbox Linking Tenant Validation**
    - **Property 9: User Data Preserved On Inbox Unlink**
    - **Validates: Requirements 3.2, 3.6**

  - [x] 2.10 Implementar getUserInboxes
    - Retornar lista de inboxes vinculadas ao usuário
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 2.11 Implementar updatePermissions
    - Atualizar permissões do usuário
    - Registrar no audit log
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ]* 2.12 Write property test for permissions
    - **Property 10: Permission Changes Apply Immediately**
    - **Property 11: Permission Changes Logged**
    - **Validates: Requirements 4.4, 4.5**

  - [x] 2.13 Implementar deactivateUser
    - Alterar status para inactive
    - Invalidar todas as sessões ativas
    - _Requirements: 7.6_

  - [ ]* 2.14 Write property test for deactivation
    - **Property 15: Session Invalidation On Deactivation**
    - **Validates: Requirements 7.6**

- [x] 3. Checkpoint - Verificar UserService
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar UserSessionService
  - [x] 4.1 Criar estrutura base do UserSessionService
    - Criar arquivo `server/services/UserSessionService.js`
    - Implementar geração de token de sessão
    - _Requirements: 2.1_

  - [x] 4.2 Implementar createSession
    - Criar sessão com token único
    - Definir expiração (24 horas)
    - _Requirements: 2.1, 2.4_

  - [x] 4.3 Implementar validateSession
    - Verificar token e expiração
    - Atualizar last_activity_at
    - _Requirements: 2.4_

  - [x] 4.4 Implementar deleteUserSessions
    - Invalidar todas as sessões de um usuário
    - _Requirements: 7.6_

- [x] 5. Implementar ApiConfigService
  - [x] 5.1 Criar estrutura base do ApiConfigService
    - Criar arquivo `server/services/ApiConfigService.js`
    - Definir chaves de configuração
    - Implementar cache em memória
    - _Requirements: 5.1, 8.5_

  - [x] 5.2 Implementar getConfig com fallback
    - Ler do banco de dados primeiro
    - Fallback para variáveis de ambiente
    - Usar cache para performance
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.3 Write property test for config priority
    - **Property 16: Config Priority DB Over Env**
    - **Validates: Requirements 8.3, 8.4**

  - [x] 5.4 Implementar updateConfig
    - Validar configuração antes de salvar
    - Invalidar cache após atualização
    - _Requirements: 5.6, 8.6_

  - [ ]* 5.5 Write property test for config validation and cache
    - **Property 12: Config Validation Before Save**
    - **Property 17: Config Cache Invalidation**
    - **Validates: Requirements 5.6, 8.6**

  - [x] 5.6 Implementar validateConfig
    - Validar formato de URL
    - Validar formato de token
    - _Requirements: 5.6_

  - [x] 5.7 Implementar testConnection
    - Testar conexão com API usando configuração atual
    - _Requirements: 5.5_

- [x] 6. Checkpoint - Verificar Services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar rotas de autenticação de usuário
  - [x] 7.1 Criar userAuthRoutes.js
    - Criar arquivo `server/routes/userAuthRoutes.js`
    - Configurar router Express
    - _Requirements: 2.1_

  - [x] 7.2 Implementar POST /api/auth/user-login
    - Autenticar usuário por email/senha
    - Criar sessão HTTP
    - Definir role como 'user'
    - _Requirements: 2.1, 2.3, 2.4, 6.2_

  - [ ]* 7.3 Write property test for user login role
    - **Property 13: User Role In Session**
    - **Validates: Requirements 6.2**

  - [x] 7.4 Implementar POST /api/auth/user-logout
    - Destruir sessão
    - Limpar cookie
    - _Requirements: 2.1_

  - [x] 7.5 Registrar rotas em routes/index.js
    - Adicionar userAuthRoutes ao app
    - _Requirements: 2.1_

- [x] 8. Implementar middleware de autenticação de usuário
  - [x] 8.1 Criar userAuth.js middleware
    - Criar arquivo `server/middleware/userAuth.js`
    - Implementar requireUserAuth
    - Verificar sessão e role='user'
    - _Requirements: 6.1, 6.5_

  - [x] 8.2 Implementar requireInbox middleware
    - Verificar se usuário tem inbox vinculada
    - Retornar erro se não tiver
    - _Requirements: 3.3, 3.4_

  - [ ]* 8.3 Write property test for inbox requirement
    - **Property 8: Inbox State Affects Messaging Availability**
    - **Validates: Requirements 3.3, 3.4**

- [x] 9. Implementar rotas de gerenciamento de usuários (admin)
  - [x] 9.1 Criar adminUserManagementRoutes.js
    - Criar arquivo `server/routes/adminUserManagementRoutes.js`
    - _Requirements: 7.1_

  - [x] 9.2 Implementar GET /api/admin/independent-users
    - Listar usuários do tenant
    - Suportar paginação
    - _Requirements: 7.1_

  - [x] 9.3 Implementar POST /api/admin/independent-users
    - Criar novo usuário
    - Validar dados de entrada
    - _Requirements: 7.2_

  - [x] 9.4 Implementar PUT /api/admin/independent-users/:userId
    - Atualizar dados do usuário
    - _Requirements: 7.3_

  - [x] 9.5 Implementar DELETE /api/admin/independent-users/:userId
    - Desativar usuário
    - Invalidar sessões
    - _Requirements: 7.4, 7.6_

  - [x] 9.6 Implementar POST /api/admin/independent-users/:userId/reset-password
    - Gerar nova senha ou enviar link de reset
    - _Requirements: 7.5_

  - [x] 9.7 Implementar rotas de vinculação de inbox
    - POST /:userId/link-inbox
    - DELETE /:userId/unlink-inbox/:inboxId
    - _Requirements: 3.2, 3.5_

  - [x] 9.8 Registrar rotas em routes/index.js
    - Adicionar adminUserManagementRoutes ao app
    - _Requirements: 7.1_

- [x] 10. Checkpoint - Verificar rotas backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Atualizar wuzapiClient para usar ApiConfigService
  - [x] 11.1 Modificar wuzapiClient.js
    - Importar ApiConfigService
    - Usar getConfig() ao invés de process.env
    - _Requirements: 8.1, 8.2_
    - **NOTA: Já implementado - wuzapiClient já usa ApiSettingsService**

  - [ ]* 11.2 Write property test for session independence
    - **Property 6: Session Independence From WUZAPI**
    - **Validates: Requirements 5.2**

- [x] 12. Implementar rotas de configuração de API (admin)
  - [x] 12.1 Atualizar adminApiSettingsRoutes.js
    - Usar ApiConfigService para leitura/escrita
    - _Requirements: 5.3, 5.4_
    - **NOTA: Já implementado - adminApiSettingsRoutes já usa ApiSettingsService**

  - [x] 12.2 Implementar endpoint de teste de conexão
    - GET /api/admin/api-settings/test-connection
    - _Requirements: 5.5_
    - **NOTA: Já implementado como POST /api/admin/api-settings/test**

- [x] 13. Checkpoint - Verificar integração backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implementar componentes frontend
  - [x] 14.1 Criar UserLoginForm component
    - Criar `src/components/auth/UserLoginForm.tsx`
    - Formulário de login com email/senha
    - _Requirements: 2.1_

  - [x] 14.2 Criar serviço de autenticação de usuário
    - Criar `src/services/user-auth.ts`
    - Implementar login, logout, status
    - _Requirements: 2.1_

  - [x] 14.3 Criar página de login de usuário
    - Criar `src/pages/UserLogin.tsx`
    - Integrar com UserLoginForm
    - _Requirements: 2.1_

  - [x] 14.4 Criar IndependentUserList component (admin)
    - Criar `src/components/admin/IndependentUserList.tsx`
    - Listar usuários com paginação
    - _Requirements: 7.1_

  - [x] 14.5 Criar IndependentUserForm component (admin)
    - Criar `src/components/admin/IndependentUserForm.tsx`
    - Formulário de criação/edição
    - _Requirements: 7.2, 7.3_

  - [x] 14.6 Criar InboxLinkingDialog component (admin)
    - Criar `src/components/admin/InboxLinkingDialog.tsx`
    - Dialog para vincular/desvincular inbox
    - _Requirements: 3.2, 3.5_

  - [x] 14.7 Criar página de gerenciamento de usuários (admin)
    - Criar `src/pages/admin/IndependentUsersPage.tsx`
    - Integrar componentes de listagem e formulário
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 15. Atualizar configurações de API no admin
  - [x] 15.1 Atualizar ApiSettingsForm component
    - Usar ApiConfigService via API
    - Adicionar botão de teste de conexão
    - _Requirements: 5.3, 5.4, 5.5_
    - **NOTA: Já implementado - ApiSettingsForm já usa api-settings service e tem botão de teste**

- [x] 16. Checkpoint - Verificar frontend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Atualizar rotas e navegação
  - [x] 17.1 Adicionar rota de login de usuário
    - Atualizar `src/App.tsx` com rota /user-login
    - _Requirements: 2.1_

  - [x] 17.2 Adicionar rota de gerenciamento de usuários no admin
    - Atualizar navegação do admin
    - _Requirements: 7.1_

  - [x] 17.3 Atualizar AuthContext para suportar User
    - Distinguir entre User e Agent
    - _Requirements: 6.1, 6.5_
    - Adicionado `loginUser()` method e `authType` field para distinguir login por senha vs token

- [x] 18. Verificar compatibilidade com Agent existente
  - [ ]* 18.1 Write property test for agent role
    - **Property 14: Agent Role In Session**
    - **Validates: Requirements 6.3**

  - [x] 18.2 Testar login de Agent existente
    - Verificar que login de Agent continua funcionando
    - _Requirements: 6.4_
    - **NOTA: Compatibilidade mantida - login de Agent usa rotas separadas (/api/agent/login)**

- [x] 19. Final checkpoint - Verificar sistema completo
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- A implementação mantém compatibilidade total com o sistema existente de Agents
