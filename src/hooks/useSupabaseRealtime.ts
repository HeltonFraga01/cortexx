/**
 * useSupabaseRealtime Hook
 * 
 * Manages Supabase Realtime connection for real-time chat updates
 * Replaces Socket.IO with Supabase Realtime channels
 * 
 * Requirements: REQ-1.1, REQ-1.4 (chat-api-realtime-migration)
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient, RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js'
import type { 
  ChatMessage, 
  Conversation, 
  MessageReaction, 
  PresenceState,
  MessageStatus 
} from '@/types/chat'

// Initialize Supabase client for realtime
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface SupabaseRealtimeOptions {
  userId: string
  userToken: string
  onNewMessage?: (message: ChatMessage) => void
  onMessageStatusUpdate?: (data: { messageId: string; status: MessageStatus }) => void
  onReaction?: (reaction: MessageReaction) => void
  onPresenceUpdate?: (data: { conversationId: string; state: PresenceState }) => void
  onConversationUpdate?: (conversation: Conversation) => void
  onTypingIndicator?: (data: { conversationId: string; isTyping: boolean; userId: string }) => void
}

interface UseSupabaseRealtimeReturn {
  isConnected: boolean
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void
  sendTypingIndicator: (conversationId: string, isTyping: boolean) => void
  sendPresence: (conversationId: string, state: PresenceState) => void
}

interface TypingUser {
  oderId: string // oderId = owner ID (the user who is typing)
  isTyping: boolean
  timestamp: number
}

export function useSupabaseRealtime({
  userId,
  userToken,
  onNewMessage,
  onMessageStatusUpdate,
  onReaction,
  onPresenceUpdate,
  onConversationUpdate,
  onTypingIndicator
}: SupabaseRealtimeOptions): UseSupabaseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false)
  const inboxChannelRef = useRef<RealtimeChannel | null>(null)
  const conversationChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map())
  const queryClient = useQueryClient()
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onNewMessage,
    onMessageStatusUpdate,
    onReaction,
    onPresenceUpdate,
    onConversationUpdate,
    onTypingIndicator
  })

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onMessageStatusUpdate,
      onReaction,
      onPresenceUpdate,
      onConversationUpdate,
      onTypingIndicator
    }
  }, [onNewMessage, onMessageStatusUpdate, onReaction, onPresenceUpdate, onConversationUpdate, onTypingIndicator])

  // Subscribe to user inbox channel for global notifications
  useEffect(() => {
    if (!userId) return

    const inboxChannel = supabase.channel(`user:${userId}:inbox`)

    // Listen for new conversations
    inboxChannel.on('broadcast', { event: 'conversation.new' }, (payload) => {
      console.log('[useSupabaseRealtime] conversation.new received:', payload)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Listen for conversation updates
    inboxChannel.on('broadcast', { event: 'conversation.updated' }, (payload) => {
      console.log('[useSupabaseRealtime] conversation.updated received:', payload)
      const conversation = payload.payload?.conversation
      if (conversation) {
        callbacksRef.current.onConversationUpdate?.(conversation)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Listen for new message notifications (global)
    inboxChannel.on('broadcast', { event: 'message.new' }, (payload) => {
      console.log('[useSupabaseRealtime] message.new (inbox) received:', payload)
      const { message, conversationId, isMuted } = payload.payload || {}
      if (message) {
        const enrichedMessage = {
          ...message,
          conversationId,
          _isMuted: isMuted || false
        }
        callbacksRef.current.onNewMessage?.(enrichedMessage as ChatMessage)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Subscribe to channel
    inboxChannel.subscribe((status) => {
      console.log('[useSupabaseRealtime] Inbox channel status:', status)
      setIsConnected(status === 'SUBSCRIBED')
    })

    inboxChannelRef.current = inboxChannel

    // Cleanup
    return () => {
      inboxChannel.unsubscribe()
      inboxChannelRef.current = null
    }
  }, [userId, queryClient])

  // Join a conversation channel
  const joinConversation = useCallback((conversationId: string) => {
    if (conversationChannelsRef.current.has(conversationId)) {
      return // Already subscribed
    }

    const channel = supabase.channel(`conversation:${conversationId}`)

    // Listen for new messages in this conversation
    channel.on('broadcast', { event: 'message.new' }, (payload) => {
      console.log('[useSupabaseRealtime] message.new received:', payload)
      const { message } = payload.payload || {}
      if (message) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    })

    // Listen for message status updates
    channel.on('broadcast', { event: 'message.status' }, (payload) => {
      console.log('[useSupabaseRealtime] message.status received:', payload)
      const { messageId, status } = payload.payload || {}
      if (messageId && status) {
        callbacksRef.current.onMessageStatusUpdate?.({ messageId, status })
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      }
    })

    // Listen for message updates (edit/delete)
    channel.on('broadcast', { event: 'message.updated' }, (payload) => {
      console.log('[useSupabaseRealtime] message.updated received:', payload)
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    })

    // Listen for reactions
    channel.on('broadcast', { event: 'reaction' }, (payload) => {
      console.log('[useSupabaseRealtime] reaction received:', payload)
      const reaction = payload.payload
      if (reaction) {
        callbacksRef.current.onReaction?.(reaction as MessageReaction)
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      }
    })

    // Listen for conversation updates
    channel.on('broadcast', { event: 'conversation.updated' }, (payload) => {
      console.log('[useSupabaseRealtime] conversation.updated received:', payload)
      const conversation = payload.payload?.conversation
      if (conversation) {
        callbacksRef.current.onConversationUpdate?.(conversation)
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Setup presence for typing indicators
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<TypingUser>()
      // Process typing indicators from presence state
      Object.entries(presenceState).forEach(([key, users]) => {
        users.forEach((user) => {
          if (user.isTyping) {
            callbacksRef.current.onTypingIndicator?.({
              conversationId,
              isTyping: true,
              userId: user.oderId
            })
          }
        })
      })
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      newPresences.forEach((presence: TypingUser) => {
        if (presence.isTyping) {
          callbacksRef.current.onTypingIndicator?.({
            conversationId,
            isTyping: true,
            userId: presence.oderId
          })
        }
      })
    })

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      leftPresences.forEach((presence: TypingUser) => {
        callbacksRef.current.onTypingIndicator?.({
          conversationId,
          isTyping: false,
          userId: presence.oderId
        })
      })
    })

    // Subscribe to channel
    channel.subscribe((status) => {
      console.log(`[useSupabaseRealtime] Conversation ${conversationId} channel status:`, status)
      if (status === 'SUBSCRIBED') {
        // Track presence
        channel.track({ oderId: userId, isTyping: false, timestamp: Date.now() })
      }
    })

    conversationChannelsRef.current.set(conversationId, channel)
  }, [userId, queryClient])

  // Leave a conversation channel
  const leaveConversation = useCallback((conversationId: string) => {
    const channel = conversationChannelsRef.current.get(conversationId)
    if (channel) {
      channel.unsubscribe()
      conversationChannelsRef.current.delete(conversationId)
    }
  }, [])

  // Send typing indicator via presence
  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    const channel = conversationChannelsRef.current.get(conversationId)
    if (channel) {
      channel.track({ oderId: userId, isTyping, timestamp: Date.now() })

      // Auto-expire typing indicator after 5 seconds
      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          channel.track({ oderId: userId, isTyping: false, timestamp: Date.now() })
        }, 5000)
      }
    }
  }, [userId])

  // Send presence state
  const sendPresence = useCallback((conversationId: string, state: PresenceState) => {
    const channel = conversationChannelsRef.current.get(conversationId)
    if (channel) {
      channel.track({ oderId: userId, state, timestamp: Date.now() })
    }
  }, [userId])

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      conversationChannelsRef.current.forEach((channel) => {
        channel.unsubscribe()
      })
      conversationChannelsRef.current.clear()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTypingIndicator,
    sendPresence
  }
}

/**
 * Hook for typing indicator with debounce (same as useChatSocket)
 */
export function useTypingIndicator(
  conversationId: string | null,
  sendTyping: (conversationId: string, isTyping: boolean) => void
) {
  const lastTypingRef = useRef<number>(0)
  const TYPING_DEBOUNCE = 2000 // 2 seconds

  const handleTyping = useCallback(() => {
    if (!conversationId) return

    const now = Date.now()
    if (now - lastTypingRef.current > TYPING_DEBOUNCE) {
      sendTyping(conversationId, true)
      lastTypingRef.current = now
    }
  }, [conversationId, sendTyping])

  const stopTyping = useCallback(() => {
    if (!conversationId) return
    sendTyping(conversationId, false)
    lastTypingRef.current = 0
  }, [conversationId, sendTyping])

  return { handleTyping, stopTyping }
}

export default useSupabaseRealtime
