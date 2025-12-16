/**
 * AdminAuditLogList Component
 * 
 * Display audit logs with filters and export functionality.
 * Requirements: 9.2, 9.3
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { adminAuditService } from '@/services/admin-audit'
import type { AdminAuditLog, AdminActionType, AuditLogFilters } from '@/types/admin-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { ScrollText, Download, Search, Loader2 } from 'lucide-react'

const actionTypeLabels: Partial<Record<AdminActionType, string>> = {
  plan_created: 'Plano Criado',
  plan_updated: 'Plano Atualizado',
  plan_deleted: 'Plano Excluído',
  user_plan_assigned: 'Plano Atribuído',
  user_suspended: 'Usuário Suspenso',
  user_reactivated: 'Usuário Reativado',
  user_deleted: 'Usuário Excluído',
  user_password_reset: 'Senha Resetada',
  quota_override_set: 'Override de Quota',
  quota_override_removed: 'Override Removido',
  feature_override_set: 'Override de Feature',
  feature_override_removed: 'Override Removido',
  bulk_action_executed: 'Ação em Massa',
  setting_changed: 'Configuração Alterada',
  user_data_exported: 'Dados Exportados',
  notification_sent: 'Notificação Enviada',
}

export function AdminAuditLogList() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<AuditLogFilters>({})
  const [searchUserId, setSearchUserId] = useState('')

  useEffect(() => {
    loadLogs()
  }, [page, filters])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      const result = await adminAuditService.listAuditLogs(filters, { page, pageSize: 20 })
      setLogs(result.logs)
      setTotal(result.total)
    } catch (error) {
      toast.error('Falha ao carregar logs de auditoria')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setFilters({ ...filters, targetUserId: searchUserId || undefined })
    setPage(1)
  }

  const handleExport = async () => {
    try {
      const blob = await adminAuditService.exportAuditLogs(filters, 'csv')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Logs exportados')
    } catch (error) {
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR')
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Log de Auditoria
            </CardTitle>
            <CardDescription>Histórico de ações administrativas</CardDescription>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Buscar por ID do usuário..."
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Select
            value={filters.actionType || 'all'}
            onValueChange={(value) => {
              setFilters({ ...filters, actionType: value === 'all' ? undefined : value as AdminActionType })
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(actionTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Usuário Alvo</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {actionTypeLabels[log.actionType] || log.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.adminId.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.targetUserId ? `${log.targetUserId.substring(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.details)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages} ({total} registros)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
