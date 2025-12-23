/**
 * InboxSidebar Component
 * 
 * Displays the list of conversations with search, filtering, and type tabs
 * 
 * Requirements: 1.1, 1.3, 1.5, 7.1, 10.1, 10.2, 20.5
 * Task 11.1: Virtualization with @tanstack/react-virtual
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { useChatInbox } from '@/hooks/useChatInbox'
import { useChatApi } from '@/hooks/useChatApi'
import { ConversationInboxBadge } from '@/components/features/chat/ConversationInboxBadge'
import type { Conversation, ConversationFilters } from '@/types/chat'
import { Search, ChevronLeft, X, User, Users, Megaphone, Newspaper, BellOff, Bell, Inbox as InboxIcon, Mail, FolderOpen, CheckCircle, Clock, Pause, Bot, UserCheck, UserX, Hand, CheckSquare, MailCheck, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { useConversationSelection } from '@/hooks/useConversationSelection'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { SelectionToolbar } from '@/components/features/chat/SelectionToolbar'

// Cache for avatars that have been fetched or are being fetched (to avoid re-fetching)
const avatarFetchedCache = new Set<number>()
const avatarFetchingCache = new Set<number>()

// Conversation type tabs
type ConversationType = 'contacts' | 'groups' | 'broadcasts' | 'newsletters'

interface InboxSidebarProps {
  selectedConversationId?: number
  onSelectConversation: (conversation: Conversation) => void
  onCollapse: () => void
  isSearchOpen?: boolean
  onSearchOpenChange?: (open: boolean) => void
  searchInputRef?: React.RefObject<HTMLInputElement>
  isConnected?: boolean
}

export function InboxSidebar({
  selectedConversationId,
  onSelectConversation,
  onCollapse,
  isSearchOpen,
  onSearchOpenChange,
  searchInputRef,
  isConnected
}: InboxSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<ConversationFilters>({})
  const [activeTab, setActiveTab] = useState<ConversationType>('contacts')
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const internalSearchRef = useRef<HTMLInputElement>(null)
  const inputRef = searchInputRef || internalSearchRef
  const queryClient = useQueryClient()
  
  // Inbox context for filtering by inbox (works with both user and agent contexts)
  const { inboxes, selectedInboxIds, isAllSelected, getSelectedCount } = useChatInbox()
  
  // Determine if we should show inbox badges (when multiple inboxes are selected)
  const showInboxBadges = useMemo(() => {
    return getSelectedCount() > 1 || isAllSelected
  }, [getSelectedCount, isAllSelected])
  
  // Get the appropriate chat API based on context (user or agent)
  const chatApi = useChatApi()

  // Selection mode for bulk actions - Requirements: 2.1, 2.4, 3.1-3.4
  const {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    deselectAll,
    selectedCount,
    isAllSelected: isAllConversationsSelected,
    isIndeterminate,
    isSelected
  } = useConversationSelection()

  // Merge inbox filter with other filters - now uses unified context
  const effectiveFilters = useMemo(() => {
    const merged: ConversationFilters = { ...filters }
    // Pass selected inbox IDs to filter conversations
    // When all are selected, don't pass filter (backend returns all)
    // When specific inboxes selected, pass their IDs
    if (!isAllSelected && selectedInboxIds.length > 0) {
      merged.inboxIds = selectedInboxIds
    }
    return merged
  }, [filters, isAllSelected, selectedInboxIds])

  // Exit selection mode when filters or tab changes - Requirement 6.1
  useEffect(() => {
    if (isSelectionMode) {
      exitSelectionMode()
    }
  }, [filters, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bulk action handlers - Requirements: 4.3, 4.4, 4.5, 4.6
  const handleBulkMarkAsRead = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map(id => chatApi.markConversationAsRead(id))
    )
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    if (failed > 0 && succeeded > 0) {
      toast.warning(`${succeeded} sucesso, ${failed} falha(s)`)
    } else if (failed > 0) {
      throw new Error('Falha ao marcar conversas como lidas')
    }
    
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    exitSelectionMode()
  }, [selectedIds, chatApi, queryClient, exitSelectionMode])

  const handleBulkMarkAsUnread = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map(id => chatApi.markConversationAsUnread(id))
    )
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    if (failed > 0 && succeeded > 0) {
      toast.warning(`${succeeded} sucesso, ${failed} falha(s)`)
    } else if (failed > 0) {
      throw new Error('Falha ao marcar conversas como não lidas')
    }
    
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    exitSelectionMode()
  }, [selectedIds, chatApi, queryClient, exitSelectionMode])

  const handleBulkResolve = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map(id => chatApi.updateConversation(id, { status: 'resolved' }))
    )
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    if (failed > 0 && succeeded > 0) {
      toast.warning(`${succeeded} sucesso, ${failed} falha(s)`)
    } else if (failed > 0) {
      throw new Error('Falha ao resolver conversas')
    }
    
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    exitSelectionMode()
  }, [selectedIds, chatApi, queryClient, exitSelectionMode])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map(id => chatApi.deleteConversation(id))
    )
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    if (failed > 0 && succeeded > 0) {
      toast.warning(`${succeeded} sucesso, ${failed} falha(s)`)
    } else if (failed > 0) {
      throw new Error('Falha ao excluir conversas')
    }
    
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    exitSelectionMode()
  }, [selectedIds, chatApi, queryClient, exitSelectionMode])

  // Fetch conversations using the appropriate API (user or agent)
  const {
    data: conversationsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conversations', effectiveFilters, chatApi.isAgentMode],
    queryFn: () => chatApi.getConversations(effectiveFilters, { limit: 100 }),
    staleTime: 30000
  })


  // Filter conversations by type
  const filteredByType = useMemo(() => {
    const conversations = conversationsData?.conversations || []
    
    const contacts: Conversation[] = []
    const groups: Conversation[] = []
    const broadcasts: Conversation[] = []
    const newsletters: Conversation[] = []
    
    for (const conv of conversations) {
      const jid = conv.contactJid || ''
      if (jid.includes('@newsletter')) {
        newsletters.push(conv)
      } else if (jid.includes('@broadcast')) {
        broadcasts.push(conv)
      } else if (jid.includes('@g.us')) {
        groups.push(conv)
      } else {
        contacts.push(conv)
      }
    }
    
    return { contacts, groups, broadcasts, newsletters }
  }, [conversationsData?.conversations])

  // Get counts for each type
  const typeCounts = useMemo(() => ({
    contacts: filteredByType.contacts.length,
    groups: filteredByType.groups.length,
    broadcasts: filteredByType.broadcasts.length,
    newsletters: filteredByType.newsletters.length
  }), [filteredByType])

  // Get unread counts for each type
  const unreadCounts = useMemo(() => ({
    contacts: filteredByType.contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    groups: filteredByType.groups.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    broadcasts: filteredByType.broadcasts.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    newsletters: filteredByType.newsletters.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  }), [filteredByType])

  // Auto-fetch avatars for conversations without avatars
  useEffect(() => {
    const conversations = conversationsData?.conversations || []
    const conversationsWithoutAvatar = conversations.filter(
      (conv) => !conv.contactAvatarUrl && 
                !avatarFetchedCache.has(conv.id) && 
                !avatarFetchingCache.has(conv.id) &&
                !conv.contactJid?.includes('status@') &&
                !conv.contactJid?.includes('@newsletter') &&
                !conv.contactJid?.includes('@broadcast')
    )

    if (conversationsWithoutAvatar.length === 0) return

    const fetchAvatars = async () => {
      for (const conv of conversationsWithoutAvatar.slice(0, 5)) {
        avatarFetchingCache.add(conv.id)
        
        try {
          const result = await chatApi.fetchConversationAvatar(conv.id)
          avatarFetchedCache.add(conv.id)
          avatarFetchingCache.delete(conv.id)
          
          if (result?.avatarUrl) {
            queryClient.setQueryData(['conversations', filters], (oldData: typeof conversationsData) => {
              if (!oldData) return oldData
              return {
                ...oldData,
                conversations: oldData.conversations.map((c) =>
                  c.id === conv.id ? { ...c, contactAvatarUrl: result.avatarUrl } : c
                )
              }
            })
          }
        } catch {
          avatarFetchedCache.add(conv.id)
          avatarFetchingCache.delete(conv.id)
        }
        
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    const timeoutId = setTimeout(fetchAvatars, 500)
    return () => clearTimeout(timeoutId)
  }, [conversationsData?.conversations, filters, queryClient, chatApi])

  // Search conversations using the appropriate API (user or agent)
  const {
    data: searchResults,
    isLoading: isSearchLoading
  } = useQuery({
    queryKey: ['conversations-search', searchQuery, chatApi.isAgentMode],
    queryFn: () => chatApi.searchConversations(searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 10000
  })

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.length >= 2) {
      setIsSearching(true)
      searchTimeoutRef.current = setTimeout(() => {
        setIsSearching(false)
      }, 300)
    } else {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setIsSearching(false)
  }, [])

  // Determine which conversations to display
  const displayConversations = useMemo(() => {
    if (searchQuery.length >= 2) {
      return searchResults || []
    }
    return filteredByType[activeTab] || []
  }, [searchQuery, searchResults, filteredByType, activeTab])

  const isLoadingConversations = isLoading || (searchQuery.length >= 2 && isSearchLoading)


  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - h-14 for uniformity */}
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Conversas</h2>
          {isConnected !== undefined && (
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )}
              title={isConnected ? 'Conectado' : 'Desconectado'}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Select button - Requirement 2.1 */}
          {!isSelectionMode && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={enterSelectionMode}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Selecionar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCollapse}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection Toolbar - Requirements: 4.1, 4.2 */}
      {isSelectionMode && selectedCount > 0 && (
        <SelectionToolbar
          selectedCount={selectedCount}
          totalCount={displayConversations.length}
          isAllSelected={isAllConversationsSelected(displayConversations.length)}
          isIndeterminate={isIndeterminate(displayConversations.length)}
          onSelectAll={() => selectAll(displayConversations.map(c => c.id))}
          onDeselectAll={deselectAll}
          onCancel={exitSelectionMode}
          onMarkAsRead={handleBulkMarkAsRead}
          onMarkAsUnread={handleBulkMarkAsUnread}
          onResolve={handleBulkResolve}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Search */}
      <div className="px-3 pt-3 pb-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9 h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Type Tabs - Icon only */}
      <TooltipProvider delayDuration={300}>
        <div className="px-3 py-1.5 border-b">
          <div className="flex items-center justify-between bg-muted/50 rounded-md p-0.5">
            <TypeTab
              type="contacts"
              icon={User}
              label="Contatos"
              count={typeCounts.contacts}
              unreadCount={unreadCounts.contacts}
              active={activeTab === 'contacts'}
              onClick={() => setActiveTab('contacts')}
            />
            <TypeTab
              type="groups"
              icon={Users}
              label="Grupos"
              count={typeCounts.groups}
              unreadCount={unreadCounts.groups}
              active={activeTab === 'groups'}
              onClick={() => setActiveTab('groups')}
            />
            <TypeTab
              type="broadcasts"
              icon={Megaphone}
              label="Listas de Transmissão"
              count={typeCounts.broadcasts}
              unreadCount={unreadCounts.broadcasts}
              active={activeTab === 'broadcasts'}
              onClick={() => setActiveTab('broadcasts')}
            />
            <TypeTab
              type="newsletters"
              icon={Newspaper}
              label="Canais"
              count={typeCounts.newsletters}
              unreadCount={unreadCounts.newsletters}
              active={activeTab === 'newsletters'}
              onClick={() => setActiveTab('newsletters')}
            />
          </div>
        </div>
      </TooltipProvider>

      {/* Status Filter buttons - icons only */}
      <TooltipProvider delayDuration={300}>
        <div className="px-3 py-1.5">
          <div className="flex items-center justify-between bg-muted/50 rounded-md p-0.5">
            <StatusTab
              icon={InboxIcon}
              label="Todas"
              active={!filters.status && !filters.hasUnread}
              onClick={() => setFilters({})}
            />
            <StatusTab
              icon={Mail}
              label="Não lidas"
              active={filters.hasUnread === true}
              onClick={() => setFilters({ hasUnread: true })}
            />
            <StatusTab
              icon={FolderOpen}
              label="Abertas"
              active={filters.status === 'open'}
              onClick={() => setFilters({ status: 'open' })}
            />
            <StatusTab
              icon={CheckCircle}
              label="Resolvidas"
              active={filters.status === 'resolved'}
              onClick={() => setFilters({ status: 'resolved' })}
            />
          </div>
        </div>
      </TooltipProvider>

      {/* Conversation List - Task 8.2: Added ARIA labels, Task 11.1: Virtualization */}
      <VirtualizedConversationList
        conversations={displayConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={onSelectConversation}
        isLoading={isLoadingConversations}
        error={error}
        onRetry={refetch}
        activeTab={activeTab}
        searchQuery={searchQuery}
        showInboxBadges={showInboxBadges}
        inboxes={inboxes}
        // Selection mode props - Requirements: 2.2, 3.1, 5.1, 5.2
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        // Quick action handlers - Requirements: 1.1, 1.2, 1.3
        onMarkRead={async (id) => {
          await chatApi.markConversationAsRead(id)
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }}
        onMute={async (id, currentMuted) => {
          await chatApi.muteConversation(id, !currentMuted)
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }}
        onResolve={async (id) => {
          await chatApi.updateConversation(id, { status: 'resolved' })
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }}
      />
    </div>
  )
}


// Type Tab Component
interface TypeTabProps {
  type: ConversationType
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  unreadCount: number
  active: boolean
  onClick: () => void
}

function TypeTab({ icon: Icon, label, count, unreadCount, active, onClick }: TypeTabProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'relative flex-1 flex items-center justify-center p-1.5 rounded transition-all',
            active
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 flex items-center justify-center text-[9px] font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label} ({count})
      </TooltipContent>
    </Tooltip>
  )
}

// Status Tab Component (for status filters)
interface StatusTabProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}

function StatusTab({ icon: Icon, label, active, onClick }: StatusTabProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex-1 flex items-center justify-center p-1.5 rounded transition-all',
            active
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

// Task 11.1: Virtualized Conversation List Component
interface VirtualizedConversationListProps {
  conversations: Conversation[]
  selectedConversationId?: number
  onSelectConversation: (conversation: Conversation) => void
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  activeTab: ConversationType
  searchQuery: string
  showInboxBadges: boolean
  inboxes: Array<{ id: number; name: string }>
  // Selection mode props - Requirements: 2.2, 3.1, 5.1, 5.2
  isSelectionMode: boolean
  selectedIds: Set<number>
  onToggleSelection: (id: number) => void
  // Quick action handlers - Requirements: 1.1, 1.2, 1.3
  onMarkRead: (id: number) => Promise<void>
  onMute: (id: number, currentMuted: boolean) => Promise<void>
  onResolve: (id: number) => Promise<void>
}

function VirtualizedConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
  error,
  onRetry,
  activeTab,
  searchQuery,
  showInboxBadges,
  inboxes,
  isSelectionMode,
  selectedIds,
  onToggleSelection,
  onMarkRead,
  onMute,
  onResolve
}: VirtualizedConversationListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  // Fixed estimate size to avoid re-render loops
  const ESTIMATED_ROW_HEIGHT = 88
  
  // Memoize getItemKey to prevent virtualizer recreation
  const getItemKey = useCallback(
    (index: number) => conversations[index]?.id ?? index,
    [conversations]
  )
  
  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => ESTIMATED_ROW_HEIGHT, []),
    overscan: 5,
    getItemKey
  })

  if (isLoading) {
    return (
      <div className="flex-1 px-3 py-1.5">
        <ConversationListSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-4 text-center text-sm text-destructive" role="alert">
        Erro ao carregar conversas
        <Button variant="link" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1">
        <EmptyState type={activeTab} searchQuery={searchQuery} />
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto px-3 py-1.5"
      role="list"
      aria-label="Lista de conversas"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const conversation = conversations[virtualRow.index]
          const inbox = conversation.inboxId
            ? inboxes.find(i => i.id === conversation.inboxId)
            : null

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                willChange: 'transform' // Task 11.3: GPU optimization
              }}
            >
              <ConversationItem
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => onSelectConversation(conversation)}
                showInboxBadge={showInboxBadges}
                inboxName={inbox?.name}
                isSelectionMode={isSelectionMode}
                isChecked={selectedIds.has(conversation.id)}
                onToggleSelection={() => onToggleSelection(conversation.id)}
                onMarkRead={() => onMarkRead(conversation.id)}
                onMute={() => onMute(conversation.id, conversation.isMuted || false)}
                onResolve={() => onResolve(conversation.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Empty State Component
interface EmptyStateProps {
  type: ConversationType
  searchQuery: string
}

function EmptyState({ type, searchQuery }: EmptyStateProps) {
  const messages: Record<ConversationType, string> = {
    contacts: 'Nenhum contato',
    groups: 'Nenhum grupo',
    broadcasts: 'Nenhuma lista de transmissão',
    newsletters: 'Nenhum canal'
  }

  return (
    <div className="p-4 text-center text-sm text-muted-foreground">
      {searchQuery ? 'Nenhuma conversa encontrada' : messages[type]}
    </div>
  )
}

// Task 1.3: QuickActions Component for conversation item hover
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
interface QuickActionsProps {
  conversation: Conversation
  onMarkRead: () => Promise<void>
  onMute: () => Promise<void>
  onResolve: () => Promise<void>
}

function QuickActions({ conversation, onMarkRead, onMute, onResolve }: QuickActionsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handleAction = async (action: string, fn: () => Promise<void>, successMsg: string) => {
    setIsLoading(action)
    try {
      await fn()
      toast.success(successMsg)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao executar ação')
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-md shadow-sm p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/80"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                handleAction('read', onMarkRead, 'Conversa marcada como lida')
              }}
            >
              {isLoading === 'read' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MailCheck className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Marcar como lida
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/80"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                handleAction(
                  'mute', 
                  onMute, 
                  conversation.isMuted ? 'Notificações ativadas' : 'Conversa silenciada'
                )
              }}
            >
              {isLoading === 'mute' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : conversation.isMuted ? (
                <Bell className="h-3 w-3 text-muted-foreground" />
              ) : (
                <BellOff className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {conversation.isMuted ? 'Ativar notificações' : 'Silenciar'}
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent/80"
              disabled={isLoading !== null || conversation.status === 'resolved'}
              onClick={(e) => {
                e.stopPropagation()
                handleAction('resolve', onResolve, 'Conversa resolvida')
              }}
            >
              {isLoading === 'resolve' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Resolver
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

// Typing Indicator Component - Task 1.2, Task 11.3: GPU-optimized animation
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-sm text-primary">
      <span className="italic">digitando</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s] will-change-transform" />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s] will-change-transform" />
        <span className="w-1 h-1 rounded-full bg-primary animate-bounce will-change-transform" />
      </span>
    </div>
  )
}

// Conversation Item Component - Task 1.1: Updated layout with new visual hierarchy
// Requirements: 2.2, 3.1, 5.1, 5.2
interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  showInboxBadge?: boolean
  inboxName?: string
  isTyping?: boolean
  // Selection mode props
  isSelectionMode?: boolean
  isChecked?: boolean
  onToggleSelection?: () => void
  // Quick action handlers
  onMarkRead?: () => Promise<void>
  onMute?: () => Promise<void>
  onResolve?: () => Promise<void>
}

function ConversationItem({ 
  conversation, 
  isSelected, 
  onClick, 
  showInboxBadge, 
  inboxName, 
  isTyping = false,
  isSelectionMode = false,
  isChecked = false,
  onToggleSelection,
  onMarkRead,
  onMute,
  onResolve
}: ConversationItemProps) {
  const initials = conversation.contactName
    ? conversation.contactName.slice(0, 2).toUpperCase()
    : conversation.contactJid.slice(0, 2).toUpperCase()

  const displayName = conversation.contactName || 
    conversation.contactJid
      .replace('@s.whatsapp.net', '')
      .replace('@g.us', '')
      .replace('@broadcast', '')
      .replace('@newsletter', '')

  const formattedTime = conversation.lastMessageAt
    ? formatRelativeTime(new Date(conversation.lastMessageAt))
    : ''

  // Determine icon for special types
  const isGroup = conversation.contactJid?.includes('@g.us')
  const isBroadcast = conversation.contactJid?.includes('@broadcast')
  const isNewsletter = conversation.contactJid?.includes('@newsletter')
  
  // Check if conversation is muted
  const isMuted = conversation.isMuted || false
  const hasUnread = conversation.unreadCount > 0

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection()
    } else {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer',
        // Selection mode highlight - Requirement 5.1
        isChecked && 'bg-primary/20',
        // Normal selection highlight
        !isChecked && isSelected && 'bg-primary/10 border-l-2 border-primary',
        // Unread highlight
        !isChecked && !isSelected && hasUnread && 'bg-muted/60 hover:bg-muted/80',
        // Default hover
        !isChecked && !isSelected && !hasUnread && 'hover:bg-muted/80'
      )}
    >
      {/* Checkbox - shown in selection mode - Requirement 2.2, 5.2 */}
      {isSelectionMode && (
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleSelection?.()}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 transition-all duration-200"
        />
      )}
      {/* Avatar with status indicator - Task 1.1: Increased to 44px (h-11 w-11) with ring */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-11 w-11 ring-2 ring-background">
          <AvatarImage src={conversation.contactAvatarUrl || undefined} loading="lazy" />
          <AvatarFallback className="text-sm">
            {isGroup ? <Users className="h-5 w-5" /> : 
             isBroadcast ? <Megaphone className="h-5 w-5" /> :
             isNewsletter ? <Newspaper className="h-5 w-5" /> :
             initials}
          </AvatarFallback>
        </Avatar>
        {/* Online status indicator */}
        {conversation.isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "truncate",
            hasUnread ? "font-semibold text-foreground" : "font-medium"
          )}>
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formattedTime}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          {/* Task 1.2: Show typing indicator when isTyping is true */}
          {isTyping ? (
            <TypingIndicator />
          ) : (
            <p className={cn(
              "text-sm truncate",
              hasUnread ? "text-foreground/80" : "text-muted-foreground"
            )}>
              {conversation.lastMessagePreview || 'Sem mensagens'}
            </p>
          )}
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Assignment indicator - Requirements: 2.2, 3.2 */}
            {!conversation.assignedAgentId && (
              <Hand className="h-3.5 w-3.5 text-orange-500" title="Disponível para pegar" />
            )}
            {conversation.assignedAgent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center">
                    <UserCheck className="h-3.5 w-3.5 text-green-600" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  Atribuída a: {conversation.assignedAgent.name || 'Agente'}
                </TooltipContent>
              </Tooltip>
            )}
            {/* Bot indicator */}
            {conversation.assignedBotId && (
              <Bot className="h-3.5 w-3.5 text-blue-500" title="Bot atribuído" />
            )}
            {/* Status indicators */}
            {conversation.status === 'resolved' && (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" title="Resolvida" />
            )}
            {conversation.status === 'pending' && (
              <Clock className="h-3.5 w-3.5 text-yellow-500" title="Pendente" />
            )}
            {conversation.status === 'snoozed' && (
              <Pause className="h-3.5 w-3.5 text-blue-500" title="Adiada" />
            )}
            {/* Mute indicator */}
            {isMuted && (
              <BellOff className="h-3.5 w-3.5 text-muted-foreground" title="Silenciada" />
            )}
            {/* Unread badge - Task 1.1: Improved styling */}
            {hasUnread && (
              <Badge 
                className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground"
                data-testid="unread-badge"
              >
                {conversation.unreadCount > 999 ? '999+' : conversation.unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Inbox Badge - shown when multiple inboxes selected */}
        {showInboxBadge && conversation.inboxId && (
          <div className="mt-1.5">
            <ConversationInboxBadge 
              inboxId={conversation.inboxId} 
              inboxName={inboxName}
            />
          </div>
        )}

        {/* Labels - Task 5.4: Improved label display as colored chips */}
        {conversation.labels && conversation.labels.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {conversation.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-xs rounded-full transition-colors hover:opacity-80"
                style={{ 
                  backgroundColor: label.color + '20', 
                  color: label.color,
                  borderColor: label.color + '40'
                }}
              >
                {label.name}
              </span>
            ))}
            {conversation.labels.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                +{conversation.labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Task 1.3: QuickActions on hover - hidden in selection mode */}
      {!isSelectionMode && onMarkRead && onMute && onResolve && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <QuickActions 
            conversation={conversation}
            onMarkRead={onMarkRead}
            onMute={onMute}
            onResolve={onResolve}
          />
        </div>
      )}
    </div>
  )
}

function ConversationListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default InboxSidebar
