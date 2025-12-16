/**
 * AgentOutboxPage
 * 
 * Page for agents to manage their campaigns (outbox).
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Loader2, 
  Inbox, 
  Play, 
  Pause, 
  XCircle, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import {
  getAgentCampaigns,
  getAgentCampaign,
  startAgentCampaign,
  pauseAgentCampaign,
  resumeAgentCampaign,
  cancelAgentCampaign,
  type AgentCampaign
} from '@/services/agent-messaging'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  scheduled: { label: 'Agendada', variant: 'secondary', icon: Clock },
  running: { label: 'Enviando', variant: 'default', icon: RefreshCw },
  paused: { label: 'Pausada', variant: 'secondary', icon: Pause },
  completed: { label: 'Concluída', variant: 'default', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle }
}

export default function AgentOutboxPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)
  
  const queryClient = useQueryClient()

  // Fetch campaigns
  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-campaigns', statusFilter],
    queryFn: () => getAgentCampaigns(statusFilter !== 'all' ? { status: statusFilter } : undefined),
    staleTime: 10000,
    refetchInterval: 10000 // Auto-refresh every 10s for running campaigns
  })

  // Fetch expanded campaign details
  const { data: expandedDetails } = useQuery({
    queryKey: ['agent-campaign', expandedCampaign],
    queryFn: () => expandedCampaign ? getAgentCampaign(expandedCampaign) : null,
    enabled: !!expandedCampaign,
    staleTime: 5000
  })

  // Start mutation
  const startMutation = useMutation({
    mutationFn: startAgentCampaign,
    onSuccess: () => {
      toast.success('Campanha iniciada!')
      queryClient.invalidateQueries({ queryKey: ['agent-campaigns'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao iniciar campanha', { description: error.message })
    }
  })

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: pauseAgentCampaign,
    onSuccess: () => {
      toast.success('Campanha pausada!')
      queryClient.invalidateQueries({ queryKey: ['agent-campaigns'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao pausar campanha', { description: error.message })
    }
  })

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: resumeAgentCampaign,
    onSuccess: () => {
      toast.success('Campanha retomada!')
      queryClient.invalidateQueries({ queryKey: ['agent-campaigns'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao retomar campanha', { description: error.message })
    }
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: cancelAgentCampaign,
    onSuccess: () => {
      toast.success('Campanha cancelada!')
      queryClient.invalidateQueries({ queryKey: ['agent-campaigns'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar campanha', { description: error.message })
    }
  })

  const handleToggleExpand = (campaignId: string) => {
    setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId)
  }

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const renderActions = (campaign: AgentCampaign) => {
    const isLoading = startMutation.isPending || pauseMutation.isPending || 
                      resumeMutation.isPending || cancelMutation.isPending

    switch (campaign.status) {
      case 'pending':
      case 'scheduled':
        return (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Iniciar"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cancelMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Cancelar"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )
      case 'running':
        return (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => pauseMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Pausar"
            >
              <Pause className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cancelMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Cancelar"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )
      case 'paused':
        return (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => resumeMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Retomar"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cancelMutation.mutate(campaign.id)}
              disabled={isLoading}
              title="Cancelar"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Caixa de Saída</h1>
          <p className="text-muted-foreground">
            Gerencie suas campanhas de envio em massa
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="running">Enviando</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Campanhas
          </CardTitle>
          <CardDescription>
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma campanha encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <>
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleExpand(campaign.id)}
                        >
                          {expandedCampaign === campaign.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{renderStatusBadge(campaign.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-32">
                          <Progress value={campaign.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {campaign.sentCount}/{campaign.totalContacts}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {renderActions(campaign)}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedCampaign === campaign.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/50 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="font-medium">{campaign.totalContacts}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Enviados</p>
                              <p className="font-medium text-green-600">{campaign.sentCount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Falhas</p>
                              <p className="font-medium text-red-600">{campaign.failedCount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
                              <p className="font-medium">{campaign.progress}%</p>
                            </div>
                          </div>
                          {expandedDetails?.contacts && expandedDetails.contacts.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-2">Últimos contatos:</p>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {expandedDetails.contacts.slice(0, 10).map((contact) => (
                                  <div key={contact.id} className="flex items-center gap-2 text-sm">
                                    {contact.status === 'sent' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                    {contact.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-500" />}
                                    {contact.status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground" />}
                                    <span>{contact.phone}</span>
                                    {contact.name && <span className="text-muted-foreground">({contact.name})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
