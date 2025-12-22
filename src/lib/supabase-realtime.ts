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
const activeChannels = new Map<string, RealtimeChannel>()

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

// ============================================
// BROADCAST CHANNELS (Task 13)
// Tenant-isolated broadcast for real-time notifications
// ============================================

type BroadcastEvent = {
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

type PresenceState = {
  id: string
  name: string
  status: 'online' | 'away' | 'busy'
  lastSeen: string
}

/**
 * Subscribe to tenant-isolated broadcast channel
 * Used for real-time notifications within a tenant
 */
export function subscribeToTenantBroadcast(
  tenantId: string,
  onEvent: (event: BroadcastEvent) => void
): () => void {
  const channelName = `tenant:${tenantId}:broadcast`
  
  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName)!
    existingChannel.unsubscribe()
    activeChannels.delete(channelName)
  }
  
  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'notification' }, (payload) => {
      onEvent(payload.payload as BroadcastEvent)
    })
    .on('broadcast', { event: 'update' }, (payload) => {
      onEvent(payload.payload as BroadcastEvent)
    })
    .on('broadcast', { event: 'alert' }, (payload) => {
      onEvent(payload.payload as BroadcastEvent)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to tenant broadcast: ${tenantId}`)
      }
    })
  
  activeChannels.set(channelName, channel)
  
  return () => {
    channel.unsubscribe()
    activeChannels.delete(channelName)
  }
}

/**
 * Send a broadcast message to all users in a tenant
 */
export async function sendTenantBroadcast(
  tenantId: string,
  eventType: 'notification' | 'update' | 'alert',
  payload: Record<string, unknown>
): Promise<void> {
  const channelName = `tenant:${tenantId}:broadcast`
  
  const channel = supabase.channel(channelName)
  
  await channel.send({
    type: 'broadcast',
    event: eventType,
    payload: {
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Subscribe to presence channel for a tenant
 * Shows which users are online within the tenant
 */
export function subscribeToTenantPresence(
  tenantId: string,
  userId: string,
  userName: string,
  callbacks: {
    onSync?: (state: Record<string, PresenceState[]>) => void
    onJoin?: (key: string, currentPresences: PresenceState[], newPresences: PresenceState[]) => void
    onLeave?: (key: string, currentPresences: PresenceState[], leftPresences: PresenceState[]) => void
  }
): () => void {
  const channelName = `tenant:${tenantId}:presence`
  
  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName)!
    existingChannel.unsubscribe()
    activeChannels.delete(channelName)
  }
  
  const channel = supabase
    .channel(channelName)
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>()
      callbacks.onSync?.(state)
    })
    .on('presence', { event: 'join' }, ({ key, currentPresences, newPresences }) => {
      callbacks.onJoin?.(key, currentPresences as PresenceState[], newPresences as PresenceState[])
    })
    .on('presence', { event: 'leave' }, ({ key, currentPresences, leftPresences }) => {
      callbacks.onLeave?.(key, currentPresences as PresenceState[], leftPresences as PresenceState[])
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track this user's presence
        await channel.track({
          id: userId,
          name: userName,
          status: 'online',
          lastSeen: new Date().toISOString()
        })
        console.log(`Joined tenant presence: ${tenantId}`)
      }
    })
  
  activeChannels.set(channelName, channel)
  
  return () => {
    channel.untrack()
    channel.unsubscribe()
    activeChannels.delete(channelName)
  }
}

/**
 * Update user's presence status
 */
export async function updatePresenceStatus(
  tenantId: string,
  status: 'online' | 'away' | 'busy'
): Promise<void> {
  const channelName = `tenant:${tenantId}:presence`
  const channel = activeChannels.get(channelName)
  
  if (channel) {
    const currentState = channel.presenceState()
    const myKey = Object.keys(currentState)[0]
    
    if (myKey && currentState[myKey]?.[0]) {
      await channel.track({
        ...currentState[myKey][0],
        status,
        lastSeen: new Date().toISOString()
      })
    }
  }
}

/**
 * Subscribe to account-level broadcast (for account-specific notifications)
 */
export function subscribeToAccountBroadcast(
  accountId: string,
  onEvent: (event: BroadcastEvent) => void
): () => void {
  const channelName = `account:${accountId}:broadcast`
  
  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName)!
    existingChannel.unsubscribe()
    activeChannels.delete(channelName)
  }
  
  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: '*' }, (payload) => {
      onEvent(payload.payload as BroadcastEvent)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to account broadcast: ${accountId}`)
      }
    })
  
  activeChannels.set(channelName, channel)
  
  return () => {
    channel.unsubscribe()
    activeChannels.delete(channelName)
  }
}
