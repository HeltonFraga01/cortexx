# Design Document: Page Builder Upgrade with Puck

## Introduction

Este documento descreve a arquitetura e design técnico para modernização do Page Builder usando a biblioteca Puck (@measured/puck). O objetivo é substituir a implementação atual baseada em @dnd-kit por uma solução mais robusta e profissional.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PuckPageBuilder                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  ConnectionBar   │  │   Puck Editor    │  │   ThemeActions   │  │
│  │  (DB Selection)  │  │   (Main Editor)  │  │   (Save/Load)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Puck <Editor />                          │  │
│  │  ┌────────────┐  ┌─────────────────┐  ┌────────────────────┐ │  │
│  │  │ Components │  │     Canvas      │  │  Fields/Properties │ │  │
│  │  │   Panel    │  │   (DropZones)   │  │       Panel        │ │  │
│  │  │            │  │                 │  │                    │ │  │
│  │  │ - Header   │  │  ┌───────────┐  │  │  - Text inputs     │ │  │
│  │  │ - FormGrid │  │  │  Block 1  │  │  │  - Selects         │ │  │
│  │  │ - Field    │  │  └───────────┘  │  │  - Field pickers   │ │  │
│  │  │ - Avatar   │  │  ┌───────────┐  │  │  - Color pickers   │ │  │
│  │  │ - Section  │  │  │  Block 2  │  │  │                    │ │  │
│  │  │ - Divider  │  │  └───────────┘  │  │                    │ │  │
│  │  │ - Button   │  │       ...       │  │                    │ │  │
│  │  │ - ...      │  │                 │  │                    │ │  │
│  │  └────────────┘  └─────────────────┘  └────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Puck <Render />                            │  │
│  │              (Used in ThemeRenderer for display)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Structure

### New Files to Create

```
src/components/features/page-builder/
├── puck/
│   ├── PuckPageBuilder.tsx      # Main editor wrapper
│   ├── PuckConfig.ts            # Puck configuration with all components
│   ├── PuckThemeRenderer.tsx    # Render-only component for saved themes
│   ├── components/              # Puck component definitions
│   │   ├── index.ts             # Export all components
│   │   ├── HeaderBlock.tsx      # Migrated header block
│   │   ├── FormGridBlock.tsx    # Migrated form-grid block
│   │   ├── SingleFieldBlock.tsx # Migrated single-field block
│   │   ├── AvatarBlock.tsx      # Migrated avatar block
│   │   ├── SectionBlock.tsx     # Migrated section block
│   │   ├── DividerBlock.tsx     # Migrated divider block
│   │   ├── SaveButtonBlock.tsx  # Migrated save-button block
│   │   ├── InfoCardBlock.tsx    # Migrated info-card block
│   │   ├── TextBlock.tsx        # Migrated text block
│   │   ├── ImageBlock.tsx       # Migrated image block
│   │   ├── BadgeBlock.tsx       # Migrated badge block
│   │   ├── StatsBlock.tsx       # Migrated stats block
│   │   ├── LinkButtonBlock.tsx  # Migrated link-button block
│   │   ├── TabsBlock.tsx        # Migrated tabs block
│   │   ├── ListBlock.tsx        # Migrated list block
│   │   └── RowBlock.tsx         # Migrated row block
│   ├── fields/                  # Custom Puck field types
│   │   ├── index.ts
│   │   ├── FieldSelectField.tsx # Database field selector
│   │   └── FieldMultiSelectField.tsx
│   └── utils/
│       ├── schemaConverter.ts   # ThemeSchema <-> Puck Data conversion
│       └── legacyMigration.ts   # Legacy theme detection and conversion
├── PageBuilder.tsx              # Keep for backward compatibility (wrapper)
└── ...existing files...
```

### Files to Modify

- `src/types/page-builder.ts` - Add Puck-specific types
- `src/pages/admin/PageBuilderPage.tsx` - Use new PuckPageBuilder
- `src/components/features/database/ThemeRenderer.tsx` - Use PuckThemeRenderer

## Data Models

### Puck Data Structure

```typescript
// Puck's native data format
interface PuckData {
  root: {
    props?: Record<string, unknown>;
  };
  content: PuckContent[];
  zones?: Record<string, PuckContent[]>;
}

interface PuckContent {
  type: string;           // Component type name
  props: {
    id: string;           // Unique block ID
    [key: string]: any;   // Component-specific props
  };
}
```

### Puck Config Structure

```typescript
// src/components/features/page-builder/puck/PuckConfig.ts
import type { Config } from '@measured/puck';

interface PuckEditorContext {
  connectionId: string | null;
  fields: FieldMetadata[];
  record: Record<string, any>;
  formData: Record<string, any>;
  onRecordChange: (data: Record<string, any>) => void;
}

export const createPuckConfig = (context: PuckEditorContext): Config => ({
  categories: {
    layout: { title: 'Layout', components: ['Row', 'Section', 'Divider'] },
    fields: { title: 'Campos', components: ['FormGrid', 'SingleField'] },
    display: { title: 'Exibição', components: ['Header', 'Avatar', 'Text', 'Image', 'Badge', 'Stats', 'InfoCard', 'List'] },
    actions: { title: 'Ações', components: ['SaveButton', 'LinkButton', 'Tabs'] },
  },
  components: {
    Header: {
      label: 'Cabeçalho',
      defaultProps: {
        titleField: '',
        subtitleField: '',
        showAvatar: false,
        avatarField: '',
      },
      fields: {
        titleField: {
          type: 'custom',
          render: FieldSelectField,
        },
        subtitleField: {
          type: 'custom',
          render: FieldSelectField,
        },
        showAvatar: { type: 'radio', options: [{ label: 'Sim', value: true }, { label: 'Não', value: false }] },
        avatarField: {
          type: 'custom',
          render: FieldSelectField,
        },
      },
      render: HeaderBlockRender,
    },
    // ... other components
  },
});
```

### Schema Conversion

```typescript
// src/components/features/page-builder/puck/utils/schemaConverter.ts

/**
 * Convert ThemeSchema to Puck Data format
 */
export function themeSchemaToP puckData(schema: ThemeSchema): PuckData {
  return {
    root: { props: {} },
    content: schema.blocks.map(block => ({
      type: blockTypeToPuckComponent(block.type),
      props: {
        id: block.id,
        ...block.props,
        ...(block.columnIndex !== undefined && { columnIndex: block.columnIndex }),
        ...(block.visibility && { visibility: block.visibility }),
      },
    })),
    zones: {},
  };
}

/**
 * Convert Puck Data back to ThemeSchema format
 */
export function puckDataToThemeSchema(
  data: PuckData,
  metadata: { id: string; name: string; description: string; connectionId?: string }
): ThemeSchema {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    connectionId: metadata.connectionId,
    blocks: data.content.map(item => ({
      id: item.props.id,
      type: puckComponentToBlockType(item.type),
      props: extractBlockProps(item.props),
      columnIndex: item.props.columnIndex,
      visibility: item.props.visibility,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Map existing BlockType to Puck component name
 */
function blockTypeToPuckComponent(type: BlockType): string {
  const mapping: Record<BlockType, string> = {
    'header': 'Header',
    'form-grid': 'FormGrid',
    'single-field': 'SingleField',
    'avatar': 'Avatar',
    'section': 'Section',
    'divider': 'Divider',
    'save-button': 'SaveButton',
    'info-card': 'InfoCard',
    'text': 'Text',
    'image': 'Image',
    'badge': 'Badge',
    'stats': 'Stats',
    'link-button': 'LinkButton',
    'tabs': 'Tabs',
    'list': 'List',
    'row': 'Row',
  };
  return mapping[type] || type;
}
```

## Correctness Properties

### Property 1: Round-Trip Serialization

**Invariant:** Converting ThemeSchema → PuckData → ThemeSchema must preserve all data.

```typescript
// Test assertion
const original: ThemeSchema = { ... };
const puckData = themeSchemaToP puckData(original);
const restored = puckDataToThemeSchema(puckData, { id: original.id, name: original.name, description: original.description });

assert.deepEqual(original.blocks, restored.blocks);
```

**Verification:**
- Unit tests for schemaConverter with all block types
- Property-based testing with random valid schemas

### Property 2: Legacy Theme Compatibility

**Invariant:** All existing themes must load and render correctly in the new editor.

```typescript
// Legacy detection
function isLegacyTheme(schema: unknown): boolean {
  // Check for old format markers
  return schema && typeof schema === 'object' && 'blocks' in schema;
}

// Migration preserves block order and config
function migrateLegacyTheme(legacy: LegacyThemeSchema): ThemeSchema {
  // Conversion logic
}
```

**Verification:**
- Load all existing themes from database
- Compare rendered output before/after migration
- Validate block count and order preserved

### Property 3: Block Type Coverage

**Invariant:** All 16 existing block types must be registered in Puck config.

```typescript
const REQUIRED_BLOCK_TYPES: BlockType[] = [
  'header', 'form-grid', 'single-field', 'avatar', 'section', 'divider',
  'save-button', 'info-card', 'text', 'image', 'badge', 'stats',
  'link-button', 'tabs', 'list', 'row'
];

// Validation at startup
function validatePuckConfig(config: Config): void {
  const registeredTypes = Object.keys(config.components);
  const missing = REQUIRED_BLOCK_TYPES.filter(
    type => !registeredTypes.includes(blockTypeToPuckComponent(type))
  );
  if (missing.length > 0) {
    throw new Error(`Missing block types in Puck config: ${missing.join(', ')}`);
  }
}
```

### Property 4: Field Type Mapping

**Invariant:** All PropSchema types must map to valid Puck field types.

| PropSchema Type | Puck Field Type |
|-----------------|-----------------|
| `string` | `text` |
| `number` | `number` |
| `boolean` | `radio` (Sim/Não) |
| `select` | `select` |
| `field-select` | `custom` (FieldSelectField) |
| `field-multi-select` | `custom` (FieldMultiSelectField) |

## Error Handling Strategy

### Editor Errors

```typescript
// Wrap Puck editor with error boundary
<ErrorBoundary
  fallback={<EditorErrorFallback onRetry={handleRetry} />}
  onError={(error) => {
    logger.error('Page Builder error', { error: error.message });
    toast.error('Erro no editor. Tente novamente.');
  }}
>
  <Puck.Editor config={config} data={data} onPublish={handleSave} />
</ErrorBoundary>
```

### Schema Conversion Errors

```typescript
try {
  const puckData = themeSchemaToP puckData(schema);
} catch (error) {
  logger.error('Failed to convert theme schema', { schemaId: schema.id, error });
  toast.error('Erro ao carregar tema. Formato inválido.');
  // Fallback to empty editor
  return getEmptyPuckData();
}
```

### Save Errors

```typescript
const handleSave = async (data: PuckData) => {
  try {
    const schema = puckDataToThemeSchema(data, metadata);
    
    // Validate before save
    if (!schema.name.trim()) {
      toast.error('Nome do tema é obrigatório');
      return;
    }
    if (schema.blocks.length === 0) {
      toast.error('Adicione pelo menos um bloco');
      return;
    }
    
    await onSave(schema);
    toast.success('Tema salvo com sucesso');
  } catch (error) {
    logger.error('Failed to save theme', { error });
    toast.error('Erro ao salvar tema');
  }
};
```

## Testing Strategy

### Unit Tests

```typescript
// schemaConverter.test.ts
describe('schemaConverter', () => {
  describe('themeSchemaToP puckData', () => {
    it('converts all block types correctly', () => {
      // Test each of 16 block types
    });
    
    it('preserves block props', () => {
      // Verify props are not lost
    });
    
    it('handles empty blocks array', () => {
      // Edge case
    });
  });
  
  describe('puckDataToThemeSchema', () => {
    it('round-trips without data loss', () => {
      // Property 1 verification
    });
  });
  
  describe('legacyMigration', () => {
    it('detects legacy format', () => {
      // Legacy detection
    });
    
    it('migrates legacy themes correctly', () => {
      // Property 2 verification
    });
  });
});
```

### Integration Tests

```typescript
// PuckPageBuilder.test.tsx
describe('PuckPageBuilder', () => {
  it('renders editor with all block categories', () => {
    render(<PuckPageBuilder onSave={mockSave} />);
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Campos')).toBeInTheDocument();
    expect(screen.getByText('Exibição')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
  });
  
  it('loads existing theme correctly', async () => {
    render(<PuckPageBuilder initialTheme={mockTheme} onSave={mockSave} />);
    // Verify blocks are rendered
  });
  
  it('saves theme with correct format', async () => {
    render(<PuckPageBuilder onSave={mockSave} />);
    // Add blocks, fill metadata, save
    await userEvent.click(screen.getByText('Salvar Tema'));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      blocks: expect.any(Array),
    }));
  });
});
```

### E2E Tests

```typescript
// cypress/e2e/page-builder.cy.ts
describe('Page Builder', () => {
  it('creates a new theme with drag and drop', () => {
    cy.visit('/admin/page-builder/new');
    cy.get('[data-testid="connection-selector"]').click();
    cy.contains('Test Connection').click();
    
    // Drag header block to canvas
    cy.get('[data-testid="block-header"]').drag('[data-testid="puck-canvas"]');
    
    // Configure block
    cy.get('[data-testid="field-titleField"]').click();
    cy.contains('name').click();
    
    // Save
    cy.get('input[name="themeName"]').type('Test Theme');
    cy.contains('Salvar Tema').click();
    cy.contains('Tema salvo com sucesso');
  });
  
  it('loads and edits existing theme', () => {
    cy.visit('/admin/page-builder/edit/theme-123');
    // Verify blocks loaded
    // Make changes
    // Save
  });
});
```

## Migration Plan

### Phase 1: Setup (Non-Breaking)
1. Install @measured/puck package
2. Create puck/ directory structure
3. Implement PuckConfig with all components
4. Implement schemaConverter utilities
5. Add unit tests for converters

### Phase 2: Component Migration
1. Create Puck versions of all 16 block components
2. Implement custom field types (FieldSelectField, etc.)
3. Test each component in isolation

### Phase 3: Editor Integration
1. Create PuckPageBuilder wrapper component
2. Implement connection selector integration
3. Add theme metadata form (name, description)
4. Test full editor flow

### Phase 4: Renderer Integration
1. Create PuckThemeRenderer for display mode
2. Update ThemeRenderer to use new component
3. Test rendering of saved themes

### Phase 5: Legacy Migration
1. Implement legacy theme detection
2. Create migration utility
3. Test with existing themes from database
4. Add migration on load (transparent to user)

### Phase 6: Cleanup
1. Update PageBuilderPage to use new editor
2. Remove old @dnd-kit based implementation (optional, can keep as fallback)
3. Update documentation

## Dependencies

### New Package

```json
{
  "dependencies": {
    "@measured/puck": "^0.16.0"
  }
}
```

### Puck CSS Import

```typescript
// src/components/features/page-builder/puck/PuckPageBuilder.tsx
import '@measured/puck/puck.css';
```

## UI/UX Considerations

### Viewport Preview
- Mobile: 360px
- Tablet: 768px  
- Desktop: 1280px

### Keyboard Shortcuts
- Ctrl+Z: Undo (native Puck)
- Ctrl+Shift+Z: Redo (native Puck)
- Delete: Remove selected block
- Ctrl+D: Duplicate block

### Accessibility
- All Puck components use semantic HTML
- Keyboard navigation supported
- Screen reader compatible
- Focus management handled by Puck

## Performance Considerations

- Puck uses React 18 concurrent features
- Lazy load block components
- Memoize expensive renders
- Debounce field updates (300ms)
