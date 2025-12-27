# Technical Design Document

## Overview

Este documento descreve a implementação técnica da integração entre o CRM e o sistema de Chat, trazendo funcionalidades do `ContactPanel` para o `ContactDetailPage`.

## Architecture

### Componentes Envolvidos

```
┌─────────────────────────────────────────────────────────────────┐
│                    ContactDetailPage.tsx                        │
│  (Enhanced with Chat Integration)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Contact Header (Enhanced)                                │   │
│  │ - Avatar with WhatsApp fetch                            │   │
│  │ - Refresh avatar button                                 │   │
│  │ - Active conversation indicator                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Tabs                                                     │   │
│  │ ┌─────────┬──────────┬─────────┬──────────┬───────────┐ │   │
│  │ │Overview │ Timeline │Purchases│ Credits  │ Settings  │ │   │
│  │ └─────────┴──────────┴─────────┴──────────┴───────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Overview Tab (Enhanced)                                  │   │
│  │                                                          │   │
│  │ ┌─────────────────┐  ┌────────────────────────────────┐ │   │
│  │ │ Lead Score Card │  │ Metrics Card                   │ │   │
│  │ └─────────────────┘  └────────────────────────────────┘ │   │
│  │                                                          │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ Chat Integration Section (NEW)                      │ │   │
│  │ │ ┌─────────────────┐ ┌─────────────────────────────┐ │ │   │
│  │ │ │ Contact         │ │ Contact Notes               │ │ │   │
│  │ │ │ Attributes      │ │ - List notes                │ │ │   │
│  │ │ │ - Key/Value     │ │ - Add new note              │ │ │   │
│  │ │ │ - Add/Edit/Del  │ │ - Delete note               │ │ │   │
│  │ │ └─────────────────┘ └─────────────────────────────┘ │ │   │
│  │ │                                                      │ │   │
│  │ │ ┌─────────────────────────────────────────────────┐ │ │   │
│  │ │ │ Previous Conversations                          │ │ │   │
│  │ │ │ - List with status, preview, timestamp          │ │ │   │
│  │ │ │ - Click to navigate to chat                     │ │ │   │
│  │ │ └─────────────────────────────────────────────────┘ │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ Recent Timeline                                     │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ContactDetailPage│────▶│   useChatApi     │────▶│  Backend APIs    │
│                  │     │                  │     │                  │
│ - phone          │     │ - getContact...  │     │ /api/user/chat/  │
│ - contactJid     │     │ - fetchAvatar    │     │ contacts/        │
│                  │     │ - getPrevious... │     │ conversations/   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                                                  │
        │                                                  │
        ▼                                                  ▼
┌──────────────────┐                              ┌──────────────────┐
│ React Query      │                              │ Supabase         │
│ Cache            │                              │ Database         │
│                  │                              │                  │
│ - contact-attrs  │                              │ - contact_attrs  │
│ - contact-notes  │                              │ - contact_notes  │
│ - prev-convos    │                              │ - conversations  │
└──────────────────┘                              └──────────────────┘
```

## Component Design

### 1. Enhanced Contact Header

Modificar o header existente para incluir fetch de avatar:

```typescript
// In ContactDetailPage.tsx

const [avatarUrl, setAvatarUrl] = useState<string | null>(contact?.avatarUrl || null)
const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

// Convert phone to JID
const contactJid = useMemo(() => {
  if (!contact?.phone) return null
  const cleanPhone = contact.phone.replace(/\D/g, '')
  return `${cleanPhone}@s.whatsapp.net`
}, [contact?.phone])

// Fetch avatar on mount
useEffect(() => {
  if (contactJid && !avatarUrl) {
    handleFetchAvatar()
  }
}, [contactJid])

const handleFetchAvatar = async () => {
  if (!contactJid) return
  setIsLoadingAvatar(true)
  try {
    // First, find or create conversation to get conversationId
    const conversation = await chatApi.startConversation(contact.phone)
    const result = await chatApi.fetchConversationAvatar(conversation.id)
    if (result?.avatarUrl) {
      setAvatarUrl(result.avatarUrl)
      // Optionally update contact record with avatar
    }
  } catch (error) {
    // Silently fail, keep initials
  } finally {
    setIsLoadingAvatar(false)
  }
}
```

### 2. CRMContactAttributesSection Component

Novo componente adaptado do `ContactAttributesSection`:

```typescript
// src/components/features/crm/CRMContactAttributesSection.tsx

interface CRMContactAttributesSectionProps {
  contactJid: string
}

export function CRMContactAttributesSection({ contactJid }: CRMContactAttributesSectionProps) {
  const chatApi = useChatApi()
  const queryClient = useQueryClient()
  
  const { data: attributes, isLoading } = useQuery({
    queryKey: ['contact-attributes', contactJid],
    queryFn: () => chatApi.getContactAttributes(contactJid),
    enabled: !!contactJid
  })
  
  // Add, edit, delete mutations...
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Atributos do contato
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Attribute list with inline editing */}
        {/* Add new attribute form */}
      </CardContent>
    </Card>
  )
}
```

### 3. CRMContactNotesSection Component

Novo componente adaptado do `ContactNotesSection`:

```typescript
// src/components/features/crm/CRMContactNotesSection.tsx

interface CRMContactNotesSectionProps {
  contactJid: string
}

export function CRMContactNotesSection({ contactJid }: CRMContactNotesSectionProps) {
  const chatApi = useChatApi()
  const [newNote, setNewNote] = useState('')
  
  const { data: notes, isLoading } = useQuery({
    queryKey: ['contact-notes', contactJid],
    queryFn: () => chatApi.getContactNotes(contactJid),
    enabled: !!contactJid
  })
  
  // Add, delete mutations...
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notas do contato
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add note input */}
        {/* Notes list */}
      </CardContent>
    </Card>
  )
}
```

### 4. CRMPreviousConversationsSection Component

Novo componente adaptado do `PreviousConversationsSection`:

```typescript
// src/components/features/crm/CRMPreviousConversationsSection.tsx

interface CRMPreviousConversationsSectionProps {
  contactJid: string
  onNavigate: (conversationId: number) => void
}

export function CRMPreviousConversationsSection({ 
  contactJid, 
  onNavigate 
}: CRMPreviousConversationsSectionProps) {
  const chatApi = useChatApi()
  
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['previous-conversations', contactJid],
    queryFn: () => chatApi.getPreviousConversations(contactJid),
    enabled: !!contactJid
  })
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Conversas anteriores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Conversations list */}
      </CardContent>
    </Card>
  )
}
```

## Database Changes

Nenhuma mudança de schema necessária. As APIs existentes do chat já suportam todas as operações.

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/chat/conversations/:id/avatar` | POST | Fetch WhatsApp avatar |
| `/api/user/chat/contacts/:jid/attributes` | GET | List contact attributes |
| `/api/user/chat/contacts/:jid/attributes` | POST | Create attribute |
| `/api/user/chat/contacts/:jid/attributes/:id` | PUT | Update attribute |
| `/api/user/chat/contacts/:jid/attributes/:id` | DELETE | Delete attribute |
| `/api/user/chat/contacts/:jid/notes` | GET | List contact notes |
| `/api/user/chat/contacts/:jid/notes` | POST | Create note |
| `/api/user/chat/contacts/:jid/notes/:id` | DELETE | Delete note |
| `/api/user/chat/contacts/:jid/conversations` | GET | List previous conversations |

## Query Keys

```typescript
// New query keys for CRM-Chat integration
['contact-attributes', contactJid]
['contact-notes', contactJid]
['previous-conversations', contactJid]
['conversation-for-contact', phone]
```

## Error Handling

1. **Avatar fetch fails**: Silently fallback to initials, no error toast
2. **Attributes/Notes API fails**: Show error toast, allow retry
3. **No conversation exists**: Show "Nenhuma conversa" message, offer to start one

## Performance Considerations

1. **Lazy loading**: Chat integration sections only fetch data when visible
2. **Caching**: Use React Query with appropriate stale times
3. **Optimistic updates**: For add/edit/delete operations

## Security

- All APIs use existing authentication (user session)
- Data is scoped to the authenticated user
- No cross-user data access possible

## Testing Strategy

1. **Unit tests**: For new CRM section components
2. **Integration tests**: For API calls via useChatApi
3. **E2E tests**: For full flow (view contact → see attributes → add note)
