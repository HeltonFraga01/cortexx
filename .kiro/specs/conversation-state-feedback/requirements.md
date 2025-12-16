# Requirements Document

## Introduction

Este documento especifica os requisitos para melhorar o feedback visual e a sincronização de estado na interface de chat quando ações são realizadas em conversas. Atualmente, quando o usuário executa ações como silenciar uma conversa, mudar status, atribuir bot ou adicionar labels, a ação é executada com sucesso mas a interface não reflete imediatamente a mudança - os botões não mudam, os ícones não aparecem e os indicadores visuais não são atualizados até que a página seja recarregada ou o cache seja atualizado.

## Glossary

- **Conversation_State_System**: Sistema responsável por gerenciar e exibir o estado atual de uma conversa (muted, status, bot assignment, labels)
- **Optimistic_Update**: Técnica de atualização da UI antes da confirmação do servidor, revertendo em caso de erro
- **Visual_Indicator**: Elemento visual que mostra o estado atual de uma propriedade da conversa
- **State_Synchronization**: Processo de manter a UI sincronizada com o estado do servidor
- **Conversation_List**: Lista lateral de conversas que mostra preview e indicadores de estado
- **Conversation_Header**: Área superior da conversa que mostra nome do contato, avatar e indicadores de estado
- **Contact_Panel**: Painel lateral direito que mostra detalhes do contato e ações disponíveis

## Requirements

### Requirement 1: Mute/Unmute Feedback

**User Story:** As a user, I want to see immediate visual feedback when I mute/unmute a conversation, so that I know my action was successful.

#### Acceptance Criteria

1. WHEN a user clicks "Silenciar conversa" THEN the Conversation_State_System SHALL immediately update the dropdown menu to show "Ativar notificações"
2. WHEN a user mutes a conversation THEN the Conversation_State_System SHALL immediately display the BellOff icon next to the contact name in the Conversation_Header
3. WHEN a user unmutes a conversation THEN the Conversation_State_System SHALL immediately remove the BellOff icon from the Conversation_Header
4. WHEN a user mutes a conversation THEN the Conversation_State_System SHALL immediately display a mute indicator in the Conversation_List item
5. IF the mute operation fails THEN the Conversation_State_System SHALL revert the visual state and display an error toast

### Requirement 2: Status Change Feedback

**User Story:** As a user, I want to see immediate visual feedback when I change conversation status, so that I can confirm the action was applied.

#### Acceptance Criteria

1. WHEN a user changes conversation status (resolved, pending, snoozed, open) THEN the Conversation_State_System SHALL immediately update the status badge in the Conversation_Header
2. WHEN a user marks a conversation as resolved THEN the Conversation_State_System SHALL immediately show the green "Resolvida" badge
3. WHEN a user marks a conversation as pending THEN the Conversation_State_System SHALL immediately show the yellow "Pendente" badge
4. WHEN a user snoozes a conversation THEN the Conversation_State_System SHALL immediately show the blue "Adiada" badge
5. WHEN a user reopens a conversation THEN the Conversation_State_System SHALL immediately remove the status badge
6. WHEN a conversation status changes THEN the Conversation_State_System SHALL update the Conversation_List item styling immediately
7. IF the status update fails THEN the Conversation_State_System SHALL revert the visual state and display an error toast

### Requirement 3: Bot Assignment Feedback

**User Story:** As a user, I want to see immediate visual feedback when I assign or remove a bot from a conversation, so that I can confirm the bot is active.

#### Acceptance Criteria

1. WHEN a user assigns a bot to a conversation THEN the Conversation_State_System SHALL immediately display the bot indicator in the Conversation_Header
2. WHEN a user removes a bot from a conversation THEN the Conversation_State_System SHALL immediately remove the bot indicator from the Conversation_Header
3. WHEN a bot is assigned THEN the Conversation_State_System SHALL immediately update the Contact_Panel to show the assigned bot information
4. WHEN a bot assignment changes THEN the Conversation_State_System SHALL update the Conversation_List item to show bot indicator
5. IF the bot assignment fails THEN the Conversation_State_System SHALL revert the visual state and display an error toast

### Requirement 4: Label Management Feedback

**User Story:** As a user, I want to see immediate visual feedback when I add or remove labels from a conversation, so that I can confirm the labels are applied.

#### Acceptance Criteria

1. WHEN a user adds a label to a conversation THEN the Conversation_State_System SHALL immediately display the label in the Contact_Panel
2. WHEN a user removes a label from a conversation THEN the Conversation_State_System SHALL immediately remove the label from the Contact_Panel
3. WHEN labels change THEN the Conversation_State_System SHALL update the Conversation_List item to reflect the new labels
4. IF the label operation fails THEN the Conversation_State_System SHALL revert the visual state and display an error toast

### Requirement 5: Conversation List Synchronization

**User Story:** As a user, I want the conversation list to reflect state changes immediately, so that I can see the updated state across the entire interface.

#### Acceptance Criteria

1. WHEN any conversation state changes THEN the Conversation_State_System SHALL update the Conversation_List within 500ms
2. WHILE a conversation is muted THEN the Conversation_State_System SHALL display a BellOff icon in the Conversation_List item
3. WHILE a conversation has a non-open status THEN the Conversation_State_System SHALL display the appropriate status indicator in the Conversation_List item
4. WHILE a conversation has an assigned bot THEN the Conversation_State_System SHALL display a bot indicator in the Conversation_List item
5. WHEN a conversation state changes THEN the Conversation_State_System SHALL update any active filters or counts immediately

### Requirement 6: Visual Consistency

**User Story:** As a user, I want consistent visual indicators across all views, so that I can easily understand the state of my conversations.

#### Acceptance Criteria

1. WHILE a conversation is muted THEN the Conversation_State_System SHALL use the same BellOff icon style in both Conversation_Header and Conversation_List
2. WHILE a conversation has a status badge THEN the Conversation_State_System SHALL use consistent colors (green for resolved, yellow for pending, blue for snoozed)
3. WHILE a conversation has an assigned bot THEN the Conversation_State_System SHALL display the bot avatar or icon consistently across all views
4. WHEN displaying state indicators THEN the Conversation_State_System SHALL use muted-foreground color for inactive states and primary colors for active states

### Requirement 7: Loading States

**User Story:** As a user, I want to see loading indicators during state changes, so that I know an action is in progress.

#### Acceptance Criteria

1. WHILE a state change operation is pending THEN the Conversation_State_System SHALL disable the action button to prevent duplicate actions
2. WHILE a state change operation is pending THEN the Conversation_State_System SHALL display a loading spinner on the action button
3. WHEN a state change completes successfully THEN the Conversation_State_System SHALL remove the loading indicator and show the updated state
4. IF a state change fails THEN the Conversation_State_System SHALL remove the loading indicator and restore the previous state
