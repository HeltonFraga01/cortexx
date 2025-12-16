/**
 * ConversationInfoSection Component
 * 
 * Displays conversation metadata and statistics
 * 
 * Requirements: 3.2, 3.3, 3.4
 */

import { useQuery } from '@tanstack/react-query'
import { useChatApi } from '@/hooks/useChatApi'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Clock, MessageSquare, Bot, Tag } from 'lucide-react'

interface ConversationInfoSectionProps {
  conversationId: number
}

export function ConversationInfoSection({ conversationId }: ConversationInfoSectionProps) {
  const chatApi = useChatApi()
  
  const { data: info, isLoading } = useQuery({
    queryKey: ['conversationInfo', conversationId, chatApi.isAgentMode],
    queryFn: () => chatApi.getConversationInfo(conversationId),
    staleTime: 30000
  })

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours < 24) return `${hours}h ${mins}min`
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  if (!info) {
    return <div className="text-sm text-muted-foreground">Informações não disponíveis</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Criada em:</span>
        <span>{formatDate(info.createdAt)}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Última atividade:</span>
        <span>{formatDate(info.lastActivityAt)}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Mensagens:</span>
        <span>{info.messageCount}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Duração:</span>
        <span>{formatDuration(info.durationMinutes)}</span>
      </div>

      {info.botAssignedAt && (
        <div className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Bot atribuído em:</span>
          <span>{formatDate(info.botAssignedAt)}</span>
        </div>
      )}

      {info.labelAssignments && info.labelAssignments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>Etiquetas atribuídas:</span>
          </div>
          <div className="pl-6 space-y-1">
            {info.labelAssignments.map((la) => (
              <div key={la.labelId} className="text-sm">
                <span className="font-medium">{la.labelName}</span>
                <span className="text-muted-foreground"> - {formatDate(la.assignedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversationInfoSection
