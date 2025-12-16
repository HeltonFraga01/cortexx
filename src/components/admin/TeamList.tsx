/**
 * TeamList Component
 * 
 * Displays list of teams with member count.
 * 
 * Requirements: 5.4
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
  Users,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { TeamWithStats } from '@/types/multi-user'
import { listTeams, deleteTeam } from '@/services/account-teams'

interface TeamListProps {
  onCreateTeam?: () => void
  onEditTeam?: (team: TeamWithStats) => void
  onManageMembers?: (team: TeamWithStats) => void
}

export function TeamList({ onCreateTeam, onEditTeam, onManageMembers }: TeamListProps) {
  const [teams, setTeams] = useState<TeamWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const itemsPerPage = 10

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listTeams()
      setTeams(data)
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Erro ao carregar equipes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleDelete = async () => {
    if (!selectedTeam) return

    try {
      setActionLoading(true)
      await deleteTeam(selectedTeam.id)
      toast.success('Equipe excluída com sucesso')
      setDeleteDialogOpen(false)
      setSelectedTeam(null)
      fetchTeams()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir equipe')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTeams = filteredTeams.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Equipes</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Organize seus agentes em equipes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchTeams} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onCreateTeam && (
            <Button onClick={onCreateTeam}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
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
              placeholder="Buscar equipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Teams Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Users}
          iconColor="text-blue-500"
          title={`Equipes (${filteredTeams.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todas as equipes da conta</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={5} />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Nenhuma equipe encontrada"
                description={searchTerm ? 'Tente uma busca diferente' : 'Crie a primeira equipe'}
              />
            </div>
          ) : (
            <>
              <div className="sm:hidden text-xs text-muted-foreground text-center py-2 px-4 bg-muted/50 border-b">
                ← Deslize horizontalmente para ver mais →
              </div>
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] px-3 sm:px-6">Equipe</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Membros</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Auto-Atribuição</TableHead>
                      <TableHead className="w-[20%] px-2 sm:px-4">Criada em</TableHead>
                      <TableHead className="w-[20%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTeams.map((team) => (
                      <TableRow key={team.id} className="group hover:bg-muted/50">
                        <TableCell className="font-medium px-3 sm:px-6">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-sm">{team.name}</div>
                            {team.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {team.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {team.memberCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant={team.allowAutoAssign ? 'default' : 'outline'} className="text-xs">
                            {team.allowAutoAssign ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right px-3 sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditTeam?.(team)}
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
                                <DropdownMenuItem onClick={() => onEditTeam?.(team)}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Configurações
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onManageMembers?.(team)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Gerenciar Membros
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTeam(team)
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir Equipe
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
        {!loading && filteredTeams.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredTeams.length)} de {filteredTeams.length} equipes
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
            <AlertDialogTitle>Excluir Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe <strong>{selectedTeam?.name}</strong>? Esta ação não pode ser
              desfeita e todos os membros serão removidos da equipe.
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

export default TeamList
