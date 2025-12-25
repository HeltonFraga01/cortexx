# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir a inconsistência na exibição do status de conexão das caixas de entrada (inboxes) entre diferentes componentes da interface.

Atualmente existe uma inconsistência onde:
1. O **InboxInfoCard** (na página de edição `/user/inboxes/edit/:id`) mostra o status correto ("Logado" com badge verde)
2. O **UnifiedInboxSelector** (dropdown na barra superior) mostra indicadores inconsistentes (cinza/vermelho quando deveria ser verde)
3. O **ConnectionStatus** no header mostra "Desconectado" quando a inbox está conectada

A causa raiz é que diferentes componentes usam diferentes fontes de dados para o status:
- `InboxInfoCard` usa `sessionStatus` do hook `useInboxConnectionData` que consulta WUZAPI diretamente
- `UnifiedInboxSelector` usa `availableInboxes.isConnected` do `SupabaseInboxContext`
- O contexto não está sendo atualizado corretamente quando o status muda

## Glossary

- **Connection_Status**: Estado atual da conexão WhatsApp (connected/disconnected/loggedIn)
- **Inbox_Selector**: Componente dropdown `UnifiedInboxSelector` no topo da página que permite selecionar caixas de entrada
- **Inbox_Info_Card**: Card que exibe informações detalhadas da inbox incluindo status de conexão
- **Connection_Status_Badge**: Badge visual que indica o status (verde=logado, amarelo=conectado, vermelho=desconectado, cinza=desconhecido)
- **Session_Status**: Status retornado pela API WUZAPI (connected, loggedIn)
- **WUZAPI**: API externa que gerencia conexões WhatsApp
- **Inbox_Context**: Contexto React `SupabaseInboxContext` que gerencia estado das inboxes
- **Provider_API**: Endpoint `/api/user/inbox/:id/status` que consulta WUZAPI como fonte de verdade

## Requirements

### Requirement 1: Fonte Única de Verdade para Status

**User Story:** As a user, I want to see consistent connection status across all UI components, so that I can trust the information displayed.

#### Acceptance Criteria

1. WHEN the Provider_API returns status for an inbox, THE Inbox_Context SHALL update the `isConnected` and `isLoggedIn` fields for that inbox in `availableInboxes`
2. WHEN the Inbox_Selector displays an inbox, THE System SHALL use the same `isConnected` value that the Inbox_Info_Card displays
3. WHEN the session status changes (connected/disconnected/loggedIn), THE System SHALL update all components within 3 seconds
4. IF the Provider_API call fails, THEN THE System SHALL display a "desconhecido" (unknown) status instead of cached data

### Requirement 2: Sincronização Bidirecional de Status

**User Story:** As a developer, I want the inbox context to be updated whenever any component fetches status, so that all components display consistent information.

#### Acceptance Criteria

1. WHEN the `useInboxConnectionData` hook fetches status from Provider_API, THE System SHALL call `updateInboxStatus` on the context to propagate the status
2. WHEN the context's polling mechanism fetches status, THE System SHALL update `availableInboxes` with the new status
3. WHEN a user navigates to the inbox edit page, THE System SHALL immediately fetch fresh status from Provider_API
4. WHEN the user selects a different inbox in the selector, THE System SHALL display the status from `availableInboxes` (which should be synchronized)

### Requirement 3: Indicadores Visuais Consistentes

**User Story:** As a user, I want visual indicators to match across all components, so that I can quickly understand my connection state.

#### Acceptance Criteria

1. WHEN an inbox has `isLoggedIn=true`, THE Inbox_Selector SHALL display a green indicator (●)
2. WHEN an inbox has `isLoggedIn=true`, THE Inbox_Info_Card SHALL display "Logado" badge with green styling
3. WHEN an inbox has `isConnected=true` but `isLoggedIn=false`, THE System SHALL display a yellow/warning indicator
4. WHEN an inbox has `isConnected=false` and `isLoggedIn=false`, THE System SHALL display a red indicator
5. WHEN the status is unknown (error fetching), THE System SHALL display a gray indicator

### Requirement 4: Atualização Imediata Após Ações

**User Story:** As a user, I want to see status updates immediately after performing connection actions, so that I know the action was successful.

#### Acceptance Criteria

1. WHEN a user clicks "Atualizar Status" button, THE System SHALL fetch fresh status from Provider_API and update all components
2. WHEN a user performs connect/disconnect/logout action, THE System SHALL update the context status within 2 seconds of completion
3. WHEN the page becomes visible after being hidden, THE System SHALL fetch fresh status from Provider_API
4. THE System SHALL display a loading indicator while fetching status

### Requirement 5: Consistência entre Seleção e Exibição

**User Story:** As a user, I want the inbox I select to show the same status in the selector and in the detail view, so that I'm not confused by different information.

#### Acceptance Criteria

1. WHEN a user selects an inbox in the Inbox_Selector, THE status indicator in the selector SHALL match the status shown in the Inbox_Info_Card
2. WHEN "Todas as Caixas" is selected, THE System SHALL show a warning indicator if ANY inbox is disconnected
3. WHEN a single inbox is selected, THE System SHALL show that inbox's specific status
4. THE Connection_Status component in the header SHALL reflect the status of the currently displayed inbox

### Requirement 6: Tratamento de Estados de Erro

**User Story:** As a user, I want to understand when the system cannot determine the connection status, so that I can take appropriate action.

#### Acceptance Criteria

1. WHEN the Provider_API returns an error, THE System SHALL display "Status desconhecido" with a gray indicator
2. WHEN the Provider_API is unavailable, THE System SHALL show a retry button
3. WHEN multiple status fetch attempts fail, THE System SHALL not show stale cached data as if it were current
4. THE System SHALL log errors for debugging without exposing technical details to users

