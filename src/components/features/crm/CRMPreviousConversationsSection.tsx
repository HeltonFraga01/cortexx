/**
 * CRMPreviousConversationsSection Component
 * 
 * Displays previous conversations with the contact in the CRM detail page.
 * Adapted from chat/PreviousConversationsSection for CRM context.
 * 
 * Requirements: CRM-Chat Integration Spec - Requirement 4
 */

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatApi } from '@/hooks/useChatApi'
import { History, MessageSquare, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CRMPreviousConversationsSectionProps {
  contactJid: string
  onNavigate: (conversationId: number) => void
}

export function CRMPreviousConversationsSection({ 
  contactJid, 
  onNavigate 
}: CRMPreviousConversationsSectionProps) {
  const chatApi = useChatApi()
  
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['crm-previous-conversations', contactJid],
    queryFn: () => chatApi.getPreviousConversations(contactJid),
    enabled: !!contactJid,
    staleTime: 60000
  })

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Conversas anteriores
          {conversations.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {conversations.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <History className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onNavigate(conv.id)}
                className="w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{formatDate(conv.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(conv.status)} className="text-xs">
                      {getStatusLabel(conv.status)}
                    </Badge>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span>{conv.messageCount} mensagens</span>
                </div>
                {conv.lastMessagePreview && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {conv.lastMessagePreview}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CRMPreviousConversationsSection
