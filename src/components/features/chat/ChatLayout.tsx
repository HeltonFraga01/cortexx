/**
 * ChatLayout Component
 * 
 * Main layout for the chat interface with 3-column design:
 * - Left: Inbox sidebar with conversation list
 * - Center: Conversation view with messages
 * - Right: Contact panel with details
 * 
 * Requirements: 10.1, 10.2, 10.3, 11.1, 14.1, 14.2
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getAgentToken } from '@/services/agent-auth'
import { InboxSidebar } from './InboxSidebar'
import { ConversationView } from './ConversationView'
import { ContactPanel } from './ContactPanel'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useChatKeyboardShortcuts } from '@/hooks/useChatKeyboardShortcuts'
import { useAudioNotification } from '@/hooks/useAudioNotification'
import { useChatApi } from '@/hooks/useChatApi'
import type { Conversation, ChatMessage, PresenceState, ConversationsResponse } from '@/types/chat'

interface ChatLayoutProps {
  className?: string
  isAgentMode?: boolean
}

export function ChatLayout({ className, isAgentMode = false }: ChatLayoutProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const chatApi = useChatApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [presenceStates, setPresenceStates] = useState<Record<number, PresenceState>>({})
  const [typingIndicators, setTypingIndicators] = useState<Record<number, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialConversationLoaded = useRef(false)

  // Sync selected conversation with cache updates (for optimistic updates)
  useEffect(() => {
    if (!selectedConversation) return

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'conversations') {
        const data = event.query.state.data as ConversationsResponse | undefined
        if (data?.conversations) {
          const updatedConversation = data.conversations.find(
            (c) => c.id === selectedConversation.id
          )
          if (updatedConversation) {
            // Only update if something actually changed
            const hasChanged = 
              updatedConversation.status !== selectedConversation.status ||
              updatedConversation.isMuted !== selectedConversation.isMuted ||
              updatedConversation.assignedBotId !== selectedConversation.assignedBotId ||
              JSON.stringify(updatedConversation.labels) !== JSON.stringify(selectedConversation.labels)
            
            if (hasChanged) {
              setSelectedConversation(updatedConversation)
            }
          }
        }
      }
    })

    return () => unsubscribe()
  }, [queryClient, selectedConversation])

  // Audio notification for new messages
  const { playNotification } = useAudioNotification()

  // Load conversation from URL parameter on mount
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId && !initialConversationLoaded.current) {
      initialConversationLoaded.current = true
      const loadConversation = async () => {
        try {
          const conversation = await chatApi.getConversation(parseInt(conversationId, 10))
          if (conversation) {
            setSelectedConversation(conversation)
          }
        } catch (error) {
          console.error('Failed to load conversation from URL:', error)
        }
        // Clear the URL parameter after loading
        setSearchParams({}, { replace: true })
      }
      loadConversation()
    }
  }, [searchParams, setSearchParams, chatApi])

  // Memoize the user token to prevent unnecessary reconnections
  // Use agent token if in agent mode, otherwise use user token
  const userToken = useMemo(() => {
    if (isAgentMode) {
      return getAgentToken() || ''
    }
    return user?.token || ''
  }, [user?.token, isAgentMode])

  // Refs for notification logic to avoid stale closures
  const selectedConversationIdRef = useRef<number | null>(null)
  
  // Keep ref updated
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null
  }, [selectedConversation?.id])

  // Memoize callbacks to prevent hook re-initialization
  const handleNewMessage = useCallback((message: ChatMessage) => {
    console.log('[ChatLayout] handleNewMessage called:', message)
    // Play notification sound for incoming messages
    // Only play if:
    // 1. Message is incoming (not sent by us)
    // 2. Message is not from the currently selected conversation OR window is not visible
    // 3. Conversation is not muted
    const isIncoming = message.direction === 'incoming'
    const currentConversationId = selectedConversationIdRef.current
    const isFromCurrentConversation = message.conversationId === currentConversationId
    const windowVisible = !document.hidden
    // Check if conversation is muted (passed from WebSocket event)
    const isMuted = (message as ChatMessage & { _isMuted?: boolean })._isMuted || false
    const shouldPlaySound = isIncoming && !isMuted && (!isFromCurrentConversation || !windowVisible)
    
    console.log('[ChatLayout] Notification check:', { isIncoming, currentConversationId, isFromCurrentConversation, windowVisible, isMuted, shouldPlaySound })
    
    if (shouldPlaySound) {
      console.log('[ChatLayout] Playing notification sound')
      playNotification()
    }
  }, [playNotification])

  const handlePresenceUpdate = useCallback(({ conversationId, state }: { conversationId: number; state: PresenceState }) => {
    setPresenceStates(prev => ({ ...prev, [conversationId]: state }))
  }, [])

  const handleTypingIndicator = useCallback(({ conversationId, isTyping }: { conversationId: number; isTyping: boolean }) => {
    setTypingIndicators(prev => ({ ...prev, [conversationId]: isTyping }))
  }, [])

  // WebSocket connection
  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTypingIndicator,
    sendPresence
  } = useChatSocket({
    userToken,
    onNewMessage: handleNewMessage,
    onPresenceUpdate: handlePresenceUpdate,
    onTypingIndicator: handleTypingIndicator
  })

  // Keyboard shortcuts
  useChatKeyboardShortcuts({
    onSearch: () => {
      setIsSearchOpen(true)
      setTimeout(() => searchInputRef.current?.focus(), 100)
    },
    onEscape: () => {
      if (isSearchOpen) {
        setIsSearchOpen(false)
      } else if (isContactPanelOpen && selectedConversation) {
        setIsContactPanelOpen(false)
      }
    },
    enabled: true
  })

  // Join/leave conversation rooms
  useEffect(() => {
    if (selectedConversation) {
      joinConversation(selectedConversation.id)
      return () => leaveConversation(selectedConversation.id)
    }
  }, [selectedConversation, joinConversation, leaveConversation])

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    // Auto-pickup unassigned conversations in agent mode - Requirements: 2.3
    if (chatApi.isAgentMode && !conversation.assignedAgentId && chatApi.pickupConversation) {
      try {
        await chatApi.pickupConversation(conversation.id)
        // Refresh conversation data after pickup
        const updatedConversation = await chatApi.getConversation(conversation.id)
        setSelectedConversation(updatedConversation)
        // Invalidate conversations cache to update the list
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        return
      } catch (error) {
        // If pickup fails (409 conflict), still select the conversation
        console.warn('Auto-pickup failed:', error)
      }
    }
    setSelectedConversation(conversation)
  }, [chatApi, queryClient])

  const handleCloseConversation = useCallback(() => {
    setSelectedConversation(null)
  }, [])

  const toggleContactPanel = useCallback(() => {
    setIsContactPanelOpen(prev => !prev)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Inbox Sidebar */}
      <div
        className={cn(
          'flex-shrink-0 border-r transition-all duration-300',
          isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'
        )}
      >
        <InboxSidebar
          selectedConversationId={selectedConversation?.id}
          onSelectConversation={handleSelectConversation}
          onCollapse={toggleSidebar}
          isSearchOpen={isSearchOpen}
          onSearchOpenChange={setIsSearchOpen}
          searchInputRef={searchInputRef}
          isConnected={isConnected}
        />
      </div>

      {/* Conversation View */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <ConversationView
            conversation={selectedConversation}
            onClose={handleCloseConversation}
            onToggleContactPanel={toggleContactPanel}
            isContactPanelOpen={isContactPanelOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            presence={presenceStates[selectedConversation.id]}
            isTyping={typingIndicators[selectedConversation.id]}
            onTyping={(isTyping) => sendTypingIndicator(selectedConversation.id, isTyping)}
            onPresence={(state) => sendPresence(selectedConversation.id, state)}
            isConnected={isConnected}
          />
        ) : (
          <EmptyState onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        )}
      </div>

      {/* Contact Panel */}
      {selectedConversation && (
        <div
          className={cn(
            'flex-shrink-0 border-l transition-all duration-300',
            isContactPanelOpen ? 'w-80' : 'w-0 overflow-hidden'
          )}
        >
          <ContactPanel
            conversation={selectedConversation}
            onClose={toggleContactPanel}
          />
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  onToggleSidebar: () => void
  isSidebarCollapsed: boolean
}

function EmptyState({ onToggleSidebar, isSidebarCollapsed }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        {isSidebarCollapsed && (
          <button
            onClick={onToggleSidebar}
            className="mb-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Mostrar conversas
          </button>
        )}
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">
            Selecione uma conversa
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma conversa na lista para começar a enviar mensagens
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChatLayout
