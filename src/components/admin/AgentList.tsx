/**
 * AgentList Component
 * 
 * Displays list of agents with status, role, last activity.
 * Actions: edit, deactivate, change role.
 * 
 * Requirements: 2.6
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Edit,
  User,
  Users,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  UserX,
  UserCheck,
  Shield,
  Mail,
  Clock,
  Circle,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Agent, AgentRole, AgentStatus, AvailabilityStatus } from '@/types/multi-user'
import { listAgents, deactivateAgent, activateAgent, updateAgentRole } from '@/services/account-agents'

interface AgentListProps {
  onCreateAgent?: () => void
  onInviteAgent?: () => void
  onEditAgent?: (agent: Agent) => void
}

const ROLE_LABELS: Record<AgentRole, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<AgentRole, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  administrator: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  agent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  pending: 'Pendente',
}

const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
  online: 'text-green-500',
  busy: 'text-yellow-500',
  offline: 'text-gray-400',
}

export function AgentList({ onCreateAgent, onInviteAgent, onEditAgent }: AgentListProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const itemsPerPage = 10

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listAgents()
      setAgents(data)
    } catch (error) {
      console.error('Error fetching agents:', error)
      toast.error('Erro ao carregar agentes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleDeactivate = async () => {
    if (!selectedAgent) return

    try {
      setActionLoading(true)
      await deactivateAgent(selectedAgent.id)
      toast.success('Agente desativado com sucesso')
      setDeactivateDialogOpen(false)
      setSelectedAgent(null)
      fetchAgents()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desativar agente')
    } finally {
      setActionLoading(false)
    }
  }

  const handleActivate = async (agent: Agent) => {
    try {
      setActionLoading(true)
      await activateAgent(agent.id)
      toast.success('Agente ativado com sucesso')
      fetchAgents()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ativar agente')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRoleChange = async (agent: Agent, newRole: AgentRole) => {
    try {
      setActionLoading(true)
      await updateAgentRole(agent.id, newRole)
      toast.success('Papel atualizado com sucesso')
      fetchAgents()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar papel')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    const matchesRole = roleFilter === 'all' || agent.role === roleFilter
    return matchesSearch && matchesStatus && matchesRole
  })

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAgents = filteredAgents.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, roleFilter])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Agentes</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gerencie os agentes da sua conta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchAgents} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onInviteAgent && (
            <Button onClick={onInviteAgent} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          )}
          {onCreateAgent && (
            <Button onClick={onCreateAgent}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agente
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AgentStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AgentRole | 'all')}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Papéis</SelectItem>
                <SelectItem value="owner">Proprietário</SelectItem>
                <SelectItem value="administrator">Administrador</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Users}
          iconColor="text-blue-500"
          title={`Agentes (${filteredAgents.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todos os agentes da conta</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={5} />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhum agente encontrado"
                description={searchTerm ? 'Tente uma busca diferente' : 'Convide ou crie o primeiro agente'}
              />
            </div>
          ) : (
            <>
              <div className="sm:hidden text-xs text-muted-foreground text-center py-2 px-4 bg-muted/50 border-b">
                ← Deslize horizontalmente para ver mais →
              </div>
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[25%] px-3 sm:px-6">Agente</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Papel</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">Status</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">Disponibilidade</TableHead>
                      <TableHead className="w-[20%] px-2 sm:px-4">Última Atividade</TableHead>
                      <TableHead className="w-[16%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAgents.map((agent) => (
                      <TableRow key={agent.id} className="group hover:bg-muted/50">
                        <TableCell className="font-medium px-3 sm:px-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                              {agent.avatarUrl ? (
                                <AvatarImage src={agent.avatarUrl} alt={agent.name} className="object-cover" />
                              ) : null}
                              <AvatarFallback className={agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted'}>
                                {getInitials(agent.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-sm">{agent.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{agent.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge className={`${ROLE_COLORS[agent.role]} text-xs whitespace-nowrap`}>
                            <Shield className="h-3 w-3 mr-1" />
                            {ROLE_LABELS[agent.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge
                            variant={agent.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs whitespace-nowrap"
                          >
                            {agent.status === 'active' ? (
                              <UserCheck className="h-3 w-3 mr-1" />
                            ) : (
                              <UserX className="h-3 w-3 mr-1" />
                            )}
                            {STATUS_LABELS[agent.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <div className="flex items-center gap-2">
                            <Circle className={`h-3 w-3 fill-current ${AVAILABILITY_COLORS[agent.availability]}`} />
                            <span className="text-sm capitalize">{agent.availability}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {agent.lastActivityAt
                              ? formatDistanceToNow(new Date(agent.lastActivityAt), { addSuffix: true, locale: ptBR })
                              : 'Nunca'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-3 sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditAgent?.(agent)}
                              className="h-8"
                            >
                              <Edit className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => onEditAgent?.(agent)}>
                                  <User className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                {agent.role !== 'owner' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChange(agent, 'administrator')}
                                      disabled={agent.role === 'administrator' || actionLoading}
                                    >
                                      <Shield className="h-4 w-4 mr-2" />
                                      Tornar Administrador
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChange(agent, 'agent')}
                                      disabled={agent.role === 'agent' || actionLoading}
                                    >
                                      <User className="h-4 w-4 mr-2" />
                                      Tornar Agente
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChange(agent, 'viewer')}
                                      disabled={agent.role === 'viewer' || actionLoading}
                                    >
                                      <User className="h-4 w-4 mr-2" />
                                      Tornar Visualizador
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {agent.status === 'active' ? (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedAgent(agent)
                                          setDeactivateDialogOpen(true)
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <UserX className="h-4 w-4 mr-2" />
                                        Desativar Agente
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleActivate(agent)} disabled={actionLoading}>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Ativar Agente
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && filteredAgents.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAgents.length)} de {filteredAgents.length} agentes
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Agente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o agente <strong>{selectedAgent?.name}</strong>? O agente não poderá mais
              acessar o sistema até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? 'Desativando...' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AgentList
