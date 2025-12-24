/**
 * SupabaseUsersList Component
 * 
 * Displays a list of Supabase users with subscription info and quick actions.
 * Uses card layout for better mobile experience.
 * Persists filter and pagination state in URL for navigation.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 5.4
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminUsersService, SupabaseUser, CreateSupabaseUserDTO } from '@/services/admin-users'
import { adminSubscriptionsService } from '@/services/admin-subscriptions'
import type { UserSubscription } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Users, Search, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { LoadingSkeleton, EmptyState } from '@/components/ui-custom'
import { SupabaseUserCard } from './SupabaseUserCard'
import { PlanAssignmentDialog } from './PlanAssignmentDialog'

export function SupabaseUsersList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Initialize state from URL params for persistence
  const initialPage = parseInt(searchParams.get('page') || '1', 10)
  const initialSearch = searchParams.get('search') || ''
  
  const [users, setUsers] = useState<SupabaseUser[]>([])
  const [subscriptions, setSubscriptions] = useState<Record<string, UserSubscription | null>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [page, setPage] = useState(initialPage)
  const [perPage] = useState(12)
  
  // Create User State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [newUserData, setNewUserData] = useState<CreateSupabaseUserDTO>({
    email: '',
    password: '',
    email_confirm: true,
    user_metadata: {
      role: 'user'
    }
  })

  // Plan Assignment Dialog State
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUserName, setSelectedUserName] = useState<string>('')
  const [selectedUserPlanId, setSelectedUserPlanId] = useState<string | undefined>()

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminUsersService.listUsers(page, perPage, searchTerm)
      setUsers(data)
      
      // Fetch subscriptions for all users in batch
      if (data.length > 0) {
        const userIds = data.map(u => u.id)
        try {
          const subs = await adminSubscriptionsService.getSubscriptionsBatch(userIds)
          setSubscriptions(subs)
        } catch (subError) {
          console.error('Erro ao buscar assinaturas:', subError)
          // Continue without subscriptions
          setSubscriptions({})
        }
      }
    } catch (error) {
      console.error('Erro ao buscar usuários Supabase:', error)
      toast.error('Erro ao carregar usuários do Supabase')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, searchTerm])

  // Update URL params when state changes (for persistence)
  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', page.toString())
    if (searchTerm) params.set('search', searchTerm)
    setSearchParams(params, { replace: true })
  }, [page, searchTerm, setSearchParams])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserData.email || !newUserData.password) {
      toast.error('Email e senha são obrigatórios')
      return
    }

    try {
      setCreateLoading(true)
      await adminUsersService.createUser(newUserData)
      toast.success('Usuário criado com sucesso')
      setIsCreateOpen(false)
      setNewUserData({
        email: '',
        password: '',
        email_confirm: true,
        user_metadata: { role: 'user' }
      })
      void fetchUsers()
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja remover o usuário ${email}? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await adminUsersService.deleteUser(id)
      toast.success(`Usuário ${email} removido com sucesso`)
      void fetchUsers()
    } catch (error) {
      console.error('Erro ao remover usuário:', error)
      toast.error('Erro ao remover usuário')
    }
  }

  const handleEditUser = (userId: string) => {
    // Navigate to Supabase user edit page
    navigate(`/admin/supabase-users/edit/${userId}`)
  }

  const handleAssignPlan = (userId: string) => {
    const user = users.find(u => u.id === userId)
    const subscription = subscriptions[userId]
    
    setSelectedUserId(userId)
    setSelectedUserName(user?.email || '')
    setSelectedUserPlanId(subscription?.planId)
    setPlanDialogOpen(true)
  }

  const handlePlanAssignmentSuccess = () => {
    void fetchUsers()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Usuários do Supabase</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => void fetchUsers()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário Supabase</DialogTitle>
                <DialogDescription>
                  Este usuário poderá fazer login no sistema.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserData.email}
                    onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserData.password}
                    onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (Opcional)</Label>
                  <Input
                    id="phone"
                    type="text"
                    value={newUserData.phone || ''}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    placeholder="+55..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="role-user"
                        name="role"
                        checked={newUserData.user_metadata?.role === 'user'}
                        onChange={() => setNewUserData({ ...newUserData, user_metadata: { ...newUserData.user_metadata, role: 'user' } })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="role-user">Usuário</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="role-admin"
                        name="role"
                        checked={newUserData.user_metadata?.role === 'admin'}
                        onChange={() => setNewUserData({ ...newUserData, user_metadata: { ...newUserData.user_metadata, role: 'admin' } })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="role-admin">Admin</Label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="email_confirm"
                    checked={newUserData.email_confirm}
                    onChange={e => setNewUserData({ ...newUserData, email_confirm: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="email_confirm">Confirmar Email Automaticamente</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Usuário'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-6">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* User Cards Grid */}
          {loading ? (
            <LoadingSkeleton variant="list" count={6} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum usuário encontrado"
              description={searchTerm ? 'Tente uma busca diferente' : 'Nenhum usuário Supabase encontrado'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {users.map((user) => (
                <SupabaseUserCard
                  key={user.id}
                  user={user}
                  subscription={subscriptions[user.id]}
                  onEdit={handleEditUser}
                  onAssignPlan={handleAssignPlan}
                  onDelete={handleDeleteUser}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={users.length < perPage}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan Assignment Dialog */}
      <PlanAssignmentDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        userId={selectedUserId}
        userName={selectedUserName}
        currentPlanId={selectedUserPlanId}
        onSuccess={handlePlanAssignmentSuccess}
      />
    </div>
  )
}

export default SupabaseUsersList
