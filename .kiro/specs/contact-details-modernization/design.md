# Design Document: Contact Details Modernization

## Overview

Este documento descreve o design técnico para modernização do painel de Detalhes do Contato no WUZAPI Manager. A implementação segue a arquitetura existente do projeto (React + TypeScript no frontend, Node.js + Express + SQLite no backend) e adiciona novas funcionalidades inspiradas no Chatwoot.

O painel modernizado terá um design colapsável com seções expansíveis, permitindo que os usuários foquem nas informações mais relevantes enquanto mantêm acesso fácil a dados adicionais.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Contact Panel (Frontend)                     │
├─────────────────────────────────────────────────────────────────┤
│  ContactPanel.tsx (Main Container)                               │
│  ├── ContactHeader (Avatar, Name, Phone, Status)                │
│  ├── CollapsibleSection (Reusable Accordion Component)          │
│  │   ├── StatusSection                                          │
│  │   ├── LabelsSection                                          │
│  │   ├── BotAssignmentSection                                   │
│  │   ├── ConversationActionsSection                             │
│  │   ├── MacrosSection                                          │
│  │   ├── ConversationInfoSection                                │
│  │   ├── ContactAttributesSection                               │
│  │   ├── ContactNotesSection                                    │
│  │   ├── PreviousConversationsSection                           │
│  │   └── ParticipantsSection (Groups only)                      │
│  └── QuickActionsFooter                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│  server/routes/userChatRoutes.js                                │
│  ├── GET  /chat/inbox/contacts/:jid/attributes                  │
│  ├── POST /chat/inbox/contacts/:jid/attributes                  │
│  ├── PUT  /chat/inbox/contacts/:jid/attributes/:id              │
│  ├── DELETE /chat/inbox/contacts/:jid/attributes/:id            │
│  ├── GET  /chat/inbox/contacts/:jid/notes                       │
│  ├── POST /chat/inbox/contacts/:jid/notes                       │
│  ├── DELETE /chat/inbox/contacts/:jid/notes/:id                 │
│  ├── GET  /chat/inbox/contacts/:jid/conversations               │
│  ├── GET  /chat/inbox/conversations/:id/info                    │
│  ├── GET  /chat/inbox/conversations/:id/participants            │
│  └── GET  /chat/inbox/macros                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database (SQLite)                            │
├─────────────────────────────────────────────────────────────────┤
│  contact_attributes (id, user_id, contact_jid, name, value)     │
│  contact_notes (id, user_id, contact_jid, content, created_at)  │
│  macros (id, user_id, name, actions, created_at)                │
│  macro_actions (id, macro_id, action_type, params, order)       │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### CollapsibleSection Component
```typescript
interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  count?: number
  defaultExpanded?: boolean
  children: React.ReactNode
  onToggle?: (expanded: boolean) => void
}
```

#### ContactAttributesSection Component
```typescript
interface ContactAttribute {
  id: number
  name: string
  value: string
  createdAt: string
  updatedAt: string
}

interface ContactAttributesSectionProps {
  contactJid: string
  attributes: ContactAttribute[]
  onAdd: (name: string, value: string) => Promise<void>
  onUpdate: (id: number, value: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}
```

#### ContactNotesSection Component
```typescript
interface ContactNote {
  id: number
  content: string
  createdAt: string
  createdBy?: string
}

interface ContactNotesSectionProps {
  contactJid: string
  notes: ContactNote[]
  onAdd: (content: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}
```

#### ConversationInfoSection Component
```typescript
interface ConversationInfo {
  createdAt: string
  lastActivityAt: string
  messageCount: number
  durationMinutes: number
  botAssignedAt?: string
  labelAssignments: Array<{
    labelId: number
    labelName: string
    assignedAt: string
  }>
}

interface ConversationInfoSectionProps {
  conversationId: number
  info: ConversationInfo
}
```

#### PreviousConversationsSection Component
```typescript
interface PreviousConversation {
  id: number
  status: string
  messageCount: number
  lastMessagePreview: string
  createdAt: string
  resolvedAt?: string
}

interface PreviousConversationsSectionProps {
  contactJid: string
  conversations: PreviousConversation[]
  currentConversationId: number
  onNavigate: (conversationId: number) => void
}
```

#### ParticipantsSection Component
```typescript
interface GroupParticipant {
  jid: string
  name: string
  avatarUrl?: string
  isAdmin: boolean
  isSuperAdmin: boolean
}

interface ParticipantsSectionProps {
  conversationId: number
  participants: GroupParticipant[]
  isGroup: boolean
}
```

#### MacrosSection Component
```typescript
interface MacroAction {
  type: 'change_status' | 'assign_bot' | 'add_label' | 'send_message'
  params: Record<string, any>
}

interface Macro {
  id: number
  name: string
  description?: string
  actions: MacroAction[]
}

interface MacrosSectionProps {
  macros: Macro[]
  onExecute: (macroId: number) => Promise<void>
}
```

### Backend API Endpoints

#### Contact Attributes
- `GET /chat/inbox/contacts/:jid/attributes` - List all attributes for a contact
- `POST /chat/inbox/contacts/:jid/attributes` - Create new attribute
- `PUT /chat/inbox/contacts/:jid/attributes/:id` - Update attribute value
- `DELETE /chat/inbox/contacts/:jid/attributes/:id` - Delete attribute

#### Contact Notes
- `GET /chat/inbox/contacts/:jid/notes` - List all notes for a contact
- `POST /chat/inbox/contacts/:jid/notes` - Create new note
- `DELETE /chat/inbox/contacts/:jid/notes/:id` - Delete note

#### Conversation Info
- `GET /chat/inbox/conversations/:id/info` - Get conversation metadata
- `GET /chat/inbox/contacts/:jid/conversations` - List previous conversations

#### Group Participants
- `GET /chat/inbox/conversations/:id/participants` - Get group participants

#### Macros
- `GET /chat/inbox/macros` - List all macros
- `POST /chat/inbox/macros/:id/execute` - Execute a macro

## Data Models

### contact_attributes Table
```sql
CREATE TABLE contact_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contact_jid TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, contact_jid, name)
);
```

### contact_notes Table
```sql
CREATE TABLE contact_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contact_jid TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### macros Table
```sql
CREATE TABLE macros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### macro_actions Table
```sql
CREATE TABLE macro_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  macro_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  params TEXT NOT NULL, -- JSON string
  action_order INTEGER NOT NULL,
  FOREIGN KEY (macro_id) REFERENCES macros(id) ON DELETE CASCADE
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, the following redundancies were identified and consolidated:
- Properties 1.4, 1.5, 1.6 (attribute CRUD) can be tested together as a round-trip property
- Properties 2.4, 2.5, 2.6 (note CRUD) can be tested together
- Properties 6.1-6.5 (participants) can be consolidated into group vs non-group behavior
- Properties 7.2, 7.3, 7.4 (collapsible state) can be tested as state persistence

### Correctness Properties

Property 1: Attribute CRUD round-trip
*For any* contact and any valid attribute (non-empty name and value), creating the attribute, then reading all attributes, should include the created attribute with matching name and value.
**Validates: Requirements 1.4**

Property 2: Attribute update persistence
*For any* existing attribute and any new valid value, updating the attribute and then reading it should return the new value.
**Validates: Requirements 1.5**

Property 3: Attribute deletion removes from list
*For any* existing attribute, deleting it and then listing all attributes should not include the deleted attribute.
**Validates: Requirements 1.6**

Property 4: Notes display in reverse chronological order
*For any* set of notes with different timestamps, listing notes should return them sorted by timestamp in descending order (newest first).
**Validates: Requirements 2.2**

Property 5: Note creation with timestamp
*For any* non-empty note content, creating a note should persist it with a timestamp and the note should appear in the list.
**Validates: Requirements 2.4**

Property 6: Empty note rejection
*For any* string composed entirely of whitespace characters, attempting to create a note should be rejected and the notes list should remain unchanged.
**Validates: Requirements 2.5**

Property 7: Conversation info contains required fields
*For any* conversation, the info endpoint should return all required fields: creation date, last activity date, message count, and duration.
**Validates: Requirements 3.2**

Property 8: Previous conversations list completeness
*For any* contact JID with multiple conversations, listing previous conversations should return all conversations except the current one.
**Validates: Requirements 4.2**

Property 9: WhatsApp Web URL generation
*For any* valid phone number, the generated WhatsApp Web URL should follow the format `https://web.whatsapp.com/send?phone={phoneNumber}`.
**Validates: Requirements 5.2**

Property 10: Macro sequential execution
*For any* macro with multiple actions, executing the macro should apply all actions in the defined order.
**Validates: Requirements 5.6**

Property 11: Group participants visibility
*For any* group conversation, the participants section should be visible and display all members. *For any* non-group conversation, the participants section should be hidden.
**Validates: Requirements 6.1, 6.5**

Property 12: Admin badge display
*For any* group participant with admin status, the participant should be displayed with an admin badge.
**Validates: Requirements 6.3**

Property 13: Collapsible state toggle
*For any* section, clicking the header should toggle between expanded and collapsed states.
**Validates: Requirements 7.2**

Property 14: Collapsible state persistence
*For any* set of section states, closing and reopening the panel should restore the same expanded/collapsed states.
**Validates: Requirements 7.4**

Property 15: Contact info display completeness
*For any* contact, the panel should display name, phone number, and WhatsApp JID.
**Validates: Requirements 8.3**

Property 16: Verified badge conditional display
*For any* contact with a verified business name, a verified badge should be displayed. *For any* contact without verification, no badge should appear.
**Validates: Requirements 8.4**

## Error Handling

### Frontend Error Handling
- All API calls wrapped in try-catch with toast notifications for errors
- Optimistic updates with rollback on failure
- Loading states for all async operations
- Empty states for sections with no data

### Backend Error Handling
- Input validation using validators for all endpoints
- Structured error responses with error codes
- Logging with context (userId, endpoint, error)
- Rate limiting on write operations

### Error Codes
| Code | Description |
|------|-------------|
| ATTR_001 | Attribute name already exists for contact |
| ATTR_002 | Attribute not found |
| NOTE_001 | Note content cannot be empty |
| NOTE_002 | Note not found |
| MACRO_001 | Macro not found |
| MACRO_002 | Macro execution failed |
| CONV_001 | Conversation not found |
| PART_001 | Not a group conversation |

## Testing Strategy

### Dual Testing Approach

This implementation requires both unit tests and property-based tests:

#### Unit Tests
- Component rendering tests for each section
- API endpoint integration tests
- Database migration tests
- Error handling edge cases

#### Property-Based Testing

The project will use **fast-check** as the property-based testing library for TypeScript/JavaScript.

Configuration:
- Minimum 100 iterations per property test
- Custom generators for domain types (ContactAttribute, ContactNote, etc.)

Property tests will be annotated with the format:
`**Feature: contact-details-modernization, Property {number}: {property_text}**`

Each correctness property from the design document will be implemented as a single property-based test.

### Test Categories

1. **Data Layer Tests**
   - Attribute CRUD operations (Properties 1-3)
   - Note CRUD operations (Properties 4-6)
   - Macro execution (Property 10)

2. **API Layer Tests**
   - Endpoint response validation (Properties 7-8)
   - URL generation (Property 9)
   - Participant visibility (Properties 11-12)

3. **UI Layer Tests**
   - Collapsible behavior (Properties 13-14)
   - Display completeness (Properties 15-16)
