# Design Document

## Overview

Este documento descreve o design da solução para melhorar a visualização de eventos no Calendário, garantindo que apenas os campos marcados como "Exibir no Card" (`showInCard: true`) sejam exibidos, seguindo o mesmo padrão já implementado nas visualizações Grid, List e Kanban.

### Current State

Atualmente, o componente `CalendarView` usa a função `getRecordTitle` que já filtra campos com `showInCard`:

```typescript
function getRecordTitle(record: any, fieldMappings: FieldMapping[]): string {
  const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
  
  if (cardFields.length === 0) {
    return `Registro #${record.id || record.Id}`;
  }
  
  const values = cardFields
    .map((field) => record[field.columnName])
    .filter(Boolean)
    .join(' - ');
  
  return values || `Registro #${record.id || record.Id}`;
}
```

**Limitações atuais:**
1. Apenas o título do evento usa `showInCard`
2. Não há tooltip customizado com informações detalhadas
3. Títulos longos não são truncados
4. Não há componente customizado para eventos (usa o padrão do react-big-calendar)

### Target State

Os eventos do calendário devem:
1. Exibir títulos baseados em campos com `showInCard: true`
2. Mostrar tooltips com todos os campos marcados como `showInCard: true`
3. Truncar títulos longos para melhor legibilidade
4. Usar um componente customizado para controle total da aparência
5. Manter consistência visual com Grid, List e Kanban

## Architecture

### Component Hierarchy

```
CalendarView
  └── react-big-calendar
      └── CustomEventComponent (NOVO)
          └── Event Display
              ├── Event Title (truncated)
              └── Tooltip (on hover)
                  └── Field List (showInCard: true)
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
CalendarView Component
  └── mapRecordsToEvents()
      └── getRecordTitle() (existing)
      └── getRecordFields() (NEW)
          ↓
CustomEventComponent (NEW)
  └── Render title + tooltip
      └── Filter: showInCard && visible
```

## Components and Interfaces

### 1. CustomEventComponent (NEW)

**Location:** `src/components/user/CalendarEventComponent.tsx`

**Purpose:** Custom component to render calendar events with enhanced field display

**Props:**
```typescript
interface CalendarEventComponentProps {
  event: CalendarEvent;
  fieldMappings: FieldMapping[];
}
```

**Implementation:**
```typescript
export function CalendarEventComponent({ 
  event, 
  fieldMappings 
}: CalendarEventComponentProps) {
  const record = event.resource;
  const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
  
  // Gerar título truncado
  const title = getEventTitle(record, cardFields);
  
  return (
    <div className="calendar-event">
      <div className="calendar-event-title" title={title}>
        {truncateText(title, 50)}
      </div>
      
      {/* Tooltip será renderizado pelo shadcn/ui Tooltip */}
      <div className="calendar-event-tooltip">
        {cardFields.map((field) => {
          const value = record[field.columnName];
          if (!value) return null;
          
          return (
            <div key={field.columnName} className="tooltip-field">
              <span className="tooltip-label">{field.label}:</span>
              <span className="tooltip-value">{formatValue(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 2. CalendarView Component (UPDATE)

**Location:** `src/components/user/CalendarView.tsx`

**Changes:**
1. Import and use `CustomEventComponent`
2. Pass `fieldMappings` to custom component
3. Update `mapRecordsToEvents` to include field data

**Updated Implementation:**
```typescript
import { CalendarEventComponent } from './CalendarEventComponent';

export function CalendarView({ ... }: CalendarViewProps) {
  // ... existing code ...
  
  return (
    <Calendar
      localizer={localizer}
      events={events}
      components={{
        event: (props) => (
          <CalendarEventComponent
            event={props.event as CalendarEvent}
            fieldMappings={connection.fieldMappings || []}
          />
        ),
      }}
      // ... other props ...
    />
  );
}
```

### 3. Helper Functions (UPDATE)

**Location:** `src/components/user/CalendarView.tsx`

**New Functions:**

```typescript
/**
 * Truncar texto com ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Formatar valor baseado no tipo
 */
function formatValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  return String(value);
}

/**
 * Gerar título do evento (existing - keep as is)
 */
function getRecordTitle(record: any, fieldMappings: FieldMapping[]): string {
  const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
  
  if (cardFields.length === 0) {
    return `Registro #${record.id || record.Id}`;
  }
  
  const values = cardFields
    .map((field) => record[field.columnName])
    .filter(Boolean)
    .map(formatValue)
    .join(' - ');
  
  return values || `Registro #${record.id || record.Id}`;
}
```

## Data Models

### CalendarEvent Interface (UPDATE)

**Location:** `src/services/database-connections.ts`

**Current:**
```typescript
export interface CalendarEvent extends Event {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  resource: any; // Original record
}
```

**No changes needed** - The `resource` property already contains the full record data.

### FieldMapping Interface (Existing - No Changes)

```typescript
interface FieldMapping {
  name?: string;
  columnName: string;
  label: string;
  type?: string;
  uidt?: string;
  visible: boolean;
  editable: boolean;
  showInCard?: boolean;
  helperText?: string;
}
```

## UI/UX Design

### Event Display Modes

#### 1. Month View
- **Title Only**: Display truncated title (max 50 chars)
- **Tooltip on Hover**: Show all `showInCard` fields
- **Click**: Open record details

#### 2. Week View
- **Title + First Field**: Display title and first field value
- **Tooltip on Hover**: Show all `showInCard` fields
- **Click**: Open record details

#### 3. Day View
- **Full Details**: Display all `showInCard` fields inline
- **No Tooltip**: All info is already visible
- **Click**: Open record details

### Tooltip Design

**Structure:**
```
┌─────────────────────────────┐
│ Campo 1: Valor 1            │
│ Campo 2: Valor 2            │
│ Campo 3: Valor 3            │
│ ...                         │
└─────────────────────────────┘
```

**Styling:**
- Background: `bg-popover`
- Border: `border border-border`
- Shadow: `shadow-md`
- Padding: `p-3`
- Max Width: `max-w-xs`
- Font Size: `text-sm`

### Event Styling

**Default Event:**
```css
.calendar-event {
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Event on Hover:**
```css
.calendar-event:hover {
  opacity: 0.9;
  cursor: pointer;
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
  return `Registro #${record.id || record.Id}`;
}
```

**Fallback:** Display record ID

### Scenario 3: Field value is null, undefined, or empty

**Handling:**
```typescript
const value = record[field.columnName];
if (!value) return null; // Skip this field
```

**Result:** Field is not displayed in tooltip

### Scenario 4: All field values are empty

**Handling:**
```typescript
const values = cardFields
  .map((field) => record[field.columnName])
  .filter(Boolean);

if (values.length === 0) {
  return `Registro #${record.id || record.Id}`;
}
```

**Fallback:** Display record ID

## Testing Strategy

### Unit Tests

**Test File:** `src/components/user/__tests__/CalendarEventComponent.test.tsx`

**Test Cases:**
1. Should display only fields with showInCard: true and visible: true
2. Should display fallback (ID) when no fields have showInCard: true
3. Should not display fields with visible: false
4. Should handle empty fieldMappings array
5. Should handle undefined fieldMappings
6. Should skip fields with null/undefined/empty values
7. Should truncate long titles correctly
8. Should format values correctly (boolean, number, date, string)
9. Should display tooltip with all card fields
10. Should handle click events correctly

### Integration Tests

**Test File:** `src/components/user/__tests__/CalendarView.test.tsx`

**Test Cases:**
1. Should pass fieldMappings correctly to CalendarEventComponent
2. Should render multiple events with correct field filtering
3. Should update event display when fieldMappings change
4. Should maintain consistency with Grid/List/Kanban views

### Manual Testing Checklist

1. **Setup:**
   - Create a database connection with 5+ fields
   - Mark 2-3 fields with `showInCard: true`
   - Mark 1-2 fields with `showInCard: false`
   - Ensure all fields have `visible: true`

2. **Test Calendar View:**
   - Navigate to Calendar view
   - Verify event titles show only fields with `showInCard: true`
   - Hover over events and verify tooltip shows all marked fields
   - Verify field labels and values are correct
   - Verify long titles are truncated with "..."

3. **Test Different Calendar Views:**
   - Switch to Month view - verify titles are truncated
   - Switch to Week view - verify more details are shown
   - Switch to Day view - verify full details are shown

4. **Test Consistency:**
   - Switch to Grid view - verify same fields are displayed
   - Switch to List view - verify same fields are displayed
   - Switch to Kanban view - verify same fields are displayed
   - Switch back to Calendar view - verify consistency

5. **Test Edge Cases:**
   - Unmark all `showInCard` fields - verify ID fallback
   - Mark a field with `visible: false` and `showInCard: true` - verify field is hidden
   - Test with empty field values - verify fields are skipped
   - Test with very long field values - verify truncation

6. **Test Backward Compatibility:**
   - Load existing connection without `showInCard` configuration
   - Verify fallback behavior works correctly
   - Verify no errors or crashes occur

## Implementation Plan

### Phase 1: Create Custom Event Component

1. Create `CalendarEventComponent.tsx` file
2. Implement basic event rendering with title
3. Add field filtering logic (`showInCard && visible`)
4. Add tooltip with field details
5. Add title truncation
6. Add value formatting

### Phase 2: Integrate with CalendarView

1. Import `CalendarEventComponent` in `CalendarView.tsx`
2. Pass component to react-big-calendar via `components` prop
3. Pass `fieldMappings` to custom component
4. Test basic rendering

### Phase 3: Enhance Styling and UX

1. Add custom CSS for event styling
2. Implement tooltip using shadcn/ui Tooltip component
3. Add hover effects
4. Ensure responsive design
5. Test on different screen sizes

### Phase 4: Testing and Validation

1. Write unit tests for `CalendarEventComponent`
2. Write integration tests for `CalendarView`
3. Perform manual testing with checklist
4. Verify consistency across all views
5. Test backward compatibility

### Phase 5: Cleanup and Documentation

1. Remove debug console.log statements
2. Add code comments
3. Update inline documentation
4. Verify no TypeScript errors

## Performance Considerations

### Current Performance

The filtering operation is lightweight:
```typescript
const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
```

- Time Complexity: O(n) where n is the number of fields
- Typical n: 5-20 fields per connection
- Impact: Negligible (< 1ms)

### Event Rendering Performance

- react-big-calendar handles virtualization
- Only visible events are rendered
- Custom component adds minimal overhead
- Tooltip is rendered on-demand (hover)

### Optimization Opportunities

1. **Memoize cardFields:**
```typescript
const cardFields = useMemo(
  () => fieldMappings.filter((f) => f.showInCard && f.visible),
  [fieldMappings]
);
```

2. **Memoize event titles:**
```typescript
const eventTitle = useMemo(
  () => getRecordTitle(record, cardFields),
  [record, cardFields]
);
```

## Security Considerations

### Data Validation

- `fieldMappings` is validated on the backend
- `showInCard` property is validated as boolean
- No user input is directly rendered

### XSS Prevention

- Field values are rendered as text, not HTML
- No `dangerouslySetInnerHTML` is used
- React automatically escapes text content
- Tooltip content is sanitized

## Accessibility Considerations

### Screen Reader Support

- Event titles are readable by screen readers
- Tooltip content is accessible via ARIA attributes
- Keyboard navigation is supported by react-big-calendar

### Keyboard Navigation

- Events are focusable and keyboard accessible
- Tooltip can be triggered via keyboard (focus)
- Click events work with Enter/Space keys

### Color Contrast

- Ensure sufficient contrast for event text
- Use semantic colors for different event types
- Test with color blindness simulators

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features are used (transpiled by Vite)
- CSS Grid and Flexbox are used (widely supported)
- react-big-calendar is compatible with all modern browsers

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate Rollback:**
   - Revert changes to `CalendarView.tsx`
   - Remove `CalendarEventComponent.tsx`
   - Deploy previous version

2. **Partial Rollback:**
   - Keep custom component but disable tooltip
   - Use default react-big-calendar event component
   - Fix issues and redeploy

3. **Communication:**
   - Notify users of temporary issue
   - Provide ETA for fix

## Future Enhancements

### 1. Event Color Coding

Allow Admin to configure event colors based on field values.

**Implementation:**
- Add `eventColorField` to `ViewConfiguration`
- Map field values to colors
- Apply colors to custom event component

### 2. Multi-Day Events

Support events that span multiple days.

**Implementation:**
- Add `endDateField` to `ViewConfiguration`
- Update `mapRecordsToEvents` to use end date
- Handle multi-day event rendering

### 3. Event Grouping

Group events by a specific field (e.g., category, status).

**Implementation:**
- Add `groupByField` to `ViewConfiguration`
- Create separate calendars for each group
- Use tabs or accordion to switch between groups

### 4. Custom Event Actions

Add quick actions to events (e.g., edit, delete, duplicate).

**Implementation:**
- Add action buttons to custom event component
- Implement action handlers
- Add confirmation dialogs

## References

- [Advanced View Builder Spec](.kiro/specs/advanced-view-builder/)
- [Kanban Card Field Filtering Spec](.kiro/specs/kanban-card-field-filtering/)
- [CalendarView Component](src/components/user/CalendarView.tsx)
- [react-big-calendar Documentation](https://jquense.github.io/react-big-calendar/)
- [shadcn/ui Tooltip](https://ui.shadcn.com/docs/components/tooltip)
