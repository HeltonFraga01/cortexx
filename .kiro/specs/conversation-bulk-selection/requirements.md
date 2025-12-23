# Requirements Document

## Introduction

Este documento define os requisitos para implementar a funcionalidade de seleção em massa de conversas e corrigir os botões de ação rápida (QuickActions) na interface de chat. A funcionalidade permite que usuários selecionem múltiplas conversas (ou todas) para executar ações em lote, além de garantir que os botões individuais de cada conversa funcionem corretamente.

## Glossary

- **Conversation_List**: Lista lateral de conversas (InboxSidebar)
- **Bulk_Selection_Mode**: Modo de seleção em massa onde checkboxes são exibidos
- **Selection_Toolbar**: Barra de ferramentas que aparece quando há conversas selecionadas
- **Bulk_Action**: Ação executada em múltiplas conversas simultaneamente
- **Quick_Actions**: Botões de ação rápida que aparecem no hover de cada conversa

## Requirements

### Requirement 1: Correção dos Botões de Ação Rápida (QuickActions)

**User Story:** As a user, I want the quick action buttons on each conversation to work properly, so that I can quickly mark as read, mute, or resolve conversations.

#### Acceptance Criteria

1. WHEN the user clicks the "Mark as Read" button on a conversation, THE System SHALL mark all messages in that conversation as read and update the unread count to zero
2. WHEN the user clicks the "Mute" button on a conversation, THE System SHALL toggle the mute state and update the icon accordingly
3. WHEN the user clicks the "Resolve" button on a conversation, THE System SHALL change the conversation status to "resolved"
4. WHEN a quick action is executed, THE System SHALL show a toast notification confirming the action
5. IF a quick action fails, THEN THE System SHALL show an error toast with the failure reason

### Requirement 2: Ativação do Modo de Seleção

**User Story:** As a user, I want to enter a selection mode to select multiple conversations, so that I can perform bulk actions efficiently.

#### Acceptance Criteria

1. WHEN the user clicks on a "Select" button in the header, THE Conversation_List SHALL enter Bulk_Selection_Mode
2. WHEN in Bulk_Selection_Mode, THE Conversation_List SHALL display a checkbox next to each conversation item
3. WHEN in Bulk_Selection_Mode, THE Conversation_List SHALL display a "Select All" checkbox in the header
4. WHEN the user clicks "Cancel" or presses Escape, THE Conversation_List SHALL exit Bulk_Selection_Mode and clear all selections

### Requirement 3: Seleção Individual e em Massa

**User Story:** As a user, I want to select individual conversations or all at once, so that I can choose exactly which conversations to act upon.

#### Acceptance Criteria

1. WHEN the user clicks on a conversation checkbox, THE System SHALL toggle the selection state of that conversation
2. WHEN the user clicks "Select All" checkbox, THE System SHALL select all visible conversations in the current filter/view
3. WHEN all conversations are selected and user clicks "Select All", THE System SHALL deselect all conversations
4. WHEN some conversations are selected, THE "Select All" checkbox SHALL display an indeterminate state

### Requirement 4: Barra de Ações em Lote

**User Story:** As a user, I want to see available bulk actions when conversations are selected, so that I can quickly perform operations on multiple conversations.

#### Acceptance Criteria

1. WHEN one or more conversations are selected, THE Selection_Toolbar SHALL appear showing the count of selected items
2. WHEN displaying the toolbar, THE Selection_Toolbar SHALL show action buttons: "Mark as Read", "Mark as Unread", "Resolve", "Delete"
3. WHEN the user clicks a bulk action, THE System SHALL execute the action on all selected conversations
4. WHEN a bulk action completes successfully, THE System SHALL show a success toast with the count of affected conversations
5. IF a bulk action fails, THEN THE System SHALL show an error message and indicate which conversations failed
6. WHEN a bulk action completes, THE System SHALL exit Bulk_Selection_Mode and clear selections

### Requirement 5: Feedback Visual de Seleção

**User Story:** As a user, I want clear visual feedback when conversations are selected, so that I can easily see which items are included in my selection.

#### Acceptance Criteria

1. WHEN a conversation is selected, THE Conversation_List SHALL highlight it with a distinct background color (primary/20)
2. WHEN in Bulk_Selection_Mode, THE Conversation_List SHALL show the checkbox with a smooth transition animation
3. WHEN the selection count changes, THE Selection_Toolbar SHALL update the count immediately
4. WHEN all conversations are selected, THE System SHALL display "Todas selecionadas" text instead of just the count

### Requirement 6: Integração com Filtros

**User Story:** As a user, I want my selection to work correctly with filters, so that I can manage conversations by category.

#### Acceptance Criteria

1. WHEN the user changes the conversation filter or tab, THE System SHALL clear the current selection and exit Bulk_Selection_Mode
2. WHEN "Select All" is clicked, THE System SHALL only select conversations matching the current filter/tab
3. WHEN a selected conversation receives a new message, THE System SHALL maintain its selected state

