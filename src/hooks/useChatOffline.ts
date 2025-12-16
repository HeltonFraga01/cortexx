/**
 * useChatOffline Hook
 * 
 * Provides offline support for chat messages:
 * - Caches messages in localStorage
 * - Queues outgoing messages when offline
 * - Syncs on reconnection
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage } from '@/types/chat'

const CACHE_KEY_PREFIX = 'chat_messages_'
const QUEUE_KEY = 'chat_message_queue'
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface QueuedMessage {
  id: string
  conversationId: number
  content: string
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact'
  replyToMessageId?: string
  createdAt: string
  retryCount: number
}

interface CachedMessages {
  messages: ChatMessage[]
  timestamp: number
}

interface UseChatOfflineOptions {
  onSendMessage: (message: QueuedMessage) => Promise<void>
  isConnected: boolean
}

interface UseChatOfflineReturn {
  isOnline: boolean
  queuedMessages: QueuedMessage[]
  getCachedMessages: (conversationId: number) => ChatMessage[]
  cacheMessages: (conversationId: number, messages: ChatMessage[]) => void
  queueMessage: (message: Omit<QueuedMessage, 'id' | 'createdAt' | 'retryCount'>) => void
  clearCache: (conversationId?: number) => void
  syncQueue: () => Promise<void>
}

export function useChatOffline({
  onSendMessage,
  isConnected
}: UseChatOfflineOptions): UseChatOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
  const isSyncing = useRef(false)

  // Load queued messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as QueuedMessage[]
        setQueuedMessages(parsed)
      } catch {
        localStorage.removeItem(QUEUE_KEY)
      }
    }
  }, [])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Save queued messages to localStorage
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queuedMessages))
  }, [queuedMessages])

  // Get cached messages for a conversation
  const getCachedMessages = useCallback((conversationId: number): ChatMessage[] => {
    const key = `${CACHE_KEY_PREFIX}${conversationId}`
    const stored = localStorage.getItem(key)
    
    if (!stored) return []
    
    try {
      const cached = JSON.parse(stored) as CachedMessages
      
      // Check if cache is expired
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(key)
        return []
      }
      
      return cached.messages
    } catch {
      localStorage.removeItem(key)
      return []
    }
  }, [])

  // Cache messages for a conversation
  const cacheMessages = useCallback((conversationId: number, messages: ChatMessage[]) => {
    const key = `${CACHE_KEY_PREFIX}${conversationId}`
    const cached: CachedMessages = {
      messages,
      timestamp: Date.now()
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(cached))
    } catch (error) {
      // localStorage might be full, try to clear old caches
      clearOldCaches()
      try {
        localStorage.setItem(key, JSON.stringify(cached))
      } catch {
        // Still failed, ignore
      }
    }
  }, [])

  // Queue a message for sending when back online
  const queueMessage = useCallback((
    message: Omit<QueuedMessage, 'id' | 'createdAt' | 'retryCount'>
  ) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0
    }
    
    setQueuedMessages(prev => [...prev, queuedMessage])
  }, [])

  // Clear cache for a specific conversation or all
  const clearCache = useCallback((conversationId?: number) => {
    if (conversationId) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${conversationId}`)
    } else {
      // Clear all chat caches
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    }
  }, [])

  // Sync queued messages when back online
  const syncQueue = useCallback(async () => {
    if (isSyncing.current || queuedMessages.length === 0) return
    
    isSyncing.current = true
    const failedMessages: QueuedMessage[] = []
    
    for (const message of queuedMessages) {
      try {
        await onSendMessage(message)
      } catch (error) {
        // Increment retry count and keep in queue if under limit
        if (message.retryCount < 3) {
          failedMessages.push({
            ...message,
            retryCount: message.retryCount + 1
          })
        }
        // Messages with 3+ retries are dropped
      }
    }
    
    setQueuedMessages(failedMessages)
    isSyncing.current = false
  }, [queuedMessages, onSendMessage])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && isConnected && queuedMessages.length > 0) {
      syncQueue()
    }
  }, [isOnline, isConnected, queuedMessages.length, syncQueue])

  return {
    isOnline,
    queuedMessages,
    getCachedMessages,
    cacheMessages,
    queueMessage,
    clearCache,
    syncQueue
  }
}

// Helper to clear old caches when localStorage is full
function clearOldCaches() {
  const keys = Object.keys(localStorage)
  const chatKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX))
  
  // Sort by timestamp (oldest first) and remove half
  const caches = chatKeys.map(key => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}') as CachedMessages
      return { key, timestamp: cached.timestamp || 0 }
    } catch {
      return { key, timestamp: 0 }
    }
  }).sort((a, b) => a.timestamp - b.timestamp)
  
  const toRemove = Math.ceil(caches.length / 2)
  caches.slice(0, toRemove).forEach(({ key }) => {
    localStorage.removeItem(key)
  })
}

export default useChatOffline
