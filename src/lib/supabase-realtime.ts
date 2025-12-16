/**
 * Supabase Realtime Subscription Utilities
 * Task 10.3: Create frontend realtime subscription utilities
 * 
 * Provides type-safe subscriptions for conversations and messages
 * with automatic reconnection handling
 */

import { createClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Types from database schema
type Conversation = Database['public']['Tables']['conversations']['Row']
type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

// Supabase client (will be initialized with user's session)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Callback types
type ConversationCallback = (payload: RealtimePostgresChangesPayload<Conversation>) => void
type MessageCallback = (payload: RealtimePostgresChangesPayload<ChatMessage>) => void

// Active subscriptions tracking
const activeChannels: Map<string, RealtimeChannel> = new Map()

/**
 * Subscribe to conversation changes for a specific account
 * RLS ensures only authorized conversations are received
 */
export function subscribeToConversations(
  accountId: string,
  callbacks: {
    onInsert?: ConversationCallback
    onUpdate?: ConversationCallback
    onDelete?: ConversationCallback
  }
): () => void {
  const channelName = `conversations:${accountId}`
  
  // Reuse existing channel if available
  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName)!
    existingChannel.unsubscribe()
    activeChannels.delete(channelName)
  }
  
  const channel = supabase
    .channel(channelName)
    .on<Conversation>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `account_id=eq.${accountId}`
      },
      (payload) => callbacks.onInsert?.(payload)
    )
    .on<Conversation>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `account_id=eq.${accountId}`
      },
      (payload) => callbacks.onUpdate?.(payload)
    )
    .on<Conversation>(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'conversations',
        filter: `account_id=eq.${accountId}`
      },
      (payload) => callbacks.onDelete?.(payload)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to conversations for account ${accountId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Error subscribing to conversations for account ${accountId}`)
        // Attempt reconnection after delay
        setTimeout(() => {
          subscribeToConversations(accountId, callbacks)
        }, 5000)
      }
    })
  
  activeChannels.set(channelName, channel)
  
  // Return unsubscribe function
  return () => {
    channel.unsubscribe()
    activeChannels.delete(channelName)
  }
}

/**
 * Subscribe to message changes for a specific conversation
 * RLS ensures only authorized messages are received
 */
export function subscribeToMessages(
  conversationId: string,
  callbacks: {
    onInsert?: MessageCallback
    onUpdate?: MessageCallback
    onDelete?: MessageCallback
  }
): () => void {
  const channelName = `messages:${conversationId}`
  
  // Reuse existing channel if available
  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName)!
    existingChannel.unsubscribe()
    activeChannels.delete(channelName)
  }
  
  const channel = supabase
    .channel(channelName)
    .on<ChatMessage>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => callbacks.onInsert?.(payload)
    )
    .on<ChatMessage>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => callbacks.onUpdate?.(payload)
    )
    .on<ChatMessage>(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => callbacks.onDelete?.(payload)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to messages for conversation ${conversationId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Error subscribing to messages for conversation ${conversationId}`)
        // Attempt reconnection after delay
        setTimeout(() => {
          subscribeToMessages(conversationId, callbacks)
        }, 5000)
      }
    })
  
  activeChannels.set(channelName, channel)
  
  // Return unsubscribe function
  return () => {
    channel.unsubscribe()
    activeChannels.delete(channelName)
  }
}

/**
 * Subscribe to all conversations with a simplified callback
 * Useful for updating conversation list in real-time
 */
export function subscribeToConversationList(
  accountId: string,
  onUpdate: (conversation: Conversation, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
): () => void {
  return subscribeToConversations(accountId, {
    onInsert: (payload) => {
      if (payload.new) {
        onUpdate(payload.new as Conversation, 'INSERT')
      }
    },
    onUpdate: (payload) => {
      if (payload.new) {
        onUpdate(payload.new as Conversation, 'UPDATE')
      }
    },
    onDelete: (payload) => {
      if (payload.old) {
        onUpdate(payload.old as Conversation, 'DELETE')
      }
    }
  })
}

/**
 * Subscribe to new messages in a conversation
 * Simplified callback for chat UI
 */
export function subscribeToNewMessages(
  conversationId: string,
  onNewMessage: (message: ChatMessage) => void
): () => void {
  return subscribeToMessages(conversationId, {
    onInsert: (payload) => {
      if (payload.new) {
        onNewMessage(payload.new as ChatMessage)
      }
    }
  })
}

/**
 * Unsubscribe from all active channels
 * Call on logout or component unmount
 */
export function unsubscribeAll(): void {
  activeChannels.forEach((channel, name) => {
    channel.unsubscribe()
    console.log(`Unsubscribed from ${name}`)
  })
  activeChannels.clear()
}

/**
 * Get count of active subscriptions
 * Useful for debugging
 */
export function getActiveSubscriptionCount(): number {
  return activeChannels.size
}
