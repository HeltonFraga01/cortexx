# Design Document

## Overview

This design addresses the contact selection persistence bug in the WUZAPI Manager contact management system. The core issue is that the `handleSendMessage` function in `UserContacts.tsx` filters selected contacts from `filteredContacts` instead of the complete `contacts` array, causing contacts selected in previous searches to be lost when the search query changes.

The solution involves modifying the contact retrieval logic to always use the complete contact list when gathering selected contacts for message sending, while maintaining the current filtering behavior for display purposes.

## Architecture

### Current Flow (Buggy)

```
User selects contact A (search: "Mãe") 
  → selectedIds.add(A.phone)
  → filteredContacts = [A]

User changes search (search: "Heitor")
  → filteredContacts = [B]
  → selectedIds still contains A.phone and B.phone

User clicks "Enviar Mensagem"
  → selectedContacts = filteredContacts.filter(c => selectedIds.has(c.phone))
  → selectedContacts = [B] only (A is not in filteredContacts!)
  → Only B is sent to dispatcher ❌
```

### Fixed Flow

```
User selects contact A (search: "Mãe")
  → selectedIds.add(A.phone)
  → filteredContacts = [A]

User changes search (search: "Heitor")
  → filteredContacts = [B]
  → selectedIds still contains A.phone and B.phone

User clicks "Enviar Mensagem"
  → selectedContacts = contacts.filter(c => selectedIds.has(c.phone))
  → selectedContacts = [A, B] (using full contacts array)
  → Both A and B are sent to dispatcher ✅
```

## Components and Interfaces

### Modified Components

#### 1. UserContacts.tsx

**Location**: `src/pages/UserContacts.tsx`

**Changes Required**:
- Modify `handleSendMessage` function to use `contacts` instead of `filteredContacts`
- Modify `handleExport` function to use `contacts` for selected contacts export
- Add helper function `getSelectedContactsFromFull` to retrieve selected contacts from complete list

**Current Implementation** (lines 117-135):
```typescript
const handleSendMessage = () => {
  if (selectedCount === 0) {
    toast.error('Selecione contatos primeiro');
    return;
  }

  try {
    // BUG: Using filteredContacts instead of contacts
    const selectedContacts = filteredContacts.filter(c => selectedIds.has(c.phone));
    
    sessionStorage.setItem('preSelectedContacts', JSON.stringify(selectedContacts));
    
    navigate('/user/disparador', {
      state: {
        fromContacts: true,
        contactCount: selectedContacts.length,
      }
    });
    
    toast.success(`${selectedContacts.length} contato(s) adicionado(s) ao disparador`);
  } catch (error) {
    console.error('Erro ao enviar para disparador:', error);
    toast.error('Erro ao enviar contatos para o disparador');
  }
};
```

**Fixed Implementation**:
```typescript
const handleSendMessage = () => {
  if (selectedCount === 0) {
    toast.error('Selecione contatos primeiro');
    return;
  }

  try {
    // FIX: Use complete contacts array instead of filtered
    const selectedContacts = contacts.filter(c => selectedIds.has(c.phone));
    
    // Validate that we found all selected contacts
    if (selectedContacts.length !== selectedCount) {
      console.warn(
        `Selection mismatch: expected ${selectedCount} contacts, found ${selectedContacts.length}`
      );
    }
    
    sessionStorage.setItem('preSelectedContacts', JSON.stringify(selectedContacts));
    
    navigate('/user/disparador', {
      state: {
        fromContacts: true,
        contactCount: selectedContacts.length,
      }
    });
    
    toast.success(`${selectedContacts.length} contato(s) adicionado(s) ao disparador`);
  } catch (error) {
    console.error('Erro ao enviar para disparador:', error);
    toast.error('Erro ao enviar contatos para o disparador');
  }
};
```

**Current Export Implementation** (lines 137-167):
```typescript
const handleExport = () => {
  const contactsToExport = selectedCount > 0
    ? filteredContacts.filter(c => selectedIds.has(c.phone))  // BUG HERE
    : filteredContacts;

  // ... rest of export logic
};
```

**Fixed Export Implementation**:
```typescript
const handleExport = () => {
  const contactsToExport = selectedCount > 0
    ? contacts.filter(c => selectedIds.has(c.phone))  // FIX: Use full contacts array
    : filteredContacts;  // Keep filtered for "export all visible" behavior

  if (contactsToExport.length === 0) {
    toast.error('Nenhum contato para exportar');
    return;
  }

  try {
    const blob = contactsService.exportToCSV(contactsToExport, tags);
    const date = new Date().toISOString().split('T')[0];
    const filename = `contatos-${date}.csv`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success(`${contactsToExport.length} contato(s) exportado(s) com sucesso`);
  } catch (error) {
    console.error('Erro ao exportar contatos:', error);
    toast.error('Erro ao exportar contatos');
  }
};
```

#### 2. ContactSelection.tsx (Enhancement)

**Location**: `src/components/contacts/ContactSelection.tsx`

**Current Behavior**: Shows count of selected contacts but doesn't display which contacts are selected

**Enhancement**: Add visual indicator showing selected contact names/phones with ability to remove individual contacts

**New Props Interface**:
```typescript
interface ContactSelectionProps {
  selectedCount: number;
  selectedContacts?: Contact[];  // NEW: Pass actual contact objects
  onClearSelection: () => void;
  onRemoveContact?: (phone: string) => void;  // NEW: Remove individual contact
  onAddTags: () => void;
  onSaveGroup: () => void;
  onSendMessage: () => void;
  onExport: () => void;
}
```

**Enhancement Details**:
- Display selected contact names in a scrollable list within the floating bar
- Add X button next to each contact name to remove from selection
- Show "N contatos selecionados" with expandable list
- Maintain current compact design when collapsed

### Unchanged Components

The following components work correctly and require no changes:

- **useContactSelection.ts**: Selection state management is correct
- **ContactsTable.tsx**: Selection UI and toggle logic is correct
- **ContactsFilters.tsx**: Filtering logic is correct
- **useContactFilters.ts**: Filter state management is correct

## Data Models

### Contact Interface

```typescript
interface Contact {
  phone: string;        // Unique identifier
  name?: string;        // Optional display name
  variables?: {         // Optional metadata
    tags?: string[];    // Tag IDs
    [key: string]: any;
  };
}
```

### Selection State

```typescript
// In useContactSelection hook
selectedIds: Set<string>  // Set of phone numbers (contact IDs)

// In sessionStorage
STORAGE_KEY = 'wuzapi_selected_contacts'
Value: string[]  // Array of phone numbers
```

## Error Handling

### Selection Mismatch Detection

When retrieving selected contacts, validate that the number of found contacts matches the selection count:

```typescript
const selectedContacts = contacts.filter(c => selectedIds.has(c.phone));

if (selectedContacts.length !== selectedCount) {
  console.warn(
    `Selection mismatch: expected ${selectedCount} contacts, found ${selectedContacts.length}`,
    {
      selectedIds: Array.from(selectedIds),
      foundPhones: selectedContacts.map(c => c.phone),
    }
  );
  
  // Continue with found contacts, but notify user
  toast.warning(
    `Alguns contatos selecionados não foram encontrados. ` +
    `Enviando ${selectedContacts.length} de ${selectedCount} contatos.`
  );
}
```

### Missing Contact Handling

If a selected contact ID is not found in the contacts array:

1. Log warning with missing phone numbers
2. Continue with available contacts
3. Show user notification about the discrepancy
4. Do not block the send operation

### SessionStorage Errors

Already handled in `useContactSelection.ts` with try-catch blocks around sessionStorage operations.

## Testing Strategy

### Unit Tests

**File**: `src/pages/UserContacts.test.tsx`

Test cases:
1. `handleSendMessage` uses full contacts array, not filtered
2. `handleExport` uses full contacts array when contacts are selected
3. Selection count matches retrieved contacts count
4. Warning is logged when selection mismatch occurs

**File**: `src/components/contacts/ContactSelection.test.tsx`

Test cases:
1. Selected contacts are displayed correctly
2. Individual contact removal works
3. Clear all selection works
4. Component handles missing contact data gracefully

### Integration Tests

**Scenario 1: Multi-Search Selection**
1. Load contacts page with 100+ contacts
2. Search for "Maria", select 2 contacts
3. Clear search, search for "João", select 3 contacts
4. Click "Enviar Mensagem"
5. Verify all 5 contacts are passed to dispatcher

**Scenario 2: Export Selected Across Searches**
1. Search for "Cliente", select 5 contacts
2. Search for "Fornecedor", select 3 contacts
3. Click "Exportar CSV"
4. Verify CSV contains all 8 selected contacts

**Scenario 3: Selection Indicator**
1. Select contacts from different searches
2. Verify selection indicator shows all selected contacts
3. Remove one contact from indicator
4. Verify selection count updates
5. Verify removed contact is not sent to dispatcher

### Manual Testing Checklist

- [ ] Select contacts from multiple different searches
- [ ] Verify selection count is accurate
- [ ] Click "Enviar Mensagem" and verify all selected contacts appear in dispatcher
- [ ] Export selected contacts and verify CSV contains all selections
- [ ] Clear selection and verify all contacts are deselected
- [ ] Remove individual contacts from selection indicator
- [ ] Verify selection persists across page refresh (sessionStorage)
- [ ] Test with large contact lists (1000+ contacts)

## Performance Considerations

### Array Filtering Performance

Using `contacts.filter()` instead of `filteredContacts.filter()` may have performance implications with large contact lists:

- **Small lists (< 1000 contacts)**: Negligible impact (< 1ms)
- **Medium lists (1000-5000 contacts)**: Minimal impact (1-5ms)
- **Large lists (> 5000 contacts)**: Noticeable but acceptable (5-20ms)

**Optimization**: If performance becomes an issue, implement a contact lookup Map:

```typescript
// Create once when contacts load
const contactsMap = useMemo(() => {
  return new Map(contacts.map(c => [c.phone, c]));
}, [contacts]);

// Use for O(1) lookup
const selectedContacts = Array.from(selectedIds)
  .map(phone => contactsMap.get(phone))
  .filter(Boolean);
```

### Memory Considerations

- Selection state is stored as Set of strings (phone numbers), not full contact objects
- SessionStorage stores only phone numbers, not full contact data
- Full contact objects are only retrieved when needed (send/export)

## Migration Notes

This is a bug fix, not a feature change, so no data migration is required. The fix is backward compatible with existing selection state in sessionStorage.

## Rollback Plan

If issues arise after deployment:

1. Revert the two function changes in `UserContacts.tsx`
2. No database changes, so rollback is safe
3. User selections in sessionStorage will continue to work

## Future Enhancements

1. **Visual Selection Indicator**: Show selected contact names in the floating bar
2. **Selection Persistence**: Store selections in localStorage for longer persistence
3. **Selection History**: Allow users to save and load selection presets
4. **Bulk Selection Tools**: "Select all with tag X", "Select all without name", etc.
