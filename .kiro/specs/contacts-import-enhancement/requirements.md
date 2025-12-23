# Requirements Document

## Introduction

Este documento especifica as melhorias no sistema de importação e gerenciamento de contatos, incluindo detecção de duplicados, mesclagem de contatos, seleção de caixa de entrada para importação, e controle de importações incrementais.

## Glossary

- **Contact_Manager**: Sistema responsável pelo gerenciamento de contatos do usuário
- **Duplicate_Detector**: Componente que identifica contatos duplicados baseado em critérios de similaridade
- **Merge_Engine**: Componente que mescla dois ou mais contatos em um único registro
- **Import_Controller**: Componente que gerencia o processo de importação de contatos
- **Inbox_Selector**: Componente de UI para seleção de caixa de entrada
- **Inbox**: Caixa de entrada vinculada a uma conta, contendo token WUZAPI e configurações de WhatsApp
- **Account**: Conta do usuário que pode ter múltiplas inboxes

## Requirements

### Requirement 1: Seleção de Caixa de Entrada para Importação

**User Story:** As a user, I want to select which inbox to import contacts from, so that I can import contacts from the correct WhatsApp instance when I have multiple inboxes.

#### Acceptance Criteria

1. WHEN a user clicks the import button, THE Inbox_Selector SHALL display a list of available inboxes for the account
2. WHEN the account has only one inbox, THE Import_Controller SHALL automatically select that inbox without showing the selector
3. WHEN the account has multiple inboxes, THE Inbox_Selector SHALL require the user to select an inbox before proceeding
4. WHEN an inbox is selected, THE Import_Controller SHALL use the wuzapi_token from that specific inbox
5. WHEN displaying inboxes, THE Inbox_Selector SHALL show inbox name, phone number, and connection status
6. IF an inbox is not connected (wuzapi_connected = false), THEN THE Inbox_Selector SHALL display a warning and disable selection for that inbox

### Requirement 2: Importação Incremental de Contatos

**User Story:** As a user, I want the import process to only add new contacts or update changed information, so that I don't waste time re-importing the same contacts repeatedly.

#### Acceptance Criteria

1. WHEN importing contacts, THE Import_Controller SHALL compare incoming contacts with existing contacts by phone number
2. WHEN a contact phone already exists, THE Import_Controller SHALL update only if the name or other data has changed
3. WHEN a contact is new (phone not found), THE Import_Controller SHALL create a new contact record
4. WHEN import completes, THE Import_Controller SHALL display a summary showing: new contacts added, contacts updated, contacts unchanged
5. THE Import_Controller SHALL track the last import timestamp per inbox in the contact metadata
6. WHEN a contact is imported, THE Contact_Manager SHALL store the source inbox ID in the contact metadata

### Requirement 3: Detecção de Contatos Duplicados

**User Story:** As a user, I want the system to identify potential duplicate contacts, so that I can keep my contact list clean and organized.

#### Acceptance Criteria

1. THE Duplicate_Detector SHALL identify contacts with identical phone numbers (exact match)
2. THE Duplicate_Detector SHALL identify contacts with similar phone numbers (same number with different formatting)
3. THE Duplicate_Detector SHALL identify contacts with similar names (fuzzy matching with >80% similarity)
4. WHEN duplicates are detected, THE Contact_Manager SHALL display a notification with the count of potential duplicates
5. WHEN the user requests to view duplicates, THE Contact_Manager SHALL display a list grouped by duplicate sets
6. THE Duplicate_Detector SHALL run automatically after each import operation
7. THE Duplicate_Detector SHALL provide a manual trigger option in the contacts page

### Requirement 4: Mesclagem de Contatos Duplicados

**User Story:** As a user, I want to merge duplicate contacts into a single record, so that I can consolidate information and avoid confusion.

#### Acceptance Criteria

1. WHEN viewing duplicate contacts, THE Merge_Engine SHALL allow the user to select which contacts to merge
2. WHEN merging contacts, THE Merge_Engine SHALL allow the user to choose which data to keep for each field (name, avatar, metadata)
3. WHEN merging contacts, THE Merge_Engine SHALL preserve all tags from all merged contacts
4. WHEN merging contacts, THE Merge_Engine SHALL preserve all group memberships from all merged contacts
5. WHEN merge is confirmed, THE Merge_Engine SHALL create a single contact with the selected data
6. WHEN merge is confirmed, THE Merge_Engine SHALL delete the duplicate contacts that were merged
7. THE Merge_Engine SHALL maintain an audit log of merged contacts for reference
8. IF a merge operation fails, THEN THE Merge_Engine SHALL rollback all changes and notify the user

### Requirement 5: Interface de Gerenciamento de Duplicados

**User Story:** As a user, I want a dedicated interface to review and manage duplicate contacts, so that I can efficiently clean up my contact list.

#### Acceptance Criteria

1. THE Contact_Manager SHALL provide a "Duplicados" section in the contacts page
2. WHEN duplicates exist, THE Contact_Manager SHALL display a badge with the count of duplicate sets
3. WHEN viewing duplicates, THE Contact_Manager SHALL group contacts by similarity type (exact phone, similar phone, similar name)
4. THE Contact_Manager SHALL allow bulk merge operations for multiple duplicate sets
5. THE Contact_Manager SHALL allow dismissing false positives (marking as "not duplicate")
6. WHEN a duplicate set is dismissed, THE Duplicate_Detector SHALL not flag those contacts again

### Requirement 6: Rastreamento de Origem do Contato

**User Story:** As a user, I want to know which inbox each contact was imported from, so that I can track the source of my contacts.

#### Acceptance Criteria

1. WHEN a contact is imported, THE Import_Controller SHALL store the inbox_id in the contact metadata
2. WHEN displaying contact details, THE Contact_Manager SHALL show the source inbox name
3. THE Contact_Manager SHALL allow filtering contacts by source inbox
4. WHEN a contact is manually created, THE Contact_Manager SHALL mark the source as "manual"
