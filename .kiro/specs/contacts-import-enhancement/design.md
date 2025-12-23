# Design Document: Contacts Import Enhancement

## Overview

Este documento descreve o design técnico para as melhorias no sistema de importação e gerenciamento de contatos, incluindo seleção de inbox, importação incremental, detecção de duplicados e mesclagem de contatos.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ InboxSelector   │  │ DuplicatesPanel │  │ MergeContactsDialog │  │
│  │ Component       │  │ Component       │  │ Component           │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │              │
│  ┌────────▼────────────────────▼──────────────────────▼──────────┐  │
│  │                    useContacts Hook (enhanced)                 │  │
│  └────────────────────────────────┬──────────────────────────────┘  │
│                                   │                                  │
│  ┌────────────────────────────────▼──────────────────────────────┐  │
│  │                  contactsApiService.ts (enhanced)              │  │
│  └────────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (Express)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              userContactsRoutes.js (enhanced)                │    │
│  │  - GET /inboxes (list available inboxes)                     │    │
│  │  - POST /import/:inboxId (import from specific inbox)        │    │
│  │  - GET /duplicates (get duplicate sets)                      │    │
│  │  - POST /merge (merge contacts)                              │    │
│  │  - POST /duplicates/dismiss (dismiss false positives)        │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │                   ContactsService.js (enhanced)              │    │
│  │  - getAccountInboxes()                                       │    │
│  │  - importFromInbox(inboxId)                                  │    │
│  │  - detectDuplicates()                                        │    │
│  │  - mergeContacts()                                           │    │
│  │  - dismissDuplicates()                                       │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │                   DuplicateDetector.js (new)                 │    │
│  │  - detectExactPhoneDuplicates()                              │    │
│  │  - detectSimilarPhoneDuplicates()                            │    │
│  │  - detectSimilarNameDuplicates()                             │    │
│  │  - calculateNameSimilarity() (Levenshtein/Jaro-Winkler)      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Database (Supabase)                          │
├─────────────────────────────────────────────────────────────────────┤
│  contacts (enhanced)                                                 │
│  ├── source_inbox_id UUID (FK to inboxes)                           │
│  ├── last_import_at TIMESTAMPTZ                                     │
│  └── import_hash VARCHAR (for change detection)                     │
│                                                                      │
│  contact_duplicate_dismissals (new)                                  │
│  ├── id UUID PK                                                      │
│  ├── account_id UUID FK                                              │
│  ├── contact_id_1 UUID FK                                            │
│  ├── contact_id_2 UUID FK                                            │
│  └── dismissed_at TIMESTAMPTZ                                        │
│                                                                      │
│  contact_merge_audit (new)                                           │
│  ├── id UUID PK                                                      │
│  ├── account_id UUID FK                                              │
│  ├── merged_contact_id UUID FK                                       │
│  ├── source_contact_ids UUID[]                                       │
│  ├── merge_data JSONB                                                │
│  └── merged_at TIMESTAMPTZ                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### InboxSelector Component

```typescript
interface InboxSelectorProps {
  accountId: string;
  onSelect: (inbox: Inbox) => void;
  onCancel: () => void;
}

interface InboxOption {
  id: string;
  name: string;
  phoneNumber: string;
  isConnected: boolean;
  lastImportAt: string | null;
}
```

Comportamento:
- Se houver apenas 1 inbox, chama `onSelect` automaticamente
- Se houver múltiplas, exibe modal/dropdown para seleção
- Inboxes desconectadas são exibidas mas desabilitadas

#### DuplicatesPanel Component

```typescript
interface DuplicatesPanelProps {
  duplicateSets: DuplicateSet[];
  onMerge: (setId: string, selectedContactId: string, fieldsToKeep: MergeFields) => void;
  onDismiss: (setId: string) => void;
  onBulkMerge: (setIds: string[]) => void;
}

interface DuplicateSet {
  id: string;
  type: 'exact_phone' | 'similar_phone' | 'similar_name';
  contacts: Contact[];
  similarity: number;
}
```

#### MergeContactsDialog Component

```typescript
interface MergeContactsDialogProps {
  contacts: Contact[];
  onConfirm: (mergedData: MergeResult) => void;
  onCancel: () => void;
}

interface MergeResult {
  primaryContactId: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  preserveTags: boolean;
  preserveGroups: boolean;
}
```

### Backend Services

#### DuplicateDetector Service

```javascript
class DuplicateDetector {
  /**
   * Detecta todos os tipos de duplicados para uma conta
   * @param {string} accountId
   * @returns {Promise<DuplicateSet[]>}
   */
  async detectAll(accountId) {}

  /**
   * Detecta duplicados por telefone exato
   * @param {string} accountId
   * @returns {Promise<DuplicateSet[]>}
   */
  async detectExactPhoneDuplicates(accountId) {}

  /**
   * Detecta duplicados por telefone similar (normalizado)
   * @param {string} accountId
   * @returns {Promise<DuplicateSet[]>}
   */
  async detectSimilarPhoneDuplicates(accountId) {}

  /**
   * Detecta duplicados por nome similar
   * @param {string} accountId
   * @param {number} threshold - Similaridade mínima (0-1), default 0.8
   * @returns {Promise<DuplicateSet[]>}
   */
  async detectSimilarNameDuplicates(accountId, threshold = 0.8) {}

  /**
   * Calcula similaridade entre dois nomes usando Jaro-Winkler
   * @param {string} name1
   * @param {string} name2
   * @returns {number} - Similaridade entre 0 e 1
   */
  calculateNameSimilarity(name1, name2) {}

  /**
   * Normaliza telefone para comparação
   * @param {string} phone
   * @returns {string}
   */
  normalizePhone(phone) {}
}
```

#### ContactsService Enhancements

```javascript
// Novos métodos a adicionar ao ContactsService

/**
 * Lista inboxes disponíveis para importação
 * @param {string} accountId
 * @returns {Promise<InboxOption[]>}
 */
async getAccountInboxes(accountId) {}

/**
 * Importa contatos de uma inbox específica
 * @param {string} accountId
 * @param {string} tenantId
 * @param {string} inboxId
 * @param {Object} createdBy
 * @returns {Promise<ImportResult>}
 */
async importFromInbox(accountId, tenantId, inboxId, createdBy) {}

/**
 * Obtém conjuntos de duplicados
 * @param {string} accountId
 * @returns {Promise<DuplicateSet[]>}
 */
async getDuplicates(accountId) {}

/**
 * Mescla contatos
 * @param {string} accountId
 * @param {string[]} contactIds
 * @param {MergeData} mergeData
 * @returns {Promise<Contact>}
 */
async mergeContacts(accountId, contactIds, mergeData) {}

/**
 * Descarta falsos positivos de duplicados
 * @param {string} accountId
 * @param {string} contactId1
 * @param {string} contactId2
 * @returns {Promise<void>}
 */
async dismissDuplicate(accountId, contactId1, contactId2) {}
```

## Data Models

### Contact Model Enhancement

```sql
-- Adicionar colunas à tabela contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source_inbox_id UUID REFERENCES inboxes(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_import_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS import_hash VARCHAR(64);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contacts_source_inbox ON contacts(source_inbox_id);
CREATE INDEX IF NOT EXISTS idx_contacts_import_hash ON contacts(import_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'));
```

### Duplicate Dismissals Table

```sql
CREATE TABLE IF NOT EXISTS contact_duplicate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id_1 UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_id_2 UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  dismissed_by UUID,
  
  CONSTRAINT unique_dismissal UNIQUE(account_id, contact_id_1, contact_id_2)
);

CREATE INDEX IF NOT EXISTS idx_dismissals_account ON contact_duplicate_dismissals(account_id);
```

### Merge Audit Table

```sql
CREATE TABLE IF NOT EXISTS contact_merge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  merged_contact_id UUID NOT NULL REFERENCES contacts(id),
  source_contact_ids UUID[] NOT NULL,
  merge_data JSONB NOT NULL,
  merged_at TIMESTAMPTZ DEFAULT now(),
  merged_by UUID
);

CREATE INDEX IF NOT EXISTS idx_merge_audit_account ON contact_merge_audit(account_id);
CREATE INDEX IF NOT EXISTS idx_merge_audit_merged_contact ON contact_merge_audit(merged_contact_id);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Inbox Auto-Selection

*For any* account with exactly one inbox, when the import process is initiated, the system should automatically select that inbox without requiring user interaction.

**Validates: Requirements 1.2**

### Property 2: Phone-Based Duplicate Detection

*For any* set of contacts in an account, if two contacts have phone numbers that normalize to the same value (removing all non-digit characters), they should be identified as duplicates.

**Validates: Requirements 3.1, 3.2**

### Property 3: Name Similarity Detection

*For any* two contacts with names that have a Jaro-Winkler similarity score greater than 0.8, they should be flagged as potential duplicates.

**Validates: Requirements 3.3**

### Property 4: Import Metadata Tracking

*For any* contact imported from an inbox, the contact's metadata should contain: (a) the source inbox ID, (b) the import timestamp, and (c) an import hash for change detection.

**Validates: Requirements 2.5, 2.6, 6.1**

### Property 5: Incremental Import Correctness

*For any* import operation, if a contact's phone already exists in the database:
- If the import hash matches, the contact should remain unchanged
- If the import hash differs, only the changed fields should be updated

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 6: Merge Preserves Associations

*For any* merge operation on contacts C1, C2, ..., Cn, the resulting merged contact should:
- Contain all tags from all source contacts (union)
- Be a member of all groups from all source contacts (union)

**Validates: Requirements 4.3, 4.4**

### Property 7: Merge Creates Single Contact

*For any* successful merge operation on contacts C1, C2, ..., Cn:
- Exactly one contact should exist with the merged data
- All source contacts (C1, C2, ..., Cn) should be deleted
- An audit log entry should be created

**Validates: Requirements 4.5, 4.6, 4.7**

### Property 8: Merge Rollback on Failure

*For any* merge operation that fails at any step, the database state should be identical to the state before the merge was attempted (no partial changes).

**Validates: Requirements 4.8**

### Property 9: Dismissed Duplicates Exclusion

*For any* pair of contacts that has been dismissed as "not duplicate", subsequent duplicate detection runs should not include that pair in the results.

**Validates: Requirements 5.6**

### Property 10: Import Summary Accuracy

*For any* import operation, the summary should accurately report:
- `added` = count of contacts with phones not previously in database
- `updated` = count of contacts with phones that existed but had different data
- `unchanged` = count of contacts with phones that existed with identical data

**Validates: Requirements 2.4**

## Error Handling

### Import Errors

| Error | HTTP Status | Message | Recovery |
|-------|-------------|---------|----------|
| Inbox not found | 404 | "Caixa de entrada não encontrada" | Refresh inbox list |
| Inbox not connected | 400 | "Caixa de entrada não conectada ao WhatsApp" | Reconnect inbox |
| WUZAPI timeout | 408 | "Tempo limite excedido ao conectar com WhatsApp" | Retry |
| Invalid token | 401 | "Token WUZAPI inválido ou expirado" | Reconnect inbox |

### Merge Errors

| Error | HTTP Status | Message | Recovery |
|-------|-------------|---------|----------|
| Contact not found | 404 | "Um ou mais contatos não encontrados" | Refresh contacts |
| Merge conflict | 409 | "Conflito ao mesclar contatos" | Manual resolution |
| Transaction failed | 500 | "Erro ao mesclar contatos. Nenhuma alteração foi feita." | Retry |

## Testing Strategy

### Unit Tests

- DuplicateDetector: Test similarity algorithms with known inputs
- Phone normalization: Test various phone formats
- Merge logic: Test tag/group union operations

### Property-Based Tests

Each correctness property should be implemented as a property-based test using a library like fast-check:

1. **Property 1**: Generate random accounts with 1 inbox, verify auto-selection
2. **Property 2**: Generate random phone numbers with formatting variations, verify detection
3. **Property 3**: Generate random name pairs, verify similarity threshold
4. **Property 4**: Generate random imports, verify metadata presence
5. **Property 5**: Generate random import sequences, verify incremental behavior
6. **Property 6**: Generate random contacts with tags/groups, verify union after merge
7. **Property 7**: Generate random merge operations, verify single result
8. **Property 8**: Generate random merge failures, verify rollback
9. **Property 9**: Generate random dismissals, verify exclusion
10. **Property 10**: Generate random import data, verify summary accuracy

### Integration Tests

- Full import flow with inbox selection
- Duplicate detection after import
- Merge operation with audit logging
- Dismissal persistence across sessions
