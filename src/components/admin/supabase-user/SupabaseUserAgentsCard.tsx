/**
 * SupabaseUserAgentsCard
 * 
 * Displays user's agents (team members)
 */

import { Users, Mail, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UserAgent } from '@/types/supabase-user'

interface SupabaseUserAgentsCardProps {
  agents: UserAgent[]
}

export function SupabaseUserAgentsCard({ agents }: SupabaseUserAgentsCardProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'text-green-500'
      case 'busy': return 'text-yellow-500'
      case 'offline': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'online': return 'Online'
      case 'busy': return 'Ocupado'
      case 'offline': return 'Offline'
      default: return 'Desconhecido'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agentes
          </div>
          <Badge variant="secondary">{agents.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum agente cadastrado
          </p>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div 
                key={agent.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {agent.name?.[0]?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    {agent.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {agent.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {agent.role && (
                    <Badge variant="outline" className="text-xs">
                      {agent.role}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Circle className={`h-2 w-2 fill-current ${getStatusColor(agent.availability_status)}`} />
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(agent.availability_status)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
