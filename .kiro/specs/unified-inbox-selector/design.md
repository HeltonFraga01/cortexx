# Design Document: Unified Inbox Selector

## Overview

Este documento descreve a arquitetura e implementação para unificar o seletor de caixas de entrada em um único componente no header, removendo a duplicação no chat sidebar. O novo seletor suporta seleção de "Todas as Caixas", seleção múltipla de inboxes, e exibe contadores de mensagens não lidas e status de conexão.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Header (UserLayout)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  UnifiedInboxSelector                                                    │
│  ├── "Todas as Caixas" option                                           │
│  ├── Multi-select checkboxes                                            │
│  ├── Unread count badges                                                │
│  └── Connection status indicators                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SupabaseInboxContext (Enhanced)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  State:                                                                  │
│  ├── selectedInboxIds: string[] | 'all'                                 │
│  ├── availableInboxes: InboxWithStats[]                                 │
│  └── unreadCounts: Map<string, number>                                  │
│                                                                          │
│  Actions:                                                                │
│  ├── selectInbox(inboxId: string)                                       │
│  ├── deselectInbox(inboxId: string)                                     │
│  ├── selectAll()                                                        │
│  └── toggleInbox(inboxId: string)                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Chat Sidebar                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Uses context.selectedInboxIds for filtering                            │
│  ├── Shows inbox badge when multiple selected                           │
│  └── NO internal InboxSelector component                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Enhanced Selection State

```typescript
// Selection can be 'all' or an array of specific inbox IDs
type InboxSelection = 'all' | string[]

interface InboxWithStats {
  id: string
  name: string
  phoneNumber?: string
  isConnected: boolean
  unreadCount: number
  channelType: string
}

interface UnifiedInboxContextValue {
  // Selection state
  selection: InboxSelection
  selectedInboxIds: string[] // Resolved IDs (all inbox IDs if 'all')
  isAllSelected: boolean
  
  // Available inboxes with stats
  availableInboxes: InboxWithStats[]
  
  // Aggregated stats
  totalUnreadCount: number
  hasDisconnectedInbox: boolean
  
  // Actions
  selectAll: () => void
  selectSingle: (inboxId: string) => void
  toggleInbox: (inboxId: string) => void
  
  // Helpers
  isInboxSelected: (inboxId: string) => boolean
  getSelectedCount: () => number
}
```

### 2. UnifiedInboxSelector Component

```typescript
// src/components/shared/UnifiedInboxSelector.tsx

interface UnifiedInboxSelectorProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

/**
 * Unified inbox selector with multi-select support.
 * 
 * Features:
 * - "Todas as Caixas" option at top
 * - Checkbox for each inbox
 * - Unread count badges
 * - Connection status indicators
 * - Persists selection to user preferences
 */
export function UnifiedInboxSelector({ 
  className,
  variant = 'outline',
  size = 'default'
}: UnifiedInboxSelectorProps) {
  // Implementation
}
```

### 3. Conversation Inbox Badge

```typescript
// src/components/features/chat/ConversationInboxBadge.tsx

interface ConversationInboxBadgeProps {
  inboxId: string
  inboxName: string
  compact?: boolean
}

/**
 * Small badge showing which inbox a conversation belongs to.
 * Only shown when multiple inboxes are selected.
 */
export function ConversationInboxBadge({
  inboxId,
  inboxName,
  compact = true
}: ConversationInboxBadgeProps) {
  // Implementation
}
```

### 4. Backend Endpoints

```
GET  /api/user/inbox-selection          - Get current selection
POST /api/user/inbox-selection          - Save selection
GET  /api/user/inboxes/stats            - Get inboxes with unread counts
```

## Data Models

### Selection Persistence

```typescript
// Stored in user_preferences table
interface InboxSelectionPreference {
  type: 'all' | 'specific'
  inboxIds?: string[]  // Only when type is 'specific'
}

// Key: 'inbox_selection'
// Value: JSON of InboxSelectionPreference
```

### API Response Types

```typescript
interface InboxStatsResponse {
  inboxes: InboxWithStats[]
  totalUnreadCount: number
}

interface InboxSelectionResponse {
  selection: InboxSelection
  selectedInboxIds: string[]
}
```

## Component Changes

### 1. Remove InboxSelector from Chat Sidebar

```diff
// src/components/features/chat/InboxSidebar.tsx

- import { InboxSelector } from '@/components/user/InboxSelector'

// Remove the InboxSelector section:
- {inboxes.length > 0 && (
-   <div className="px-3 pt-2 pb-1">
-     <InboxSelector
-       currentInbox={currentInbox as InboxWithStats | null}
-       onSelect={handleInboxSelect}
-       showAllOption={true}
-     />
-   </div>
- )}
```

### 2. Update Chat Sidebar to Use Context

```typescript
// src/components/features/chat/InboxSidebar.tsx

// Use unified context for filtering
const { selectedInboxIds, isAllSelected } = useUnifiedInboxContext()

// Filter conversations by selected inboxes
const effectiveFilters = useMemo(() => {
  const merged: ConversationFilters = { ...filters }
  if (!isAllSelected && selectedInboxIds.length > 0) {
    merged.inboxIds = selectedInboxIds
  }
  return merged
}, [filters, selectedInboxIds, isAllSelected])
```

### 3. Add Inbox Badge to Conversation Items

```typescript
// src/components/features/chat/InboxSidebar.tsx

// In ConversationItem component
const { isAllSelected, getSelectedCount } = useUnifiedInboxContext()
const showInboxBadge = isAllSelected || getSelectedCount() > 1

return (
  <button ...>
    {showInboxBadge && conversation.inboxId && (
      <ConversationInboxBadge 
        inboxId={conversation.inboxId}
        inboxName={conversation.inboxName || 'Inbox'}
      />
    )}
    {/* ... rest of conversation item */}
  </button>
)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Context-Driven Filtering

*For any* inbox selection (single, multiple, or all), the chat sidebar SHALL display only conversations belonging to the selected inbox(es), and changing the selection SHALL immediately update the displayed conversations.

**Validates: Requirements 1.3, 1.4**

### Property 2: All Inboxes Selection

*For any* user with N available inboxes, selecting "Todas as Caixas" SHALL result in conversations from all N inboxes being displayed.

**Validates: Requirements 2.2**

### Property 3: Multi-Select Filtering

*For any* subset S of available inboxes selected via checkboxes, the system SHALL display only conversations where conversation.inboxId is in S.

**Validates: Requirements 3.2**

### Property 4: Selection Count Display

*For any* selection of K inboxes where K > 1, the selector SHALL display "K caixas selecionadas" as the button text.

**Validates: Requirements 3.3, 3.6**

### Property 5: Toggle Behavior

*For any* inbox that is currently selected, clicking it SHALL deselect it (unless it's the last selected inbox).

**Validates: Requirements 3.4**

### Property 6: Minimum Selection Constraint

*For any* attempt to deselect the last remaining selected inbox, the system SHALL prevent the deselection and maintain at least one inbox selected.

**Validates: Requirements 3.5**

### Property 7: Conditional Badge Display

*For any* conversation displayed when multiple inboxes or "all" is selected, the conversation SHALL show an inbox badge. *For any* conversation displayed when exactly one inbox is selected, the conversation SHALL NOT show an inbox badge.

**Validates: Requirements 4.1, 4.4**

### Property 8: Selection Persistence Round-Trip

*For any* inbox selection saved by the user, loading the selection in a subsequent session SHALL return the same selection (excluding any inboxes that no longer exist).

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 9: Unread Count Aggregation

*For any* set of inboxes with unread counts [c1, c2, ..., cn], the "Todas as Caixas" option SHALL display the sum (c1 + c2 + ... + cn) as its unread count.

**Validates: Requirements 2.4, 6.4**

### Property 10: Zero Unread Hidden

*For any* inbox with unreadCount = 0, the selector SHALL NOT display a count badge for that inbox.

**Validates: Requirements 6.3**

### Property 11: Connection Status Indicator

*For any* inbox, the selector SHALL display a green indicator if isConnected = true, and a red indicator if isConnected = false.

**Validates: Requirements 7.2, 7.3**

### Property 12: Aggregated Connection Warning

*For any* selection of "Todas as Caixas" where at least one inbox has isConnected = false, the selector SHALL display a yellow warning indicator.

**Validates: Requirements 7.5**

## Error Handling

### Error Codes

| Code | HTTP Status | Message | Cause |
|------|-------------|---------|-------|
| `INVALID_SELECTION` | 400 | "Seleção inválida" | Invalid inbox IDs in selection |
| `NO_INBOXES` | 403 | "Nenhuma caixa de entrada disponível" | User has no inboxes |
| `SELECTION_SAVE_ERROR` | 500 | "Erro ao salvar seleção" | Database error |

## Testing Strategy

### Unit Tests

1. **UnifiedInboxSelector**
   - Renders "Todas as Caixas" as first option
   - Shows checkboxes for each inbox
   - Displays unread counts correctly
   - Shows connection status indicators
   - Handles selection changes

2. **Selection Logic**
   - selectAll() sets selection to 'all'
   - toggleInbox() adds/removes from selection
   - Cannot deselect last inbox
   - Persists selection to preferences

3. **Chat Sidebar Integration**
   - Filters conversations by selected inboxes
   - Shows inbox badge when multiple selected
   - Hides inbox badge when single selected

### Property-Based Tests

Using fast-check library:

1. **Property 1**: Generate random selections, verify filtering
2. **Property 3**: Generate random subsets, verify filtering
3. **Property 6**: Generate single-inbox selection, verify cannot deselect
4. **Property 8**: Generate selections, save/load, verify equality
5. **Property 9**: Generate inbox stats, verify sum calculation

### Integration Tests

1. Full selection flow with persistence
2. Chat sidebar updates on selection change
3. Real-time unread count updates

</content>
</invoke>