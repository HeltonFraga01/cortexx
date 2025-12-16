/**
 * InboxList Component
 * 
 * Displays list of inboxes with member count and actions.
 * 
 * Requirements: 4.1
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Inbox,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Settings,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { InboxWithStats } from '@/types/multi-user'
import { listInboxes, deleteInbox } from '@/services/account-inboxes'

interface InboxListProps {
  onCreateInbox?: () => void
  onEditInbox?: (inbox: InboxWithStats) => void
  onManageAgents?: (inbox: InboxWithStats) => void
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web Chat',
  api: 'API',
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱',
  email: '📧',
  web: '💬',
  api: '🔌',
}

export function InboxList({ onCreateInbox, onEditInbox, onManageAgents }: InboxListProps) {
  const [inboxes, setInboxes] = useState<InboxWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedInbox, setSelectedInbox] = useState<InboxWithStats | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const itemsPerPage = 10

  const fetchInboxes = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listInboxes()
      setInboxes(data)
    } catch (error) {
      console.error('Error fetching inboxes:', error)
      toast.error('Erro ao carregar caixas de entrada')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInboxes()
  }, [fetchInboxes])

  const handleDelete = async () => {
    if (!selectedInbox) return

    try {
      setActionLoading(true)
      await deleteInbox(selectedInbox.id)
      toast.success('Caixa de entrada excluída com sucesso')
      setDeleteDialogOpen(false)
      setSelectedInbox(null)
      fetchInboxes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir caixa de entrada')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredInboxes = inboxes.filter((inbox) =>
    inbox.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inbox.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredInboxes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInboxes = filteredInboxes.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Caixas de Entrada</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Configure canais de comunicação para sua equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchInboxes} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onCreateInbox && (
            <Button onClick={onCreateInbox}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Caixa
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar caixas de entrada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inboxes Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Inbox}
          iconColor="text-purple-500"
          title={`Caixas de Entrada (${filteredInboxes.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todas as caixas de entrada da conta</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={5} />
            </div>
          ) : filteredInboxes.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Inbox}
                title="Nenhuma caixa de entrada encontrada"
                description={searchTerm ? 'Tente uma busca diferente' : 'Crie a primeira caixa de entrada'}
              />
            </div>
          ) : (
            <>
              <div className="sm:hidden text-xs text-muted-foreground text-center py-2 px-4 bg-muted/50 border-b">
                ← Deslize horizontalmente para ver mais →
              </div>
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] px-3 sm:px-6">Caixa de Entrada</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">Canal</TableHead>
                      <TableHead className="w-[12%] px-2 sm:px-4">Agentes</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Auto-Atribuição</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Criada em</TableHead>
                      <TableHead className="w-[16%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInboxes.map((inbox) => (
                      <TableRow key={inbox.id} className="group hover:bg-muted/50">
                        <TableCell className="font-medium px-3 sm:px-6">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{CHANNEL_ICONS[inbox.channelType] || '📥'}</span>
                              <span className="truncate font-semibold text-sm">{inbox.name}</span>
                            </div>
                            {inbox.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px] ml-7">
                                {inbox.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant="outline" className="text-xs">
                            {CHANNEL_LABELS[inbox.channelType] || inbox.channelType}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant="secondary" className="text-xs">
                            <UserPlus className="h-3 w-3 mr-1" />
                            {inbox.memberCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant={inbox.enableAutoAssignment ? 'default' : 'outline'} className="text-xs">
                            {inbox.enableAutoAssignment ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(inbox.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right px-3 sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditInbox?.(inbox)}
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
                                <DropdownMenuItem onClick={() => onEditInbox?.(inbox)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Configurações
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onManageAgents?.(inbox)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Gerenciar Agentes
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Ver Conversas
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedInbox(inbox)
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir Caixa
                                </DropdownMenuItem>
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
        {!loading && filteredInboxes.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredInboxes.length)} de {filteredInboxes.length} caixas
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Caixa de Entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a caixa de entrada <strong>{selectedInbox?.name}</strong>? Esta ação não pode ser
              desfeita e todas as conversas associadas serão arquivadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default InboxList
