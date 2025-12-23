/**
 * ConversationActionsSection Component
 * 
 * Quick actions for conversations including transfer and release
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1
 */

import { useCallback, useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import type { Conversation, ConversationsResponse } from '@/types/chat'
import { updateConversationBotInCache, updateConversationStatusInCache } from '@/lib/conversation-cache'
import { ExternalLink, CheckCircle, Bot, UserPlus, Hand, Loader2 } from 'lucide-react'
import { InboxTransferSelector } from './InboxTransferSelector'

interface ConversationActionsSectionProps {
  conversation: Conversation
}

export function ConversationActionsSection({ conversation }: ConversationActionsSectionProps) {
  const [showBotSelect, setShowBotSelect] = useState(false)
  const [showTransferSelect, setShowTransferSelect] = useState(false)
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)
  const queryClient = useQueryClient()
  const chatApi = useChatApi()

  // Fetch bots
  const { data: bots = [] } = useQuery({
    queryKey: ['bots', chatApi.isAgentMode],
    queryFn: chatApi.getBots,
    staleTime: 60000
  })

  // Fetch transferable agents (agent mode only) - Requirements: 5.1
  const { data: transferableAgents = [] } = useQuery({
    queryKey: ['transferable-agents', conversation.id],
    queryFn: () => chatApi.getTransferableAgents?.(conversation.id) || Promise.resolve([]),
    enabled: chatApi.isAgentMode && showTransferSelect,
    staleTime: 30000
  })

  // Transfer mutation - Requirements: 5.1
  const transferMutation = useMutation({
    mutationFn: (targetAgentId: string) => 
      chatApi.transferConversation?.(conversation.id, targetAgentId) || Promise.reject('Not in agent mode'),
    onSuccess: (data) => {
      setShowTransferSelect(false)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(data.warning ? `Conversa transferida. ${data.warning}` : 'Conversa transferida')
    },
    onError: () => {
      toast.error('Erro ao transferir conversa')
    }
  })

  // Release mutation - Requirements: 6.1
  const releaseMutation = useMutation({
    mutationFn: () => 
      chatApi.releaseConversation?.(conversation.id) || Promise.reject('Not in agent mode'),
    onSuccess: () => {
      setShowReleaseConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversa liberada')
    },
    onError: () => {
      toast.error('Erro ao liberar conversa')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; assignedBotId?: number | null }) =>
      chatApi.updateConversation(conversation.id, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      
      const previousData: Record<string, ConversationsResponse | undefined> = {}
      const queryCache = queryClient.getQueryCache()
      const conversationQueries = queryCache.findAll({ queryKey: ['conversations'] })
      
      conversationQueries.forEach(query => {
        const key = JSON.stringify(query.queryKey)
        previousData[key] = queryClient.getQueryData(query.queryKey)
      })
      
      if (data.status) {
        conversationQueries.forEach(query => {
          queryClient.setQueryData(query.queryKey, (old: ConversationsResponse | undefined) =>
            updateConversationStatusInCache(old, conversation.id, data.status as any)
          )
        })
      }
      
      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([key, data]) => {
          queryClient.setQueryData(JSON.parse(key), data)
        })
      }
      toast.error('Erro ao atualizar conversa')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

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
      toast.error('Erro ao atribuir bot')
    },
    onSuccess: () => {
      setShowBotSelect(false)
      toast.success('Bot atribuído')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const handleOpenWhatsApp = useCallback(() => {
    const phone = conversation.contactJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    const url = `https://web.whatsapp.com/send?phone=${phone}`
    window.open(url, '_blank')
  }, [conversation.contactJid])

  const handleMarkResolved = useCallback(() => {
    updateMutation.mutate({ status: 'resolved' })
    toast.success('Conversa marcada como resolvida')
  }, [updateMutation])

  const handleBotChange = useCallback((value: string) => {
    const botId = value === 'none' ? null : parseInt(value, 10)
    assignBotMutation.mutate(botId)
  }, [assignBotMutation])

  const handleTransfer = useCallback((agentId: string) => {
    transferMutation.mutate(agentId)
  }, [transferMutation])

  const handleRelease = useCallback(() => {
    releaseMutation.mutate()
  }, [releaseMutation])

  const isGroup = conversation.contactJid.endsWith('@g.us')
  const isAssignedToMe = chatApi.isAgentMode && conversation.assignedAgentId

  return (
    <div className="space-y-2">
      {!isGroup && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleOpenWhatsApp}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir no WhatsApp Web
        </Button>
      )}

      {conversation.status !== 'resolved' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleMarkResolved}
          disabled={updateMutation.isPending}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Marcar como resolvida
        </Button>
      )}

      {/* Inbox transfer - available for all users */}
      <InboxTransferSelector conversation={conversation} />

      {/* Bot assignment */}
      {showBotSelect ? (
        <div className="space-y-2">
          <Select
            value={conversation.assignedBotId?.toString() || 'none'}
            onValueChange={handleBotChange}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum bot</SelectItem>
              {bots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id.toString()}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowBotSelect(false)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setShowBotSelect(true)}
        >
          <Bot className="h-4 w-4 mr-2" />
          Enviar para bot
        </Button>
      )}

      {/* Transfer and Release buttons (agent mode only) - Requirements: 5.1, 6.1 */}
      {chatApi.isAgentMode && isAssignedToMe && (
        <>
          {showTransferSelect ? (
            <div className="space-y-2">
              <Select onValueChange={handleTransfer} disabled={transferMutation.isPending}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Selecionar agente..." />
                </SelectTrigger>
                <SelectContent>
                  {transferableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          agent.availability === 'online' ? 'bg-green-500' :
                          agent.availability === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`} />
                        <span>{agent.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({agent.conversationCount} conversas)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowTransferSelect(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowTransferSelect(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Transferir conversa
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-orange-600 hover:text-orange-700"
            onClick={() => setShowReleaseConfirm(true)}
            disabled={releaseMutation.isPending}
          >
            {releaseMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Hand className="h-4 w-4 mr-2" />
            )}
            Liberar conversa
          </Button>
        </>
      )}

      {/* Release confirmation dialog */}
      <AlertDialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa será liberada e ficará disponível para outros agentes pegarem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelease}>
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ConversationActionsSection
