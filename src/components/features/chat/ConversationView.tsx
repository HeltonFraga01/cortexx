/**
 * ConversationView Component
 * 
 * Displays the message list and input for a conversation
 * 
 * Requirements: 1.4, 2.1, 4.1, 4.2, 4.4, 4.5, 7.2, 12.4, 15.1, 15.2
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { useChatApi } from '@/hooks/useChatApi'
import type { Conversation, ChatMessage, PresenceState, ConversationStatus } from '@/types/chat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { 
  Menu, 
  PanelRightClose, 
  PanelRightOpen, 
  Search, 
  MoreVertical,
  X,
  CheckCircle,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  Bell,
  BellOff,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { 
  updateConversationInCache,
  updateConversationMutedInCache,
  updateConversationStatusInCache
} from '@/lib/conversation-cache'
import type { ConversationsResponse } from '@/types/chat'

interface ConversationViewProps {
  conversation: Conversation
  onClose: () => void
  onToggleContactPanel: () => void
  isContactPanelOpen: boolean
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  presence?: PresenceState | null
  isTyping?: boolean
  onTyping?: (isTyping: boolean) => void
  onPresence?: (state: PresenceState) => void
  isConnected?: boolean
}

export function ConversationView({
  conversation,
  onClose,
  onToggleContactPanel,
  isContactPanelOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  presence: externalPresence,
  isTyping: externalIsTyping,
  onTyping,
  onPresence,
  isConnected
}: ConversationViewProps) {
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstUnreadRef = useRef<HTMLDivElement>(null)
  const previousConversationId = useRef<number | null>(null)
  const queryClient = useQueryClient()
  
  // Get the appropriate chat API based on context (user or agent)
  const chatApi = useChatApi()

  // Update conversation status mutation with optimistic update
  const updateStatusMutation = useMutation({
    mutationFn: (status: ConversationStatus) => chatApi.updateConversation(conversation.id, { status }),
    onMutate: async (status) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      // Snapshot previous values for all filter variations
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      // Optimistically update all conversation caches
      conversationQueries.forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
          updateConversationStatusInCache(old, conversation.id, status)
        )
      })
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          const queryKey = JSON.parse(key)
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Erro ao atualizar status')
    },
    onSuccess: (_, status) => {
      const statusMessages: Record<ConversationStatus, string> = {
        resolved: 'Conversa marcada como resolvida',
        open: 'Conversa reaberta',
        pending: 'Conversa marcada como pendente',
        snoozed: 'Conversa adiada'
      }
      toast.success(statusMessages[status])
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: () => chatApi.deleteConversation(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversa excluída com sucesso')
      onClose()
    },
    onError: () => {
      toast.error('Erro ao excluir conversa')
    }
  })

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string | number) => chatApi.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
      toast.success('Mensagem excluída com sucesso')
    },
    onError: () => {
      toast.error('Erro ao excluir mensagem')
    }
  })

  // Mute conversation mutation with optimistic update
  const muteMutation = useMutation({
    mutationFn: (muted: boolean) => chatApi.muteConversation(conversation.id, muted),
    onMutate: async (muted) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      // Snapshot previous values for all filter variations
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      // Optimistically update all conversation caches
      conversationQueries.forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
          updateConversationMutedInCache(old, conversation.id, muted)
        )
      })
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          const queryKey = JSON.parse(key)
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error('Erro ao silenciar conversa')
    },
    onSuccess: (_, muted) => {
      toast.success(muted ? 'Conversa silenciada' : 'Notificações ativadas')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
  
  // Use external presence if provided, otherwise use local state
  const presence = externalPresence || null

  // Fetch messages using the appropriate API (user or agent)
  const {
    data: messagesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['messages', conversation.id, chatApi.isAgentMode],
    queryFn: () => chatApi.getMessages(conversation.id, { limit: 50 }),
    staleTime: 10000
  })

  // Task 7.1: Send message mutation with optimistic updates
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => chatApi.sendTextMessage(conversation.id, {
      content,
      replyToMessageId: replyToMessage?.id.toString()
    }),
    onMutate: async (content) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', conversation.id] })
      
      // Snapshot previous messages
      const previousMessages = queryClient.getQueryData(['messages', conversation.id, chatApi.isAgentMode])
      
      // Create optimistic message with 'sending' status
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversationId: conversation.id,
        content,
        messageType: 'text',
        direction: 'outgoing',
        status: 'sending',
        timestamp: new Date().toISOString(),
        replyToMessage: replyToMessage || undefined,
        isEdited: false,
        reactions: []
      }
      
      // Optimistically add message to cache
      queryClient.setQueryData(
        ['messages', conversation.id, chatApi.isAgentMode],
        (old: { messages: ChatMessage[] } | undefined) => {
          if (!old) return { messages: [optimisticMessage] }
          return { messages: [...old.messages, optimisticMessage] }
        }
      )
      
      // Scroll to bottom for new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
      
      return { previousMessages, optimisticMessageId: optimisticMessage.id }
    },
    onError: (err, content, context) => {
      // Rollback on error - mark message as failed instead of removing
      if (context?.optimisticMessageId) {
        queryClient.setQueryData(
          ['messages', conversation.id, chatApi.isAgentMode],
          (old: { messages: ChatMessage[] } | undefined) => {
            if (!old) return old
            return {
              messages: old.messages.map(msg => 
                msg.id === context.optimisticMessageId 
                  ? { ...msg, status: 'failed' as const }
                  : msg
              )
            }
          }
        )
      }
      toast.error('Erro ao enviar mensagem', { 
        description: 'Clique no ícone de erro para tentar novamente'
      })
    },
    onSuccess: (data, content, context) => {
      // Remove optimistic message and let the real one come from invalidation
      queryClient.setQueryData(
        ['messages', conversation.id, chatApi.isAgentMode],
        (old: { messages: ChatMessage[] } | undefined) => {
          if (!old) return old
          return {
            messages: old.messages.filter(msg => msg.id !== context?.optimisticMessageId)
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setReplyToMessage(null)
    }
  })

  // Reset scroll state when conversation changes
  useEffect(() => {
    if (previousConversationId.current !== conversation.id) {
      setHasScrolledToUnread(false)
      previousConversationId.current = conversation.id
    }
  }, [conversation.id])

  // Mark as read when conversation is opened (with delay to allow scroll first)
  useEffect(() => {
    if (conversation.unreadCount > 0 && hasScrolledToUnread) {
      // Delay marking as read to allow user to see unread messages first
      const timer = setTimeout(() => {
        chatApi.markConversationAsRead(conversation.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [conversation.id, conversation.unreadCount, hasScrolledToUnread, queryClient])

  // Scroll to first unread message or bottom
  useEffect(() => {
    if (!messagesData?.messages || messagesData.messages.length === 0) return
    
    // Use setTimeout to ensure DOM is updated after render
    const timer = setTimeout(() => {
      // If we haven't scrolled yet and there are unread messages, scroll to first unread
      if (!hasScrolledToUnread && conversation.unreadCount > 0 && firstUnreadRef.current) {
        firstUnreadRef.current.scrollIntoView({ behavior: 'instant', block: 'center' })
        setHasScrolledToUnread(true)
      } else if (!hasScrolledToUnread) {
        // No unread messages, scroll to bottom
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        setHasScrolledToUnread(true)
      } else {
        // Already scrolled, only scroll to bottom for new messages
        // Check if user is near bottom before auto-scrolling
        const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainer
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
          if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [messagesData?.messages, conversation.unreadCount, hasScrolledToUnread])

  const handleSendMessage = useCallback((content: string) => {
    if (content.trim()) {
      sendMessageMutation.mutate(content)
    }
  }, [sendMessageMutation])

  const handleReply = useCallback((message: ChatMessage) => {
    setReplyToMessage(message)
  }, [])

  const handleDeleteMessage = useCallback((message: ChatMessage) => {
    if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
      deleteMessageMutation.mutate(message.id)
    }
  }, [deleteMessageMutation])

  // Task 7.2: Handle retry for failed messages
  const handleRetryMessage = useCallback((message: ChatMessage) => {
    if (message.content && message.status === 'failed') {
      // Remove the failed message from cache
      queryClient.setQueryData(
        ['messages', conversation.id, chatApi.isAgentMode],
        (old: { messages: ChatMessage[] } | undefined) => {
          if (!old) return old
          return {
            messages: old.messages.filter(msg => msg.id !== message.id)
          }
        }
      )
      // Resend the message
      sendMessageMutation.mutate(message.content)
    }
  }, [conversation.id, chatApi.isAgentMode, queryClient, sendMessageMutation])

  const cancelReply = useCallback(() => {
    setReplyToMessage(null)
  }, [])

  const displayName = conversation.contactName || 
    conversation.contactJid.replace('@s.whatsapp.net', '')

  const initials = conversation.contactName
    ? conversation.contactName.slice(0, 2).toUpperCase()
    : conversation.contactJid.slice(0, 2).toUpperCase()

  const messages = messagesData?.messages || []

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - h-14 for uniformity */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b bg-background">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleSidebar}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
          
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.contactAvatarUrl || undefined} loading="lazy" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium truncate">{displayName}</h3>
              {conversation.isMuted && (
                <BellOff className="h-3.5 w-3.5 text-muted-foreground" title="Conversa silenciada" />
              )}
              {conversation.status !== 'open' && (
                <span className={cn(
                  'px-1.5 py-0.5 text-[10px] font-medium rounded',
                  conversation.status === 'resolved' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  conversation.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  conversation.status === 'snoozed' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                )}>
                  {conversation.status === 'resolved' && 'Resolvida'}
                  {conversation.status === 'pending' && 'Pendente'}
                  {conversation.status === 'snoozed' && 'Adiada'}
                </span>
              )}
            </div>
            {presence && (
              <p className="text-xs text-muted-foreground">
                {getPresenceText(presence)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSearchOpen(!isSearchOpen)}>
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={onToggleContactPanel}
          >
            {isContactPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {conversation.status === 'resolved' ? (
                <DropdownMenuItem 
                  onClick={() => updateStatusMutation.mutate('open')}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reabrir conversa
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => updateStatusMutation.mutate('resolved')}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Marcar como resolvida
                </DropdownMenuItem>
              )}
              
              {conversation.status === 'snoozed' ? (
                <DropdownMenuItem 
                  onClick={() => updateStatusMutation.mutate('open')}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Reativar conversa
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => updateStatusMutation.mutate('snoozed')}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellOff className="h-4 w-4 mr-2" />
                  )}
                  Adiar conversa
                </DropdownMenuItem>
              )}
              
              {conversation.isMuted ? (
                <DropdownMenuItem 
                  onClick={() => muteMutation.mutate(false)}
                  disabled={muteMutation.isPending}
                >
                  {muteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Ativar notificações
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => muteMutation.mutate(true)}
                  disabled={muteMutation.isPending}
                >
                  {muteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellOff className="h-4 w-4 mr-2" />
                  )}
                  Silenciar conversa
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem 
                onClick={() => updateStatusMutation.mutate('pending')}
                disabled={updateStatusMutation.isPending || conversation.status === 'pending'}
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                Marcar como pendente
              </DropdownMenuItem>
              
              {/* Delete option - only visible in user mode (Requirements: 3.1, 3.2, 3.4) */}
              {!chatApi.isAgentMode && (
                <>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir conversa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete confirmation dialog - only rendered in user mode (Requirement: 3.3) */}
      {!chatApi.isAgentMode && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão permanentemente excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  deleteConversationMutation.mutate()
                  setShowDeleteDialog(false)
                }}
                disabled={deleteConversationMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Search bar */}
      {isSearchOpen && (
        <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-background border rounded-md"
              autoFocus
            />
            <button
              onClick={() => {
                setIsSearchOpen(false)
                setSearchQuery('')
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef} constrainWidth>
        {isLoading ? (
          <MessagesSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-destructive">Erro ao carregar mensagens</p>
              <Button variant="link" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Comece a conversa!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Calculate first unread message index
              const allMessages = messages
              const unreadCount = conversation.unreadCount || 0
              const firstUnreadIndex = unreadCount > 0 ? Math.max(0, allMessages.length - unreadCount) : -1
              let globalIndex = 0
              let hasShownUnreadDivider = false

              return Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date}>
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                      {date}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dateMessages.map((message, index) => {
                      const currentGlobalIndex = globalIndex++
                      const isFirstUnread = currentGlobalIndex === firstUnreadIndex && !hasShownUnreadDivider
                      
                      if (isFirstUnread) {
                        hasShownUnreadDivider = true
                      }
                      
                      // Check if this is a group conversation
                      const isGroupConversation = conversation.contactJid.endsWith('@g.us')
                      
                      // Determine if we should show participant name
                      const previousMessage = index > 0 ? dateMessages[index - 1] : null
                      const nextMessage = index < dateMessages.length - 1 ? dateMessages[index + 1] : null
                      const showParticipant = isGroupConversation && 
                        message.direction === 'incoming' &&
                        (previousMessage?.direction !== 'incoming' ||
                         previousMessage.participantJid !== message.participantJid)
                      
                      // Task 2.2: Calculate message grouping
                      const isSameSenderAsPrevious = previousMessage && 
                        previousMessage.direction === message.direction &&
                        (!isGroupConversation || previousMessage.participantJid === message.participantJid)
                      
                      const isSameSenderAsNext = nextMessage && 
                        nextMessage.direction === message.direction &&
                        (!isGroupConversation || nextMessage.participantJid === message.participantJid)
                      
                      // Check time gap (group messages within 2 minutes)
                      const timeDiffPrev = previousMessage 
                        ? Math.abs(new Date(message.timestamp).getTime() - new Date(previousMessage.timestamp).getTime()) 
                        : Infinity
                      const timeDiffNext = nextMessage 
                        ? Math.abs(new Date(nextMessage.timestamp).getTime() - new Date(message.timestamp).getTime()) 
                        : Infinity
                      
                      const isGroupedWithPrevious = isSameSenderAsPrevious && timeDiffPrev < 120000 // 2 minutes
                      const isGroupedWithNext = isSameSenderAsNext && timeDiffNext < 120000
                      
                      const isGrouped = isGroupedWithPrevious || isGroupedWithNext
                      const isFirstInGroup = !isGroupedWithPrevious
                      const isLastInGroup = !isGroupedWithNext
                      
                      return (
                        <div key={message.id}>
                          {/* Unread messages divider */}
                          {isFirstUnread && (
                            <div 
                              ref={firstUnreadRef}
                              className="flex items-center gap-3 my-4"
                            >
                              <div className="flex-1 h-px bg-primary/50" />
                              <span className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">
                                {unreadCount} {unreadCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
                              </span>
                              <div className="flex-1 h-px bg-primary/50" />
                            </div>
                          )}
                          <MessageBubble
                            message={message}
                            onReply={handleReply}
                            onDelete={handleDeleteMessage}
                            onRetry={handleRetryMessage}
                            searchQuery={searchQuery}
                            showParticipant={showParticipant}
                            isGrouped={isGrouped}
                            isFirstInGroup={isFirstInGroup}
                            isLastInGroup={isLastInGroup}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Task 4.4: Improved Reply preview - compact with clear dismiss */}
      {replyToMessage && (
        <div className="flex-shrink-0 px-4 py-2 border-t bg-muted/30">
          <div className="flex items-start gap-3 p-2 rounded-lg bg-background/50 border-l-2 border-primary">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">
                Respondendo a {replyToMessage.direction === 'incoming' ? displayName : 'você'}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {replyToMessage.content || '[Mídia]'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
              onClick={cancelReply}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        onSend={handleSendMessage}
        isLoading={sendMessageMutation.isPending}
        conversationId={conversation.id}
        onTyping={onTyping}
        onPresence={onPresence}
      />
    </div>
  )
}

// Task 7.3: Improved MessagesSkeleton that simulates message layout
function MessagesSkeleton() {
  // Varied heights and widths to look more natural
  const skeletonMessages = [
    { align: 'start', width: 'w-[60%]', height: 'h-12' },
    { align: 'start', width: 'w-[45%]', height: 'h-10' },
    { align: 'end', width: 'w-[55%]', height: 'h-14' },
    { align: 'start', width: 'w-[70%]', height: 'h-20' },
    { align: 'end', width: 'w-[40%]', height: 'h-10' },
    { align: 'end', width: 'w-[50%]', height: 'h-12' },
    { align: 'start', width: 'w-[65%]', height: 'h-16' },
  ]

  return (
    <div className="space-y-3">
      {/* Date separator skeleton */}
      <div className="flex items-center justify-center my-4">
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      
      {skeletonMessages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            'flex',
            msg.align === 'start' ? 'justify-start' : 'justify-end'
          )}
        >
          <div className={cn(
            'rounded-2xl overflow-hidden',
            msg.width,
            msg.align === 'start' ? 'bg-muted' : 'bg-primary/20'
          )}>
            <Skeleton className={cn(
              'w-full animate-pulse',
              msg.height
            )} />
            {/* Footer skeleton */}
            <div className={cn(
              'flex items-center gap-1 px-3 pb-2',
              msg.align === 'end' ? 'justify-end' : 'justify-start'
            )}>
              <Skeleton className="h-3 w-10" />
              {msg.align === 'end' && <Skeleton className="h-3 w-3" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function groupMessagesByDate(messages: ChatMessage[]): Record<string, ChatMessage[]> {
  const groups: Record<string, ChatMessage[]> = {}
  
  messages.forEach((message) => {
    const date = new Date(message.timestamp)
    const dateKey = formatDateKey(date)
    
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(message)
  })
  
  return groups
}

function formatDateKey(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (isSameDay(date, today)) {
    return 'Hoje'
  }
  if (isSameDay(date, yesterday)) {
    return 'Ontem'
  }
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  })
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

function getPresenceText(presence: PresenceState): string {
  switch (presence) {
    case 'composing':
      return 'digitando...'
    case 'recording':
      return 'gravando áudio...'
    case 'paused':
      return 'online'
    case 'available':
      return 'online'
    case 'unavailable':
      return 'offline'
    default:
      return ''
  }
}

export default ConversationView
