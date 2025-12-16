# Requirements Document

## Introduction

Este documento especifica melhorias no sistema de identificação e exibição de nomes de grupos no chat do WhatsApp. O sistema atual já possui funcionalidade básica de detecção de nomes inválidos e busca via API, mas precisa de melhorias na captura de nomes vindos dos webhooks e na atualização automática quando novos webhooks chegam com informações atualizadas.

## Glossary

- **WUZAPI**: API externa do WhatsApp Business que envia webhooks com eventos de mensagens
- **Webhook**: Evento HTTP POST enviado pela WUZAPI quando ocorre uma ação no WhatsApp
- **Group JID**: Identificador único de um grupo no WhatsApp (formato: `número@g.us`)
- **Contact JID**: Identificador único de um contato no WhatsApp (formato: `número@s.whatsapp.net`)
- **Conversation**: Registro no banco de dados que representa uma conversa (individual ou grupo)
- **ChatMessageHandler**: Serviço que processa webhooks recebidos da WUZAPI
- **Group Name**: Nome legível do grupo do WhatsApp
- **Invalid Group Name**: Nome que é na verdade um JID, número, ou placeholder genérico

## Requirements

### Requirement 1

**User Story:** Como usuário do chat, eu quero ver o nome real dos grupos do WhatsApp, para que eu possa identificar facilmente as conversas em grupo.

#### Acceptance Criteria

1. WHEN a WUZAPI webhook arrives with a group message THEN the System SHALL extract the group name from all available webhook fields (GroupName, Name, Subject, ChatName)
2. WHEN a group name is extracted from a webhook THEN the System SHALL validate it is not an invalid format (JID, pure numbers, or generic placeholder)
3. WHEN a valid group name is found in a webhook THEN the System SHALL update the conversation record immediately
4. WHEN a webhook contains an invalid or missing group name THEN the System SHALL fetch the group name from the WUZAPI API
5. WHEN a group name is fetched from the API THEN the System SHALL store it in the conversation record

### Requirement 2

**User Story:** Como desenvolvedor, eu quero logs detalhados do processamento de nomes de grupos, para que eu possa diagnosticar problemas de identificação.

#### Acceptance Criteria

1. WHEN a webhook is processed THEN the System SHALL log all available name fields from the webhook payload
2. WHEN a group name validation occurs THEN the System SHALL log the validation result and reason
3. WHEN a group name is updated THEN the System SHALL log the old name, new name, and source (webhook or API)
4. WHEN an API call is made to fetch a group name THEN the System SHALL log the request and response
5. WHEN an error occurs during name processing THEN the System SHALL log the error with full context

### Requirement 3

**User Story:** Como usuário do chat, eu quero que os nomes dos grupos sejam atualizados automaticamente quando mudarem no WhatsApp, para que eu sempre veja informações atualizadas.

#### Acceptance Criteria

1. WHEN a webhook arrives with a different valid group name THEN the System SHALL update the stored name
2. WHEN a conversation is created from a webhook THEN the System SHALL attempt to get the best available name immediately
3. WHEN multiple webhooks arrive for the same group THEN the System SHALL use the most recent valid name
4. WHEN a user opens a conversation with an invalid name THEN the System SHALL trigger an automatic name refresh
5. WHEN a name refresh completes THEN the System SHALL broadcast the update via WebSocket to connected clients

### Requirement 4

**User Story:** Como administrador do sistema, eu quero que o sistema seja resiliente a falhas na API WUZAPI, para que conversas continuem funcionando mesmo quando a API está indisponível.

#### Acceptance Criteria

1. WHEN the WUZAPI API is unavailable THEN the System SHALL use the best available name from the webhook
2. WHEN an API call fails THEN the System SHALL log the error but continue processing the message
3. WHEN a group name cannot be determined THEN the System SHALL use a formatted fallback based on the Group JID
4. WHEN the API returns an error THEN the System SHALL retry with exponential backoff up to 3 times
5. WHEN all retries fail THEN the System SHALL store a temporary name and mark it for later refresh

### Requirement 5

**User Story:** Como desenvolvedor, eu quero uma função centralizada para obter nomes de grupos, para que a lógica seja consistente em todo o sistema.

#### Acceptance Criteria

1. WHEN any part of the system needs a group name THEN the System SHALL use a centralized function
2. WHEN the centralized function is called THEN the System SHALL check the database first
3. WHEN the database has a valid name THEN the System SHALL return it immediately
4. WHEN the database has an invalid name THEN the System SHALL fetch from the API
5. WHEN a new name is fetched THEN the System SHALL update the database and return the new name
