# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir a exibição do nome de grupos do WhatsApp na lista de conversas. Atualmente, quando mensagens são recebidas de grupos, o sistema está exibindo incorretamente o nome do participante que enviou a mensagem ou o número do JID do grupo (ex: `120363043775639115`) ao invés do nome real do grupo configurado no WhatsApp.

## Glossary

- **Chat System**: O sistema de chat do WUZAPI Manager que exibe conversas do WhatsApp
- **Group JID**: Identificador único do grupo no formato `número@g.us` (ex: `120363043775639115@g.us`)
- **Group Name**: Nome configurado do grupo no WhatsApp (ex: "Borabrother Iptv", "Lima Sat Iptv")
- **Participant**: Membro individual de um grupo do WhatsApp que envia mensagens
- **Push Name**: Nome de exibição configurado pelo usuário no WhatsApp
- **WUZAPI**: API de integração com WhatsApp Business utilizada pelo sistema
- **Conversation List**: Lista de conversas exibida na interface do chat

## Requirements

### Requirement 1

**User Story:** As a user, I want to see the correct group name in my conversation list, so that I can easily identify which group each conversation belongs to.

#### Acceptance Criteria

1. WHEN a message is received from a WhatsApp group THEN the Chat System SHALL fetch and store the group name from WUZAPI
2. WHEN displaying a group conversation in the list THEN the Chat System SHALL show the group name, not the participant name or JID
3. WHEN the WUZAPI group info API fails THEN the Chat System SHALL retry the fetch on subsequent messages until successful
4. WHEN the group name cannot be fetched THEN the Chat System SHALL display a formatted fallback (ex: "Grupo 120363...")
5. IF the stored group name matches a participant name THEN the Chat System SHALL re-fetch the correct group name from WUZAPI

### Requirement 2

**User Story:** As a user, I want group names to be updated when they change in WhatsApp, so that my conversation list stays current.

#### Acceptance Criteria

1. WHEN a group name is changed in WhatsApp THEN the Chat System SHALL update the stored name on the next message received
2. WHEN fetching group info THEN the Chat System SHALL compare with stored name and update if different
3. WHEN updating a group name THEN the Chat System SHALL persist the change immediately to the database

### Requirement 3

**User Story:** As a developer, I want the system to correctly differentiate between group names and participant names, so that the conversation list displays accurate information.

#### Acceptance Criteria

1. WHEN processing a group message THEN the Chat System SHALL use the group name for `contact_name` field, not the participant's PushName
2. WHEN creating a new group conversation THEN the Chat System SHALL fetch the group name before storing the conversation
3. WHEN the `contact_name` field contains a JID pattern (numbers followed by @g.us) THEN the Chat System SHALL attempt to fetch the real group name
4. WHEN the `contact_name` field is null or empty for a group THEN the Chat System SHALL fetch and populate the group name

