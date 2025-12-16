import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui-custom/StatsCard'
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton'
import { CardHeaderWithIcon } from '@/components/ui-custom/CardHeaderWithIcon'
import { 
  MessageSquare, 
  Users, 
  Inbox, 
  User,
  Clock,
  Send,
  ChevronRight
} from 'lucide-react'
import { getMyStats } from '@/services/agent-data'

// Helper to get availability color
const getAvailabilityBgColor = (status: string) => {
  switch (status) {
    case 'online': return 'bg-green-500'
    case 'busy': return 'bg-yellow-500'
    case 'offline': return 'bg-gray-500'
    default: return 'bg-gray-500'
  }
}

export default function AgentOverview() {
  const { agent, account, permissions, hasPermission } = useAgentAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ 
    totalInboxes: 0, 
    totalConversations: 0, 
    openConversations: 0, 
    pendingConversations: 0, 
    totalContacts: 0 
  })
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await getMyStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  if (isLoadingStats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Carregando dados...</p>
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

  return (
    <div className="space-y-6">
      {/* Header with Avatar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {agent?.avatarUrl ? (
              <img 
                src={agent.avatarUrl} 
                alt={agent.name}
                className="h-14 w-14 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-3 shadow-lg shadow-orange-500/20">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getAvailabilityBgColor(agent?.availability || 'offline')} rounded-full border-2 border-background`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Olá, {agent?.name ? agent.name.split(' ')[0] : 'Agente'}
            </h1>
            <p className="text-muted-foreground">{account?.name || 'Conta'}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Using StatsCard with gradient backgrounds */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Caixas de Entrada"
          value={stats.totalInboxes}
          icon={Inbox}
          variant="blue"
        />

        <StatsCard
          title="Conversas Abertas"
          value={stats.openConversations}
          icon={MessageSquare}
          variant="green"
        />

        <StatsCard
          title="Pendentes"
          value={stats.pendingConversations}
          icon={Clock}
          variant={stats.pendingConversations > 0 ? 'orange' : 'purple'}
        />

        <StatsCard
          title="Contatos"
          value={stats.totalContacts}
          icon={Users}
          variant="purple"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Agent Info Card */}
        <Card>
          <CardHeaderWithIcon icon={User} title="Meu Perfil" className="pb-3" />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {agent?.avatarUrl ? (
                <img 
                  src={agent.avatarUrl} 
                  alt={agent.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {agent?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">{agent?.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{agent?.email}</p>
                <Badge variant="secondary" className="mt-1">
                  {agent?.role}
                </Badge>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={() => navigate('/agent/profile')}
            >
              Ver Perfil Completo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card>
          <CardHeaderWithIcon icon={Users} title="Conta" className="pb-3" />
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Nome da Conta</span>
                <p className="font-medium">{account?.name}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Permissões</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {permissions.slice(0, 4).map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs font-normal">
                      {perm.split(':')[0]}
                    </Badge>
                  ))}
                  {permissions.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{permissions.length - 4}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            <CardDescription>Acesse as principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasPermission('conversations:view') && (
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/agent/chat')}
              >
                <div className="p-1.5 rounded-lg bg-green-500/10 mr-3">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                </div>
                Chat
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            )}
            {hasPermission('messages:send') && (
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/agent/messaging')}
              >
                <div className="p-1.5 rounded-lg bg-orange-500/10 mr-3">
                  <Send className="h-4 w-4 text-orange-500" />
                </div>
                Enviar Mensagens
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            )}
            {hasPermission('contacts:view') && (
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/agent/contacts')}
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 mr-3">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                Contatos
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            )}
            {hasPermission('inboxes:view') && (
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/agent/inboxes')}
              >
                <div className="p-1.5 rounded-lg bg-blue-500/10 mr-3">
                  <Inbox className="h-4 w-4 text-blue-500" />
                </div>
                Caixas de Entrada
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
