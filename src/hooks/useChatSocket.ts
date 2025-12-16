/**
 * useChatSocket Hook
 * 
 * Manages WebSocket connection for real-time chat updates
 * 
 * Requirements: 11.1, 11.2, 11.3, 2.5, 15.3, 15.4
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import type { 
  ChatMessage, 
  Conversation, 
  MessageReaction, 
  PresenceState,
  MessageStatus 
} from '@/types/chat'
import { transformKeys } from '@/services/chat'

interface ChatSocketOptions {
  userToken: string
  onNewMessage?: (message: ChatMessage) => void
  onMessageStatusUpdate?: (data: { messageId: string; status: MessageStatus }) => void
  onReaction?: (reaction: MessageReaction) => void
  onPresenceUpdate?: (data: { conversationId: number; state: PresenceState }) => void
  onConversationUpdate?: (conversation: Conversation) => void
  onTypingIndicator?: (data: { conversationId: number; isTyping: boolean }) => void
}

interface UseChatSocketReturn {
  isConnected: boolean
  joinConversation: (conversationId: number) => void
  leaveConversation: (conversationId: number) => void
  sendTypingIndicator: (conversationId: number, isTyping: boolean) => void
  sendPresence: (conversationId: number, state: PresenceState) => void
}

export function useChatSocket({
  userToken,
  onNewMessage,
  onMessageStatusUpdate,
  onReaction,
  onPresenceUpdate,
  onConversationUpdate,
  onTypingIndicator
}: ChatSocketOptions): UseChatSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
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

  // Initialize socket connection - only depends on userToken
  useEffect(() => {
    if (!userToken) return

    // In development, use the current origin (Vite will proxy)
    // In production, use the API base URL or current origin
    const isDev = import.meta.env.DEV
    const apiUrl = isDev 
      ? window.location.origin 
      : (import.meta.env.VITE_API_BASE_URL || window.location.origin)
    
    const socket = io(`${apiUrl}/chat`, {
      auth: { token: userToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io'
    })

    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      console.log('Chat socket connected')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Chat socket disconnected')
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Chat socket connection error:', error)
      setIsConnected(false)
    })

    // Message events - for specific conversation room (message display)
    socket.on('new_message', (rawData: any) => {
      // Transform snake_case to camelCase (is_edited -> isEdited, etc.)
      const data = transformKeys<{ conversationId: number; message: ChatMessage }>(rawData)
      const message = { ...data.message, conversationId: data.conversationId }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages', message.conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Global notification event - for audio notifications (all clients receive this)
    socket.on('new_message_notification', (rawData: any) => {
      console.log('[useChatSocket] new_message_notification received:', rawData)
      // Transform snake_case to camelCase
      const data = transformKeys<{ conversationId: number; message: ChatMessage; isMuted?: boolean }>(rawData)
      // Include isMuted in the message object for notification logic
      const message = { 
        ...data.message, 
        conversationId: data.conversationId,
        _isMuted: data.isMuted || false // Use underscore prefix to indicate it's metadata
      }
      console.log('[useChatSocket] Transformed message:', message)
      // Call the notification callback for audio alerts
      callbacksRef.current.onNewMessage?.(message as ChatMessage)
      // Also invalidate queries in case user is not in the conversation room
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    socket.on('message_status_update', (data: { messageId: string; conversationId: number; status: MessageStatus }) => {
      callbacksRef.current.onMessageStatusUpdate?.(data)
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] })
    })

    // Message update events (edit/delete)
    // Requirements: 5.1 (websocket-data-transformation-fix) - apply transformKeys for consistent format
    socket.on('message_update', (rawData: unknown) => {
      const data = transformKeys<{ 
        conversationId: number; 
        id: number; 
        content?: string; 
        isEdited?: boolean; 
        isDeleted?: boolean 
      }>(rawData)
      // Invalidate queries to refresh data with updated message
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] })
    })

    socket.on('reaction', (reaction: MessageReaction & { conversationId: number }) => {
      callbacksRef.current.onReaction?.(reaction)
      queryClient.invalidateQueries({ queryKey: ['messages', reaction.conversationId] })
    })

    // Presence events
    socket.on('presence', (data: { conversationId: number; contactJid: string; state: PresenceState }) => {
      callbacksRef.current.onPresenceUpdate?.(data)
    })

    socket.on('typing', (data: { conversationId: number; userId: number; isTyping: boolean }) => {
      callbacksRef.current.onTypingIndicator?.(data)
    })

    // Conversation events
    // Requirements: 5.2 (websocket-data-transformation-fix) - apply transformKeys for consistent format
    socket.on('conversation_update', (rawData: unknown) => {
      const data = transformKeys<{ conversation: Conversation }>(rawData)
      callbacksRef.current.onConversationUpdate?.(data.conversation)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })

    // Cleanup
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userToken, queryClient])

  // Join a conversation room
  const joinConversation = useCallback((conversationId: number) => {
    socketRef.current?.emit('join_conversation', { conversationId })
  }, [])

  // Leave a conversation room
  const leaveConversation = useCallback((conversationId: number) => {
    socketRef.current?.emit('leave_conversation', { conversationId })
  }, [])

  // Send typing indicator with auto-expire
  const sendTypingIndicator = useCallback((conversationId: number, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId, isTyping })

    // Auto-expire typing indicator after 5 seconds
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', { conversationId, isTyping: false })
      }, 5000)
    }
  }, [])

  // Send presence state
  const sendPresence = useCallback((conversationId: number, state: PresenceState) => {
    socketRef.current?.emit('presence', { conversationId, state })
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
 * Hook for typing indicator with debounce
 */
export function useTypingIndicator(
  conversationId: number | null,
  sendTyping: (conversationId: number, isTyping: boolean) => void
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

export default useChatSocket
