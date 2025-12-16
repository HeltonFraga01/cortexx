/**
 * useSupabaseChat Hook
 * Task 16.4: Integrate realtime subscriptions in chat components
 * 
 * React hook for managing chat state with Supabase realtime subscriptions.
 * Provides conversations list, messages, and automatic updates.
 * 
 * Requirements: 4.1, 4.2, 6.1, 6.2
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  subscribeToConversationList,
  subscribeToMessages,
  unsubscribeAll
} from '@/lib/supabase-realtime'
import {
  getConversations,
  getMessages,
  getConversation,
  markConversationAsRead,
  updateConversation,
  type ConversationWithRelations,
  type MessageWithRelations,
  type ConversationFilters
} from '@/services/chat-supabase'
import type { Database } from '@/types/supabase'

type Conversation = Database['public']['Tables']['conversations']['Row']
type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

interface UseConversationsOptions {
  accountId: string
  filters?: ConversationFilters
  limit?: number
  enableRealtime?: boolean
}

interface UseConversationsReturn {
  conversations: ConversationWithRelations[]
  isLoading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook for managing conversations list with realtime updates
 */
export function useConversations(options: UseConversationsOptions): UseConversationsReturn {
  const { accountId, filters = {}, limit = 20, enableRealtime = true } = options
  
  const [conversations, setConversations] = useState<ConversationWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Load conversations
  const loadConversations = useCallback(async (reset = false) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await getConversations(
        accountId,
        filtersRef.current,
        { limit, cursor: reset ? null : cursor }
      )
      
      if (reset) {
        setConversations(response.conversations)
      } else {
        setConversations(prev => [...prev, ...response.conversations])
      }
      
      setCursor(response.pagination.cursor)
      setHasMore(response.pagination.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load conversations'))
    } finally {
      setIsLoading(false)
    }
  }, [accountId, limit, cursor])

  // Initial load
  useEffect(() => {
    loadConversations(true)
  }, [accountId, JSON.stringify(filters)])

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime || !accountId) return

    const unsubscribe = subscribeToConversationList(
      accountId,
      (conversation: Conversation, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
        setConversations(prev => {
          switch (eventType) {
            case 'INSERT':
              // Add new conversation at the top
              return [conversation as ConversationWithRelations, ...prev]
            
            case 'UPDATE':
              // Update existing conversation and re-sort
              const updated = prev.map(c => 
                c.id === conversation.id ? { ...c, ...conversation } : c
              )
              return updated.sort((a, b) => {
                const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                return bTime - aTime
              })
            
            case 'DELETE':
              return prev.filter(c => c.id !== conversation.id)
            
            default:
              return prev
          }
        })
      }
    )

    return () => {
      unsubscribe()
    }
  }, [accountId, enableRealtime])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    await loadConversations(false)
  }, [hasMore, isLoading, loadConversations])

  const refresh = useCallback(async () => {
    setCursor(null)
    await loadConversations(true)
  }, [loadConversations])

  return {
    conversations,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh
  }
}

interface UseMessagesOptions {
  conversationId: string | null
  limit?: number
  enableRealtime?: boolean
}

interface UseMessagesReturn {
  messages: MessageWithRelations[]
  isLoading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  addOptimisticMessage: (message: Partial<MessageWithRelations>) => void
}

/**
 * Hook for managing messages with realtime updates
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const { conversationId, limit = 50, enableRealtime = true } = options
  
  const [messages, setMessages] = useState<MessageWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Load messages
  const loadMessages = useCallback(async (reset = false) => {
    if (!conversationId) return
    
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await getMessages(
        conversationId,
        { limit, cursor: reset ? null : cursor }
      )
      
      if (reset) {
        setMessages(response.messages)
      } else {
        // Prepend older messages
        setMessages(prev => [...response.messages, ...prev])
      }
      
      setCursor(response.pagination.cursor)
      setHasMore(response.pagination.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load messages'))
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, limit, cursor])

  // Initial load when conversation changes
  useEffect(() => {
    if (conversationId) {
      setCursor(null)
      setMessages([])
      loadMessages(true)
    }
  }, [conversationId])

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime || !conversationId) return

    const unsubscribe = subscribeToMessages(conversationId, {
      onInsert: (payload) => {
        if (payload.new) {
          const newMessage = payload.new as MessageWithRelations
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
        }
      },
      onUpdate: (payload) => {
        if (payload.new) {
          const updatedMessage = payload.new as MessageWithRelations
          setMessages(prev => 
            prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m)
          )
        }
      },
      onDelete: (payload) => {
        if (payload.old) {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as ChatMessage).id))
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [conversationId, enableRealtime])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    await loadMessages(false)
  }, [hasMore, isLoading, loadMessages])

  const refresh = useCallback(async () => {
    setCursor(null)
    await loadMessages(true)
  }, [loadMessages])

  // Add optimistic message (for immediate UI feedback)
  const addOptimisticMessage = useCallback((message: Partial<MessageWithRelations>) => {
    const optimisticMessage: MessageWithRelations = {
      id: `optimistic_${Date.now()}`,
      conversation_id: conversationId!,
      message_id: `temp_${Date.now()}`,
      direction: 'outgoing',
      message_type: 'text',
      content: '',
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      media_duration_seconds: null,
      reply_to_message_id: null,
      status: 'pending',
      is_private_note: false,
      sender_type: 'user',
      sender_agent_id: null,
      sender_bot_id: null,
      metadata: null,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ...message
    }
    
    setMessages(prev => [...prev, optimisticMessage])
  }, [conversationId])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    addOptimisticMessage
  }
}

interface UseConversationOptions {
  conversationId: string | null
  enableRealtime?: boolean
  autoMarkAsRead?: boolean
}

interface UseConversationReturn {
  conversation: ConversationWithRelations | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  update: (updates: Partial<Conversation>) => Promise<void>
  markAsRead: () => Promise<void>
}

/**
 * Hook for managing a single conversation with realtime updates
 */
export function useConversation(options: UseConversationOptions): UseConversationReturn {
  const { conversationId, enableRealtime = true, autoMarkAsRead = true } = options
  
  const [conversation, setConversation] = useState<ConversationWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Load conversation
  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      setConversation(null)
      return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const data = await getConversation(conversationId)
      setConversation(data)
      
      // Auto mark as read
      if (autoMarkAsRead && data && data.unread_count > 0) {
        await markConversationAsRead(conversationId)
        setConversation(prev => prev ? { ...prev, unread_count: 0 } : null)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load conversation'))
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, autoMarkAsRead])

  // Initial load
  useEffect(() => {
    loadConversation()
  }, [conversationId])

  // Realtime subscription for this specific conversation
  useEffect(() => {
    if (!enableRealtime || !conversationId) return

    const unsubscribe = subscribeToConversationList(
      conversation?.account_id || '',
      (conv: Conversation, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => {
        if (conv.id !== conversationId) return
        
        if (eventType === 'UPDATE') {
          setConversation(prev => prev ? { ...prev, ...conv } : null)
        } else if (eventType === 'DELETE') {
          setConversation(null)
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [conversationId, conversation?.account_id, enableRealtime])

  const update = useCallback(async (updates: Partial<Conversation>) => {
    if (!conversationId) return
    
    try {
      const updated = await updateConversation(conversationId, updates)
      setConversation(updated)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update conversation'))
      throw err
    }
  }, [conversationId])

  const markAsRead = useCallback(async () => {
    if (!conversationId) return
    
    try {
      await markConversationAsRead(conversationId)
      setConversation(prev => prev ? { ...prev, unread_count: 0 } : null)
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }, [conversationId])

  return {
    conversation,
    isLoading,
    error,
    refresh: loadConversation,
    update,
    markAsRead
  }
}

/**
 * Hook to cleanup all realtime subscriptions on unmount
 */
export function useCleanupRealtimeSubscriptions(): void {
  useEffect(() => {
    return () => {
      unsubscribeAll()
    }
  }, [])
}

export default {
  useConversations,
  useMessages,
  useConversation,
  useCleanupRealtimeSubscriptions
}
