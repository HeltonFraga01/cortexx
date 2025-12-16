# Design Document: Bot Test Chat

## Overview

Este documento descreve o design para implementar uma funcionalidade de "Chat de Teste com Bot" que permite aos usuários testar seus bots configurados diretamente da página de configurações. O sistema utiliza a mesma infraestrutura de chat existente, mas com um JID simulado para manter compatibilidade com o payload do webhook.

A funcionalidade se integra com:
- Sistema de bots existente (`BotService`)
- Sistema de quotas (`QuotaService`) 
- Interface de chat (`ChatLayout`, `ConversationView`)
- Sistema de webhooks

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Bot Test Chat System                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   BotSettings    │    │  BotTestChat     │    │   Bot Service    │       │
│  │   Component      │    │  Dialog          │    │                  │       │
│  │                  │    │                  │    │ - forwardToBot() │       │
│  │ - Test Button    │───▶│ - Chat UI        │───▶│ - handleReply()  │       │
│  │ - Bot Cards      │    │ - Message Input  │    │ - checkQuota()   │       │
│  └──────────────────┘    │ - Quota Display  │    └────────┬─────────┘       │
│                          └────────┬─────────┘             │                 │
│                                   │                       │                 │
│  ┌──────────────────┐    ┌────────▼─────────┐    ┌────────▼─────────┐       │
│  │ Test Conversation│    │  Simulated JID   │    │  Webhook Handler │       │
│  │   Service        │    │  Generator       │    │                  │       │
│  │                  │    │                  │    │ - Same payload   │       │
│  │ - create()       │◀───│ - format:        │    │ - Token tracking │       │
│  │ - archive()      │    │   test_<uid>_    │    │ - Reply handling │       │
│  │ - getMessages()  │    │   <ts>@s.wa.net  │    └──────────────────┘       │
│  └──────────────────┘    └──────────────────┘                               │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                               │
│  │  Quota Service   │    │  Chat Messages   │                               │
│  │                  │    │  Table           │                               │
│  │ - checkBotCall   │    │                  │                               │
│  │ - checkBotMsg    │    │ - is_test flag   │                               │
│  │ - trackTokens    │    │ - test messages  │                               │
│  └──────────────────┘    └──────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. BotTestChatDialog Component

Componente modal que exibe a interface de chat de teste:

```typescript
// src/components/features/chat/settings/BotTestChatDialog.tsx

interface BotTestChatDialogProps {
  bot: AgentBot | AssignedBot;
  isOpen: boolean;
  onClose: () => void;
}

export function BotTestChatDialog({ bot, isOpen, onClose }: BotTestChatDialogProps) {
  // State for messages, input, loading
  // Quota display
  // Message sending logic
  // Bot response handling
}
```

### 2. TestConversationService (Backend)

Serviço para gerenciar conversas de teste:

```javascript
// server/services/TestConversationService.js

class TestConversationService {
  /**
   * Generate a simulated JID for test conversations
   * @param {number} userId - User ID
   * @returns {string} Simulated JID in format test_<userId>_<timestamp>@s.whatsapp.net
   */
  generateSimulatedJid(userId) {
    const timestamp = Date.now();
    return `test_${userId}_${timestamp}@s.whatsapp.net`;
  }

  /**
   * Create a test conversation for bot testing
   * @param {number} userId - User ID
   * @param {number} botId - Bot ID being tested
   * @returns {Promise<Conversation>} Created test conversation
   */
  async createTestConversation(userId, botId) {
    // Create conversation with is_test = 1
    // Assign the bot being tested
    // Return conversation object
  }

  /**
   * Archive a test conversation when testing is complete
   * @param {number} conversationId - Conversation ID
   */
  async archiveTestConversation(conversationId) {
    // Mark conversation as archived
  }

  /**
   * Get messages from a test conversation
   * @param {number} conversationId - Conversation ID
   * @param {number} limit - Max messages to return
   * @returns {Promise<ChatMessage[]>} Messages
   */
  async getTestMessages(conversationId, limit = 10) {
    // Return messages for history
  }

  /**
   * Clear all messages from a test conversation
   * @param {number} conversationId - Conversation ID
   */
  async clearTestHistory(conversationId) {
    // Delete all messages from test conversation
  }
}
```

### 3. BotTestRoutes (Backend API)

Endpoints para o chat de teste:

```javascript
// server/routes/userBotTestRoutes.js

/**
 * POST /api/user/bots/:botId/test/start
 * Start a test chat session with a bot
 */
router.post('/:botId/test/start', authenticate, async (req, res) => {
  // Check quota
  // Create test conversation
  // Return conversation details
});

/**
 * POST /api/user/bots/:botId/test/message
 * Send a test message to the bot
 */
router.post('/:botId/test/message', authenticate, async (req, res) => {
  // Validate message
  // Check quota
  // Forward to bot webhook
  // Track usage
  // Return bot response
});

/**
 * POST /api/user/bots/:botId/test/end
 * End a test chat session
 */
router.post('/:botId/test/end', authenticate, async (req, res) => {
  // Archive test conversation
});

/**
 * DELETE /api/user/bots/:botId/test/history
 * Clear test conversation history
 */
router.delete('/:botId/test/history', authenticate, async (req, res) => {
  // Clear messages
});
```

### 4. Webhook Payload Structure

O payload enviado ao webhook do bot deve ser idêntico ao de mensagens reais:

```typescript
interface TestWebhookPayload {
  // Standard fields (same as real messages)
  jid: string;                    // Simulated JID: test_<userId>_<timestamp>@s.whatsapp.net
  message: {
    id: string;
    text: string;
    timestamp: number;
    fromMe: boolean;
  };
  conversationId: number;
  userId: number;
  
  // Optional history (if bot.includeHistory is true)
  history?: Array<{
    id: string;
    text: string;
    timestamp: number;
    fromMe: boolean;
  }>;
  
  // Test indicator (optional, for bot developers who want to handle differently)
  isTest?: boolean;
}
```

## Data Models

### Database Schema Changes

```sql
-- Add is_test column to conversations table if not exists
ALTER TABLE conversations ADD COLUMN is_test INTEGER DEFAULT 0;

-- Add index for filtering test conversations
CREATE INDEX IF NOT EXISTS idx_conversations_is_test ON conversations(is_test);
```

### Conversation Model Extension

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| is_test | INTEGER | 0 | Flag indicating test conversation (1 = test, 0 = real) |

### Test Conversation Filtering

Conversas de teste devem ser excluídas das listagens normais:

```javascript
// In conversation queries, add filter:
WHERE is_test = 0  // Exclude test conversations from normal list
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Test button presence
*For any* bot card rendered (user-created or admin-assigned), the component SHALL include a visible "Testar Bot" button.
**Validates: Requirements 1.1, 5.1**

### Property 2: Simulated JID format
*For any* userId and timestamp, the generated simulated JID SHALL match the regex pattern `^test_\d+_\d+@s\.whatsapp\.net$`.
**Validates: Requirements 1.4**

### Property 3: Test conversation creation
*For any* test chat session started, a conversation SHALL be created with `is_test = 1` and the specified bot assigned.
**Validates: Requirements 1.3**

### Property 4: Test conversation archival
*For any* test chat session closed, the associated conversation SHALL have `status = 'archived'`.
**Validates: Requirements 1.5**

### Property 5: Webhook payload completeness
*For any* test message sent, the webhook payload SHALL contain all required fields: `jid`, `message.id`, `message.text`, `message.timestamp`, `conversationId`, and `userId`.
**Validates: Requirements 2.2**

### Property 6: Bot call quota enforcement
*For any* user whose bot call quota is at or above the limit, test messages SHALL NOT be forwarded to the webhook.
**Validates: Requirements 3.1**

### Property 7: Bot message counter increment
*For any* bot reply successfully processed, the user's bot messages counter SHALL increase by exactly 1.
**Validates: Requirements 3.3**

### Property 8: Bot message quota enforcement
*For any* user whose bot messages quota is at or above the limit, bot replies SHALL be skipped.
**Validates: Requirements 3.4**

### Property 9: Test conversation exclusion
*For any* conversation list query without explicit test filter, conversations with `is_test = 1` SHALL NOT be included in results.
**Validates: Requirements 4.4**

### Property 10: History inclusion
*For any* bot with `includeHistory = true`, the webhook payload SHALL include up to 10 previous messages from the test conversation.
**Validates: Requirements 6.1, 6.2**

### Property 11: History limit enforcement
*For any* test conversation with more than 10 messages, the history array in the webhook payload SHALL contain exactly 10 messages (the most recent).
**Validates: Requirements 6.2**

### Property 12: New session empty history
*For any* newly created test conversation, the first webhook payload SHALL have an empty or undefined history array.
**Validates: Requirements 6.3**

### Property 13: Message timestamp presence
*For any* message displayed in the test chat, the rendered output SHALL include a visible timestamp.
**Validates: Requirements 7.4**

### Property 14: Token tracking accuracy
*For any* bot webhook response with `tokensUsed` field, the user's token counter SHALL increase by exactly that amount.
**Validates: Requirements 2.4**

## Error Handling

### Error Responses

```typescript
interface TestChatError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Error codes
const TEST_CHAT_ERRORS = {
  QUOTA_EXCEEDED: 'BOT_TEST_QUOTA_EXCEEDED',
  WEBHOOK_FAILED: 'BOT_WEBHOOK_FAILED',
  WEBHOOK_TIMEOUT: 'BOT_WEBHOOK_TIMEOUT',
  INVALID_BOT: 'INVALID_BOT_ID',
  CONVERSATION_NOT_FOUND: 'TEST_CONVERSATION_NOT_FOUND'
};
```

### Webhook Error Handling

```javascript
// Timeout handling
const WEBHOOK_TIMEOUT = 30000; // 30 seconds

// Retry logic (no retries for test - fail fast)
// Display error message in chat UI
```

## Testing Strategy

### Dual Testing Approach

**Unit Tests:**
- Test simulated JID generation format
- Test conversation creation with is_test flag
- Test quota checking before message send
- Test webhook payload structure

**Property-Based Tests:**
- Use `fast-check` library
- Generate random userIds, timestamps, messages
- Verify invariants hold across all inputs
- Minimum 100 iterations per property test

### Property-Based Testing Library

Use `fast-check` (available via vitest integration).

### Test Annotations

Each property-based test MUST be annotated with:
```javascript
// **Feature: bot-test-chat, Property {number}: {property_text}**
// **Validates: Requirements X.Y**
```

### Test Coverage

1. **TestConversationService tests:**
   - JID generation format validation
   - Conversation creation with correct flags
   - Archival state transition
   - History retrieval with limit

2. **BotTestRoutes tests:**
   - Quota enforcement before forwarding
   - Payload structure validation
   - Error handling for webhook failures

3. **Frontend component tests:**
   - Test button rendering on bot cards
   - Dialog open/close behavior
   - Message display with timestamps
   - Quota indicator display

## UI Components

### BotTestChatDialog Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🧪 Testar Bot: [Bot Name]                            [X]  │
│  ⚠️ Ambiente de teste - mensagens não são enviadas ao WA   │
├─────────────────────────────────────────────────────────────┤
│  Quota: Chamadas 5/50 | Mensagens 3/25 | Tokens 1.2k/5k    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [User Message]                           14:30     │   │
│  │                                                     │   │
│  │       [Bot Reply]                         14:31     │   │
│  │                                                     │   │
│  │  [User Message]                           14:32     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Clear History]  [________________] [Enviar]              │
└─────────────────────────────────────────────────────────────┘
```

### Visual Distinction

- Header com ícone de teste (🧪 ou BeakerIcon)
- Borda amarela/laranja para indicar ambiente de teste
- Badge "Teste" em destaque
- Warning banner explicando que é ambiente de teste
