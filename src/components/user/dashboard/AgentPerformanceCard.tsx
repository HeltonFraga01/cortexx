/**
 * AgentPerformanceCard Component
 * Displays agent list with availability status and performance metrics
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Trophy, MessageSquare, CheckCircle, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentPerformanceProps, AgentMetrics } from '@/types/dashboard'

const availabilityConfig = {
  online: { label: 'Online', color: 'bg-green-500' },
  busy: { label: 'Ocupado', color: 'bg-orange-500' },
  offline: { label: 'Offline', color: 'bg-gray-400' }
}

function AgentItem({
  agent,
  onClick,
  showRank
}: {
  agent: AgentMetrics
  onClick: () => void
  showRank?: number
}) {
  const availability = availabilityConfig[agent.availability] || availabilityConfig.offline

  return (
    <div
      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {showRank && (
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {showRank}
        </div>
      )}
      <div className="relative">
        <Avatar className="h-7 w-7">
          <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name} />
          <AvatarFallback className="text-xs">
            {agent.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
            availability.color
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{agent.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-2.5 w-2.5" />
            {agent.assignedConversations}
          </span>
          <span className="flex items-center gap-0.5">
            <CheckCircle className="h-2.5 w-2.5" />
            {agent.resolvedConversations}
          </span>
        </div>
      </div>
    </div>
  )
}

export function AgentPerformanceCard({
  agents,
  onAgentClick,
  isLoading
}: AgentPerformanceProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-1 pt-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2 pb-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Agentes
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Users className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground mb-2">
              Nenhum agente cadastrado
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate('/user/agents')}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Criar agente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get top 3 agents by resolved conversations
  const topAgents = [...agents]
    .sort((a, b) => b.resolvedConversations - a.resolvedConversations)
    .slice(0, 3)

  // Get online/busy agents count
  const onlineCount = agents.filter(a => a.availability === 'online').length
  const busyCount = agents.filter(a => a.availability === 'busy').length

  return (
    <Card>
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Agentes
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-green-600 text-xs h-5 px-1.5">
              {onlineCount} on
            </Badge>
            {busyCount > 0 && (
              <Badge variant="outline" className="text-orange-600 text-xs h-5 px-1.5">
                {busyCount} busy
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {/* Top performers */}
        {topAgents.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Trophy className="h-3 w-3" />
              <span>Top performers</span>
            </div>
            {topAgents.map((agent, index) => (
              <AgentItem
                key={agent.id}
                agent={agent}
                onClick={() => onAgentClick(agent.id)}
                showRank={index + 1}
              />
            ))}
          </div>
        )}

        {/* View all link */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => navigate('/user/agents')}
        >
          Ver todos
        </Button>
      </CardContent>
    </Card>
  )
}

export default AgentPerformanceCard
