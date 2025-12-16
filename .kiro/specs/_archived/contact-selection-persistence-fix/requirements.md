# Requirements Document

## Introduction

Este documento define os requisitos para corrigir o bug de persistência de seleção de contatos durante múltiplas operações de busca no sistema de gerenciamento de contatos do WUZAPI Manager. Atualmente, quando um usuário seleciona contatos em diferentes buscas, apenas os contatos visíveis na busca atual são enviados para o disparador de mensagens, perdendo as seleções anteriores.

## Glossary

- **Contact Selection System**: Sistema responsável por gerenciar a seleção de contatos pelo usuário
- **Filtered Contacts**: Lista de contatos que correspondem aos critérios de busca e filtros ativos
- **Selected Contacts**: Conjunto de contatos marcados pelo usuário para envio de mensagens
- **Search State**: Estado atual da busca de contatos (texto de busca, filtros aplicados)
- **Message Dispatcher**: Componente responsável por enviar mensagens em massa para contatos selecionados

## Requirements

### Requirement 1

**User Story:** As a user, I want my contact selections to persist across multiple searches, so that I can select contacts from different search results and send messages to all of them

#### Acceptance Criteria

1. WHEN a user selects a contact from search results, THE Contact Selection System SHALL maintain that selection even when the search query changes
2. WHEN a user changes the search query, THE Contact Selection System SHALL preserve all previously selected contact IDs in the selection state
3. WHEN a user clicks "Enviar Mensagem", THE Contact Selection System SHALL retrieve all selected contacts from the complete contact list, not just from the currently filtered results
4. WHEN a user views the selection count indicator, THE Contact Selection System SHALL display the total number of selected contacts regardless of current search filters
5. WHILE viewing filtered search results, THE Contact Selection System SHALL visually indicate which contacts are selected, including those selected in previous searches

### Requirement 2

**User Story:** As a user, I want to see all my selected contacts in the selection indicator, so that I can verify which contacts will receive messages before sending

#### Acceptance Criteria

1. WHEN a user has selected contacts from multiple searches, THE Contact Selection System SHALL display all selected contact names or phone numbers in the selection indicator
2. WHEN the selection indicator shows selected contacts, THE Contact Selection System SHALL allow the user to remove individual contacts from the selection
3. WHEN a user removes a contact from the selection indicator, THE Contact Selection System SHALL update the selection state immediately
4. THE Contact Selection System SHALL display selected contacts in the indicator even if they are not currently visible in the filtered results

### Requirement 3

**User Story:** As a user, I want the system to correctly pass all selected contacts to the message dispatcher, so that my messages reach all intended recipients

#### Acceptance Criteria

1. WHEN a user clicks "Enviar Mensagem" with multiple contacts selected, THE Contact Selection System SHALL retrieve contact data from the complete unfiltered contact list
2. WHEN retrieving selected contacts for message sending, THE Contact Selection System SHALL use the selected IDs to find contacts in the full contact array, not the filtered array
3. WHEN navigating to the message dispatcher, THE Contact Selection System SHALL pass all selected contact objects with complete data (phone, name, variables)
4. THE Contact Selection System SHALL maintain selection state in sessionStorage to persist across page navigation
5. IF a selected contact ID cannot be found in the contact list, THEN THE Contact Selection System SHALL log a warning and exclude that contact from the message batch

### Requirement 4

**User Story:** As a user, I want to clear my selection or remove individual contacts, so that I can manage my recipient list effectively

#### Acceptance Criteria

1. WHEN a user clicks "Limpar" in the selection indicator, THE Contact Selection System SHALL remove all contacts from the selection state
2. WHEN a user removes a specific contact from the selection, THE Contact Selection System SHALL update the selection count immediately
3. THE Contact Selection System SHALL provide visual feedback when contacts are added or removed from the selection
4. WHEN the selection is cleared, THE Contact Selection System SHALL remove the selection data from sessionStorage
