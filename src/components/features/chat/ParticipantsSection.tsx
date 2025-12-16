/**
 * ParticipantsSection Component
 * 
 * Displays group participants
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5
 */

import { useQuery } from '@tanstack/react-query'
import { useChatApi } from '@/hooks/useChatApi'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Shield } from 'lucide-react'

interface ParticipantsSectionProps {
  conversationId: number
  isGroup: boolean
}

export function ParticipantsSection({ conversationId, isGroup }: ParticipantsSectionProps) {
  const chatApi = useChatApi()
  
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['groupParticipants', conversationId, chatApi.isAgentMode],
    queryFn: () => chatApi.getGroupParticipants(conversationId),
    enabled: isGroup,
    staleTime: 60000
  })

  // Don't render for non-group conversations
  if (!isGroup) {
    return null
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Participantes não disponíveis</p>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  const formatPhone = (jid: string) => {
    return jid.replace('@s.whatsapp.net', '')
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-2">
        {participants.length} participante{participants.length !== 1 ? 's' : ''}
      </div>
      
      {participants.map((participant) => (
        <div
          key={participant.jid}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={participant.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(participant.name || formatPhone(participant.jid))}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {participant.name || formatPhone(participant.jid)}
              </span>
              {(participant.isAdmin || participant.isSuperAdmin) && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {participant.isSuperAdmin ? 'Super Admin' : 'Admin'}
                </Badge>
              )}
            </div>
            {participant.name && (
              <span className="text-xs text-muted-foreground">
                {formatPhone(participant.jid)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ParticipantsSection
