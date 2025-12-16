# Design Document: Page Builder Modernization

## Overview

Esta modernização transforma o Page Builder existente em uma ferramenta mais completa e moderna para construção de temas de páginas de edição. As principais melhorias incluem:

1. **Correção do Avatar Block** - Renderização correta de imagens via URL
2. **Novos tipos de blocos** - Text, Image, Badge, Stats, Link, Tabs, List
3. **Container/Row com colunas** - Layout flexível de 1-4 colunas
4. **Canvas aprimorado** - Melhor feedback visual, duplicação, undo/redo
5. **Preview com dados reais** - Busca dados usando token de autenticação
6. **Templates de blocos** - Salvar e reutilizar configurações
7. **Visibilidade condicional** - Mostrar/ocultar baseado em valores

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Page Builder                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌───────────────────┐  ┌───────────────────┐     │
│  │ BlockLibrary │  │   BuilderCanvas   │  │  PropertiesPanel  │     │
│  │              │  │                   │  │                   │     │
│  │ - Categories │  │ - DnD Context     │  │ - Block Config    │     │
│  │ - Templates  │  │ - History Manager │  │ - Spacing/Align   │     │
│  │ - Search     │  │ - Selection       │  │ - Visibility      │     │
│  └──────────────┘  └───────────────────┘  └───────────────────┘     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Block Registry                          │   │
│  │  - Layout: Header, Section, Divider, Row                     │   │
│  │  - Fields: FormGrid, SingleField                             │   │
│  │  - Display: Avatar, Image, Text, Badge, Stats, List, Tabs    │   │
│  │  - Actions: SaveButton, LinkButton                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      State Management                        │   │
│  │  - HistoryManager (undo/redo stack)                          │   │
│  │  - TemplateStorage (localStorage)                            │   │
│  │  - VisibilityEvaluator                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Block Types

```typescript
// Extended BlockType union
export type BlockType =
  // Existing
  | 'header'
  | 'form-grid'
  | 'single-field'
  | 'avatar'
  | 'section'
  | 'divider'
  | 'save-button'
  | 'info-card'
  // New blocks
  | 'text'
  | 'image'
  | 'badge'
  | 'stats'
  | 'link-button'
  | 'tabs'
  | 'list'
  | 'row';
```

### Row/Container Block

```typescript
interface RowBlockProps {
  columns: 1 | 2 | 3 | 4;
  columnWidths: string[]; // e.g., ['50%', '50%'] or ['1fr', '2fr']
  gap: 'none' | 'small' | 'medium' | 'large';
  verticalAlign: 'top' | 'center' | 'bottom' | 'stretch';
  stackOnMobile: boolean;
}

interface ThemeBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
  children?: ThemeBlock[]; // For container blocks like Row
  columnIndex?: number; // Which column this block belongs to in parent Row
}
```

### History Manager

```typescript
interface HistoryState {
  blocks: ThemeBlock[];
  selectedBlockId: string | null;
}

interface HistoryManager {
  push(state: HistoryState): void;
  undo(): HistoryState | null;
  redo(): HistoryState | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

### Block Templates

```typescript
interface BlockTemplate {
  id: string;
  name: string;
  blockType: BlockType;
  props: Record<string, any>;
  children?: BlockTemplate[];
  createdAt: string;
}

interface TemplateStorage {
  save(template: BlockTemplate): void;
  load(id: string): BlockTemplate | null;
  list(): BlockTemplate[];
  delete(id: string): void;
}
```

### Visibility Conditions

```typescript
type ComparisonOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';

interface VisibilityCondition {
  field: string;
  operator: ComparisonOperator;
  value?: string | number | boolean;
}

interface BlockWithVisibility extends ThemeBlock {
  visibility?: VisibilityCondition;
}
```

### Spacing Configuration

```typescript
interface SpacingConfig {
  marginTop: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  marginBottom: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  marginLeft: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  marginRight: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  paddingTop: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  paddingBottom: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  paddingLeft: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  paddingRight: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  horizontalAlign: 'left' | 'center' | 'right' | 'stretch';
}
```

### Preview Data Fetcher

```typescript
interface PreviewDataFetcher {
  fetchRecords(connectionId: number, limit?: number): Promise<Record<string, any>[]>;
  fetchRecord(connectionId: number, recordId: string): Promise<Record<string, any>>;
}
```

## Data Models

### Extended ThemeSchema

```typescript
interface ThemeSchema {
  id: string;
  name: string;
  description: string;
  connectionId?: number;
  blocks: ThemeBlock[];
  templates?: BlockTemplate[]; // Saved block templates
  createdAt: string;
  updatedAt: string;
}
```

### Block Definition Extension

```typescript
interface BlockDefinition {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: BlockCategory;
  defaultProps: Record<string, any>;
  propsSchema: PropSchema[];
  component: React.ComponentType<BlockComponentProps>;
  allowChildren?: boolean; // For container blocks
  maxChildren?: number; // Limit children count
  acceptedChildTypes?: BlockType[]; // Restrict child types
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Avatar image URL rendering
*For any* Avatar block with a valid imageField and a record containing a non-empty URL string in that field, the rendered output SHALL contain an img element with the src attribute set to that URL value.
**Validates: Requirements 1.1, 1.4**

### Property 2: Avatar fallback for invalid URLs
*For any* Avatar block with an imageField and a record where that field is empty, null, undefined, or contains only whitespace, the rendered output SHALL display the fallback (initials or default icon) instead of an img element.
**Validates: Requirements 1.2**

### Property 3: Row column count constraint
*For any* Row block configuration, the columns property SHALL be constrained to values 1, 2, 3, or 4. Any attempt to set a value outside this range SHALL be rejected or clamped.
**Validates: Requirements 3.1**

### Property 4: Row column widths validation
*For any* Row block with columnWidths configured, the sum of percentage widths SHALL equal 100%, or if using fractions, the values SHALL be valid CSS fr units.
**Validates: Requirements 3.2**

### Property 5: Row children rendering
*For any* Row block with children blocks assigned to columns, the rendered output SHALL contain all child blocks positioned within their respective column containers.
**Validates: Requirements 3.4**

### Property 6: Block duplication preserves props
*For any* block, duplicating it SHALL produce a new block with a different id but identical type and props values.
**Validates: Requirements 5.2**

### Property 7: Container duplication is deep
*For any* container block with children, duplicating it SHALL produce a deep copy where all child blocks also have new unique ids while preserving their type and props.
**Validates: Requirements 5.3**

### Property 8: History manager capacity
*For any* sequence of state changes pushed to the HistoryManager, the manager SHALL retain at most 50 states, discarding the oldest when the limit is exceeded.
**Validates: Requirements 8.1**

### Property 9: Undo returns previous state
*For any* HistoryManager with at least one previous state, calling undo() SHALL return the state that was current before the last push().
**Validates: Requirements 8.2**

### Property 10: Redo restores undone state
*For any* HistoryManager where undo() was called, calling redo() SHALL return the state that was undone.
**Validates: Requirements 8.3**

### Property 11: Undo/Redo round trip
*For any* state S pushed to HistoryManager, calling undo() followed by redo() SHALL return a state equivalent to S.
**Validates: Requirements 8.2, 8.3**

### Property 12: canUndo reflects history state
*For any* HistoryManager, canUndo() SHALL return false if and only if there are no previous states to undo to.
**Validates: Requirements 8.4**

### Property 13: Template save/load round trip
*For any* BlockTemplate saved to TemplateStorage, loading it by id SHALL return a template with equivalent name, blockType, props, and children.
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 14: Visibility condition evaluation
*For any* visibility condition and record data, the evaluateVisibility function SHALL return true only when the condition is satisfied by the record's field value.
**Validates: Requirements 10.3**

## Error Handling

### Image Loading Errors
- Avatar and Image blocks use `onError` handler to trigger fallback
- Fallback displays initials (Avatar) or placeholder icon (Image)
- No error propagation to parent components

### Invalid Block Configuration
- Block registry validates definitions on registration
- Invalid props are replaced with defaults
- Console warnings for debugging

### History Manager Overflow
- Oldest states automatically discarded when limit reached
- No error thrown, silent truncation

### Template Storage Errors
- localStorage quota exceeded: show toast error, don't save
- Invalid template data: skip loading, log warning

### Preview Data Fetch Errors
- Network errors: show error state in preview
- Auth errors: prompt to re-authenticate
- Empty data: show "no records" message

## Testing Strategy

### Property-Based Testing Library
- **Library**: fast-check (TypeScript/JavaScript)
- **Minimum iterations**: 100 per property test

### Unit Tests
- Block component rendering with various props
- HistoryManager state transitions
- TemplateStorage CRUD operations
- VisibilityEvaluator condition matching
- Row block column width calculations

### Property-Based Tests
Each correctness property will be implemented as a property-based test using fast-check:

1. **Avatar URL rendering** - Generate valid URLs, verify img src
2. **Avatar fallback** - Generate empty/invalid values, verify fallback
3. **Row columns constraint** - Generate numbers, verify clamping
4. **Row widths validation** - Generate width arrays, verify sum
5. **Block duplication** - Generate blocks, verify id differs but props match
6. **Container deep copy** - Generate nested blocks, verify all ids unique
7. **History capacity** - Push >50 states, verify max 50 retained
8. **Undo/Redo** - Generate state sequences, verify transitions
9. **Template round trip** - Generate templates, verify save/load equality
10. **Visibility evaluation** - Generate conditions and records, verify logic

### Integration Tests
- Full Page Builder workflow with drag-drop
- Preview with real database connection
- Theme save and load cycle

### E2E Tests (Cypress)
- Create theme with multiple block types
- Configure Row with columns
- Undo/redo operations
- Preview with viewport switching
- Template save and reuse
