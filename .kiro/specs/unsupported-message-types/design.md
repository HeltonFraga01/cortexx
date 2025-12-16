# Design Document: Unsupported Message Types

## Overview

Este documento descreve o design para corrigir o tratamento de tipos de mensagens do WhatsApp que atualmente são exibidas como "[Mensagem não suportada]". A solução envolve modificações no backend (chatMessageHandler.js) para processar corretamente todos os tipos de mensagens do WUZAPI, e no frontend (MessageBubble.tsx) para renderizar adequadamente cada tipo.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WUZAPI Webhook                          │
│                    (WhatsApp Message Events)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                    chatMessageHandler.js                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              parseMessageContent()                      │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ Message Type Router                             │    │   │
│  │  │ ├── Text/ExtendedText → text                    │    │   │
│  │  │ ├── Image/Video/Audio/Document → media          │    │   │
│  │  │ ├── Sticker → sticker                           │    │   │
│  │  │ ├── Location/Contact → special                  │    │   │
│  │  │ ├── Reaction → reaction                         │    │   │
│  │  │ ├── ProtocolMessage → edit/delete handler       │    │   │
│  │  │ ├── PollCreation/Update → poll                  │    │   │
│  │  │ ├── ViewOnce → view_once                        │    │   │
│  │  │ ├── Buttons/List → interactive                  │    │   │
│  │  │ ├── Template → template                         │    │   │
│  │  │ ├── SenderKeyDistribution → IGNORE              │    │   │
│  │  │ ├── EncComment → channel_comment                │    │   │
│  │  │ └── Unknown → fallback with type name           │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      chat_messages table                        │
│  message_type: text|image|video|audio|document|sticker|         │
│                location|contact|reaction|poll|view_once|        │
│                interactive|template|channel_comment|deleted     │
│  is_edited: boolean                                             │
│  is_deleted: boolean                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                     MessageBubble.tsx                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MessageContent Component                   │   │
│  │  switch(messageType) {                                  │   │
│  │    case 'text': <TextContent />                         │   │
│  │    case 'image': <MediaImage />                         │   │
│  │    case 'poll': <PollContent />                         │   │
│  │    case 'view_once': <ViewOnceIndicator />              │   │
│  │    case 'interactive': <InteractiveContent />           │   │
│  │    case 'deleted': <DeletedMessage />                   │   │
│  │    case 'channel_comment': <ChannelComment />           │   │
│  │    default: <UnknownType type={messageType} />          │   │
│  │  }                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. MessageTypeParser (chatMessageHandler.js)

Responsável por identificar e extrair conteúdo de todos os tipos de mensagens WUZAPI.

```javascript
/**
 * Parse message content from WUZAPI format
 * @param {Object} messageContent - Raw message content from WUZAPI
 * @returns {ParsedMessage} Parsed message with type and content
 */
parseMessageContent(messageContent) → {
  type: string,           // Message type identifier
  content: string,        // Text content or JSON for complex types
  mediaUrl?: string,      // URL for media messages
  mediaMimeType?: string, // MIME type for media
  mediaMetadata?: Object, // Additional media metadata
  isEdited?: boolean,     // True if message was edited
  isDeleted?: boolean,    // True if message was deleted
  pollData?: PollData,    // Poll question and options
  interactiveData?: InteractiveData, // Buttons/list data
  shouldIgnore?: boolean  // True for system messages to ignore
}
```

#### 2. ProtocolMessageHandler

Processa mensagens de protocolo (edição, deleção).

```javascript
/**
 * Handle protocol messages (edit, delete, etc.)
 * @param {Object} protocolMsg - Protocol message from WUZAPI
 * @param {string} chatJid - Chat JID for context
 * @returns {ProtocolAction} Action to take
 */
handleProtocolMessage(protocolMsg, chatJid) → {
  action: 'edit' | 'delete' | 'ignore',
  targetMessageId?: string,
  newContent?: string
}
```

### Frontend Components

#### 1. MessageContent (MessageBubble.tsx)

Componente que renderiza o conteúdo baseado no tipo de mensagem.

```typescript
interface MessageContentProps {
  message: ChatMessage
  highlightedContent: React.ReactNode
}

// New message types to support
type ExtendedMessageType = 
  | 'text' | 'image' | 'video' | 'audio' | 'document' 
  | 'sticker' | 'location' | 'contact' | 'reaction'
  | 'poll' | 'view_once' | 'interactive' | 'template'
  | 'channel_comment' | 'deleted' | 'unknown'
```

#### 2. New Sub-components

```typescript
// Poll message display
function PollContent({ pollData }: { pollData: PollData })

// View-once indicator
function ViewOnceIndicator({ mediaType }: { mediaType: 'image' | 'video' })

// Interactive message (buttons/lists)
function InteractiveContent({ data }: { data: InteractiveData })

// Deleted message placeholder
function DeletedMessage()

// Channel comment placeholder
function ChannelComment()

// Unknown type fallback
function UnknownTypeMessage({ type }: { type: string })
```

## Data Models

### ParsedMessage

```typescript
interface ParsedMessage {
  type: string
  content: string
  mediaUrl?: string
  mediaMimeType?: string
  mediaMetadata?: MediaMetadata
  isEdited?: boolean
  isDeleted?: boolean
  pollData?: PollData
  interactiveData?: InteractiveData
  shouldIgnore?: boolean
}
```

### PollData

```typescript
interface PollData {
  question: string
  options: string[]
  selectableCount?: number
}
```

### InteractiveData

```typescript
interface InteractiveData {
  type: 'buttons' | 'list' | 'buttons_response' | 'list_response'
  text: string
  buttons?: Array<{ id: string; text: string }>
  sections?: Array<{ title: string; rows: Array<{ id: string; title: string }> }>
  selectedId?: string
  selectedTitle?: string
}
```

### Database Schema Updates

```sql
-- Add new columns to chat_messages table
ALTER TABLE chat_messages ADD COLUMN is_edited BOOLEAN DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN poll_data TEXT; -- JSON for poll data
ALTER TABLE chat_messages ADD COLUMN interactive_data TEXT; -- JSON for interactive data
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: System messages are silently ignored
*For any* message containing only senderKeyDistributionMessage or messageContextInfo without other content, the parseMessageContent function SHALL return an object with shouldIgnore: true, and the message SHALL NOT be stored in the database.
**Validates: Requirements 1.1, 1.2**

### Property 2: Edit messages update original content
*For any* protocolMessage with type 14 (MESSAGE_EDIT) containing a valid target message ID and new content, the system SHALL update the original message's content and set isEdited to true.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Delete messages mark original as deleted
*For any* protocolMessage with type 0 (REVOKE) containing a valid target message ID, the system SHALL set the original message's isDeleted to true and content to the deletion placeholder.
**Validates: Requirements 3.1, 3.2**

### Property 4: Poll messages are parsed correctly
*For any* pollCreationMessage containing a question and options array, the parseMessageContent function SHALL return type 'poll' with pollData containing the question string and all option strings in order.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: View-once messages are identified
*For any* viewOnceMessage or viewOnceMessageV2 wrapper, the parseMessageContent function SHALL return type 'view_once' with the inner media type (image or video) identified in the content.
**Validates: Requirements 5.1, 5.2**

### Property 6: Interactive messages are parsed correctly
*For any* buttonsMessage, buttonsResponseMessage, listMessage, or listResponseMessage, the parseMessageContent function SHALL return type 'interactive' with interactiveData containing the message text and all button/list data.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 7: Template messages are parsed correctly
*For any* templateMessage containing content, the parseMessageContent function SHALL return type 'template' with the extracted title, body, footer, and button labels.
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 8: Encrypted comments return placeholder
*For any* encCommentMessage, the parseMessageContent function SHALL return type 'channel_comment' with content "💬 Comentário em canal" without throwing an error.
**Validates: Requirements 8.1, 8.2**

### Property 9: Unknown types return identifiable fallback
*For any* message with an unrecognized type, the parseMessageContent function SHALL return type 'unknown' with content containing the original type name in a user-friendly format.
**Validates: Requirements 9.3**

## Error Handling

### Backend Error Handling

1. **Missing message content**: Return empty text message
2. **Malformed protocol message**: Log warning, ignore message
3. **Target message not found for edit/delete**: Log warning, store as new message with indicator
4. **JSON parse errors in poll/interactive data**: Return raw content as text

### Frontend Error Handling

1. **Unknown message type**: Display type name with generic icon
2. **Missing poll/interactive data**: Display placeholder text
3. **Media load failures**: Show retry button (existing behavior)

## Testing Strategy

### Unit Testing

- Test parseMessageContent with each message type
- Test protocol message handling (edit/delete)
- Test edge cases (empty content, malformed data)

### Property-Based Testing

Using fast-check library for JavaScript:

1. **System message ignore property**: Generate random senderKeyDistributionMessage payloads, verify shouldIgnore is true
2. **Edit message property**: Generate message + edit pairs, verify content is updated
3. **Delete message property**: Generate message + delete pairs, verify isDeleted is true
4. **Poll parsing property**: Generate random poll data, verify round-trip parsing
5. **Interactive parsing property**: Generate random button/list data, verify extraction
6. **Unknown type fallback property**: Generate random unknown types, verify type name in output

### Integration Testing

- End-to-end test with real WUZAPI webhook payloads
- Verify database storage for each message type
- Verify frontend rendering for each message type

