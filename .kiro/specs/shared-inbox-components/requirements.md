# Requirements Document

## Introduction

Este documento especifica os requisitos para criar componentes compartilhados de inbox que podem ser reutilizados tanto na página de edição de inbox do admin (`/admin/inboxes/edit/:id`) quanto no dashboard do usuário (`/user/dashboard`). O objetivo é reduzir duplicação de código, manter consistência visual e simplificar a manutenção.

## Glossary

- **Inbox**: Caixa de entrada WhatsApp gerenciada pelo sistema (anteriormente chamada de "usuário WUZAPI")
- **Admin_Edit_Page**: Página de edição de inbox em `/admin/inboxes/edit/:id` usando `UserEditForm.tsx`
- **User_Dashboard**: Dashboard do usuário em `/user/dashboard` usando componentes modulares
- **Shared_Component**: Componente React reutilizável em diferentes contextos (admin/user)
- **WUZAPI_Service**: Serviço direto de acesso à API WUZAPI (usado pelo admin)
- **Backend_Proxy**: API proxy do backend que encapsula chamadas WUZAPI (usado pelo user)
- **Connection_Data**: Dados de conexão da inbox (status, JID, avatar, token)

## Requirements

### Requirement 1: Criar Componente Compartilhado de Informações da Inbox

**User Story:** Como desenvolvedor, quero um componente único para exibir informações da inbox, para evitar duplicação entre admin e user dashboards.

#### Acceptance Criteria

1. THE Shared_Component SHALL be located at `src/components/shared/inbox/InboxInfoCard.tsx`
2. THE InboxInfoCard SHALL accept props for: id, name, phone, jid, token, profilePicture, isConnected, isLoggedIn
3. THE InboxInfoCard SHALL display avatar with connection status indicator (green/gray dot)
4. THE InboxInfoCard SHALL display name, phone number, and JID with copy buttons
5. THE InboxInfoCard SHALL display token with show/hide toggle and copy button
6. THE InboxInfoCard SHALL support an optional `variant` prop: "compact" | "full" (default: "full")
7. WHEN variant is "compact", THE InboxInfoCard SHALL hide token section and reduce padding
8. THE InboxInfoCard SHALL follow the existing `UserInfoCardModern.tsx` design patterns

### Requirement 2: Criar Componente Compartilhado de Controle de Conexão

**User Story:** Como desenvolvedor, quero um componente único para controles de conexão WhatsApp, para manter consistência nas ações de conectar/desconectar.

#### Acceptance Criteria

1. THE Shared_Component SHALL be located at `src/components/shared/inbox/ConnectionControlCard.tsx`
2. THE ConnectionControlCard SHALL accept props for: isConnected, isLoggedIn, isLoading, onConnect, onDisconnect, onLogout, onGenerateQR
3. THE ConnectionControlCard SHALL display appropriate buttons based on connection state
4. WHEN disconnected, THE ConnectionControlCard SHALL show "Conectar" and "Gerar QR Code" buttons
5. WHEN connected but not logged in, THE ConnectionControlCard SHALL show "Gerar QR Code" button prominently
6. WHEN logged in, THE ConnectionControlCard SHALL show "Desconectar" and "Logout" buttons
7. THE ConnectionControlCard SHALL display loading states on buttons during operations
8. THE ConnectionControlCard SHALL use consistent button colors (green for connect, red for disconnect/logout)

### Requirement 3: Criar Componente Compartilhado de Configuração de Webhook

**User Story:** Como desenvolvedor, quero um componente único para configuração de webhook, para manter consistência na interface de eventos.

#### Acceptance Criteria

1. THE Shared_Component SHALL be located at `src/components/shared/inbox/WebhookConfigCard.tsx`
2. THE WebhookConfigCard SHALL accept props for: webhookUrl, events, availableEvents, onSave, isLoading, readOnly
3. THE WebhookConfigCard SHALL display input for webhook URL with validation
4. THE WebhookConfigCard SHALL display event selection with categories (Mensagens, Grupos, Conexão, etc.)
5. THE WebhookConfigCard SHALL support "Todos os Eventos" option
6. WHEN readOnly is true, THE WebhookConfigCard SHALL disable all inputs and hide save button
7. THE WebhookConfigCard SHALL show event count badge (e.g., "12 eventos selecionados")
8. THE WebhookConfigCard SHALL validate URL format before allowing save

### Requirement 4: Criar Adaptadores de Dados para Diferentes Contextos

**User Story:** Como desenvolvedor, quero adaptadores que transformem dados de diferentes fontes para o formato esperado pelos componentes compartilhados.

#### Acceptance Criteria

1. THE System SHALL create `src/lib/adapters/inbox-adapters.ts` with transformation functions
2. THE `adaptWuzapiUserToInboxInfo` function SHALL transform WuzAPIUser to InboxInfoCardProps
3. THE `adaptConnectionDataToInboxInfo` function SHALL transform InboxConnectionData to InboxInfoCardProps
4. THE adapters SHALL handle null/undefined values gracefully with sensible defaults
5. THE adapters SHALL be type-safe with proper TypeScript interfaces

### Requirement 5: Integrar Componentes na Página Admin

**User Story:** Como desenvolvedor, quero substituir o código duplicado na página admin pelos componentes compartilhados.

#### Acceptance Criteria

1. THE Admin_Edit_Page SHALL import and use InboxInfoCard from shared components
2. THE Admin_Edit_Page SHALL import and use ConnectionControlCard from shared components
3. THE Admin_Edit_Page SHALL import and use WebhookConfigCard from shared components
4. THE Admin_Edit_Page SHALL use `adaptWuzapiUserToInboxInfo` adapter for data transformation
5. THE Admin_Edit_Page SHALL maintain all existing functionality after refactoring
6. THE Admin_Edit_Page SHALL reduce `UserEditForm.tsx` from ~1164 lines to under 500 lines

### Requirement 6: Integrar Componentes no Dashboard do Usuário

**User Story:** Como desenvolvedor, quero que o dashboard do usuário use os mesmos componentes compartilhados.

#### Acceptance Criteria

1. THE User_Dashboard SHALL import and use InboxInfoCard from shared components
2. THE User_Dashboard SHALL import and use ConnectionControlCard from shared components
3. THE User_Dashboard SHALL import and use WebhookConfigCard from shared components
4. THE User_Dashboard SHALL use `adaptConnectionDataToInboxInfo` adapter for data transformation
5. THE User_Dashboard SHALL maintain all existing functionality after refactoring
6. THE User_Dashboard SHALL deprecate `UserInfoCardModern.tsx` in favor of shared InboxInfoCard

### Requirement 7: Manter Compatibilidade com APIs Diferentes

**User Story:** Como desenvolvedor, quero que os componentes funcionem com diferentes fontes de dados (WUZAPI direto vs Backend Proxy).

#### Acceptance Criteria

1. THE Shared_Components SHALL NOT make API calls directly
2. THE Shared_Components SHALL receive all data and callbacks via props
3. THE Admin_Edit_Page SHALL continue using WUZAPI service directly for data fetching
4. THE User_Dashboard SHALL continue using Backend Proxy APIs for data fetching
5. THE Shared_Components SHALL be agnostic to the data source

### Requirement 8: Exportar Componentes de Forma Organizada

**User Story:** Como desenvolvedor, quero imports limpos e organizados para os componentes compartilhados.

#### Acceptance Criteria

1. THE System SHALL create `src/components/shared/inbox/index.ts` with named exports
2. THE exports SHALL include: InboxInfoCard, ConnectionControlCard, WebhookConfigCard
3. THE exports SHALL include TypeScript interfaces for all component props
4. THE imports SHALL follow pattern: `import { InboxInfoCard } from '@/components/shared/inbox'`
