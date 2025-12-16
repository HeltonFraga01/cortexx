# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o tratamento de tipos de mensagens do WhatsApp que atualmente são exibidas como "[Mensagem não suportada]" no chat do WUZAPI Manager. O objetivo é identificar, processar e exibir corretamente todos os tipos de mensagens recebidas via WUZAPI, incluindo mensagens de protocolo, mensagens editadas, reações, enquetes, e mensagens de sistema.

## Glossary

- **Chat_System**: O sistema de chat do WUZAPI Manager que exibe mensagens do WhatsApp
- **WUZAPI**: API de integração com WhatsApp baseada na biblioteca whatsmeow
- **Protocol_Message**: Mensagem de protocolo do WhatsApp (edição, deleção, revogação)
- **Sender_Key_Distribution_Message**: Mensagem de distribuição de chave de criptografia para grupos (mensagem de sistema, não deve ser exibida)
- **Edited_Message**: Mensagem que foi editada pelo remetente
- **Poll_Message**: Mensagem de enquete com opções de votação
- **View_Once_Message**: Mensagem de visualização única (foto/vídeo que desaparece)
- **Buttons_Message**: Mensagem com botões interativos
- **List_Message**: Mensagem com lista de opções selecionáveis
- **Template_Message**: Mensagem de template do WhatsApp Business
- **Enc_Comment_Message**: Comentário criptografado em canais/newsletters
- **Message_Handler**: Componente backend que processa webhooks de mensagens do WUZAPI

## Requirements

### Requirement 1

**User Story:** As a user, I want system messages (like encryption key distribution) to be silently ignored, so that my chat is not cluttered with technical messages.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a senderKeyDistributionMessage THEN the Chat_System SHALL silently ignore the message without storing or displaying it
2. WHEN the Message_Handler receives a messageContextInfo without other content THEN the Chat_System SHALL silently ignore the message
3. WHEN a system message is ignored THEN the Chat_System SHALL log the event at debug level for troubleshooting

### Requirement 2

**User Story:** As a user, I want to see when a message has been edited, so that I know the content was modified after being sent.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a protocolMessage with type 14 (MESSAGE_EDIT) THEN the Chat_System SHALL update the original message content with the edited content
2. WHEN a message is edited THEN the Chat_System SHALL display an "(editada)" indicator next to the message timestamp
3. WHEN the Message_Handler receives an editedMessage wrapper THEN the Chat_System SHALL extract and display the inner message content with edit indicator
4. WHEN the original message cannot be found for editing THEN the Chat_System SHALL store the edited message as a new message with edit indicator

### Requirement 3

**User Story:** As a user, I want to see when a message has been deleted, so that I understand why a message is no longer visible.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a protocolMessage with type 0 (REVOKE) THEN the Chat_System SHALL mark the original message as deleted
2. WHEN a message is marked as deleted THEN the Chat_System SHALL display "🚫 Esta mensagem foi apagada" in place of the original content
3. WHEN the original message cannot be found for deletion THEN the Chat_System SHALL log a warning and ignore the deletion request

### Requirement 4

**User Story:** As a user, I want to see poll messages with their options, so that I can understand what question was asked.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a pollCreationMessage THEN the Chat_System SHALL extract the poll question and options
2. WHEN displaying a poll message THEN the Chat_System SHALL show the question text followed by a numbered list of options
3. WHEN the Message_Handler receives a pollUpdateMessage THEN the Chat_System SHALL display it as a vote notification

### Requirement 5

**User Story:** As a user, I want to see an indicator for view-once messages, so that I know a disappearing media was sent.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a viewOnceMessage or viewOnceMessageV2 THEN the Chat_System SHALL extract the inner media message
2. WHEN displaying a view-once message THEN the Chat_System SHALL show "📷 Foto de visualização única" or "🎥 Vídeo de visualização única" based on media type
3. WHEN a view-once message has already been viewed THEN the Chat_System SHALL display "Mídia de visualização única já visualizada"

### Requirement 6

**User Story:** As a user, I want to see button and list messages with their content, so that I understand interactive messages sent by businesses.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a buttonsMessage THEN the Chat_System SHALL display the message text followed by button labels
2. WHEN the Message_Handler receives a buttonsResponseMessage THEN the Chat_System SHALL display the selected button text
3. WHEN the Message_Handler receives a listMessage THEN the Chat_System SHALL display the message text followed by section titles
4. WHEN the Message_Handler receives a listResponseMessage THEN the Chat_System SHALL display the selected item title

### Requirement 7

**User Story:** As a user, I want to see template messages with their content, so that I can read business notifications.

#### Acceptance Criteria

1. WHEN the Message_Handler receives a templateMessage THEN the Chat_System SHALL extract and display the template content
2. WHEN a template contains a hydratedFourRowTemplate THEN the Chat_System SHALL display the title, body, and footer text
3. WHEN a template contains buttons THEN the Chat_System SHALL display button labels below the message

### Requirement 8

**User Story:** As a user, I want encrypted channel comments to be handled gracefully, so that I don't see error messages for newsletter content.

#### Acceptance Criteria

1. WHEN the Message_Handler receives an encCommentMessage THEN the Chat_System SHALL display "💬 Comentário em canal" as placeholder
2. WHEN the encrypted comment cannot be decrypted THEN the Chat_System SHALL NOT display an error message to the user

### Requirement 9

**User Story:** As a developer, I want comprehensive logging for unknown message types, so that I can identify and implement support for new message types.

#### Acceptance Criteria

1. WHEN the Message_Handler receives an unknown message type THEN the Chat_System SHALL log the message type and structure at warn level
2. WHEN logging unknown message types THEN the Chat_System SHALL include the message keys and a truncated content sample
3. WHEN an unknown message type is encountered THEN the Chat_System SHALL display a user-friendly message indicating the type if identifiable

### Requirement 10

**User Story:** As a user, I want the frontend to display appropriate icons and labels for special message types, so that I can quickly identify the message category.

#### Acceptance Criteria

1. WHEN displaying an edited message THEN the Chat_System SHALL show a pencil icon (✏️) next to the timestamp
2. WHEN displaying a deleted message THEN the Chat_System SHALL show the message in italic with reduced opacity
3. WHEN displaying a poll message THEN the Chat_System SHALL show a poll icon (📊) before the question
4. WHEN displaying a view-once message THEN the Chat_System SHALL show a timer icon (⏱️) indicating ephemeral content
5. WHEN displaying a button/list message THEN the Chat_System SHALL show an interactive icon (🔘) before the content

