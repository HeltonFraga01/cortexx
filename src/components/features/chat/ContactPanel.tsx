/**
 * ContactPanel Component
 * 
 * Displays contact details, labels, and bot assignment with collapsible sections
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 19.1, 19.3, 19.4, 20.1, 20.2
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  updateConversationBotInCache,
  addLabelToConversationInCache,
  removeLabelFromConversationInCache
} from '@/lib/conversation-cache'
import type { ConversationsResponse, Label } from '@/types/chat'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatApi } from '@/hooks/useChatApi'
import type { AgentBot } from '@/types/chat'
import type { Conversation } from '@/types/chat'
import { 
  X, 
  Copy, 
  Phone, 
  Tag, 
  Bot, 
  Plus,
  RefreshCw,
  Info,
  FileText,
  History,
  Users,
  Zap,
  Settings2,
  BadgeCheck
} from 'lucide-react'

// Import new section components
import { CollapsibleSection } from './CollapsibleSection'
import { ContactAttributesSection } from './ContactAttributesSection'
import { ContactNotesSection } from './ContactNotesSection'
import { ConversationInfoSection } from './ConversationInfoSection'
import { PreviousConversationsSection } from './PreviousConversationsSection'
import { ParticipantsSection } from './ParticipantsSection'
import { ConversationActionsSection } from './ConversationActionsSection'
import { MacrosSection } from './MacrosSection'

interface ContactPanelProps {
  conversation: Conversation
  onClose: () => void
  onNavigateToConversation?: (conversationId: number) => void
}

export function ContactPanel({ conversation, onClose, onNavigateToConversation }: ContactPanelProps) {
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(conversation.contactAvatarUrl || null)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)
  const queryClient = useQueryClient()
  const chatApi = useChatApi()

  const displayName = conversation.contactName || 
    conversation.contactJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

  const phoneNumber = conversation.contactJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
  const isGroup = conversation.contactJid.endsWith('@g.us')

  // Fetch avatar on mount if not available
  useEffect(() => {
    if (!avatarUrl && conversation.id) {
      handleFetchAvatar()
    }
  }, [conversation.id])

  // Update avatar when conversation changes
  useEffect(() => {
    setAvatarUrl(conversation.contactAvatarUrl || null)
  }, [conversation.contactAvatarUrl])

  const handleFetchAvatar = useCallback(async () => {
    setIsLoadingAvatar(true)
    try {
      const result = await chatApi.fetchConversationAvatar(conversation.id)
      if (result?.avatarUrl) {
        setAvatarUrl(result.avatarUrl)
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    } catch (error) {
      console.error('Failed to fetch avatar:', error)
    } finally {
      setIsLoadingAvatar(false)
    }
  }, [conversation.id, queryClient, chatApi])

  const initials = conversation.contactName
    ? conversation.contactName.slice(0, 2).toUpperCase()
    : phoneNumber.slice(0, 2).toUpperCase()

  // Fetch labels using the appropriate API (user or agent)
  const { data: allLabels } = useQuery({
    queryKey: ['labels', chatApi.isAgentMode],
    queryFn: chatApi.getLabels,
    staleTime: 60000
  })

  // Fetch bots
  const { data: bots } = useQuery<AgentBot[]>({
    queryKey: ['bots', chatApi.isAgentMode],
    queryFn: chatApi.getBots,
    staleTime: 60000
  })

  // Assign label mutation with optimistic update
  const assignLabelMutation = useMutation({
    mutationFn: (labelId: number) => chatApi.assignLabelToConversation(conversation.id, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      const label = allLabels?.find(l => l.id === labelId)
      if (!label) return {}
      
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      conversationQueries.forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
          addLabelToConversationInCache(old, conversation.id, label)
        )
      })
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          queryClient.setQueryData(JSON.parse(key), data)
        })
      }
      toast.error('Erro ao adicionar etiqueta')
    },
    onSuccess: () => {
      toast.success('Etiqueta adicionada')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  // Remove label mutation with optimistic update
  const removeLabelMutation = useMutation({
    mutationFn: (labelId: number) => chatApi.removeLabelFromConversation(conversation.id, labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      conversationQueries.forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
          removeLabelFromConversationInCache(old, conversation.id, labelId)
        )
      })
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          queryClient.setQueryData(JSON.parse(key), data)
        })
      }
      toast.error('Erro ao remover etiqueta')
    },
    onSuccess: () => {
      toast.success('Etiqueta removida')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  // Assign bot mutation with optimistic update
  const assignBotMutation = useMutation({
    mutationFn: (botId: number | null) => chatApi.assignBotToConversation(conversation.id, botId),
    onMutate: async (botId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      const bot = botId ? bots?.find(b => b.id === botId) : null
      const assignedBot = bot ? { id: bot.id, name: bot.name, avatarUrl: bot.avatarUrl } : null
      
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      conversationQueries.forEach(query => {
        queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
          updateConversationBotInCache(old, conversation.id, botId, assignedBot)
        )
      })
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          queryClient.setQueryData(JSON.parse(key), data)
        })
      }
      toast.error('Erro ao alterar bot')
    },
    onSuccess: (_, botId) => {
      if (botId === null) {
        toast.success('Bot removido da conversa')
      } else {
        toast.success('Bot atribuído à conversa')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const handleCopyPhone = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber)
    } catch {
      // Silently fail
    }
  }, [phoneNumber])

  const handleAssignLabel = useCallback((labelId: number) => {
    assignLabelMutation.mutate(labelId)
    setIsLabelDialogOpen(false)
  }, [assignLabelMutation])

  const handleRemoveLabel = useCallback((labelId: number) => {
    removeLabelMutation.mutate(labelId)
  }, [removeLabelMutation])

  const handleBotChange = useCallback((value: string) => {
    const botId = value === 'none' ? null : parseInt(value, 10)
    console.log('handleBotChange called with:', value, '-> botId:', botId)
    assignBotMutation.mutate(botId)
  }, [assignBotMutation])

  const handleNavigateToConversation = useCallback((conversationId: number) => {
    if (onNavigateToConversation) {
      onNavigateToConversation(conversationId)
    }
  }, [onNavigateToConversation])

  // Labels not yet assigned to this conversation
  const availableLabels = allLabels?.filter(
    (label) => !conversation.labels?.some((l) => l.id === label.id)
  ) || []

  return (
    // Task 5.3: Applied max-w-[320px] to container
    <div className="flex flex-col h-full max-w-[320px] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <h3 className="text-sm font-semibold">Detalhes do contato</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Task 5.1: Reorganized Contact Header with larger avatar */}
        <div className="p-6 border-b text-center">
          <div className="relative inline-block">
            {/* Task 5.1: Avatar increased to 80px with ring-4 */}
            <Avatar className="h-20 w-20 ring-4 ring-muted mx-auto">
              <AvatarImage src={avatarUrl || undefined} loading="lazy" />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border shadow-sm"
              onClick={handleFetchAvatar}
              disabled={isLoadingAvatar}
              title="Atualizar foto do perfil"
            >
              <RefreshCw className={cn("h-3 w-3", isLoadingAvatar && "animate-spin")} />
            </Button>
          </div>
          
          {/* Task 5.1: Centered name and phone */}
          <h4 className="mt-4 text-lg font-semibold">{displayName}</h4>
          
          {/* Task 5.1: Phone with copy button */}
          <div className="flex items-center justify-center gap-2 mt-1 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="text-sm">{phoneNumber}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopyPhone}
              title="Copiar número"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          
          {isGroup && (
            <Badge variant="secondary" className="mt-2">
              <Users className="h-3 w-3 mr-1" />
              Grupo
            </Badge>
          )}
        </div>

        {/* Collapsible Sections */}
        <div>
          {/* Status Section */}
          <CollapsibleSection
            id="status"
            title="Status"
            icon={<Info className="h-4 w-4" />}
            defaultExpanded={true}
          >
            <Badge variant={getStatusVariant(conversation.status)}>
              {getStatusLabel(conversation.status)}
            </Badge>
          </CollapsibleSection>

          {/* Labels Section */}
          <CollapsibleSection
            id="labels"
            title="Etiquetas"
            icon={<Tag className="h-4 w-4" />}
            count={conversation.labels?.length}
            defaultExpanded={true}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {conversation.labels && conversation.labels.length > 0 ? (
                  conversation.labels.map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="flex items-center gap-1"
                      style={{ 
                        borderColor: label.color,
                        backgroundColor: label.color + '20'
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                      <button
                        onClick={() => handleRemoveLabel(label.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma etiqueta</p>
                )}
              </div>
              
              {availableLabels.length > 0 && (
                <div className="pt-2">
                  {isLabelDialogOpen ? (
                    <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
                      {availableLabels.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => handleAssignLabel(label.id)}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className="text-sm">{label.name}</span>
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setIsLabelDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setIsLabelDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar etiqueta
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Bot Assignment Section */}
          <CollapsibleSection
            id="bot"
            title="Bot atribuído"
            icon={<Bot className="h-4 w-4" />}
            defaultExpanded={true}
          >
            <div className="space-y-2">
              {/* Show currently assigned bot with remove option */}
              {conversation.assignedBotId && bots && (
                <div className="p-2 rounded-lg bg-primary/10 border border-primary">
                  {(() => {
                    const assignedBot = bots.find(b => b.id === conversation.assignedBotId)
                    if (!assignedBot) return null
                    return (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={assignedBot.avatarUrl || undefined} loading="lazy" />
                          <AvatarFallback className="text-xs">
                            {assignedBot.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{assignedBot.name}</p>
                          <Badge variant="default" className="text-xs">Ativo</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleBotChange('none')
                          }}
                          disabled={assignBotMutation.isPending}
                          title="Remover bot"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Show available bots to assign */}
              {bots && bots.length > 0 ? (
                <div className="space-y-2">
                  {!conversation.assignedBotId && (
                    <p className="text-sm text-muted-foreground">Nenhum bot atribuído</p>
                  )}
                  {bots
                    .filter(bot => bot.id !== conversation.assignedBotId)
                    .map((bot) => (
                      <button
                        key={bot.id}
                        onClick={() => handleBotChange(bot.id.toString())}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={bot.avatarUrl || undefined} loading="lazy" />
                          <AvatarFallback className="text-xs">
                            {bot.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{bot.name}</p>
                          {bot.status === 'paused' && (
                            <Badge variant="secondary" className="text-xs">Pausado</Badge>
                          )}
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum bot disponível</p>
              )}
            </div>
          </CollapsibleSection>

          {/* Conversation Actions Section */}
          <CollapsibleSection
            id="actions"
            title="Ações da conversa"
            icon={<Settings2 className="h-4 w-4" />}
          >
            <ConversationActionsSection conversation={conversation} />
          </CollapsibleSection>

          {/* Macros Section */}
          <CollapsibleSection
            id="macros"
            title="Macros"
            icon={<Zap className="h-4 w-4" />}
          >
            <MacrosSection conversationId={conversation.id} />
          </CollapsibleSection>

          {/* Conversation Info Section */}
          <CollapsibleSection
            id="info"
            title="Informação da conversa"
            icon={<Info className="h-4 w-4" />}
          >
            <ConversationInfoSection conversationId={conversation.id} />
          </CollapsibleSection>

          {/* Contact Attributes Section */}
          <CollapsibleSection
            id="attributes"
            title="Atributos do contato"
            icon={<FileText className="h-4 w-4" />}
          >
            <ContactAttributesSection contactJid={conversation.contactJid} />
          </CollapsibleSection>

          {/* Contact Notes Section */}
          <CollapsibleSection
            id="notes"
            title="Notas do contato"
            icon={<FileText className="h-4 w-4" />}
          >
            <ContactNotesSection contactJid={conversation.contactJid} />
          </CollapsibleSection>

          {/* Previous Conversations Section */}
          <CollapsibleSection
            id="previous"
            title="Conversas anteriores"
            icon={<History className="h-4 w-4" />}
          >
            <PreviousConversationsSection
              contactJid={conversation.contactJid}
              currentConversationId={conversation.id}
              onNavigate={handleNavigateToConversation}
            />
          </CollapsibleSection>

          {/* Participants Section (Groups only) */}
          {isGroup && (
            <CollapsibleSection
              id="participants"
              title="Participantes da conversa"
              icon={<Users className="h-4 w-4" />}
            >
              <ParticipantsSection
                conversationId={conversation.id}
                isGroup={isGroup}
              />
            </CollapsibleSection>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'open':
      return 'default'
    case 'resolved':
      return 'secondary'
    case 'pending':
      return 'outline'
    case 'snoozed':
      return 'secondary'
    default:
      return 'outline'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Aberta'
    case 'resolved':
      return 'Resolvida'
    case 'pending':
      return 'Pendente'
    case 'snoozed':
      return 'Adiada'
    default:
      return status
  }
}

export default ContactPanel
