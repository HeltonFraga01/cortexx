# Requirements Document

## Introduction

Este documento especifica os requisitos para resolver problemas sistêmicos de inconsistência na transformação de dados entre backend e frontend. Durante a correção da funcionalidade "Silenciar conversa", foram identificados três problemas críticos que afetam múltiplas funcionalidades do sistema:

1. **Duplicação de código**: Múltiplas implementações do mesmo método (ex: `getConversations`) com comportamentos diferentes
2. **Transformação inconsistente**: Uso de `extractData` em vez de `extractAndTransform` em endpoints que retornam dados com campos snake_case
3. **Conversão de tipos SQLite**: Campos booleanos armazenados como INTEGER (0/1) não são consistentemente convertidos para boolean no JavaScript

Esses problemas causam bugs silenciosos onde a UI não reflete corretamente o estado do servidor.

## Glossary

- **Data_Transformation_Layer**: Camada responsável por converter dados entre formatos do banco (snake_case, INTEGER) e formatos do frontend (camelCase, boolean)
- **snake_case**: Convenção de nomenclatura com underscores (ex: `is_muted`, `created_at`)
- **camelCase**: Convenção de nomenclatura JavaScript (ex: `isMuted`, `createdAt`)
- **SQLite_Boolean**: Representação de booleanos no SQLite como INTEGER (0 = false, 1 = true)
- **extractData**: Função que extrai dados da resposta da API sem transformação
- **extractAndTransform**: Função que extrai dados e aplica transformação snake_case → camelCase
- **ChatService**: Serviço backend responsável por operações de chat e conversas
- **Response_Transformer**: Utilitário que padroniza a transformação de respostas do backend

## Requirements

### Requirement 1: Backend Response Standardization

**User Story:** As a developer, I want all backend services to return data in a consistent format, so that the frontend can reliably consume the data without transformation bugs.

#### Acceptance Criteria

1. WHEN the ChatService returns conversation data THEN the Data_Transformation_Layer SHALL convert all snake_case fields to camelCase
2. WHEN the ChatService returns boolean fields (is_muted, is_active, is_default) THEN the Data_Transformation_Layer SHALL convert SQLite_Boolean (0/1) to JavaScript boolean (true/false)
3. WHEN the BotService returns bot data THEN the Data_Transformation_Layer SHALL convert is_default and include_history to boolean
4. WHEN the OutgoingWebhookService returns webhook data THEN the Data_Transformation_Layer SHALL convert is_active to boolean
5. IF a service method is duplicated THEN the Data_Transformation_Layer SHALL consolidate into a single implementation

### Requirement 2: Frontend API Client Consistency

**User Story:** As a developer, I want the frontend API client to use consistent data extraction methods, so that all API responses are properly transformed.

#### Acceptance Criteria

1. WHEN the chat service calls an endpoint that returns snake_case data THEN the chat service SHALL use extractAndTransform instead of extractData
2. WHEN the chat service receives conversation data THEN the chat service SHALL ensure isMuted, isActive, and other boolean fields are JavaScript booleans
3. WHEN the chat service receives bot data THEN the chat service SHALL ensure isDefault and includeHistory are JavaScript booleans
4. WHEN the chat service receives webhook data THEN the chat service SHALL ensure isActive is a JavaScript boolean
5. IF extractData is used THEN the chat service SHALL only use it for endpoints that return data already in camelCase format

### Requirement 3: Response Transformer Utility

**User Story:** As a developer, I want a centralized response transformer utility, so that data transformation logic is not duplicated across services.

#### Acceptance Criteria

1. WHEN transforming conversation data THEN the Response_Transformer SHALL provide a transformConversation function
2. WHEN transforming bot data THEN the Response_Transformer SHALL provide a transformBot function
3. WHEN transforming webhook data THEN the Response_Transformer SHALL provide a transformWebhook function
4. WHEN transforming any data THEN the Response_Transformer SHALL handle null/undefined values gracefully
5. WHEN transforming boolean fields THEN the Response_Transformer SHALL convert 0/1, "0"/"1", and null to proper booleans

### Requirement 4: Code Deduplication

**User Story:** As a developer, I want to eliminate duplicate method implementations, so that changes are applied consistently across the codebase.

#### Acceptance Criteria

1. WHEN the ChatService has multiple getConversations implementations THEN the Data_Transformation_Layer SHALL consolidate into a single method
2. WHEN consolidating methods THEN the Data_Transformation_Layer SHALL preserve all functionality from both implementations
3. WHEN consolidating methods THEN the Data_Transformation_Layer SHALL ensure all callers receive consistent data format
4. IF a method has different return formats for different callers THEN the Data_Transformation_Layer SHALL standardize on camelCase with proper boolean conversion

### Requirement 5: Type Safety

**User Story:** As a developer, I want TypeScript types to accurately reflect the data format, so that type errors catch transformation bugs at compile time.

#### Acceptance Criteria

1. WHEN defining Conversation type THEN the type definition SHALL use boolean for isMuted, not number or any
2. WHEN defining AgentBot type THEN the type definition SHALL use boolean for isDefault and includeHistory
3. WHEN defining OutgoingWebhook type THEN the type definition SHALL use boolean for isActive
4. WHEN the backend returns data THEN the frontend types SHALL match the transformed data format exactly
5. IF a type mismatch exists between backend response and frontend type THEN the transformation layer SHALL resolve it

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the changes to be backward compatible, so that existing functionality continues to work during the migration.

#### Acceptance Criteria

1. WHEN updating transformation logic THEN the Data_Transformation_Layer SHALL not break existing API contracts
2. WHEN consolidating duplicate methods THEN the Data_Transformation_Layer SHALL ensure all existing callers continue to work
3. WHEN adding new transformer functions THEN the Data_Transformation_Layer SHALL not require changes to existing code that already works correctly
4. IF a breaking change is necessary THEN the Data_Transformation_Layer SHALL provide a migration path

### Requirement 7: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for data transformation, so that transformation bugs are caught before deployment.

#### Acceptance Criteria

1. WHEN transforming conversation data THEN the test suite SHALL verify isMuted is a boolean
2. WHEN transforming bot data THEN the test suite SHALL verify isDefault and includeHistory are booleans
3. WHEN transforming webhook data THEN the test suite SHALL verify isActive is a boolean
4. WHEN transforming data with null/undefined values THEN the test suite SHALL verify graceful handling
5. WHEN transforming data with edge cases (empty strings, "0", "1") THEN the test suite SHALL verify correct boolean conversion
