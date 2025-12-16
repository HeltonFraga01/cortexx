/**
 * InboxSidebar Component
 * 
 * Displays the list of conversations with search, filtering, and type tabs
 * 
 * Requirements: 1.1, 1.3, 1.5, 7.1, 10.1, 10.2, 20.5
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { useChatInbox } from '@/hooks/useChatInbox'
import { useChatApi } from '@/hooks/useChatApi'
import { InboxSelector } from '@/components/user/InboxSelector'
import type { Conversation, ConversationFilters } from '@/types/chat'
import type { InboxWithStats } from '@/types/multi-user'
import { Search, ChevronLeft, X, User, Users, Megaphone, Newspaper, BellOff, Inbox as InboxIcon, Mail, FolderOpen, CheckCircle, Clock, Pause, Bot, UserCheck, UserX, Hand } from 'lucide-react'

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
  const { currentInbox, setCurrentInbox, inboxes } = useChatInbox()
  
  // Get the appropriate chat API based on context (user or agent)
  const chatApi = useChatApi()

  // Handle inbox selection
  const handleInboxSelect = useCallback((inbox: InboxWithStats | null) => {
    setCurrentInbox(inbox)
  }, [setCurrentInbox])

  // Merge inbox filter with other filters
  const effectiveFilters = useMemo(() => {
    const merged: ConversationFilters = { ...filters }
    if (currentInbox) {
      merged.inboxId = currentInbox.id
    }
    return merged
  }, [filters, currentInbox])

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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCollapse}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Inbox Selector - Requirements: 10.1, 10.2 */}
      {inboxes.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <InboxSelector
            currentInbox={currentInbox as InboxWithStats | null}
            onSelect={handleInboxSelect}
            showAllOption={true}
          />
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-3 pb-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
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

      {/* Conversation List */}
      <ScrollArea className="flex-1" constrainWidth>
        <div className="px-3 py-1.5 space-y-0.5">
          {isLoadingConversations ? (
            <ConversationListSkeleton />
          ) : error ? (
            <div className="p-4 text-center text-sm text-destructive">
              Erro ao carregar conversas
              <Button variant="link" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : displayConversations.length === 0 ? (
            <EmptyState type={activeTab} searchQuery={searchQuery} />
          ) : (
            displayConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => onSelectConversation(conversation)}
              />
            ))
          )}
        </div>
      </ScrollArea>
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

// Conversation Item Component
interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
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

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-primary/15'
          : hasUnread 
            ? 'bg-muted/40 hover:bg-muted/60' 
            : 'hover:bg-muted/50'
      )}
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={conversation.contactAvatarUrl || undefined} />
        <AvatarFallback className="text-xs">
          {isGroup ? <Users className="h-4 w-4" /> : 
           isBroadcast ? <Megaphone className="h-4 w-4" /> :
           isNewsletter ? <Newspaper className="h-4 w-4" /> :
           initials}
        </AvatarFallback>
      </Avatar>

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

        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={cn(
            "text-sm truncate",
            hasUnread ? "text-foreground/80" : "text-muted-foreground"
          )}>
            {conversation.lastMessagePreview || 'Sem mensagens'}
          </p>
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
            {hasUnread && (
              <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs font-medium bg-green-500 text-white rounded-full">
                {conversation.unreadCount > 999 ? '999+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Labels */}
        {conversation.labels && conversation.labels.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {conversation.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-xs rounded-full"
                style={{ backgroundColor: label.color + '20', color: label.color }}
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
    </button>
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
