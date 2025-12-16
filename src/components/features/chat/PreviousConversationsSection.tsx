/**
 * PreviousConversationsSection Component
 * 
 * Displays previous conversations with the same contact
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

import { useQuery } from '@tanstack/react-query'
import { useChatApi } from '@/hooks/useChatApi'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageSquare, History } from 'lucide-react'

interface PreviousConversationsSectionProps {
  contactJid: string
  currentConversationId: number
  onNavigate: (conversationId: number) => void
}

export function PreviousConversationsSection({
  contactJid,
  currentConversationId,
  onNavigate
}: PreviousConversationsSectionProps) {
  const chatApi = useChatApi()
  
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['previousConversations', contactJid, currentConversationId, chatApi.isAgentMode],
    queryFn: () => chatApi.getPreviousConversations(contactJid, currentConversationId),
    staleTime: 60000
  })

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'open': return 'default'
      case 'resolved': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'open': return 'Aberta'
      case 'resolved': return 'Resolvida'
      case 'pending': return 'Pendente'
      case 'snoozed': return 'Adiada'
      default: return status
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <History className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa anterior</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onNavigate(conv.id)}
          className="w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{formatDate(conv.createdAt)}</span>
            <Badge variant={getStatusVariant(conv.status)} className="text-xs">
              {getStatusLabel(conv.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{conv.messageCount} mensagens</span>
          </div>
          {conv.lastMessagePreview && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {conv.lastMessagePreview}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

export default PreviousConversationsSection
