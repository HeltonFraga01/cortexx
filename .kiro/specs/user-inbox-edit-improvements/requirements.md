# Requirements Document

## Introduction

Este documento especifica os requisitos para melhorar a página de edição de inbox do usuário (`/user/inboxes/edit/:inboxId`) para ter paridade de funcionalidades com a página de edição do admin (`/admin/inboxes/edit/:id`). As melhorias focam em: carregamento correto do avatar, exibição de categorias de eventos webhook, e consistência visual.

## Glossary

- **User_Inbox_Edit_Page**: Página de edição de inbox em `/user/inboxes/edit/:inboxId` usando `UserInboxEditPage.tsx`
- **Admin_Inbox_Edit_Page**: Página de edição de inbox em `/admin/inboxes/edit/:id` usando `EditUserPage.tsx` e `UserEditForm.tsx`
- **WebhookConfigCard**: Componente compartilhado para configuração de webhook em `src/components/shared/inbox/WebhookConfigCard.tsx`
- **Avatar**: Foto de perfil do WhatsApp associada à inbox
- **Event_Category**: Agrupamento de eventos webhook (Mensagens, Grupos, Newsletter, etc.)
- **Connection_Status**: Estado de conexão da inbox (conectado, logado, offline)

## Requirements

### Requirement 1: Carregamento Correto do Avatar

**User Story:** Como usuário, quero ver minha foto de perfil do WhatsApp na página de edição da inbox, para ter confirmação visual de qual conta está conectada.

#### Acceptance Criteria

1. WHEN the User_Inbox_Edit_Page loads AND the inbox is logged in, THE System SHALL automatically fetch the avatar from WUZAPI
2. WHEN the avatar is successfully fetched, THE System SHALL display it in the Avatar component
3. WHEN the avatar is loading, THE System SHALL show a loading spinner in the Avatar fallback
4. IF the avatar fetch fails, THEN THE System SHALL show a generic user icon with a "Carregar foto" button
5. WHEN the user clicks "Carregar foto", THE System SHALL retry fetching the avatar
6. THE Avatar SHALL be displayed with the same size and styling as the Admin_Inbox_Edit_Page (h-24 w-24)

### Requirement 2: Exibição de Categorias de Eventos Webhook

**User Story:** Como usuário, quero ver os eventos webhook organizados por categoria, para selecionar facilmente quais eventos desejo receber.

#### Acceptance Criteria

1. WHEN the webhook config has specific events selected (not "All"), THE WebhookConfigCard SHALL display events grouped by category
2. THE categories SHALL include: Mensagens, Grupos, Newsletter, Presença, Sistema, Sincronização, Chamadas, Conexão, Keep Alive, Pairing, Outros
3. WHEN a category is expanded, THE System SHALL show checkboxes for each event in that category
4. THE System SHALL display a badge showing "X/Y" (selected/total) for each category with selected events
5. WHEN "Todos os Eventos" is checked, THE System SHALL hide the category breakdown and show total event count
6. WHEN "Todos os Eventos" is unchecked, THE System SHALL show the category breakdown with all events unselected

### Requirement 3: Consistência Visual com Admin Page

**User Story:** Como usuário, quero que a página de edição da minha inbox tenha a mesma qualidade visual da página admin, para ter uma experiência consistente.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL display ID with copy button (same as admin)
2. THE User_Inbox_Edit_Page SHALL display phone number with copy button (same as admin)
3. THE User_Inbox_Edit_Page SHALL display connection status badge (Logado/Conectado/Offline) with appropriate colors
4. THE User_Inbox_Edit_Page SHALL display "Ações Rápidas" section with QR Code and Refresh buttons
5. THE User_Inbox_Edit_Page SHALL use the same Card layout structure as Admin_Inbox_Edit_Page

### Requirement 4: Sincronização de Status de Conexão

**User Story:** Como usuário, quero ver o status de conexão correto e atualizado da minha inbox, para saber se posso enviar/receber mensagens.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL fetch connection status from WUZAPI on page load
2. WHEN the user clicks "Atualizar Status", THE System SHALL refresh the connection status from WUZAPI
3. THE connection status SHALL be consistent between the header badge and the info card
4. IF the inbox is logged in, THE System SHALL show "Logado" badge with green color
5. IF the inbox is connected but not logged in, THE System SHALL show "Conectado" badge with secondary color
6. IF the inbox is offline, THE System SHALL show "Offline" badge with outline style

### Requirement 5: Inicialização Correta do Webhook Config

**User Story:** Como usuário, quero que a configuração de webhook seja carregada corretamente do servidor, para ver minha configuração atual.

#### Acceptance Criteria

1. WHEN the page loads, THE System SHALL fetch the current webhook configuration from the server
2. IF the server returns specific events, THE System SHALL display them as selected in the category view
3. IF the server returns "All" or empty events, THE System SHALL show "Todos os Eventos" as checked
4. THE webhook URL field SHALL be pre-populated with the current webhook URL from the server
5. WHEN the user makes changes, THE System SHALL enable the "Salvar Webhook" button
6. WHEN the user saves, THE System SHALL send the updated configuration to the server

### Requirement 6: Feedback Visual de Operações

**User Story:** Como usuário, quero feedback visual claro quando realizo operações na página, para saber se minhas ações foram bem-sucedidas.

#### Acceptance Criteria

1. WHEN copying a field (ID, phone, JID, token), THE System SHALL show a toast notification "X copiado!"
2. WHEN copying a field, THE System SHALL change the copy icon to a checkmark for 2 seconds
3. WHEN saving webhook config, THE System SHALL show a loading spinner on the save button
4. WHEN webhook save succeeds, THE System SHALL show a success toast "Webhook configurado com sucesso!"
5. WHEN an operation fails, THE System SHALL show an error toast with the error message
