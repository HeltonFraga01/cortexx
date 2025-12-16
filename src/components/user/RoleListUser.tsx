/**
 * RoleListUser Component
 * 
 * Displays default and custom roles with permissions for user dashboard.
 * Reuses logic from admin RoleList.
 * 
 * Requirements: 5.1
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Edit,
  Shield,
  RefreshCw,
  Search,
  MoreHorizontal,
  Trash2,
  Lock,
  Key,
} from 'lucide-react'
import { toast } from 'sonner'

import type { CustomRole, DefaultRole, Permission } from '@/types/multi-user'
import { listRoles, deleteCustomRole } from '@/services/account-roles'

interface RoleListUserProps {
  onCreateRole?: () => void
  onEditRole?: (role: CustomRole) => void
}

interface RoleDisplay {
  id: string
  name: string
  description?: string
  permissions: Permission[] | ['*']
  isDefault: boolean
  usageCount?: number
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: string[] }> = {
  conversations: {
    label: 'Conversas',
    permissions: ['conversations:view', 'conversations:create', 'conversations:assign', 'conversations:delete'],
  },
  messages: {
    label: 'Mensagens',
    permissions: ['messages:send', 'messages:delete'],
  },
  contacts: {
    label: 'Contatos',
    permissions: ['contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete'],
  },
  agents: {
    label: 'Agentes',
    permissions: ['agents:view', 'agents:create', 'agents:edit', 'agents:delete'],
  },
  teams: {
    label: 'Equipes',
    permissions: ['teams:view', 'teams:manage'],
  },
  inboxes: {
    label: 'Caixas de Entrada',
    permissions: ['inboxes:view', 'inboxes:manage'],
  },
  settings: {
    label: 'Configurações',
    permissions: ['settings:view', 'settings:edit', 'webhooks:manage', 'integrations:manage'],
  },
  reports: {
    label: 'Relatórios',
    permissions: ['reports:view'],
  },
}

export function RoleListUser({ onCreateRole, onEditRole }: RoleListUserProps) {
  const [roles, setRoles] = useState<RoleDisplay[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleDisplay | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listRoles()
      
      const defaultRoles: RoleDisplay[] = data.defaultRoles.map((role: DefaultRole) => ({
        id: role.name,
        name: ROLE_LABELS[role.name] || role.name,
        permissions: role.permissions,
        isDefault: true,
      }))

      const customRoles: RoleDisplay[] = data.customRoles.map((role: CustomRole) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isDefault: false,
      }))

      setRoles([...defaultRoles, ...customRoles])
      setAvailablePermissions(data.availablePermissions)
    } catch (error) {
      console.error('Error fetching roles:', error)
      toast.error('Erro ao carregar papéis')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleDelete = async () => {
    if (!selectedRole || selectedRole.isDefault) return

    try {
      setActionLoading(true)
      await deleteCustomRole(selectedRole.id)
      toast.success('Papel excluído com sucesso')
      setDeleteDialogOpen(false)
      setSelectedRole(null)
      fetchRoles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir papel')
    } finally {
      setActionLoading(false)
    }
  }

  const getPermissionCount = (permissions: Permission[] | ['*']): string => {
    if (permissions.includes('*' as Permission)) {
      return 'Todas'
    }
    return `${permissions.length}/${availablePermissions.length}`
  }

  const getPermissionCategories = (permissions: Permission[] | ['*']): string[] => {
    if (permissions.includes('*' as Permission)) {
      return Object.values(PERMISSION_CATEGORIES).map(c => c.label)
    }
    
    const categories: string[] = []
    for (const [, category] of Object.entries(PERMISSION_CATEGORIES)) {
      const hasAny = category.permissions.some(p => permissions.includes(p as Permission))
      if (hasAny) {
        categories.push(category.label)
      }
    }
    return categories
  }

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Papéis</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Configure permissões para diferentes tipos de usuários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchRoles} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onCreateRole && (
            <Button onClick={onCreateRole}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Papel
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
              placeholder="Buscar papéis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Shield}
          iconColor="text-amber-500"
          title={`Papéis (${filteredRoles.length})`}
        >
          <p className="text-sm text-muted-foreground">Papéis padrão e personalizados</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={5} />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Shield}
                title="Nenhum papel encontrado"
                description={searchTerm ? 'Tente uma busca diferente' : 'Crie um papel personalizado'}
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
                      <TableHead className="w-[30%] px-3 sm:px-6">Papel</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Tipo</TableHead>
                      <TableHead className="w-[15%] px-2 sm:px-4">Permissões</TableHead>
                      <TableHead className="w-[25%] px-2 sm:px-4">Categorias</TableHead>
                      <TableHead className="w-[15%] text-right px-3 sm:px-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoles.map((role) => (
                      <TableRow key={role.id} className="group hover:bg-muted/50">
                        <TableCell className="font-medium px-3 sm:px-6">
                          <div className="min-w-0 flex items-center gap-2">
                            {role.isDefault ? (
                              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <Key className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <div>
                              <div className="truncate font-semibold text-sm">{role.name}</div>
                              {role.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {role.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant={role.isDefault ? 'secondary' : 'default'} className="text-xs">
                            {role.isDefault ? 'Padrão' : 'Personalizado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant="outline" className="text-xs">
                            {getPermissionCount(role.permissions)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <TooltipProvider>
                            <div className="flex flex-wrap gap-1">
                              {getPermissionCategories(role.permissions).slice(0, 3).map((cat) => (
                                <Badge key={cat} variant="outline" className="text-xs">
                                  {cat}
                                </Badge>
                              ))}
                              {getPermissionCategories(role.permissions).length > 3 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      +{getPermissionCategories(role.permissions).length - 3}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{getPermissionCategories(role.permissions).slice(3).join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right px-3 sm:px-6">
                          {role.isDefault ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <Lock className="h-3 w-3 mr-1" />
                              Bloqueado
                            </Badge>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEditRole?.(role as unknown as CustomRole)}
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
                                  <DropdownMenuItem onClick={() => onEditRole?.(role as unknown as CustomRole)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar Papel
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedRole(role)
                                      setDeleteDialogOpen(true)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir Papel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Papel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o papel <strong>{selectedRole?.name}</strong>? Esta ação não pode ser
              desfeita. Agentes com este papel serão alterados para o papel padrão &quot;Agente&quot;.
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

export default RoleListUser
