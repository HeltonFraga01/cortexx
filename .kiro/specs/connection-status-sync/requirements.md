# Requirements Document

## Introduction

Este documento especifica os requisitos para:
1. Sincronizar o status de conexão WhatsApp entre todos os componentes da interface
2. Permitir que usuários gerenciem suas caixas de entrada com as mesmas funcionalidades do admin, respeitando as quotas do plano

Atualmente existe uma inconsistência onde o toggle de seleção de inbox mostra "Online" enquanto o card de controle mostra "Desconectado". Além disso, o usuário precisa ter capacidade completa de CRUD de inboxes.

## Glossary

- **Connection_Status**: Estado atual da conexão WhatsApp (connected/disconnected/loggedIn)
- **Inbox_Selector**: Componente dropdown no topo da página que permite selecionar caixas de entrada
- **Connection_Control_Card**: Card que exibe status e botões de controle de conexão
- **Session_Status**: Status retornado pela API WUZAPI (Connected, LoggedIn)
- **WUZAPI**: API externa que gerencia conexões WhatsApp
- **Inbox_Context**: Contexto React que gerencia estado das inboxes
- **Quota**: Limite de recursos disponíveis no plano do usuário
- **Inbox_Management**: Funcionalidades de criar, editar, excluir e gerenciar caixas de entrada

## Requirements

### Requirement 1: Fonte Única de Verdade para Status

**User Story:** As a user, I want to see consistent connection status across all UI components, so that I can trust the information displayed.

#### Acceptance Criteria

1. WHEN the Connection_Status is fetched from WUZAPI, THE Inbox_Context SHALL update the status for the corresponding inbox in availableInboxes
2. WHEN the Inbox_Selector displays an inbox, THE System SHALL use the same isConnected value as the Connection_Control_Card
3. WHEN the session status changes (connected/disconnected), THE System SHALL update all components within 2 seconds
4. IF the WUZAPI call fails, THEN THE System SHALL use the cached database value as fallback

### Requirement 2: Sincronização de Status no Contexto

**User Story:** As a developer, I want the inbox context to maintain synchronized status, so that all components display consistent information.

#### Acceptance Criteria

1. WHEN the useInboxConnectionData hook fetches status, THE System SHALL also update the corresponding inbox in the context's availableInboxes
2. WHEN polling updates the session status, THE Inbox_Context SHALL propagate the change to availableInboxes
3. THE System SHALL ensure isConnected in availableInboxes matches sessionStatus.loggedIn for the active inbox
4. WHEN switching inboxes, THE System SHALL immediately fetch and display the correct status

### Requirement 3: Indicadores Visuais Consistentes

**User Story:** As a user, I want visual indicators to match across components, so that I can quickly understand my connection state.

#### Acceptance Criteria

1. WHEN an inbox is connected (loggedIn=true), THE Inbox_Selector SHALL display a green indicator
2. WHEN an inbox is connected (loggedIn=true), THE Connection_Control_Card SHALL display "Conectado" status
3. WHEN an inbox is disconnected, THE Inbox_Selector SHALL display a red indicator
4. WHEN an inbox is disconnected, THE Connection_Control_Card SHALL display "Desconectado" status
5. WHEN an inbox is connected but not logged in, THE System SHALL display a yellow/warning indicator

### Requirement 4: Atualização em Tempo Real

**User Story:** As a user, I want to see status updates in real-time, so that I know immediately when my connection state changes.

#### Acceptance Criteria

1. WHEN a connection action is performed (connect/disconnect/logout), THE System SHALL update all status indicators immediately
2. WHEN the polling interval triggers, THE System SHALL update all affected components
3. THE System SHALL maintain a single polling mechanism to avoid duplicate API calls
4. WHEN the user performs a manual refresh, THE System SHALL update all status indicators

### Requirement 5: Gerenciamento Completo de Inboxes pelo Usuário

**User Story:** As a user, I want to create, edit, delete and manage my inboxes with the same capabilities as admin, so that I can fully control my WhatsApp connections within my plan limits.

#### Acceptance Criteria

1. WHEN a user accesses the inbox management page, THE System SHALL display all their inboxes with full management options
2. WHEN a user creates a new inbox, THE System SHALL validate against the quota limit before allowing creation
3. IF the user has reached their inbox quota, THEN THE System SHALL display a message indicating the limit and prevent creation
4. WHEN a user edits an inbox, THE System SHALL allow modification of name, phone number, and WUZAPI token
5. WHEN a user deletes an inbox, THE System SHALL require confirmation and remove all associated data
6. THE System SHALL provide the same connection controls as admin (Connect, Disconnect, Logout, Generate QR Code)

### Requirement 6: Controles de Conexão na Interface do Usuário

**User Story:** As a user, I want to connect, disconnect, logout and generate QR codes for my inboxes, so that I can manage my WhatsApp sessions independently.

#### Acceptance Criteria

1. WHEN a user clicks "Conectar", THE System SHALL initiate a WUZAPI connection for that inbox
2. WHEN a user clicks "Gerar QR Code", THE System SHALL fetch and display the QR code for WhatsApp login
3. WHEN a user clicks "Desconectar", THE System SHALL disconnect the WUZAPI session
4. WHEN a user clicks "Logout WhatsApp", THE System SHALL logout the WhatsApp session and clear credentials
5. WHEN any connection action completes, THE System SHALL update the status across all components
6. THE System SHALL display loading states during connection operations

### Requirement 7: Validação de Quota

**User Story:** As a user, I want to see my inbox quota usage, so that I know how many more inboxes I can create.

#### Acceptance Criteria

1. WHEN displaying the inbox list, THE System SHALL show current usage vs quota limit (e.g., "3/5 caixas")
2. WHEN the user is at quota limit, THE System SHALL disable the "Create Inbox" button
3. WHEN the user is at quota limit, THE System SHALL display a message suggesting plan upgrade
4. THE System SHALL enforce quota limits on the backend to prevent bypass

### Requirement 8: Tratamento de Erros de Conexão

**User Story:** As a user, I want clear feedback when connection actions fail, so that I understand what happened and what to do next.

#### Acceptance Criteria

1. WHEN a user clicks "Conectar" and the session is already connected, THE System SHALL display a friendly message "Já conectado" instead of an error
2. WHEN the WUZAPI returns "already connected" error, THE System SHALL treat it as a success and update the status to connected
3. WHEN a connection action fails with a 401 error, THE System SHALL display a message indicating the WUZAPI token is invalid
4. WHEN a connection action fails with a network error, THE System SHALL display a retry option
5. WHEN any connection action completes (success or handled error), THE System SHALL refresh the status from WUZAPI

### Requirement 9: Verificação de Status Antes de Ação

**User Story:** As a user, I want the system to check the current status before performing connection actions, so that unnecessary API calls are avoided.

#### Acceptance Criteria

1. WHEN a user clicks "Conectar" and the status shows "Conectado", THE System SHALL skip the connect call and show "Já conectado"
2. WHEN a user clicks "Desconectar" and the status shows "Desconectado", THE System SHALL skip the disconnect call and show "Já desconectado"
3. WHEN the cached status is stale (older than 30 seconds), THE System SHALL fetch fresh status before performing the action
4. THE System SHALL display the current status prominently before showing action buttons
