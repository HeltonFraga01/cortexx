import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Inbox, MessageSquare, Users } from 'lucide-react'
import { toast } from 'sonner'
import { getMyInboxes, type AgentInbox } from '@/services/agent-data'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import { StatsCard } from '@/components/ui-custom/StatsCard'
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton'
import { EmptyState } from '@/components/ui-custom/EmptyState'
import { GradientCard, getIconClasses } from '@/components/ui-custom/GradientCard'

export default function AgentInboxesPage() {
  const { agent } = useAgentAuth()
  const [inboxes, setInboxes] = useState<AgentInbox[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInboxes()
  }, [])

  const loadInboxes = async () => {
    try {
      const data = await getMyInboxes()
      setInboxes(data)
    } catch (error) {
      toast.error('Erro ao carregar caixas de entrada')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Caixas de Entrada</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
        <LoadingSkeleton variant="stats" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    )
  }

  const activeInboxes = inboxes.filter(i => i.enableAutoAssignment)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-3 shadow-lg shadow-blue-500/20">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Caixas de Entrada</h1>
            <p className="text-muted-foreground">Caixas atribuídas a {agent?.name?.split(' ')[0] || 'você'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatsCard
          title="Total de Caixas"
          value={inboxes.length}
          icon={Inbox}
          variant="blue"
        />
        <StatsCard
          title="Auto-atribuição"
          value={activeInboxes.length}
          icon={Users}
          variant="green"
        />
        <StatsCard
          title="Canais Ativos"
          value={new Set(inboxes.map(i => i.channelType)).size}
          icon={MessageSquare}
          variant="purple"
        />
      </div>

      {/* Inboxes List */}
      {inboxes.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma caixa de entrada"
          description="Você ainda não foi atribuído a nenhuma caixa de entrada."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {inboxes.map((inbox) => (
            <GradientCard 
              key={inbox.id} 
              variant="blue"
              className="hover:shadow-md transition-all cursor-pointer"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`p-2 rounded-lg ${getIconClasses('blue')}`}>
                    <Inbox className="h-4 w-4" />
                  </div>
                  <span className="truncate">{inbox.name}</span>
                </CardTitle>
                {inbox.description && (
                  <CardDescription className="line-clamp-2">{inbox.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {inbox.channelType}
                  </Badge>
                  {inbox.enableAutoAssignment && (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-0">
                      Auto-atribuição
                    </Badge>
                  )}
                </div>
              </CardContent>
            </GradientCard>
          ))}
        </div>
      )}
    </div>
  )
}
