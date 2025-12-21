/**
 * IndependentUserList Component
 * 
 * Lists independent users with pagination and actions.
 * Requirements: 7.1
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  MoreHorizontal,
  Search,
  UserPlus,
  Trash2,
  Edit,
  Key,
  Link,
  Unlink,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  status: 'active' | 'inactive'
  permissions: string[]
  createdAt: string
  lastLoginAt?: string
}

interface IndependentUserListProps {
  onCreateUser: () => void
  onEditUser: (user: User) => void
  onLinkInbox: (user: User) => void
}

export function IndependentUserList({
  onCreateUser,
  onEditUser,
  onLinkInbox
}: IndependentUserListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['independent-users', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      })
      if (search) params.append('search', search)
      
      const response = await api.get<{
        success: boolean
        data: User[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/admin/independent-users?${params}`)
      
      return response.data
    }
  })

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/api/admin/independent-users/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      toast({
        title: 'Usuário desativado',
        description: 'O usuário foi desativado com sucesso.'
      })
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar o usuário.',
        variant: 'destructive'
      })
    }
  })

  // Activate user mutation
  const activateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/api/admin/independent-users/${userId}/activate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      toast({
        title: 'Usuário ativado',
        description: 'O usuário foi ativado com sucesso.'
      })
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível ativar o usuário.',
        variant: 'destructive'
      })
    }
  })

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post<{
        success: boolean
        data: { temporaryPassword?: string }
      }>(`/api/admin/independent-users/${userId}/reset-password`)
      return response.data
    },
    onSuccess: (data) => {
      if (data.data.temporaryPassword) {
        toast({
          title: 'Senha redefinida',
          description: `Nova senha temporária: ${data.data.temporaryPassword}`,
          duration: 10000
        })
      } else {
        toast({
          title: 'Senha redefinida',
          description: 'A senha foi redefinida com sucesso.'
        })
      }
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível redefinir a senha.',
        variant: 'destructive'
      })
    }
  })

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Erro ao carregar usuários
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-10"
          />
        </div>
        <Button onClick={onCreateUser}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Login</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status === 'active' ? (
                        <><CheckCircle className="mr-1 h-3 w-3" /> Ativo</>
                      ) : (
                        <><XCircle className="mr-1 h-3 w-3" /> Inativo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditUser(user)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onLinkInbox(user)}>
                          <Link className="mr-2 h-4 w-4" />
                          Gerenciar Inboxes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(user.id)}>
                          <Key className="mr-2 h-4 w-4" />
                          Redefinir Senha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === 'active' ? (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deactivateMutation.mutate(user.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => activateMutation.mutate(user.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Ativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {data.data.length} de {data.pagination.total} usuários
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
