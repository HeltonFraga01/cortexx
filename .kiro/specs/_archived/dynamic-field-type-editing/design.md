# Design Document

## Overview

This design implements type-aware field editing for database records by fetching field metadata from NocoDB and rendering appropriate input components based on each field's data type. The solution extends the existing `RecordForm` component to support multiple field types (single select, multi select, checkbox, date, datetime, number, etc.) instead of treating all fields as plain text inputs.

The implementation leverages NocoDB's column metadata API to determine field types and constraints, then dynamically renders specialized input components from shadcn/ui library. This ensures data integrity by preventing users from entering invalid data formats and provides a better user experience with appropriate UI controls.

## Architecture

### High-Level Flow

```
User Opens Edit Page
    ↓
Load Connection Metadata (cached)
    ↓
Fetch NocoDB Column Metadata (if not cached)
    ↓
Parse Field Types & Options
    ↓
Render Type-Aware Input Components
    ↓
User Edits Fields
    ↓
Client-Side Validation
    ↓
Submit to Backend
    ↓
Backend Validation & Save
```

### Component Architecture

```
UserDatabaseView (existing)
    ↓
RecordForm (enhanced)
    ├── FieldTypeResolver (new utility)
    ├── TypeAwareFieldInput (new component)
    │   ├── TextInput (existing)
    │   ├── TextareaInput (existing)
    │   ├── NumberInput (new)
    │   ├── DatePicker (existing shadcn/ui)
    │   ├── DateTimePicker (new)
    │   ├── TimePicker (new)
    │   ├── SelectInput (existing shadcn/ui)
    │   ├── MultiSelectInput (new)
    │   ├── CheckboxInput (existing shadcn/ui)
    │   ├── EmailInput (new)
    │   ├── PhoneInput (new)
    │   └── UrlInput (new)
    └── FieldValidator (enhanced)
```

### Data Flow

1. **Metadata Fetching**: When `RecordForm` mounts, it checks if field metadata is cached. If not, it calls `databaseConnectionsService.getNocoDBColumns()` to fetch column definitions.

2. **Type Resolution**: A new `FieldTypeResolver` utility maps NocoDB's `uidt` (UI Data Type) values to our internal field type enum.

3. **Component Rendering**: Based on resolved type, `TypeAwareFieldInput` renders the appropriate input component with proper props and validation.

4. **Value Handling**: Each input component handles its own value formatting (e.g., dates to ISO strings, multi-select to arrays).

5. **Validation**: Client-side validation occurs on blur and before submission. Backend validation remains unchanged.

## Components and Interfaces

### New Types

```typescript
// src/lib/types.ts additions

export enum FieldType {
  TEXT = 'text',
  LONG_TEXT = 'longText',
  NUMBER = 'number',
  DECIMAL = 'decimal',
  CURRENCY = 'currency',
  PERCENT = 'percent',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  YEAR = 'year',
  SINGLE_SELECT = 'singleSelect',
  MULTI_SELECT = 'multiSelect',
  CHECKBOX = 'checkbox',
  EMAIL = 'email',
  PHONE = 'phoneNumber',
  URL = 'url',
  RATING = 'rating',
  DURATION = 'duration',
  ATTACHMENT = 'attachment',
  USER = 'user',
  JSON = 'json'
}

export interface FieldMetadata {
  columnName: string;
  label: string;
  type: FieldType;
  uidt: string; // Original NocoDB type
  required: boolean;
  editable: boolean;
  visible: boolean;
  options?: SelectOption[]; // For single/multi select
  meta?: Record<string, any>; // Additional metadata from NocoDB
}

export interface SelectOption {
  id: string;
  title: string;
  color?: string; // NocoDB supports colored options
}

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
}
```

### Enhanced RecordForm Component

```typescript
// src/components/user/RecordForm.tsx (enhanced)

interface RecordFormProps {
  connection: DatabaseConnection;
  record: Record<string, any>;
  onRecordChange: (updatedRecord: Record<string, any>) => void;
  disabled?: boolean;
  loading?: boolean;
}

interface RecordFormState {
  formData: Record<string, any>;
  validation: Record<string, FieldValidationResult>;
  fieldMetadata: FieldMetadata[];
  metadataLoading: boolean;
  metadataError?: string;
}

// Component will:
// 1. Fetch field metadata on mount (with caching)
// 2. Merge metadata with existing FieldMapping configuration
// 3. Render TypeAwareFieldInput for each visible field
// 4. Handle validation and change events
// 5. Maintain backward compatibility with existing functionality
```

### New TypeAwareFieldInput Component

```typescript
// src/components/user/TypeAwareFieldInput.tsx (new)

interface TypeAwareFieldInputProps {
  field: FieldMetadata;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  helperText?: string;
}

// Component will:
// 1. Receive field metadata and current value
// 2. Render appropriate input based on field.type
// 3. Handle value formatting and parsing
// 4. Emit onChange with properly formatted value
// 5. Display validation errors
```

### Field Type Resolver Utility

```typescript
// src/utils/fieldTypeResolver.ts (new)

export class FieldTypeResolver {
  /**
   * Maps NocoDB uidt to our FieldType enum
   */
  static resolveFieldType(uidt: string): FieldType {
    const typeMap: Record<string, FieldType> = {
      'SingleLineText': FieldType.TEXT,
      'LongText': FieldType.LONG_TEXT,
      'Number': FieldType.NUMBER,
      'Decimal': FieldType.DECIMAL,
      'Currency': FieldType.CURRENCY,
      'Percent': FieldType.PERCENT,
      'Date': FieldType.DATE,
      'DateTime': FieldType.DATETIME,
      'Time': FieldType.TIME,
      'Year': FieldType.YEAR,
      'SingleSelect': FieldType.SINGLE_SELECT,
      'MultiSelect': FieldType.MULTI_SELECT,
      'Checkbox': FieldType.CHECKBOX,
      'Email': FieldType.EMAIL,
      'PhoneNumber': FieldType.PHONE,
      'URL': FieldType.URL,
      'Rating': FieldType.RATING,
      'Duration': FieldType.DURATION,
      'Attachment': FieldType.ATTACHMENT,
      'User': FieldType.USER,
      'JSON': FieldType.JSON
    };
    
    return typeMap[uidt] || FieldType.TEXT;
  }
  
  /**
   * Extracts select options from NocoDB column metadata
   */
  static extractSelectOptions(columnMeta: any): SelectOption[] {
    if (!columnMeta.colOptions?.options) return [];
    
    return columnMeta.colOptions.options.map((opt: any) => ({
      id: opt.id || opt.title,
      title: opt.title,
      color: opt.color
    }));
  }
  
  /**
   * Determines if a field type requires special validation
   */
  static requiresValidation(type: FieldType): boolean {
    return [
      FieldType.EMAIL,
      FieldType.PHONE,
      FieldType.URL,
      FieldType.NUMBER,
      FieldType.DECIMAL,
      FieldType.DATE,
      FieldType.DATETIME
    ].includes(type);
  }
}
```

## Data Models

### NocoDB Column Metadata Structure

```typescript
// Actual structure returned by NocoDB API
interface NocoDBColumnResponse {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type
  dt: string; // Database Type
  np: string; // Numeric Precision
  ns: string; // Numeric Scale
  clen: number; // Column Length
  cop: number; // Column Order Position
  pk: boolean; // Primary Key
  pv: boolean; // Primary Value
  rqd: boolean; // Required
  un: boolean; // Unsigned
  ai: boolean; // Auto Increment
  unique: boolean;
  cdf: string | null; // Column Default
  cc: string | null; // Computed Column
  csn: string | null; // Column System Name
  dtx: string; // Data Type Extended
  dtxp: string; // Data Type Extended Precision
  dtxs: string; // Data Type Extended Scale
  au: boolean; // Auto Update
  colOptions?: {
    options?: Array<{
      id: string;
      title: string;
      color?: string;
      order?: number;
    }>;
  };
  meta?: Record<string, any>;
}
```

### Cached Metadata Structure

```typescript
// Stored in connectionCache
interface CachedFieldMetadata {
  connectionId: number;
  tableId: string;
  fields: FieldMetadata[];
  fetchedAt: number;
  expiresAt: number;
}
```

## Error Handling

### Metadata Fetch Errors

```typescript
// When metadata fetch fails, fall back to text inputs
try {
  const columns = await databaseConnectionsService.getNocoDBColumns(
    connection.host,
    connection.nocodb_token!,
    connection.nocodb_table_id!
  );
  setFieldMetadata(parseColumns(columns));
} catch (error) {
  console.error('Failed to fetch field metadata:', error);
  setMetadataError('Não foi possível carregar tipos de campos. Usando campos de texto.');
  // Continue with text-only inputs
  setFieldMetadata(createFallbackMetadata(fieldMappings));
}
```

### Validation Errors

```typescript
// Field-level validation with user-friendly messages
const validateField = (field: FieldMetadata, value: any): FieldValidationResult => {
  // Required validation
  if (field.required && !value) {
    return {
      isValid: false,
      error: `${field.label} é obrigatório`
    };
  }
  
  // Type-specific validation
  switch (field.type) {
    case FieldType.EMAIL:
      if (value && !isValidEmail(value)) {
        return {
          isValid: false,
          error: 'Digite um email válido (exemplo: usuario@dominio.com)'
        };
      }
      break;
      
    case FieldType.PHONE:
      if (value && !isValidPhone(value)) {
        return {
          isValid: false,
          error: 'Digite um telefone válido (exemplo: (11) 98765-4321)'
        };
      }
      break;
      
    case FieldType.URL:
      if (value && !isValidUrl(value)) {
        return {
          isValid: false,
          error: 'Digite uma URL válida (exemplo: https://exemplo.com)'
        };
      }
      break;
      
    case FieldType.NUMBER:
    case FieldType.DECIMAL:
      if (value && isNaN(Number(value))) {
        return {
          isValid: false,
          error: 'Digite um número válido'
        };
      }
      break;
      
    case FieldType.SINGLE_SELECT:
      if (value && field.options && !field.options.find(opt => opt.id === value)) {
        return {
          isValid: false,
          error: 'Selecione uma opção válida da lista'
        };
      }
      break;
  }
  
  return { isValid: true };
};
```

### Network Errors

```typescript
// Handle connection timeouts and network issues
const fetchWithRetry = async (fn: () => Promise<any>, retries = 2): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      await delay(1000);
      return fetchWithRetry(fn, retries - 1);
    }
    throw error;
  }
};
```

## Testing Strategy

### Unit Tests

```typescript
// src/components/user/__tests__/TypeAwareFieldInput.test.tsx
describe('TypeAwareFieldInput', () => {
  it('renders text input for TEXT type', () => {});
  it('renders select dropdown for SINGLE_SELECT type', () => {});
  it('renders multi-select for MULTI_SELECT type', () => {});
  it('renders date picker for DATE type', () => {});
  it('renders checkbox for CHECKBOX type', () => {});
  it('validates email format', () => {});
  it('validates phone format', () => {});
  it('validates URL format', () => {});
  it('handles disabled state', () => {});
  it('displays error messages', () => {});
});

// src/utils/__tests__/fieldTypeResolver.test.ts
describe('FieldTypeResolver', () => {
  it('maps NocoDB types to FieldType enum', () => {});
  it('extracts select options from column metadata', () => {});
  it('handles unknown types gracefully', () => {});
});
```

### Integration Tests

```typescript
// src/components/user/__tests__/RecordForm.integration.test.tsx
describe('RecordForm with field metadata', () => {
  it('fetches and caches field metadata on mount', () => {});
  it('renders appropriate inputs based on field types', () => {});
  it('validates all fields before submission', () => {});
  it('falls back to text inputs when metadata fetch fails', () => {});
  it('maintains backward compatibility with existing FieldMapping', () => {});
});
```

### E2E Tests

```typescript
// cypress/e2e/dynamic-field-editing.cy.ts
describe('Dynamic Field Type Editing', () => {
  it('displays date picker for date fields', () => {});
  it('displays dropdown for single select fields', () => {});
  it('prevents invalid email submission', () => {});
  it('allows multi-select with checkboxes', () => {});
  it('saves edited record successfully', () => {});
});
```

## Performance Considerations

### Caching Strategy

```typescript
// Cache field metadata for 10 minutes
const METADATA_CACHE_TTL = 600000; // 10 minutes

// Cache key structure
const cacheKey = `field-metadata:${connectionId}:${tableId}`;

// Invalidation triggers:
// 1. Admin updates connection configuration
// 2. User manually refreshes
// 3. Cache TTL expires
```

### Lazy Loading

```typescript
// Only fetch metadata when RecordForm is rendered
// Not when listing records in table view
useEffect(() => {
  if (connection.type === 'NOCODB' && !fieldMetadata.length) {
    fetchFieldMetadata();
  }
}, [connection]);
```

### Debounced Validation

```typescript
// Debounce validation on input change to avoid excessive re-renders
const debouncedValidate = useMemo(
  () => debounce((field: FieldMetadata, value: any) => {
    const result = validateField(field, value);
    setValidation(prev => ({
      ...prev,
      [field.columnName]: result
    }));
  }, 300),
  []
);
```

## Security Considerations

### Input Sanitization

```typescript
// Sanitize all user inputs before submission
const sanitizeValue = (type: FieldType, value: any): any => {
  if (value === null || value === undefined) return value;
  
  switch (type) {
    case FieldType.TEXT:
    case FieldType.LONG_TEXT:
      // Remove potentially dangerous characters
      return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [] });
      
    case FieldType.EMAIL:
      return String(value).toLowerCase().trim();
      
    case FieldType.URL:
      // Ensure URL has protocol
      const url = String(value).trim();
      return url.match(/^https?:\/\//) ? url : `https://${url}`;
      
    default:
      return value;
  }
};
```

### XSS Prevention

```typescript
// Never render user input as HTML
// Always use text content or sanitized values
<Input value={sanitizeValue(field.type, value)} />
```

### CSRF Protection

```typescript
// Backend already implements CSRF protection
// Frontend sends user token in Authorization header
// No additional changes needed
```

## Backward Compatibility

### Existing FieldMapping Support

```typescript
// Merge NocoDB metadata with existing FieldMapping configuration
const mergeFieldConfiguration = (
  metadata: FieldMetadata[],
  mappings: FieldMapping[]
): FieldMetadata[] => {
  return metadata.map(field => {
    const mapping = mappings.find(m => m.columnName === field.columnName);
    
    if (!mapping) return field;
    
    return {
      ...field,
      label: mapping.label || field.label,
      visible: mapping.visible,
      editable: mapping.editable,
      helperText: mapping.helperText
    };
  });
};
```

### Fallback for Non-NocoDB Connections

```typescript
// For SQLite, PostgreSQL, MySQL connections without metadata
if (connection.type !== 'NOCODB') {
  // Use existing text-only inputs
  return <RecordFormLegacy {...props} />;
}
```

### Gradual Rollout

```typescript
// Feature flag for gradual rollout
const ENABLE_TYPE_AWARE_INPUTS = true;

if (!ENABLE_TYPE_AWARE_INPUTS) {
  return <RecordFormLegacy {...props} />;
}
```

## Migration Path

### Phase 1: Add Metadata Fetching (Non-Breaking)
- Add `getNocoDBColumns` method to service (already exists)
- Add caching layer for metadata
- No UI changes yet

### Phase 2: Implement Type-Aware Components (Opt-In)
- Create `TypeAwareFieldInput` component
- Add feature flag to enable/disable
- Test with subset of users

### Phase 3: Full Rollout
- Enable for all NocoDB connections
- Monitor error rates and user feedback
- Keep fallback to text inputs for errors

### Phase 4: Extend to Other Database Types
- Add metadata fetching for PostgreSQL, MySQL
- Implement type mapping for each database
- Maintain consistent UX across all types

## Accessibility

### Keyboard Navigation

```typescript
// All inputs support keyboard navigation
<Select onKeyDown={handleKeyDown}>
  <SelectTrigger aria-label={field.label}>
    <SelectValue />
  </SelectTrigger>
</Select>
```

### Screen Reader Support

```typescript
// Proper ARIA labels and descriptions
<Input
  aria-label={field.label}
  aria-describedby={`${field.columnName}-helper`}
  aria-invalid={hasError}
  aria-required={field.required}
/>
```

### Focus Management

```typescript
// Focus first invalid field on submission error
const focusFirstError = () => {
  const firstErrorField = Object.keys(validation).find(
    key => !validation[key].isValid
  );
  
  if (firstErrorField) {
    document.getElementById(`field-${firstErrorField}`)?.focus();
  }
};
```

## Monitoring and Observability

### Metrics to Track

```typescript
// Track metadata fetch success/failure rates
logger.info('Field metadata fetched', {
  connectionId,
  fieldCount: metadata.length,
  duration: Date.now() - startTime
});

// Track validation errors by field type
logger.warn('Validation error', {
  fieldType: field.type,
  errorType: result.error
});

// Track fallback usage
logger.warn('Using fallback text inputs', {
  connectionId,
  reason: error.message
});
```

### Error Reporting

```typescript
// Report critical errors to monitoring service
if (metadataError && !isNetworkError(metadataError)) {
  reportError('FieldMetadataFetchFailed', {
    connectionId,
    error: metadataError
  });
}
```
