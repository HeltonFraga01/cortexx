/**
 * AuditLogUser Component
 * 
 * Displays audit log with filters for user dashboard.
 * Reuses logic from admin AuditLog.
 * 
 * Requirements: 9.1, 9.2, 9.4
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Eye,
  Calendar,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { AuditLog as AuditLogType, AuditLogFilters, Agent } from '@/types/multi-user'
import { listAuditLogs, exportAuditLogs } from '@/services/account-audit'
import { listAgents } from '@/services/account-agents'

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  assign: 'Atribuição',
  invite: 'Convite',
  register: 'Registro',
  password_change: 'Alteração de Senha',
  role_change: 'Alteração de Papel',
  status_change: 'Alteração de Status',
}

const RESOURCE_LABELS: Record<string, string> = {
  agent: 'Agente',
  team: 'Equipe',
  inbox: 'Caixa de Entrada',
  role: 'Papel',
  conversation: 'Conversa',
  message: 'Mensagem',
  contact: 'Contato',
  webhook: 'Webhook',
  session: 'Sessão',
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-100 text-green-800',
  logout: 'bg-gray-100 text-gray-800',
  create: 'bg-blue-100 text-blue-800',
  update: 'bg-yellow-100 text-yellow-800',
  delete: 'bg-red-100 text-red-800',
  assign: 'bg-purple-100 text-purple-800',
  invite: 'bg-indigo-100 text-indigo-800',
  register: 'bg-green-100 text-green-800',
  password_change: 'bg-orange-100 text-orange-800',
  role_change: 'bg-pink-100 text-pink-800',
  status_change: 'bg-cyan-100 text-cyan-800',
}

export function AuditLogUser() {
  const [logs, setLogs] = useState<AuditLogType[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLogType | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  
  // Filters
  const [agentFilter, setAgentFilter] = useState<string>('')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [resourceFilter, setResourceFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  
  const itemsPerPage = 20

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const filters: AuditLogFilters = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      }
      
      if (agentFilter && agentFilter !== 'all') filters.agentId = agentFilter
      if (actionFilter && actionFilter !== 'all') filters.action = actionFilter
      if (resourceFilter && resourceFilter !== 'all') filters.resourceType = resourceFilter
      
      const result = await listAuditLogs(filters)
      setLogs(result.logs)
      setTotalCount(result.pagination.total)
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      toast.error('Erro ao carregar logs de auditoria')
    } finally {
      setLoading(false)
    }
  }, [currentPage, agentFilter, actionFilter, resourceFilter])

  const fetchAgents = useCallback(async () => {
    try {
      const data = await listAgents()
      setAgents(data)
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setCurrentPage(1)
  }, [agentFilter, actionFilter, resourceFilter])

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'Sistema'
    const agent = agents.find(a => a.id === agentId)
    return agent?.name || 'Desconhecido'
  }

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      getAgentName(log.agentId).toLowerCase().includes(searchLower) ||
      (ACTION_LABELS[log.action] || log.action).toLowerCase().includes(searchLower) ||
      (RESOURCE_LABELS[log.resourceType] || log.resourceType).toLowerCase().includes(searchLower) ||
      log.resourceId?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const handleViewDetails = (log: AuditLogType) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const filters: AuditLogFilters = {}
      if (agentFilter && agentFilter !== 'all') filters.agentId = agentFilter
      if (actionFilter && actionFilter !== 'all') filters.action = actionFilter
      if (resourceFilter && resourceFilter !== 'all') filters.resourceType = resourceFilter
      
      const blob = await exportAuditLogs(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Exportação concluída!')
    } catch (error) {
      console.error('Error exporting audit logs:', error)
      toast.error('Erro ao exportar logs')
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setAgentFilter('')
    setActionFilter('')
    setResourceFilter('')
    setSearchTerm('')
  }

  const hasActiveFilters = agentFilter || actionFilter || resourceFilter || searchTerm

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Log de Auditoria</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Histórico de ações realizadas no sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchLogs} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Agentes</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Recursos</SelectItem>
                {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={FileText}
          iconColor="text-slate-500"
          title={`Registros (${totalCount})`}
        >
          <p className="text-sm text-muted-foreground">Histórico de ações dos agentes</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={10} />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="Nenhum registro encontrado"
                description={hasActiveFilters ? 'Tente ajustar os filtros' : 'Ainda não há registros de auditoria'}
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
                      <TableHead className="w-[20%] px-3 sm:px-6">Data/Hora</TableHead>
                      <TableHead className="w-[18%] px-2 sm:px-4">Agente</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Ação</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Recurso</TableHead>
                      <TableHead className="w-[20%] px-2 sm:px-4">ID do Recurso</TableHead>
                      <TableHead className="w-[12%] text-right px-3 sm:px-6">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="group hover:bg-muted/50">
                        <TableCell className="px-3 sm:px-6">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-medium">
                                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <span className="text-sm font-medium">{getAgentName(log.agentId)}</span>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant="outline" className="text-xs">
                            {RESOURCE_LABELS[log.resourceType] || log.resourceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <span className="text-sm text-muted-foreground font-mono truncate max-w-[150px] block">
                            {log.resourceId || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right px-3 sm:px-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                            className="h-8"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
        {!loading && totalCount > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} registros
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

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro</DialogTitle>
            <DialogDescription>
              Informações completas sobre esta ação
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                  <p className="text-sm">
                    {format(new Date(selectedLog.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Agente</label>
                  <p className="text-sm">{getAgentName(selectedLog.agentId)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Ação</label>
                  <p className="text-sm">
                    <Badge className={`text-xs ${ACTION_COLORS[selectedLog.action] || 'bg-gray-100 text-gray-800'}`}>
                      {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recurso</label>
                  <p className="text-sm">
                    <Badge variant="outline" className="text-xs">
                      {RESOURCE_LABELS[selectedLog.resourceType] || selectedLog.resourceType}
                    </Badge>
                  </p>
                </div>
                {selectedLog.resourceId && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">ID do Recurso</label>
                    <p className="text-sm font-mono">{selectedLog.resourceId}</p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Endereço IP</label>
                    <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>
              
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Detalhes Adicionais</label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AuditLogUser
