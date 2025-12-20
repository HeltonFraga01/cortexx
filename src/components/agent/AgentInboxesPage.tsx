/**
 * AgentInboxesPage Component
 * 
 * Displays list of inboxes assigned to the current agent with connection status.
 * Shows online/offline status for WhatsApp inboxes with automatic polling.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2
 */

import { useState, useEffect, useCallback } from 'react'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Inbox, MessageSquare, Users, RefreshCw, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { 
  getMyInboxes, 
  getMyInboxesStatus,
  type AgentInbox, 
  type InboxStatus,
  type InboxStatusSummary
} from '@/services/agent-data'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import { StatsCard } from '@/components/ui-custom/StatsCard'
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton'
import { EmptyState } from '@/components/ui-custom/EmptyState'
import { GradientCard, getIconClasses } from '@/components/ui-custom/GradientCard'
import { InboxStatusBadge } from './InboxStatusBadge'

// Polling interval in milliseconds (30 seconds)
const STATUS_POLLING_INTERVAL = 30000

export default function AgentInboxesPage() {
  const { agent } = useAgentAuth()
  const [inboxes, setInboxes] = useState<AgentInbox[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inboxStatuses, setInboxStatuses] = useState<Record<string, InboxStatus>>({})
  const [statusSummary, setStatusSummary] = useState<InboxStatusSummary>({ total: 0, online: 0, offline: 0, connecting: 0 })
  const [statusLoading, setStatusLoading] = useState(false)

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

  const loadStatuses = useCallback(async () => {
    try {
      setStatusLoading(true)
      const { statuses, summary } = await getMyInboxesStatus()
      
      // Convert array to record for easy lookup
      const statusMap: Record<string, InboxStatus> = {}
      statuses.forEach(status => {
        statusMap[status.inboxId] = status
      })
      
      setInboxStatuses(statusMap)
      setStatusSummary(summary)
    } catch (error) {
      console.error('Failed to load inbox statuses:', error)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    setIsLoading(true)
    await loadInboxes()
    await loadStatuses()
  }

  useEffect(() => {
    loadInboxes()
  }, [])

  // Load statuses after inboxes are loaded
  useEffect(() => {
    if (inboxes.length > 0) {
      loadStatuses()
    }
  }, [inboxes.length, loadStatuses])

  // Polling for status updates
  useEffect(() => {
    if (inboxes.length === 0) return

    const interval = setInterval(() => {
      loadStatuses()
    }, STATUS_POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [inboxes.length, loadStatuses])

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
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={isLoading || statusLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Caixas"
          value={inboxes.length}
          icon={Inbox}
          variant="blue"
        />
        <StatsCard
          title="Caixas Online"
          value={`${statusSummary.online}/${statusSummary.total}`}
          icon={Wifi}
          variant={statusSummary.online > 0 ? 'green' : 'red'}
          description={statusSummary.online === 0 && statusSummary.total > 0 ? 'Nenhuma conectada' : undefined}
        />
        <StatsCard
          title="Auto-atribuição"
          value={activeInboxes.length}
          icon={Users}
          variant="purple"
        />
        <StatsCard
          title="Canais Ativos"
          value={new Set(inboxes.map(i => i.channelType)).size}
          icon={MessageSquare}
          variant="orange"
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
          {inboxes.map((inbox) => {
            const status = inboxStatuses[inbox.id]
            const isWhatsApp = inbox.channelType === 'whatsapp'
            
            return (
              <GradientCard 
                key={inbox.id} 
                variant="blue"
                className="hover:shadow-md transition-all"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${getIconClasses('blue')}`}>
                        <Inbox className="h-4 w-4" />
                      </div>
                      <span className="truncate">{inbox.name}</span>
                    </div>
                    {isWhatsApp && (
                      <InboxStatusBadge 
                        status={status?.status || 'unknown'} 
                        isLoading={statusLoading && !status}
                        size="sm"
                      />
                    )}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
