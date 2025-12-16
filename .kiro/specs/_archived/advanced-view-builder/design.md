# Design Document

## Overview

The Advanced View Builder feature transforms the Admin's database configuration interface from a simple field mapper into a comprehensive view configuration system. This design enables Admins to:

1. Add helper text to form fields for better user guidance
2. Configure Calendar views for date-based data visualization
3. Configure Kanban views for status/stage-based data visualization

The design maintains backward compatibility with existing field mapping functionality while adding new capabilities through a modular, extensible architecture.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Interface                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         DatabaseAdvancedTab Component                 │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │  │
│  │  │  Field Mapper  │  │  View Configuration      │   │  │
│  │  │  (Enhanced)    │  │  Section (NEW)           │   │  │
│  │  │  - Labels      │  │  - Calendar Toggle       │   │  │
│  │  │  - Visibility  │  │  - Calendar Date Field   │   │  │
│  │  │  - Editable    │  │  - Kanban Toggle         │   │  │
│  │  │  - Show in Card│  │  - Kanban Status Field   │   │  │
│  │  │  - Helper Text │  │                          │   │  │
│  │  └────────────────┘  └──────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Connection Service                     │
│  - Save/Load Field Mappings (with helper text)              │
│  - Save/Load View Configurations                            │
│  - Validate View Settings                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API                                │
│  - Store enhanced field mappings                            │
│  - Store view configurations                                │
│  - Serve configuration to end users                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  End User Interface                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         UserDatabaseView Component (NEW)             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │  │ Form View  │  │ Calendar   │  │ Kanban View  │  │  │
│  │  │ (Enhanced) │  │ View (NEW) │  │ (NEW)        │  │  │
│  │  │ - Fields   │  │ - Events   │  │ - Columns    │  │  │
│  │  │ - Helper   │  │ - Date     │  │ - Cards      │  │  │
│  │  │   Text     │  │   Range    │  │ - Drag/Drop  │  │  │
│  │  └────────────┘  └────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
AdminDatabases
  └── DatabaseConnectionEdit
      └── DatabaseConnectionForm
          └── DatabaseAdvancedTab (ENHANCED)
              ├── User Assignment Section (existing)
              ├── Data Link Section (existing)
              ├── Field Mapper Section (ENHANCED)
              │   └── Field Mapping Table
              │       ├── Column Name
              │       ├── Label
              │       ├── Helper Text (NEW)
              │       ├── Visible
              │       ├── Editable
              │       └── Show in Card
              └── View Configuration Section (NEW)
                  ├── Calendar View Config
                  │   ├── Enable Toggle
                  │   └── Date Field Selector
                  └── Kanban View Config
                      ├── Enable Toggle
                      └── Status Field Selector

UserDashboard
  └── UserDatabaseView (NEW - replaces UserDatabase)
      ├── Connection Selector
      ├── View Tabs (NEW)
      │   ├── Form Tab
      │   ├── Calendar Tab (conditional)
      │   └── Kanban Tab (conditional)
      ├── FormView (enhanced DirectEditPage)
      │   └── RecordForm (ENHANCED)
      │       └── Fields with Helper Text
      ├── CalendarView (NEW)
      │   └── Calendar Component
      │       └── Event Cards
      └── KanbanView (NEW)
          └── Kanban Board
              └── Kanban Columns
                  └── Record Cards
```

## Components and Interfaces

### 1. Enhanced Data Models

#### FieldMapping (Enhanced)

```typescript
interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
  showInCard?: boolean;
  helperText?: string; // NEW: Helper text for the field
}
```

#### ViewConfiguration (NEW)

```typescript
interface ViewConfiguration {
  calendar?: {
    enabled: boolean;
    dateField?: string; // Column name to use for calendar organization
  };
  kanban?: {
    enabled: boolean;
    statusField?: string; // Column name to use for kanban columns
  };
}
```

#### DatabaseConnection (Enhanced)

```typescript
interface DatabaseConnection {
  // ... existing fields ...
  fieldMappings?: FieldMapping[];
  viewConfiguration?: ViewConfiguration; // NEW
}
```

### 2. Admin Components

#### DatabaseAdvancedTab (Enhanced)

**Location:** `src/components/admin/DatabaseAdvancedTab.tsx`

**Enhancements:**
- Add "Helper Text" column to Field Mapper table
- Add new "View Configuration" section below Field Mapper
- Implement Calendar view toggle and date field selector
- Implement Kanban view toggle and status field selector
- Validate view configurations before saving

**New State:**
```typescript
const [viewConfig, setViewConfig] = useState<ViewConfiguration>({
  calendar: { enabled: false },
  kanban: { enabled: false }
});
```

**New Methods:**
```typescript
// Handle calendar view toggle
const handleCalendarToggle = (enabled: boolean) => {
  setViewConfig(prev => ({
    ...prev,
    calendar: { ...prev.calendar, enabled }
  }));
};

// Handle calendar date field selection
const handleCalendarDateFieldChange = (fieldName: string) => {
  setViewConfig(prev => ({
    ...prev,
    calendar: { ...prev.calendar, dateField: fieldName }
  }));
};

// Handle kanban view toggle
const handleKanbanToggle = (enabled: boolean) => {
  setViewConfig(prev => ({
    ...prev,
    kanban: { ...prev.kanban, enabled }
  }));
};

// Handle kanban status field selection
const handleKanbanStatusFieldChange = (fieldName: string) => {
  setViewConfig(prev => ({
    ...prev,
    kanban: { ...prev.kanban, statusField: fieldName }
  }));
};

// Get date/datetime columns for calendar
const getDateColumns = (): NocoDBColumn[] => {
  return columns.filter(col => 
    col.uidt === 'Date' || 
    col.uidt === 'DateTime' ||
    col.uidt === 'CreatedTime' ||
    col.uidt === 'LastModifiedTime'
  );
};

// Get groupable columns for kanban
const getGroupableColumns = (): NocoDBColumn[] => {
  return columns.filter(col => 
    col.uidt === 'SingleLineText' ||
    col.uidt === 'LongText' ||
    col.uidt === 'SingleSelect' ||
    col.uidt === 'MultiSelect'
  );
};
```

#### ViewConfigurationSection (NEW)

**Location:** `src/components/admin/ViewConfigurationSection.tsx`

**Purpose:** Separate component for view configuration to keep DatabaseAdvancedTab clean

**Props:**
```typescript
interface ViewConfigurationSectionProps {
  viewConfig: ViewConfiguration;
  columns: NocoDBColumn[];
  onViewConfigChange: (config: ViewConfiguration) => void;
}
```

### 3. End User Components

#### UserDatabaseView (NEW)

**Location:** `src/components/user/UserDatabaseView.tsx`

**Purpose:** Main container for all database views with tab navigation

**Features:**
- Tab navigation between Form, Calendar, and Kanban views
- Conditional rendering based on view configuration
- View preference persistence in localStorage
- Responsive design for mobile/tablet/desktop

**State:**
```typescript
const [selectedView, setSelectedView] = useState<'form' | 'calendar' | 'kanban'>('form');
const [connection, setConnection] = useState<DatabaseConnection | null>(null);
const [records, setRecords] = useState<any[]>([]);
```

**View Persistence:**
```typescript
// Save view preference
const saveViewPreference = (connectionId: number, view: string) => {
  localStorage.setItem(`db-view-${connectionId}`, view);
};

// Load view preference
const loadViewPreference = (connectionId: number): string => {
  return localStorage.getItem(`db-view-${connectionId}`) || 'form';
};
```

#### FormView (Enhanced)

**Location:** `src/components/user/FormView.tsx` (refactored from DirectEditPage)

**Enhancements:**
- Display helper text below each form field
- Improved field layout with helper text styling
- Accessibility improvements for helper text

**Helper Text Display:**
```typescript
<div className="space-y-2">
  <Label htmlFor={field.columnName}>
    {field.label}
  </Label>
  <Input
    id={field.columnName}
    value={formData[field.columnName]}
    onChange={(e) => handleChange(field.columnName, e.target.value)}
    disabled={!field.editable}
  />
  {field.helperText && (
    <p className="text-xs text-muted-foreground">
      {field.helperText}
    </p>
  )}
</div>
```

#### CalendarView (NEW)

**Location:** `src/components/user/CalendarView.tsx`

**Purpose:** Display records in a calendar format

**Dependencies:**
- `react-big-calendar` or `@fullcalendar/react` for calendar UI
- Date manipulation library (date-fns or dayjs)

**Features:**
- Month/Week/Day views
- Event cards showing record information
- Click to view/edit record
- Date range navigation
- Responsive calendar layout

**Props:**
```typescript
interface CalendarViewProps {
  connection: DatabaseConnection;
  records: any[];
  dateField: string;
  onRecordClick: (record: any) => void;
  onRefresh: () => void;
}
```

**Event Mapping:**
```typescript
const mapRecordsToEvents = (
  records: any[],
  dateField: string,
  fieldMappings: FieldMapping[]
): CalendarEvent[] => {
  return records.map(record => ({
    id: record.id,
    title: getRecordTitle(record, fieldMappings),
    start: new Date(record[dateField]),
    end: new Date(record[dateField]),
    resource: record
  }));
};

const getRecordTitle = (
  record: any,
  fieldMappings: FieldMapping[]
): string => {
  const cardFields = fieldMappings.filter(f => f.showInCard);
  if (cardFields.length === 0) return `Record #${record.id}`;
  
  return cardFields
    .map(f => record[f.columnName])
    .filter(Boolean)
    .join(' - ');
};
```

#### KanbanView (NEW)

**Location:** `src/components/user/KanbanView.tsx`

**Purpose:** Display records in a kanban board format

**Dependencies:**
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop
- Custom kanban board components

**Features:**
- Columns based on unique values of status field
- Drag-and-drop to change status
- Card display using "Show in Card" fields
- Add new records
- Responsive board layout

**Props:**
```typescript
interface KanbanViewProps {
  connection: DatabaseConnection;
  records: any[];
  statusField: string;
  onRecordUpdate: (recordId: string, updates: any) => Promise<void>;
  onRecordClick: (record: any) => void;
  onRefresh: () => void;
}
```

**Column Generation:**
```typescript
const generateKanbanColumns = (
  records: any[],
  statusField: string
): KanbanColumn[] => {
  // Get unique status values
  const uniqueStatuses = Array.from(
    new Set(records.map(r => r[statusField]).filter(Boolean))
  );
  
  // Create columns
  return uniqueStatuses.map(status => ({
    id: status,
    title: status,
    records: records.filter(r => r[statusField] === status)
  }));
};
```

**Card Component:**
```typescript
interface KanbanCardProps {
  record: any;
  fieldMappings: FieldMapping[];
  onClick: () => void;
}

const KanbanCard = ({ record, fieldMappings, onClick }: KanbanCardProps) => {
  const cardFields = fieldMappings.filter(f => f.showInCard);
  
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        {cardFields.map(field => (
          <div key={field.columnName}>
            <span className="text-xs text-muted-foreground">{field.label}:</span>
            <span className="text-sm ml-2">{record[field.columnName]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

### 4. Service Layer

#### DatabaseConnectionsService (Enhanced)

**Location:** `src/services/database-connections.ts`

**New Methods:**

```typescript
/**
 * Get column metadata including type information
 * Used to filter date columns for calendar and groupable columns for kanban
 */
async getNocoDBColumnMetadata(
  baseURL: string,
  token: string,
  tableId: string
): Promise<NocoDBColumn[]> {
  // Implementation already exists, ensure it returns uidt (UI Data Type)
}

/**
 * Validate view configuration
 * Ensures selected fields exist and are of correct type
 */
validateViewConfiguration(
  viewConfig: ViewConfiguration,
  columns: NocoDBColumn[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate calendar configuration
  if (viewConfig.calendar?.enabled) {
    if (!viewConfig.calendar.dateField) {
      errors.push('Calendar view requires a date field selection');
    } else {
      const dateColumn = columns.find(c => c.column_name === viewConfig.calendar.dateField);
      if (!dateColumn) {
        errors.push('Selected calendar date field does not exist');
      } else if (!['Date', 'DateTime', 'CreatedTime', 'LastModifiedTime'].includes(dateColumn.uidt)) {
        errors.push('Selected calendar field is not a date/datetime type');
      }
    }
  }
  
  // Validate kanban configuration
  if (viewConfig.kanban?.enabled) {
    if (!viewConfig.kanban.statusField) {
      errors.push('Kanban view requires a status field selection');
    } else {
      const statusColumn = columns.find(c => c.column_name === viewConfig.kanban.statusField);
      if (!statusColumn) {
        errors.push('Selected kanban status field does not exist');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Data Models

### Database Schema Changes

#### database_connections table (Enhanced)

```sql
ALTER TABLE database_connections 
ADD COLUMN view_configuration TEXT; -- JSON string containing ViewConfiguration
```

**Example JSON:**
```json
{
  "calendar": {
    "enabled": true,
    "dateField": "created_at"
  },
  "kanban": {
    "enabled": true,
    "statusField": "status"
  }
}
```

#### field_mappings enhancement

The `fieldMappings` JSON in `database_connections` table will be enhanced:

```json
[
  {
    "columnName": "name",
    "label": "Nome Completo",
    "visible": true,
    "editable": true,
    "showInCard": true,
    "helperText": "Digite seu nome completo como aparece no documento"
  },
  {
    "columnName": "chatwootInboxName",
    "label": "Caixa de Entrada Chatwoot",
    "visible": true,
    "editable": true,
    "showInCard": false,
    "helperText": "Informe o nome exato da sua Caixa de Entrada no Chatwoot"
  }
]
```

## Error Handling

### Admin-Side Validation

1. **Field Mapping Validation:**
   - Ensure helper text doesn't exceed 500 characters
   - Validate that at least one field is marked as "Show in Card" if Kanban is enabled

2. **View Configuration Validation:**
   - Calendar: Ensure selected date field exists and is of date/datetime type
   - Kanban: Ensure selected status field exists
   - Prevent saving if validation fails
   - Show clear error messages

### End User Error Handling

1. **Missing Configuration:**
   - If view is enabled but configuration is incomplete, show error message
   - Fallback to Form view automatically

2. **Data Loading Errors:**
   - Show loading skeletons during data fetch
   - Display error messages if data fails to load
   - Provide retry button

3. **Invalid Data:**
   - Handle records with missing date values in Calendar view
   - Handle records with missing status values in Kanban view
   - Show "Uncategorized" column in Kanban for records without status

## Testing Strategy

### Unit Tests

1. **Component Tests:**
   - `DatabaseAdvancedTab`: Test helper text input, view toggles, field selectors
   - `ViewConfigurationSection`: Test validation logic
   - `CalendarView`: Test event mapping, date navigation
   - `KanbanView`: Test column generation, drag-and-drop
   - `FormView`: Test helper text display

2. **Service Tests:**
   - `DatabaseConnectionsService.validateViewConfiguration`: Test all validation scenarios
   - View configuration save/load operations

### Integration Tests

1. **Admin Flow:**
   - Create connection → Configure fields with helper text → Enable Calendar view → Save
   - Create connection → Configure fields → Enable Kanban view → Save
   - Edit existing connection → Modify view configuration → Save

2. **End User Flow:**
   - Load connection with Calendar view → View records in calendar → Click event → Edit record
   - Load connection with Kanban view → View records in kanban → Drag card → Update status
   - Load connection with Form view → See helper text → Edit fields

3. **View Persistence:**
   - Select Calendar view → Refresh page → Verify Calendar view is still selected
   - Switch between connections → Verify each connection remembers its view preference

### E2E Tests (Cypress)

1. **Complete Admin Configuration:**
   ```typescript
   it('should configure calendar and kanban views', () => {
     cy.login('admin');
     cy.visit('/admin/databases/edit/1');
     cy.get('[data-testid="advanced-tab"]').click();
     
     // Add helper text
     cy.get('[data-testid="field-mapping-table"]')
       .find('tr').first()
       .find('[data-testid="helper-text-input"]')
       .type('This is helper text');
     
     // Enable calendar view
     cy.get('[data-testid="calendar-toggle"]').click();
     cy.get('[data-testid="calendar-date-field"]').select('created_at');
     
     // Enable kanban view
     cy.get('[data-testid="kanban-toggle"]').click();
     cy.get('[data-testid="kanban-status-field"]').select('status');
     
     cy.get('[data-testid="save-button"]').click();
     cy.contains('Configuração salva com sucesso');
   });
   ```

2. **Complete End User Experience:**
   ```typescript
   it('should navigate between views and see helper text', () => {
     cy.login('user');
     cy.visit('/user/database/1');
     
     // Check form view with helper text
     cy.get('[data-testid="view-tab-form"]').click();
     cy.contains('This is helper text');
     
     // Check calendar view
     cy.get('[data-testid="view-tab-calendar"]').click();
     cy.get('[data-testid="calendar-view"]').should('be.visible');
     
     // Check kanban view
     cy.get('[data-testid="view-tab-kanban"]').click();
     cy.get('[data-testid="kanban-board"]').should('be.visible');
   });
   ```

## Performance Considerations

1. **Calendar View:**
   - Lazy load events outside visible date range
   - Implement virtual scrolling for large datasets
   - Cache calendar events in memory

2. **Kanban View:**
   - Limit number of cards rendered per column (virtualization)
   - Debounce drag-and-drop updates
   - Optimistic UI updates for status changes

3. **View Switching:**
   - Preload data for all enabled views on initial load
   - Cache view state to avoid re-rendering
   - Use React.memo for expensive components

4. **Data Fetching:**
   - Implement connection-level caching (already exists)
   - Invalidate cache on record updates
   - Use SWR or React Query for automatic revalidation

## Accessibility

1. **Keyboard Navigation:**
   - Tab through view tabs
   - Arrow keys for calendar navigation
   - Keyboard shortcuts for common actions

2. **Screen Reader Support:**
   - ARIA labels for all interactive elements
   - Announce view changes
   - Describe helper text relationship to fields

3. **Visual Accessibility:**
   - High contrast mode support
   - Sufficient color contrast for status indicators
   - Clear focus indicators

## Migration Strategy

1. **Backward Compatibility:**
   - Existing connections without `viewConfiguration` default to Form view only
   - Existing `fieldMappings` without `helperText` display normally
   - No breaking changes to existing functionality

2. **Database Migration:**
   ```sql
   -- Add new column with default NULL
   ALTER TABLE database_connections 
   ADD COLUMN view_configuration TEXT DEFAULT NULL;
   
   -- No data migration needed, NULL is valid
   ```

3. **Gradual Rollout:**
   - Phase 1: Deploy helper text feature
   - Phase 2: Deploy Calendar view
   - Phase 3: Deploy Kanban view
   - Each phase can be deployed independently

## Future Enhancements

1. **Additional View Types:**
   - Gallery view (card grid)
   - Timeline view (Gantt chart)
   - Map view (geolocation data)

2. **Advanced Calendar Features:**
   - Recurring events
   - Multi-day events
   - Color coding by field value

3. **Advanced Kanban Features:**
   - Swimlanes (secondary grouping)
   - WIP limits per column
   - Card templates

4. **View Customization:**
   - User-specific view preferences
   - Custom view filters
   - Saved view configurations
