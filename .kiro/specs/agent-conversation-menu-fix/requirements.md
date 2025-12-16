# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o menu de opções de conversa na interface de chat do agent. Atualmente, existem dois problemas principais:

1. A permissão `conversations:manage` é usada em várias rotas do backend, mas não existe na lista de permissões disponíveis, causando erro 403 (Forbidden) quando agents tentam atualizar status de conversas.

2. A opção "Excluir conversa" aparece no menu para agents, mas agents não deveriam ter essa opção disponível - apenas usuários (owners) podem excluir conversas.

## Glossary

- **Agent**: Usuário com papel de atendente que pode visualizar, criar e atribuir conversas, mas não pode excluí-las
- **Owner/User**: Proprietário da conta que tem todas as permissões, incluindo excluir conversas
- **Conversation Status**: Estado da conversa (open, resolved, pending, snoozed)
- **Permission**: Autorização específica para realizar uma ação no sistema
- **conversations:manage**: Nova permissão que permite gerenciar conversas (atualizar status, silenciar, atribuir labels)

## Requirements

### Requirement 1

**User Story:** As an agent, I want to update conversation status (resolved, pending, snoozed), so that I can organize my workflow and track conversation progress.

#### Acceptance Criteria

1. WHEN an agent clicks "Marcar como resolvida" THEN the system SHALL update the conversation status to "resolved"
2. WHEN an agent clicks "Adiar conversa" THEN the system SHALL update the conversation status to "snoozed"
3. WHEN an agent clicks "Silenciar conversa" THEN the system SHALL toggle the conversation muted state
4. WHEN an agent clicks "Marcar como pendente" THEN the system SHALL update the conversation status to "pending"
5. WHEN the status update succeeds THEN the system SHALL display a success toast notification
6. WHEN the status update fails THEN the system SHALL display an error toast notification with the error message

### Requirement 2

**User Story:** As a system administrator, I want the permission system to include `conversations:manage`, so that agents can manage conversation properties without having delete permissions.

#### Acceptance Criteria

1. THE PermissionService SHALL include `conversations:manage` in the list of available permissions
2. THE default agent role SHALL include the `conversations:manage` permission
3. THE default administrator role SHALL include the `conversations:manage` permission
4. THE default viewer role SHALL NOT include the `conversations:manage` permission
5. WHEN an agent with `conversations:manage` permission updates a conversation THEN the system SHALL allow the operation
6. WHEN an agent without `conversations:manage` permission updates a conversation THEN the system SHALL return a 403 Forbidden error

### Requirement 3

**User Story:** As an agent, I should not see the delete conversation option, so that I don't accidentally try to delete conversations I'm not authorized to delete.

#### Acceptance Criteria

1. WHEN the chat interface is in agent mode THEN the system SHALL NOT display the "Excluir conversa" menu option
2. WHEN the chat interface is in user mode THEN the system SHALL display the "Excluir conversa" menu option
3. WHEN the chat interface is in agent mode THEN the system SHALL NOT display the delete confirmation dialog
4. THE menu separator before the delete option SHALL only appear when the delete option is visible

### Requirement 4

**User Story:** As an agent, I want to manage labels on conversations, so that I can categorize and organize conversations effectively.

#### Acceptance Criteria

1. WHEN an agent assigns a label to a conversation THEN the system SHALL add the label to the conversation
2. WHEN an agent removes a label from a conversation THEN the system SHALL remove the label from the conversation
3. WHEN the label operation succeeds THEN the system SHALL update the UI to reflect the change
4. WHEN the label operation fails THEN the system SHALL display an error toast notification

### Requirement 5

**User Story:** As an agent, I want to execute macros on conversations, so that I can automate repetitive tasks.

#### Acceptance Criteria

1. WHEN an agent executes a macro on a conversation THEN the system SHALL perform all macro actions
2. WHEN the macro execution succeeds THEN the system SHALL display a success notification
3. WHEN the macro execution fails THEN the system SHALL display an error notification with details
