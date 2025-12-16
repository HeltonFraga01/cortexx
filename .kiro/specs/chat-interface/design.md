# Design Document - Chat Interface

## Overview

A interface de chat do WUZAPI Manager é um sistema completo de gerenciamento de conversas WhatsApp, inspirado no Chatwoot. O sistema permite visualizar, enviar e receber mensagens em tempo real, com suporte a múltiplos tipos de mídia, automação via Agent Bots, e integração com sistemas externos via webhooks.

### Objetivos Principais

1. **Interface profissional** - Layout moderno e responsivo similar ao Chatwoot
2. **Tempo real** - Sincronização instantânea via webhooks da WUZAPI
3. **Automação** - Sistema de Agent Bots para respostas automáticas
4. **Integração** - Webhooks de saída para sistemas externos
5. **Produtividade** - Labels, canned responses, notas privadas e atalhos

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WUZAPI Manager Frontend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Inbox     │  │   Chat      │  │  Contact    │  │   Bot       │    │
│  │   List      │  │   View      │  │   Panel     │  │  Settings   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│                          ┌────────┴────────┐                            │
│                          │  Chat Service   │                            │
│                          │  (React Query)  │                            │
│                          └────────┬────────┘                            │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ HTTP/WebSocket
┌──────────────────────────────────┼──────────────────────────────────────┐
│                         WUZAPI Manager Backend                           │
│                          ┌────────┴────────┐                            │
│                          │   Chat Routes   │                            │
│                          └────────┬────────┘                            │
│         ┌─────────────────────────┼─────────────────────────┐           │
│  ┌──────┴──────┐  ┌───────────────┴───────────────┐  ┌──────┴──────┐   │
│  │  Message    │  │      Webhook Handler          │  │   Bot       │   │
│  │  Service    │  │  (Incoming from WUZAPI)       │  │  Service    │   │
│  └──────┬──────┘  └───────────────┬───────────────┘  └──────┬──────┘   │
│         │                         │                         │           │
│         └─────────────────────────┼─────────────────────────┘           │
│                          ┌────────┴────────┐                            │
│                          │    SQLite DB    │                            │
│                          │  (Messages,     │                            │
│                          │   Contacts,     │                            │
│                          │   Bots, Labels) │                            │
│                          └────────┬────────┘                            │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────┐
│                              WUZAPI                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Session   │  │   Chat      │  │   User      │  │  Webhook    │    │
│  │   API       │  │   API       │  │   API       │  │  Events     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          │    WhatsApp     │
                          │    Servers      │
                          └─────────────────┘
```

### Fluxo de Dados

1. **Mensagem Recebida**: WhatsApp → WUZAPI → Webhook → Backend → SQLite → Frontend
2. **Mensagem Enviada**: Frontend → Backend → WUZAPI → WhatsApp
3. **Bot Response**: Webhook → Backend → Bot Service → External Webhook → Backend → WUZAPI

## Components and Interfaces

### Frontend Components

```
src/components/
├── features/
│   └── chat/
│       ├── ChatLayout.tsx           # Layout principal (3 colunas)
│       ├── InboxSidebar.tsx         # Lista de conversas
│       ├── ConversationView.tsx     # Área principal do chat
│       ├── ContactPanel.tsx         # Painel lateral do contato
│       ├── MessageBubble.tsx        # Bolha de mensagem individual
│       ├── MessageInput.tsx         # Área de composição
│       ├── MediaPreview.tsx         # Preview de mídia
│       ├── EmojiPicker.tsx          # Seletor de emojis/reações
│       ├── SearchBar.tsx            # Busca de conversas
│       ├── LabelBadge.tsx           # Badge de label
│       ├── PresenceIndicator.tsx    # Indicador de presença
│       ├── MessageStatus.tsx        # Status de entrega (ticks)
│       ├── CannedResponsePicker.tsx # Seletor de respostas rápidas
│       └── PrivateNote.tsx          # Nota privada
│
├── user/
│   └── chat/
│       ├── ChatPage.tsx             # Página principal do chat
│       ├── BotSettings.tsx          # Configurações de bots
│       ├── WebhookSettings.tsx      # Configurações de webhook
│       ├── LabelManager.tsx         # Gerenciador de labels
│       └── CannedResponseManager.tsx # Gerenciador de respostas
```

### Backend Routes

```
server/routes/
├── userChatRoutes.js      # Rotas de chat do usuário
│   ├── GET  /conversations           # Lista conversas
│   ├── GET  /conversations/:id       # Detalhes da conversa
│   ├── GET  /conversations/:id/messages # Mensagens da conversa
│   ├── POST /conversations/:id/messages # Enviar mensagem
│   ├── POST /conversations/:id/read  # Marcar como lido
│   ├── POST /conversations/:id/labels # Adicionar label
│   ├── POST /conversations/:id/notes # Adicionar nota privada
│   └── POST /conversations/:id/assign-bot # Atribuir bot
│
├── userBotRoutes.js       # Rotas de Agent Bots
│   ├── GET  /bots                    # Lista bots
│   ├── POST /bots                    # Criar bot
│   ├── PUT  /bots/:id                # Atualizar bot
│   ├── DELETE /bots/:id              # Deletar bot
│   ├── POST /bots/:id/pause          # Pausar bot
│   └── POST /bots/:id/resume         # Resumir bot
│
├── userWebhookRoutes.js   # Rotas de webhook de saída
│   ├── GET  /outgoing-webhook        # Config atual
│   ├── POST /outgoing-webhook        # Configurar webhook
│   └── GET  /outgoing-webhook/stats  # Estatísticas
│
├── userLabelRoutes.js     # Rotas de labels
│   ├── GET  /labels                  # Lista labels
│   ├── POST /labels                  # Criar label
│   ├── PUT  /labels/:id              # Atualizar label
│   └── DELETE /labels/:id            # Deletar label
│
└── userCannedRoutes.js    # Rotas de respostas rápidas
    ├── GET  /canned-responses        # Lista respostas
    ├── POST /canned-responses        # Criar resposta
    ├── PUT  /canned-responses/:id    # Atualizar resposta
    └── DELETE /canned-responses/:id  # Deletar resposta
```

### Backend Services

```
server/services/
├── ChatService.js         # Lógica de chat
│   ├── getConversations()
│   ├── getMessages()
│   ├── sendMessage()
│   ├── markAsRead()
│   └── searchMessages()
│
├── BotService.js          # Lógica de Agent Bots
│   ├── createBot()
│   ├── updateBot()
│   ├── pauseBot()
│   ├── resumeBot()
│   ├── processIncomingMessage()
│   └── forwardToBot()
│
├── OutgoingWebhookService.js # Webhook de saída
│   ├── configure()
│   ├── sendEvent()
│   ├── retryFailedDeliveries()
│   └── getStats()
│
├── LabelService.js        # Lógica de labels
│   ├── createLabel()
│   ├── assignLabel()
│   └── removeLabel()
│
└── CannedResponseService.js # Respostas rápidas
    ├── create()
    ├── search()
    └── getByShortcut()
```

## Data Models

### Database Schema (SQLite)

```sql
-- Conversas
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contact_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_avatar_url TEXT,
  last_message_at DATETIME,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  assigned_bot_id INTEGER,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_bot_id) REFERENCES agent_bots(id),
  UNIQUE(user_id, contact_jid)
);

-- Mensagens
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'incoming' | 'outgoing'
  message_type TEXT NOT NULL, -- 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'sticker'
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  reply_to_message_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  is_private_note INTEGER DEFAULT 0,
  sender_type TEXT, -- 'user' | 'contact' | 'bot'
  sender_bot_id INTEGER,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_bot_id) REFERENCES agent_bots(id)
);

-- Agent Bots
CREATE TABLE agent_bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  outgoing_url TEXT NOT NULL,
  access_token TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' | 'paused'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Labels
CREATE TABLE labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name)
);

-- Conversation Labels (many-to-many)
CREATE TABLE conversation_labels (
  conversation_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, label_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (label_id) REFERENCES labels(id)
);

-- Canned Responses
CREATE TABLE canned_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, shortcut)
);

-- Outgoing Webhooks
CREATE TABLE outgoing_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types
  is_active INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Webhook Delivery Log
CREATE TABLE webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success' | 'failed' | 'pending'
  response_code INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME,
  FOREIGN KEY (webhook_id) REFERENCES outgoing_webhooks(id)
);

-- Reactions
CREATE TABLE message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  reactor_jid TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id),
  UNIQUE(message_id, reactor_jid)
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX idx_messages_status ON chat_messages(status);
CREATE INDEX idx_bots_user_id ON agent_bots(user_id);
CREATE INDEX idx_labels_user_id ON labels(user_id);
```

### TypeScript Interfaces

```typescript
// src/types/chat.ts

export interface Conversation {
  id: number
  contactJid: string
  contactName: string | null
  contactAvatarUrl: string | null
  lastMessageAt: string
  lastMessagePreview: string | null
  unreadCount: number
  assignedBotId: number | null
  assignedBot: AgentBot | null
  status: 'open' | 'resolved' | 'pending'
  labels: Label[]
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: number
  conversationId: number
  messageId: string
  direction: 'incoming' | 'outgoing'
  messageType: MessageType
  content: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaFilename: string | null
  replyToMessageId: string | null
  replyToMessage: ChatMessage | null
  status: MessageStatus
  isPrivateNote: boolean
  senderType: 'user' | 'contact' | 'bot'
  senderBotId: number | null
  timestamp: string
  reactions: MessageReaction[]
}

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'document' 
  | 'location' 
  | 'contact' 
  | 'sticker'

export type MessageStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed'

export interface MessageReaction {
  id: number
  messageId: number
  emoji: string
  reactorJid: string
  createdAt: string
}

export interface AgentBot {
  id: number
  name: string
  description: string | null
  avatarUrl: string | null
  outgoingUrl: string
  accessToken: string
  status: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export interface Label {
  id: number
  name: string
  color: string
  createdAt: string
}

export interface CannedResponse {
  id: number
  shortcut: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface OutgoingWebhook {
  id: number
  url: string
  events: string[]
  isActive: boolean
  successCount: number
  failureCount: number
  lastDeliveryAt: string | null
  lastError: string | null
}

export interface PresenceState {
  contactJid: string
  state: 'composing' | 'paused' | 'recording' | 'available' | 'unavailable'
  lastSeen: string | null
}

// Webhook payload types
export interface IncomingWebhookEvent {
  type: 'Message' | 'ReadReceipt' | 'ChatPresence' | 'HistorySync'
  data: unknown
  timestamp: string
}

export interface OutgoingWebhookPayload {
  event: 'message.received' | 'message.sent' | 'message.read' | 'conversation.created'
  conversation: Conversation
  message?: ChatMessage
  timestamp: string
}

export interface BotWebhookPayload {
  event: 'message.received'
  conversation: {
    id: number
    contactJid: string
    contactName: string | null
  }
  message: {
    id: string
    type: MessageType
    content: string | null
    mediaUrl: string | null
    timestamp: string
  }
  bot: {
    id: number
    name: string
  }
}

export interface BotWebhookResponse {
  action: 'reply' | 'ignore' | 'handoff'
  message?: {
    type: MessageType
    content?: string
    mediaUrl?: string
    caption?: string
  }
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified. Redundant properties have been consolidated.

### Property 1: Conversation ordering by activity

*For any* list of conversations, the conversations SHALL always be ordered by `lastMessageAt` in descending order (most recent first).

**Validates: Requirements 1.1, 1.2**

### Property 2: Conversation display completeness

*For any* conversation displayed in the inbox, the rendered output SHALL contain the contact name (or phone number if name is null), last message preview, timestamp, and unread count.

**Validates: Requirements 1.3**

### Property 3: Message status lifecycle

*For any* outgoing message, the status SHALL transition through the valid states: `pending` → `sent` → `delivered` → `read`, and SHALL never skip states or transition backwards.

**Validates: Requirements 2.2, 2.3, 4.1, 4.2**

### Property 4: Empty message rejection

*For any* string composed entirely of whitespace characters (including empty string), attempting to send it as a message SHALL be rejected and the message list SHALL remain unchanged.

**Validates: Requirements 2.4**

### Property 5: Timestamp formatting

*For any* message timestamp, if the timestamp is within the last 24 hours, the display SHALL show relative time (e.g., "2 hours ago"), otherwise it SHALL show the full date.

**Validates: Requirements 4.3**

### Property 6: Conversation search filtering

*For any* search query and list of conversations, the filtered results SHALL only contain conversations where the contact name OR phone number contains the search query (case-insensitive).

**Validates: Requirements 7.1**

### Property 7: Message search within conversation

*For any* search query within a conversation, the results SHALL only contain messages where the content contains the search query (case-insensitive).

**Validates: Requirements 7.2**

### Property 8: Unread count consistency

*For any* conversation, the unread count SHALL equal the number of incoming messages with status not equal to 'read'.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 9: Webhook message processing

*For any* incoming message webhook event, a new message record SHALL be created in the database with the correct conversation association.

**Validates: Requirements 11.1**

### Property 10: Reply context preservation

*For any* reply message, the `replyToMessageId` SHALL reference a valid existing message in the same conversation.

**Validates: Requirements 12.1, 12.3**

### Property 11: Message persistence round-trip

*For any* message stored in the database, retrieving it by ID SHALL return an equivalent message object with all fields preserved.

**Validates: Requirements 13.1, 13.2**

### Property 12: Webhook delivery retry

*For any* failed webhook delivery, the system SHALL retry up to 3 times with exponential backoff (1s, 2s, 4s delays).

**Validates: Requirements 16.5**

### Property 13: Bot status enforcement

*For any* Agent Bot with status 'paused', incoming messages SHALL NOT be forwarded to the bot's webhook URL.

**Validates: Requirements 18.1, 18.4**

### Property 14: Bot assignment scope

*For any* conversation with an assigned bot, only messages in that specific conversation SHALL be forwarded to the bot.

**Validates: Requirements 19.2, 19.3**

### Property 15: Label uniqueness per user

*For any* user, label names SHALL be unique (case-insensitive). Attempting to create a duplicate label SHALL be rejected.

**Validates: Requirements 20.4**

### Property 16: Label filtering accuracy

*For any* label filter applied to the inbox, the results SHALL only contain conversations that have that specific label assigned.

**Validates: Requirements 20.3**

### Property 17: Canned response shortcut uniqueness

*For any* user, canned response shortcuts SHALL be unique. Attempting to create a duplicate shortcut SHALL be rejected.

**Validates: Requirements 21.4**

### Property 18: Canned response search

*For any* shortcut prefix typed by the user, the suggested canned responses SHALL only include responses where the shortcut starts with that prefix.

**Validates: Requirements 21.5**

### Property 19: Private note isolation

*For any* private note stored in the database, it SHALL have `isPrivateNote` set to true and SHALL NOT be included in messages sent to contacts via WUZAPI.

**Validates: Requirements 22.2, 22.3**

### Property 20: Conversation-contact uniqueness

*For any* user, there SHALL be at most one conversation per contact JID. Creating a conversation for an existing contact SHALL return the existing conversation.

**Validates: Requirements 1.1 (implicit)**

## Error Handling

### Frontend Error Handling

```typescript
// Error types
export enum ChatErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  WUZAPI_ERROR = 'WUZAPI_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
  MEDIA_UPLOAD_FAILED = 'MEDIA_UPLOAD_FAILED',
  WEBHOOK_DELIVERY_FAILED = 'WEBHOOK_DELIVERY_FAILED',
}

// Error handling strategy
interface ErrorHandler {
  // Show toast notification for user-facing errors
  showToast(message: string, type: 'error' | 'warning'): void
  
  // Retry logic for transient failures
  retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>
  
  // Queue messages for offline sending
  queueForRetry(message: ChatMessage): void
}
```

### Backend Error Handling

```javascript
// Structured error responses
const errorResponse = (res, code, message, details = null) => {
  const statusMap = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    WUZAPI_ERROR: 502,
  }
  
  res.status(statusMap[code] || 500).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  })
}

// Webhook error handling with retry
const handleWebhookDelivery = async (webhook, payload) => {
  const maxRetries = 3
  const delays = [1000, 2000, 4000] // Exponential backoff
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10000,
      })
      
      if (response.ok) {
        await updateWebhookStats(webhook.id, 'success')
        return { success: true }
      }
      
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(delays[attempt])
      } else {
        await updateWebhookStats(webhook.id, 'failure', error.message)
        await logWebhookDelivery(webhook.id, payload, 'failed', error.message)
        return { success: false, error: error.message }
      }
    }
  }
}
```

### WUZAPI Error Handling

```javascript
// WUZAPI client with error handling
const wuzapiClient = {
  async sendMessage(token, phone, body, options = {}) {
    try {
      const response = await fetch(`${WUZAPI_BASE_URL}/chat/send/text`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Phone: phone, Body: body, ...options }),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new WuzapiError(data.code, data.message || 'Unknown WUZAPI error')
      }
      
      return data
    } catch (error) {
      if (error instanceof WuzapiError) throw error
      throw new WuzapiError('NETWORK_ERROR', error.message)
    }
  },
}
```

## Testing Strategy

### Testing Framework

- **Frontend**: Vitest + React Testing Library
- **Backend**: Node.js test runner (built-in)
- **Property-Based Testing**: fast-check (JavaScript PBT library)
- **E2E**: Cypress

### Unit Tests

Unit tests will cover:
- Message formatting and parsing
- Timestamp formatting logic
- Search/filter functions
- Validation functions
- Status transition logic

### Property-Based Tests

Each correctness property will be implemented as a property-based test using fast-check. Tests will run a minimum of 100 iterations.

```javascript
// Example: Property 1 - Conversation ordering
import fc from 'fast-check'
import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('ChatService', () => {
  /**
   * Feature: chat-interface, Property 1: Conversation ordering by activity
   * Validates: Requirements 1.1, 1.2
   */
  it('should always return conversations ordered by lastMessageAt descending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            contactJid: fc.string({ minLength: 10 }),
            lastMessageAt: fc.date(),
          }),
          { minLength: 0, maxLength: 100 }
        ),
        (conversations) => {
          const sorted = sortConversationsByActivity(conversations)
          
          for (let i = 1; i < sorted.length; i++) {
            assert(
              new Date(sorted[i - 1].lastMessageAt) >= new Date(sorted[i].lastMessageAt),
              'Conversations should be sorted by lastMessageAt descending'
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: chat-interface, Property 4: Empty message rejection
   * Validates: Requirements 2.4
   */
  it('should reject messages composed entirely of whitespace', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
        (whitespaceString) => {
          const result = validateMessageContent(whitespaceString)
          assert.strictEqual(result.valid, false, 'Whitespace-only messages should be invalid')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: chat-interface, Property 6: Conversation search filtering
   * Validates: Requirements 7.1
   */
  it('should filter conversations by contact name or phone number', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            contactName: fc.option(fc.string({ minLength: 1 })),
            contactJid: fc.string({ minLength: 10 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        fc.string({ minLength: 1, maxLength: 10 }),
        (conversations, query) => {
          const filtered = filterConversations(conversations, query)
          const lowerQuery = query.toLowerCase()
          
          for (const conv of filtered) {
            const nameMatch = conv.contactName?.toLowerCase().includes(lowerQuery)
            const phoneMatch = conv.contactJid.toLowerCase().includes(lowerQuery)
            assert(nameMatch || phoneMatch, 'Filtered results should match query')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: chat-interface, Property 11: Message persistence round-trip
   * Validates: Requirements 13.1, 13.2
   */
  it('should preserve message data through storage and retrieval', () => {
    fc.assert(
      fc.property(
        fc.record({
          messageId: fc.uuid(),
          direction: fc.constantFrom('incoming', 'outgoing'),
          messageType: fc.constantFrom('text', 'image', 'video', 'audio', 'document'),
          content: fc.option(fc.string()),
          timestamp: fc.date(),
        }),
        async (messageData) => {
          const stored = await storeMessage(messageData)
          const retrieved = await getMessage(stored.id)
          
          assert.strictEqual(retrieved.messageId, messageData.messageId)
          assert.strictEqual(retrieved.direction, messageData.direction)
          assert.strictEqual(retrieved.messageType, messageData.messageType)
          assert.strictEqual(retrieved.content, messageData.content)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: chat-interface, Property 13: Bot status enforcement
   * Validates: Requirements 18.1, 18.4
   */
  it('should not forward messages to paused bots', () => {
    fc.assert(
      fc.property(
        fc.record({
          botId: fc.integer({ min: 1 }),
          status: fc.constantFrom('active', 'paused'),
        }),
        fc.record({
          messageId: fc.uuid(),
          content: fc.string(),
        }),
        async (bot, message) => {
          const forwardCalled = await simulateBotForwarding(bot, message)
          
          if (bot.status === 'paused') {
            assert.strictEqual(forwardCalled, false, 'Paused bots should not receive messages')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Tests

Integration tests will verify:
- Webhook processing pipeline
- Bot message forwarding
- Database operations
- WUZAPI client interactions (mocked)

### E2E Tests

Cypress tests will cover:
- Complete conversation flow (send/receive messages)
- Bot creation and management
- Label management
- Search functionality
- Responsive layout

### Test File Structure

```
server/
├── services/
│   ├── ChatService.js
│   ├── ChatService.test.js           # Unit tests
│   └── ChatService.property.test.js  # Property-based tests
│   ├── BotService.js
│   ├── BotService.test.js
│   └── BotService.property.test.js
│   ├── OutgoingWebhookService.js
│   └── OutgoingWebhookService.test.js

src/
├── components/features/chat/
│   ├── MessageBubble.tsx
│   └── MessageBubble.test.tsx
│   ├── InboxSidebar.tsx
│   └── InboxSidebar.test.tsx

cypress/
├── e2e/
│   ├── chat-flow.cy.ts
│   ├── bot-management.cy.ts
│   └── label-management.cy.ts
```
