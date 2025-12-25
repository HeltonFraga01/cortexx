# Requirements Document

## Introduction

Este documento especifica os requisitos para modernizar a experiência de usuário (UX) e interface (UI) da página de edição de caixa de entrada (`/user/inboxes/edit/:inboxId`). O objetivo é criar uma interface mais moderna, intuitiva e visualmente atraente, seguindo padrões de design contemporâneos como layouts em tabs, cards com gradientes sutis, micro-interações e melhor hierarquia visual.

## Glossary

- **Inbox_Edit_Page**: Página de edição de caixa de entrada em `/user/inboxes/edit/:inboxId`
- **Tab_Navigation**: Sistema de navegação por abas para organizar seções da página
- **Connection_Card**: Card principal exibindo status de conexão e informações da inbox
- **Quick_Actions**: Ações rápidas acessíveis diretamente no header da página
- **Webhook_Section**: Seção de configuração de webhooks
- **Bot_Section**: Seção de integração com bots
- **Status_Indicator**: Indicador visual de status de conexão (online/offline/conectando)

## Requirements

### Requirement 1: Layout em Tabs para Organização de Conteúdo

**User Story:** Como usuário, quero navegar entre diferentes seções da configuração da inbox usando tabs, para encontrar rapidamente o que preciso sem scroll excessivo.

#### Acceptance Criteria

1. THE Inbox_Edit_Page SHALL display a Tab_Navigation component with the following tabs: "Visão Geral", "Webhooks", "Automação"
2. WHEN the user clicks on a tab, THE System SHALL display the corresponding section content without page reload
3. THE Tab_Navigation SHALL persist the active tab state in the URL query parameter for shareability
4. WHEN the page loads with a tab query parameter, THE System SHALL automatically activate that tab
5. THE Tab_Navigation SHALL use smooth transitions when switching between tabs

### Requirement 2: Header Modernizado com Status em Tempo Real

**User Story:** Como usuário, quero ver o status da minha conexão WhatsApp de forma clara e proeminente no topo da página, para saber imediatamente se posso enviar mensagens.

#### Acceptance Criteria

1. THE Inbox_Edit_Page SHALL display a modernized header with inbox name, avatar, and connection status
2. THE Status_Indicator SHALL use animated pulse effect when the connection is active (logado)
3. THE Status_Indicator SHALL display different colors: green for "Logado", yellow for "Conectado", gray for "Offline"
4. WHEN the connection status changes, THE System SHALL update the Status_Indicator with a smooth transition
5. THE header SHALL include Quick_Actions buttons (QR Code, Refresh) with icon-only design on mobile
6. THE header SHALL display the phone number prominently when connected

### Requirement 3: Card de Conexão com Design Moderno

**User Story:** Como usuário, quero ver as informações da minha conexão em um card visualmente atraente com gradientes sutis, para ter uma experiência mais agradável.

#### Acceptance Criteria

1. THE Connection_Card SHALL use a subtle gradient background based on connection status (green gradient for connected, neutral for offline)
2. THE Connection_Card SHALL display avatar with a ring indicator showing connection status
3. THE Connection_Card SHALL organize information in a clear visual hierarchy: name > status > phone > ID
4. WHEN hovering over copyable fields, THE System SHALL show a tooltip indicating the field can be copied
5. THE Connection_Card SHALL use icons consistently for each information type (phone, key, hash)
6. THE Connection_Card SHALL include a "Detalhes" expandable section for less frequently accessed info (token, JID completo)

### Requirement 4: Ações de Conexão com Feedback Visual Aprimorado

**User Story:** Como usuário, quero feedback visual claro quando executo ações de conexão, para entender o que está acontecendo.

#### Acceptance Criteria

1. WHEN the user initiates a connection action, THE System SHALL display a loading state with skeleton animation
2. THE connection action buttons SHALL use distinct visual styles: primary for connect, outline for disconnect, destructive for logout
3. WHEN an action is in progress, THE System SHALL disable other action buttons to prevent conflicts
4. THE System SHALL display progress indicators for long-running operations (QR code generation)
5. WHEN an action completes, THE System SHALL show a success animation (checkmark) before returning to normal state
6. IF an action fails, THEN THE System SHALL display an inline error message with retry option

### Requirement 5: Seção de Webhooks Reorganizada

**User Story:** Como usuário, quero configurar webhooks de forma mais intuitiva, com categorias de eventos claramente organizadas.

#### Acceptance Criteria

1. THE Webhook_Section SHALL display a toggle switch for enabling/disabling webhooks globally
2. WHEN webhooks are disabled, THE System SHALL collapse the configuration options
3. THE Webhook_Section SHALL display event categories as expandable accordion items
4. WHEN a category is expanded, THE System SHALL show checkboxes for individual events with descriptions
5. THE Webhook_Section SHALL display a summary badge showing "X eventos selecionados" 
6. THE Webhook_Section SHALL include a "Testar Webhook" button to send a test payload
7. WHEN the webhook URL is invalid, THE System SHALL show inline validation error

### Requirement 6: Seção de Automação com Bot Cards

**User Story:** Como usuário, quero ver os bots disponíveis como cards visuais, para escolher facilmente qual bot atribuir à minha inbox.

#### Acceptance Criteria

1. THE Bot_Section SHALL display available bots as visual cards with avatar, name, and type
2. THE currently assigned bot card SHALL have a highlighted border and "Ativo" badge
3. WHEN the user clicks on a bot card, THE System SHALL assign that bot to the inbox
4. THE Bot_Section SHALL include a "Nenhum bot" option as a card to remove assignment
5. WHEN no bots are available, THE System SHALL display an empty state with link to create bot
6. THE Bot_Section SHALL show bot status (ativo/pausado) on each card

### Requirement 7: Responsividade e Mobile-First

**User Story:** Como usuário mobile, quero usar a página de edição de inbox confortavelmente no meu celular, com elementos adequadamente dimensionados.

#### Acceptance Criteria

1. THE Tab_Navigation SHALL use a scrollable horizontal layout on mobile screens
2. THE Connection_Card SHALL stack elements vertically on mobile screens
3. THE Quick_Actions SHALL collapse to icon-only buttons on screens smaller than 640px
4. THE Webhook_Section accordion SHALL use full-width layout on mobile
5. THE Bot_Section cards SHALL display in a single column on mobile screens
6. ALL touch targets SHALL have minimum size of 44x44 pixels for accessibility

### Requirement 8: Micro-interações e Animações

**User Story:** Como usuário, quero que a interface responda às minhas ações com animações sutis, para ter uma experiência mais fluida e moderna.

#### Acceptance Criteria

1. WHEN copying a field, THE System SHALL animate the copy icon to checkmark with a smooth transition
2. WHEN expanding/collapsing sections, THE System SHALL use smooth height transitions
3. WHEN hovering over interactive elements, THE System SHALL apply subtle scale or shadow effects
4. THE Status_Indicator pulse animation SHALL be subtle (opacity 0.5-1.0) to avoid distraction
5. WHEN switching tabs, THE System SHALL use a fade transition for content
6. THE loading states SHALL use skeleton animations instead of spinners where appropriate

