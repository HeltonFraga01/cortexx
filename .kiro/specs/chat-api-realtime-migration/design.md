# Chat API & Supabase Realtime Migration - Design

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHAT SYSTEM v2.0                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Frontend      │    │  External API   │    │   WUZAPI        │         │
│  │   (React)       │    │   Consumers     │    │   Webhooks      │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           │ Supabase Realtime    │ REST API             │ HTTP POST         │
│           │ (WebSocket)          │ /api/v1/chat/*       │                   │
│           │                      │                      │                   │
│  ┌────────▼──────────────────────▼──────────────────────▼────────┐         │
│  │                     API Gateway Layer                          │         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │         │
│  │  │ Auth         │  │ Rate Limit   │  │ Validation   │         │         │
│  │  │ Middleware   │  │ Middleware   │  │ Middleware   │         │         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │         │
│  └───────────────────────────┬───────────────────────────────────┘         │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────┐         │
│  │                     Service Layer                              │         │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │         │
│  │  │ ChatService      │  │ RealtimeService  │                   │         │
│  │  │ (Business Logic) │  │ (Event Dispatch) │                   │         │
│  │  └──────────────────┘  └──────────────────┘                   │         │
│  └───────────────────────────┬───────────────────────────────────┘         │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────┐         │
│  │                     Data Layer                                 │         │
│  │  ┌──────────────────────────────────────────────────────┐     │         │
│  │  │                    Supabase                           │     │         │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │     │         │
│  │  │  │ PostgreSQL │  │ Realtime   │  │ RLS        │      │     │         │
│  │  │  │ (Storage)  │  │ (Events)   │  │ (Security) │      │     │         │
│  │  │  └────────────┘  └────────────┘  └────────────┘      │     │         │
│  │  └──────────────────────────────────────────────────────┘     │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Supabase Realtime Channels

### 1.1 Estrutura de Canais

```typescript
// Canais por tipo de evento
const CHANNELS = {
  // Canal de conversa específica (mensagens, status, typing)
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  
  // Canal de inbox do usuário (novas conversas, atualizações)
  userInbox: (userId: string) => `user:${userId}:inbox`,
  
  // Canal de presença (agentes online)
  presence: (conversationId: string) => `presence:${conversationId}`
}
```

### 1.2 Eventos do Realtime

```typescript
// Eventos de mensagem
interface MessageEvent {
  type: 'message.new' | 'message.updated' | 'message.deleted' | 'message.status'
  payload: {
    id: number
    conversationId: number
    content: string
    direction: 'incoming' | 'outgoing'
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document'
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

// Eventos de conversa
interface ConversationEvent {
  type: 'conversation.new' | 'conversation.updated' | 'conversation.assigned'
  payload: {
    id: number
    contactJid: string
    contactName: string
    status: 'open' | 'pending' | 'resolved' | 'snoozed'
    assignedAgentId?: string
    assignedBotId?: number
    lastMessageAt: string
    unreadCount: number
  }
}

// Eventos de presença
interface PresenceEvent {
  type: 'presence.join' | 'presence.leave' | 'presence.typing'
  payload: {
    conversationId: number
    userId: string
    username: string
    isTyping?: boolean
    lastSeen: string
  }
}
```

### 1.3 Configuração do Realtime no Supabase

```sql
-- Habilitar Realtime nas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Índices para performance do Realtime
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created 
  ON chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_status_updated 
  ON conversations(user_id, status, updated_at DESC);

-- RLS policies para Realtime
CREATE POLICY "Users can subscribe to their conversations"
  ON chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

---

## 2. Backend Services

### 2.1 RealtimeService (Novo)

```javascript
// server/services/RealtimeService.js
const { createClient } = require('@supabase/supabase-js')
const logger = require('../utils/logger')

class RealtimeService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }

  /**
   * Broadcast evento para canal de conversa
   */
  async broadcastToConversation(conversationId, event, payload) {
    try {
      const channel = `conversation:${conversationId}`
      
      await this.supabase
        .channel(channel)
        .send({
          type: 'broadcast',
          event,
          payload: this.transformPayload(payload)
        })

      logger.debug('Broadcast sent', { channel, event, conversationId })
    } catch (error) {
      logger.error('Broadcast failed', { error: error.message, conversationId })
    }
  }

  /**
   * Broadcast evento para inbox do usuário
   */
  async broadcastToUserInbox(userId, event, payload) {
    try {
      const channel = `user:${userId}:inbox`
      
      await this.supabase
        .channel(channel)
        .send({
          type: 'broadcast',
          event,
          payload: this.transformPayload(payload)
        })

      logger.debug('Inbox broadcast sent', { channel, event, userId })
    } catch (error) {
      logger.error('Inbox broadcast failed', { error: error.message, userId })
    }
  }

  /**
   * Transforma payload para camelCase
   */
  transformPayload(payload) {
    // Implementar transformação snake_case -> camelCase
    return transformKeys(payload)
  }
}

module.exports = new RealtimeService()
```

### 2.2 ChatService Atualizado

```javascript
// server/services/ChatService.js (modificações)

const RealtimeService = require('./RealtimeService')
const ChatWebSocketHandler = require('../websocket/ChatWebSocketHandler')

class ChatService {
  /**
   * Salva mensagem e dispara eventos
   */
  async saveMessage(conversationId, messageData, options = {}) {
    // 1. Salvar no banco
    const { data: message, error } = await SupabaseService.insert('chat_messages', {
      conversation_id: conversationId,
      ...messageData
    })

    if (error) throw error

    // 2. Atualizar conversa
    await this.updateConversationLastMessage(conversationId, message)

    // 3. Broadcast via Supabase Realtime (novo)
    await RealtimeService.broadcastToConversation(conversationId, 'message.new', message)

    // 4. Broadcast via Socket.IO (legado - remover após migração)
    if (this.chatWebSocketHandler) {
      this.chatWebSocketHandler.broadcastNewMessage(conversationId, message, options)
    }

    // 5. Disparar webhooks externos
    await this.triggerExternalWebhooks('message.received', message)

    return message
  }

  /**
   * Atualiza status da mensagem
   */
  async updateMessageStatus(messageId, status, timestamp) {
    const { data: message, error } = await SupabaseService.update('chat_messages', messageId, {
      status,
      status_updated_at: timestamp
    })

    if (error) throw error

    // Broadcast status update
    await RealtimeService.broadcastToConversation(
      message.conversation_id, 
      'message.status', 
      { id: messageId, status, timestamp }
    )

    return message
  }
}
```

### 2.3 API v1 Routes (Novo)

```javascript
// server/routes/api/v1/chatRoutes.js
const router = require('express').Router()
const { authenticateApiKey } = require('../../../middleware/apiKeyAuth')
const { rateLimiter } = require('../../../middleware/rateLimiter')
const ChatService = require('../../../services/ChatService')
const logger = require('../../../utils/logger')

/**
 * @api {get} /api/v1/chat/conversations List conversations
 * @apiHeader {String} X-API-Key API key for authentication
 */
router.get('/conversations', authenticateApiKey, rateLimiter('api-chat', 100, 60), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, assignedTo } = req.query
    
    const conversations = await ChatService.listConversations(req.apiUser.id, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      status,
      assignedTo
    })

    res.json({
      success: true,
      data: conversations.data,
      pagination: {
        page: conversations.page,
        limit: conversations.limit,
        total: conversations.total,
        hasMore: conversations.hasMore
      }
    })
  } catch (error) {
    logger.error('API: List conversations failed', { error: error.message, userId: req.apiUser?.id })
    res.status(500).json({ error: error.message })
  }
})

/**
 * @api {post} /api/v1/chat/conversations/:id/messages Send message
 */
router.post('/conversations/:id/messages', authenticateApiKey, rateLimiter('api-chat-send', 60, 60), async (req, res) => {
  try {
    const { id: conversationId } = req.params
    const { content, type = 'text', metadata } = req.body

    // Validar ownership
    const conversation = await ChatService.getConversation(conversationId, req.apiUser.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    const message = await ChatService.sendMessage(conversationId, {
      content,
      type,
      metadata,
      direction: 'outgoing'
    })

    res.status(201).json({
      success: true,
      data: message
    })
  } catch (error) {
    logger.error('API: Send message failed', { error: error.message, conversationId: req.params.id })
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
```

---

## 3. Frontend Integration

### 3.1 useSupabaseRealtime Hook (Novo)

```typescript
// src/hooks/useSupabaseRealtime.ts
import { useEffect, useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js'
import type { ChatMessage, Conversation } from '@/types/chat'

interface UseSupabaseRealtimeOptions {
  userId: string
  onNewMessage?: (message: ChatMessage) => void
  onConversationUpdate?: (conversation: Conversation) => void
  onPresenceChange?: (presence: RealtimePresenceState) => void
}

export function useSupabaseRealtime({
  userId,
  onNewMessage,
  onConversationUpdate,
  onPresenceChange
}: UseSupabaseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const queryClient = useQueryClient()
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map())
  const inboxChannelRef = useRef<RealtimeChannel | null>(null)

  // Subscribe to user inbox channel
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`user:${userId}:inbox`)
      .on('broadcast', { event: 'conversation.new' }, ({ payload }) => {
        onConversationUpdate?.(payload)
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .on('broadcast', { event: 'conversation.updated' }, ({ payload }) => {
        onConversationUpdate?.(payload)
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    inboxChannelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [userId, queryClient, onConversationUpdate])

  // Join conversation channel
  const joinConversation = useCallback((conversationId: number) => {
    const channelName = `conversation:${conversationId}`
    
    if (channelsRef.current.has(channelName)) return

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'message.new' }, ({ payload }) => {
        onNewMessage?.(payload)
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      })
      .on('broadcast', { event: 'message.status' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      })
      .on('broadcast', { event: 'message.updated' }, ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        onPresenceChange?.(state)
      })
      .subscribe()

    channelsRef.current.set(channelName, channel)
  }, [queryClient, onNewMessage, onPresenceChange])

  // Leave conversation channel
  const leaveConversation = useCallback((conversationId: number) => {
    const channelName = `conversation:${conversationId}`
    const channel = channelsRef.current.get(channelName)
    
    if (channel) {
      channel.unsubscribe()
      channelsRef.current.delete(channelName)
    }
  }, [])

  // Send typing indicator via presence
  const sendTypingIndicator = useCallback((conversationId: number, isTyping: boolean) => {
    const channelName = `conversation:${conversationId}`
    const channel = channelsRef.current.get(channelName)
    
    if (channel) {
      channel.track({
        isTyping,
        userId,
        timestamp: new Date().toISOString()
      })
    }
  }, [userId])

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      channelsRef.current.forEach(channel => channel.unsubscribe())
      channelsRef.current.clear()
    }
  }, [])

  return {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTypingIndicator
  }
}
```

### 3.2 Migração do ChatLayout

```typescript
// src/components/features/chat/ChatLayout.tsx (modificações)

import { useChatSocket } from '@/hooks/useChatSocket'
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime'

// Feature flag para controlar provider
const REALTIME_PROVIDER = import.meta.env.VITE_CHAT_REALTIME_PROVIDER || 'socketio'

export function ChatLayout({ className, isAgentMode = false }: ChatLayoutProps) {
  // ... existing code ...

  // Escolher provider baseado na feature flag
  const realtimeHook = REALTIME_PROVIDER === 'supabase' 
    ? useSupabaseRealtime({
        userId: user?.id || '',
        onNewMessage: handleNewMessage,
        onConversationUpdate: handleConversationUpdate,
        onPresenceChange: handlePresenceChange
      })
    : useChatSocket({
        userToken,
        onNewMessage: handleNewMessage,
        onConversationUpdate: handleConversationUpdate,
        onTypingIndicator: handleTypingIndicator
      })

  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTypingIndicator
  } = realtimeHook

  // ... rest of component ...
}
```

---

## 4. Database Schema Updates

### 4.1 Novas Tabelas

```sql
-- Tabela para API keys externas
CREATE TABLE IF NOT EXISTS chat_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL, -- Primeiros caracteres para identificação
  scopes TEXT[] DEFAULT ARRAY['chat:read', 'chat:write'],
  rate_limit INTEGER DEFAULT 100, -- requests per minute
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para webhooks externos
CREATE TABLE IF NOT EXISTS chat_external_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  events TEXT[] NOT NULL, -- ['message.received', 'message.sent', 'conversation.updated']
  secret VARCHAR(255), -- Para assinatura HMAC
  is_active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_chat_api_keys_user ON chat_api_keys(user_id);
CREATE INDEX idx_chat_api_keys_prefix ON chat_api_keys(key_prefix);
CREATE INDEX idx_chat_external_webhooks_user ON chat_external_webhooks(user_id);
CREATE INDEX idx_chat_external_webhooks_active ON chat_external_webhooks(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE chat_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_external_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
  ON chat_api_keys FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own webhooks"
  ON chat_external_webhooks FOR ALL
  USING (user_id = auth.uid());
```

### 4.2 Otimizações nas Tabelas Existentes

```sql
-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_status 
  ON chat_messages(status) WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_conversations_unread 
  ON conversations(user_id, unread_count) WHERE unread_count > 0;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 5. Estratégia de Migração

### Fase 1: Preparação (1 semana)
1. Criar `RealtimeService` no backend
2. Habilitar Realtime nas tabelas do Supabase
3. Criar `useSupabaseRealtime` hook no frontend
4. Implementar feature flag `CHAT_REALTIME_PROVIDER`

### Fase 2: Dual-Write (2 semanas)
1. Modificar `ChatService` para broadcast em ambos providers
2. Testar em ambiente de staging
3. Monitorar métricas de latência e erros
4. Coletar feedback de usuários beta

### Fase 3: Migração Gradual (2 semanas)
1. Migrar 10% dos usuários para Supabase Realtime
2. Aumentar gradualmente (25%, 50%, 75%, 100%)
3. Monitorar métricas e rollback se necessário

### Fase 4: Cleanup (1 semana)
1. Remover código Socket.IO
2. Remover feature flags
3. Atualizar documentação
4. Deprecar endpoints antigos

---

## 6. Monitoramento e Observabilidade

### Métricas a Coletar
- `chat.realtime.connection.count` - Conexões ativas
- `chat.realtime.message.latency` - Latência de entrega
- `chat.realtime.broadcast.success` - Taxa de sucesso de broadcasts
- `chat.realtime.broadcast.failure` - Taxa de falha
- `chat.api.request.count` - Requisições à API
- `chat.api.request.latency` - Latência da API

### Alertas
- Latência P95 > 500ms
- Taxa de erro > 1%
- Conexões ativas < threshold mínimo
- Falhas de broadcast consecutivas > 5

---

## 7. Considerações de Segurança

### RLS Policies
- Todas as tabelas de chat com RLS habilitado
- Usuários só acessam suas próprias conversas
- API keys com scopes limitados

### Rate Limiting
- API: 100 req/min por API key
- Realtime: 10 mensagens/segundo por usuário
- Typing indicators: 1 evento/segundo

### Validação
- Sanitização de conteúdo de mensagens (DOMPurify)
- Validação de tamanho de payload (max 4KB)
- Validação de tipos de arquivo permitidos
