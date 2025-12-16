# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir problemas críticos de transformação de dados identificados durante a auditoria do sistema. Os problemas afetam principalmente a comunicação via WebSocket e conversões de booleanos inconsistentes que podem causar bugs silenciosos na UI.

Os problemas identificados são:

1. **WebSocket `message_update`**: Envia dados em snake_case (`is_edited`, `is_deleted`) sem transformação no frontend
2. **WebSocket `conversation_update`**: Pode enviar dados em snake_case sem garantir transformação
3. **chatMessageHandler.js**: Usa `=== 1` em vez de `toBoolean()` para conversão de `is_muted`
4. **OutgoingWebhookService.getWebhookStats**: Usa `=== 1` em vez de `toBoolean()` para conversão de `success`
5. **Frontend inconsistência**: Alguns endpoints usam `extractData` quando deveriam usar padrão consistente

## Glossary

- **WebSocket_Handler**: Componente responsável por broadcast de eventos em tempo real via Socket.IO
- **toBoolean**: Função centralizada para conversão de booleanos SQLite (0/1) para JavaScript (true/false)
- **transformConversation**: Função centralizada para transformar dados de conversa de snake_case para camelCase
- **transformKeys**: Função do frontend para transformar chaves de objetos de snake_case para camelCase
- **broadcastMessageUpdate**: Método que envia atualizações de mensagens (edit/delete) via WebSocket
- **broadcastConversationUpdate**: Método que envia atualizações de conversas via WebSocket

## Requirements

### Requirement 1: WebSocket Message Update Transformation

**User Story:** As a user, I want message edit/delete updates to be correctly displayed in the UI, so that I can see the current state of messages in real-time.

#### Acceptance Criteria

1. WHEN the WebSocket_Handler broadcasts a message update THEN the Data_Transformation_Layer SHALL convert `is_edited` to `isEdited` (camelCase)
2. WHEN the WebSocket_Handler broadcasts a message update THEN the Data_Transformation_Layer SHALL convert `is_deleted` to `isDeleted` (camelCase)
3. WHEN the frontend receives a message update event THEN the frontend SHALL correctly parse boolean fields as JavaScript booleans

### Requirement 2: WebSocket Conversation Update Transformation

**User Story:** As a user, I want conversation updates to be correctly displayed in the UI, so that I can see muted status and other properties in real-time.

#### Acceptance Criteria

1. WHEN the WebSocket_Handler broadcasts a conversation update THEN the Data_Transformation_Layer SHALL use transformConversation function
2. WHEN the WebSocket_Handler broadcasts a conversation update THEN the Data_Transformation_Layer SHALL ensure `is_muted` is converted to `isMuted` as boolean
3. WHEN the WebSocket_Handler broadcasts a conversation update THEN the Data_Transformation_Layer SHALL ensure all snake_case fields are converted to camelCase

### Requirement 3: Centralized Boolean Conversion in chatMessageHandler

**User Story:** As a developer, I want all boolean conversions to use the centralized toBoolean function, so that conversion logic is consistent across the codebase.

#### Acceptance Criteria

1. WHEN chatMessageHandler checks if a conversation is muted THEN the chatMessageHandler SHALL use toBoolean(conversation.is_muted) instead of manual comparison
2. WHEN any service checks boolean fields from SQLite THEN the service SHALL use toBoolean function from responseTransformer

### Requirement 4: Centralized Boolean Conversion in OutgoingWebhookService

**User Story:** As a developer, I want webhook statistics to correctly display success/failure status, so that users can monitor webhook health.

#### Acceptance Criteria

1. WHEN OutgoingWebhookService returns delivery statistics THEN the service SHALL use toBoolean for success field conversion
2. WHEN mapping delivery records THEN the service SHALL ensure all boolean fields are proper JavaScript booleans

### Requirement 5: Frontend WebSocket Event Handling

**User Story:** As a developer, I want the frontend to consistently transform WebSocket event data, so that the UI always receives data in the expected format.

#### Acceptance Criteria

1. WHEN the frontend receives `message_update` event THEN the frontend SHALL apply transformKeys to convert snake_case to camelCase
2. WHEN the frontend receives `conversation_update` event THEN the frontend SHALL apply transformKeys to ensure consistent format
3. WHEN the frontend receives any WebSocket event with snake_case data THEN the frontend SHALL transform before processing

