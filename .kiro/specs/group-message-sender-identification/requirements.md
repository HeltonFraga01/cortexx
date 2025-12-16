# Requirements Document

## Introduction

Este documento especifica os requisitos para identificação de remetentes individuais em mensagens de grupos do WhatsApp. Atualmente, quando mensagens são recebidas de grupos, o sistema não exibe qual participante específico enviou cada mensagem, dificultando o acompanhamento de conversas e a identificação de quem está falando.

## Glossary

- **Chat System**: O sistema de chat do WUZAPI Manager que exibe conversas do WhatsApp
- **Group Message**: Mensagem recebida de um grupo do WhatsApp (identificado por JID terminando em `@g.us`)
- **Participant**: Membro individual de um grupo do WhatsApp que envia mensagens
- **Participant JID**: Identificador único do participante no formato `número@s.whatsapp.net`
- **Push Name**: Nome de exibição configurado pelo usuário no WhatsApp
- **WUZAPI**: API de integração com WhatsApp Business utilizada pelo sistema

## Requirements

### Requirement 1

**User Story:** As a user, I want to see who sent each message in a group chat, so that I can identify which participant is speaking and respond appropriately.

#### Acceptance Criteria

1. WHEN a message is received from a WhatsApp group THEN the Chat System SHALL extract and store the participant identifier from the message payload
2. WHEN displaying a group message THEN the Chat System SHALL show the participant's name or phone number before the message content
3. WHEN the participant has a Push Name THEN the Chat System SHALL display the Push Name as the sender identifier
4. WHEN the participant does not have a Push Name THEN the Chat System SHALL display the formatted phone number as the sender identifier
5. IF the participant identifier is missing from the message payload THEN the Chat System SHALL display "Unknown Participant" as the sender identifier

### Requirement 2

**User Story:** As a user, I want group messages to be visually distinct from individual chat messages, so that I can quickly understand the conversation context.

#### Acceptance Criteria

1. WHEN displaying a group message THEN the Chat System SHALL render the sender identifier in a distinct visual style (different color or font weight)
2. WHEN multiple consecutive messages are from the same participant THEN the Chat System SHALL group them visually while still showing the sender on the first message
3. WHEN a message is from a different participant than the previous message THEN the Chat System SHALL clearly separate the messages with the new sender identifier

### Requirement 3

**User Story:** As a developer, I want the system to correctly parse participant information from WUZAPI webhook payloads, so that sender identification works reliably.

#### Acceptance Criteria

1. WHEN processing a webhook payload from a group message THEN the Chat System SHALL extract the `participant` field from the message data
2. WHEN storing a group message THEN the Chat System SHALL persist the participant JID in the database alongside the message
3. WHEN the webhook payload contains `pushName` for the participant THEN the Chat System SHALL store and use this display name
4. WHEN parsing the participant JID THEN the Chat System SHALL extract the phone number portion (before `@s.whatsapp.net`)
5. WHEN serializing message data for the frontend THEN the Chat System SHALL include participant information in the response

### Requirement 4

**User Story:** As a user, I want to see participant information consistently across all message types in groups, so that I always know who sent what.

#### Acceptance Criteria

1. WHEN a text message is received from a group THEN the Chat System SHALL display the sender identifier
2. WHEN an audio message is received from a group THEN the Chat System SHALL display the sender identifier
3. WHEN an image message is received from a group THEN the Chat System SHALL display the sender identifier
4. WHEN a video message is received from a group THEN the Chat System SHALL display the sender identifier
5. WHEN a document message is received from a group THEN the Chat System SHALL display the sender identifier
6. WHEN a quoted/reply message is received from a group THEN the Chat System SHALL display both the sender of the reply and the original message sender

