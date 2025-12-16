# Design Document

## Overview

Este documento descreve o design da solução para corrigir o comportamento dos cards do Kanban, garantindo que apenas os campos marcados como "Exibir no Card" (`showInCard: true`) sejam exibidos, seguindo o mesmo padrão já implementado nas visualizações Grid e List.

### Current State

Atualmente, o componente `KanbanCard` já possui a lógica de filtro implementada:

```typescript
const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
```

No entanto, pela evidência visual fornecida, parece que **todos os campos visíveis** estão sendo exibidos nos cards, sugerindo que:

1. A propriedade `showInCard` pode não estar sendo persistida corretamente no banco de dados
2. Os `fieldMappings` podem não estar sendo passados corretamente para o componente
3. Pode haver um problema na lógica de fallback quando não há campos com `showInCard: true`

### Target State

Os cards do Kanban devem exibir apenas os campos onde `showInCard: true` AND `visible: true`, com um fallback para o ID do registro quando nenhum campo atende a esses critérios.

## Architecture

### Component Hierarchy

```
KanbanView
  └── KanbanCard (para cada registro)
      └── Card UI (shadcn/ui)
          └── Field Display (apenas campos com showInCard: true)
```

### Data Flow

```
Database (SQLite)
  └── database_connections table
      └── field_mappings (JSON)
          └── showInCard property
              ↓
Backend API (databaseRoutes.js)
  └── GET /api/database/connections/:id
      ↓
Frontend Service (database-connections.ts)
  └── DatabaseConnection interface
      ↓
KanbanView Component
  └── connection.fieldMappings
      ↓
KanbanCard Component
  └── Filter: showInCard && visible
      ↓
Render only filtered fields
```

## Components and Interfaces

### 1. KanbanCard Component (Existing - Needs Verification)

**Location:** `src/components/user/KanbanCard.tsx`

**Current Implementation:**
```typescript
export function KanbanCard({ record, fieldMappings = [], onClick }: KanbanCardProps) {
  // Filtrar campos para exibir no card
  const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);

  return (
    <Card>
      <CardContent>
        {cardFields.length > 0 ? (
          cardFields.map((field) => {
            const value = record[field.columnName];
            if (!value) return null;
            
            return (
              <div key={field.columnName}>
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="text-sm font-medium">{String(value)}</p>
              </div>
            );
          })
        ) : (
          // Fallback
          <div>
            <p className="text-xs text-muted-foreground">ID</p>
            <p className="text-sm font-medium">#{recordId}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Issues to Investigate:**
- Verificar se `fieldMappings` está sendo passado corretamente do `KanbanView`
- Verificar se a propriedade `showInCard` existe nos objetos de `fieldMappings`
- Adicionar logging para debug durante desenvolvimento

### 2. KanbanView Component (Existing - Needs Update)

**Location:** `src/components/user/KanbanView.tsx`

**Current Implementation:**
```typescript
<KanbanCard
  record={record}
  fieldMappings={connection.fieldMappings}
  onClick={() => onRecordClick(record)}
/>
```

**Proposed Changes:**
- Adicionar validação para garantir que `connection.fieldMappings` existe
- Adicionar logging para debug (remover após correção)
- Garantir que `fieldMappings` seja sempre um array válido

### 3. Grid and List Views (Reference Implementation)

**Location:** `src/components/user/UserDatabaseModern.tsx`

**Reference Implementation (Grid View):**
```typescript
const cardFields = visibleFields.filter(f => f.showInCard);
const fieldsToShow = cardFields.length > 0 ? cardFields.slice(0, 4) : visibleFields.slice(0, 4);
```

**Key Differences:**
- Grid/List views usam `visibleFields` (já filtrados por `visible: true`)
- Grid/List views têm um fallback diferente: mostram os primeiros 4 campos visíveis se nenhum tiver `showInCard: true`
- Kanban usa `fieldMappings` diretamente e filtra por `showInCard && visible`

**Decision:** Manter a abordagem do Kanban (mostrar ID como fallback) pois é mais explícita e força o Admin a configurar os campos corretamente.

## Data Models

### FieldMapping Interface (Existing)

```typescript
interface FieldMapping {
  name?: string;           // Nome do campo no NocoDB
  columnName: string;      // Nome da coluna
  label: string;           // Label amigável
  type?: string;           // Tipo do campo
  uidt?: string;           // NocoDB UI Data Type
  visible: boolean;        // Se o campo é visível
  editable: boolean;       // Se o campo é editável
  showInCard?: boolean;    // Se aparece em cards (Grid, List, Kanban)
  helperText?: string;     // Texto de ajuda
}
```

### DatabaseConnection Interface (Existing)

```typescript
interface DatabaseConnection {
  id: number;
  name: string;
  type: 'nocodb';
  config: any;
  fieldMappings?: FieldMapping[];
  viewConfiguration?: ViewConfiguration;
  // ... outros campos
}
```

## Error Handling

### Scenario 1: fieldMappings is undefined or empty

**Handling:**
```typescript
const cardFields = (fieldMappings || []).filter((f) => f.showInCard && f.visible);
```

**Fallback:** Display record ID

### Scenario 2: No fields have showInCard: true

**Handling:**
```typescript
if (cardFields.length === 0) {
  // Display fallback with record ID
}
```

**Fallback:** Display record ID

### Scenario 3: Field value is null, undefined, or empty string

**Handling:**
```typescript
const value = record[field.columnName];
if (!value) return null; // Skip this field
```

**Result:** Field is not displayed in the card

### Scenario 4: columnName doesn't exist in record

**Handling:**
```typescript
const value = record[field.columnName];
if (value === undefined) return null;
```

**Result:** Field is not displayed in the card

## Testing Strategy

### Unit Tests

**Test File:** `src/components/user/__tests__/KanbanCard.test.tsx`

**Test Cases:**
1. Should display only fields with showInCard: true and visible: true
2. Should display fallback (ID) when no fields have showInCard: true
3. Should not display fields with visible: false, even if showInCard: true
4. Should handle empty fieldMappings array
5. Should handle undefined fieldMappings
6. Should skip fields with null/undefined/empty values
7. Should display field label and value correctly
8. Should handle missing columnName in record

### Integration Tests

**Test File:** `src/components/user/__tests__/KanbanView.test.tsx`

**Test Cases:**
1. Should pass fieldMappings correctly to KanbanCard
2. Should render multiple cards with correct field filtering
3. Should update card display when fieldMappings change

### Manual Testing Checklist

1. **Setup:**
   - Create a database connection with at least 5 fields
   - Mark 2-3 fields with `showInCard: true`
   - Mark 1-2 fields with `showInCard: false`
   - Ensure all fields have `visible: true`

2. **Test Kanban View:**
   - Navigate to Kanban view
   - Verify only fields with `showInCard: true` are displayed
   - Verify field labels match configured labels
   - Verify field values are displayed correctly

3. **Test Consistency:**
   - Switch to Grid view
   - Verify same fields are displayed
   - Switch to List view
   - Verify same fields are displayed
   - Switch back to Kanban view
   - Verify consistency is maintained

4. **Test Edge Cases:**
   - Unmark all `showInCard` fields
   - Verify fallback (ID) is displayed
   - Mark a field with `visible: false` and `showInCard: true`
   - Verify field is NOT displayed

5. **Test Backward Compatibility:**
   - Load an existing connection without `showInCard` configuration
   - Verify fallback behavior works correctly

## Implementation Plan

### Phase 1: Investigation and Debugging

1. Add console.log statements to `KanbanCard` component to verify:
   - `fieldMappings` prop is being received
   - `showInCard` property exists on field objects
   - Filtered `cardFields` array contains expected fields

2. Add console.log statements to `KanbanView` component to verify:
   - `connection.fieldMappings` exists and is populated
   - Data is being passed correctly to `KanbanCard`

3. Verify database data:
   - Check if `field_mappings` column contains `showInCard` property
   - Verify data is being loaded correctly from backend

### Phase 2: Fix Implementation

Based on investigation results, implement one of the following fixes:

**Option A: Fix Data Loading (if showInCard is missing from database)**
- Update backend to ensure `showInCard` is included in field_mappings
- Update database migration if needed
- Update existing connections to include `showInCard: false` as default

**Option B: Fix Component Logic (if data is correct but display is wrong)**
- Update `KanbanCard` filtering logic
- Ensure fallback behavior is correct
- Add proper null/undefined checks

**Option C: Fix Data Passing (if fieldMappings is not being passed correctly)**
- Update `KanbanView` to ensure `fieldMappings` is passed correctly
- Add validation and error handling
- Ensure `connection` object has `fieldMappings` property

### Phase 3: Testing and Validation

1. Run unit tests
2. Run integration tests
3. Perform manual testing with checklist
4. Verify consistency across Grid, List, and Kanban views
5. Test backward compatibility with existing connections

### Phase 4: Cleanup

1. Remove debug console.log statements
2. Update documentation if needed
3. Add comments to clarify logic

## Performance Considerations

### Current Performance

The filtering operation is lightweight:
```typescript
const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
```

- Time Complexity: O(n) where n is the number of fields
- Typical n: 5-20 fields per connection
- Impact: Negligible (< 1ms)

### Optimization Opportunities

None needed at this time. The current implementation is efficient.

## Security Considerations

### Data Validation

- `fieldMappings` is validated on the backend before storage
- `showInCard` property is validated as boolean
- No user input is directly rendered without validation

### XSS Prevention

- Field values are rendered as text, not HTML
- No `dangerouslySetInnerHTML` is used
- React automatically escapes text content

## Accessibility Considerations

### Screen Reader Support

- Field labels are properly associated with values
- Semantic HTML structure is maintained
- ARIA labels are present on interactive elements (drag handle)

### Keyboard Navigation

- Cards are clickable and keyboard accessible
- Drag functionality has keyboard alternatives (via dnd-kit)

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features are used (transpiled by Vite)
- CSS Grid and Flexbox are used (widely supported)

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate Rollback:**
   - Revert changes to `KanbanCard.tsx` and `KanbanView.tsx`
   - Deploy previous version

2. **Data Rollback:**
   - If database changes were made, run rollback migration
   - Restore previous `field_mappings` structure

3. **Communication:**
   - Notify users of temporary issue
   - Provide ETA for fix

## Future Enhancements

### 1. Field Ordering in Cards

Allow Admin to specify the order of fields in cards, not just which fields to show.

**Implementation:**
- Add `displayOrder` property to `FieldMapping`
- Sort `cardFields` by `displayOrder` before rendering

### 2. Field Limit Configuration

Allow Admin to configure how many fields to show in cards (currently hardcoded to all fields with `showInCard: true`).

**Implementation:**
- Add `maxFieldsInCard` to `ViewConfiguration`
- Slice `cardFields` array based on this limit

### 3. Conditional Field Display

Allow Admin to configure rules for when fields should be displayed (e.g., only show "Due Date" if it's in the future).

**Implementation:**
- Add `displayCondition` property to `FieldMapping`
- Evaluate condition before rendering field

## References

- [Advanced View Builder Spec](.kiro/specs/advanced-view-builder/)
- [Field Mapper Documentation](docs/FIELD_MAPPER_ORDER_AND_ADD_RECORDS.md)
- [KanbanCard Component](src/components/user/KanbanCard.tsx)
- [KanbanView Component](src/components/user/KanbanView.tsx)
- [UserDatabaseModern Component](src/components/user/UserDatabaseModern.tsx)
