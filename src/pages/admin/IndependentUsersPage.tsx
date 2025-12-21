/**
 * IndependentUsersPage
 * 
 * Admin page for managing independent users with inline forms.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { IndependentUserList } from '@/components/admin/IndependentUserList'
import { IndependentUserForm } from '@/components/admin/IndependentUserForm'
import { InboxLinkingPanel } from '@/components/admin/InboxLinkingDialog'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

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

export function IndependentUsersPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [inboxUser, setInboxUser] = useState<User | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      email: string
      password: string
      name: string
      avatarUrl?: string
      permissions: string[]
    }) => {
      const response = await api.post<{ success: boolean; data: User }>(
        '/api/admin/independent-users',
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      setShowForm(false)
      toast({
        title: 'Usuário criado',
        description: 'O usuário foi criado com sucesso.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive'
      })
    }
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      userId,
      data
    }: {
      userId: string
      data: {
        name: string
        avatarUrl?: string
        status: 'active' | 'inactive'
        permissions: string[]
      }
    }) => {
      // Update user data
      await api.put(`/api/admin/independent-users/${userId}`, {
        name: data.name,
        avatarUrl: data.avatarUrl,
        status: data.status
      })
      
      // Update permissions separately
      await api.put(`/api/admin/independent-users/${userId}/permissions`, {
        permissions: data.permissions
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      setShowForm(false)
      setEditingUser(null)
      toast({
        title: 'Usuário atualizado',
        description: 'As informações do usuário foram atualizadas.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o usuário.',
        variant: 'destructive'
      })
    }
  })

  const handleCreateUser = () => {
    setEditingUser(null)
    setInboxUser(null)
    setShowForm(true)
  }

  const handleEditUser = (user: User) => {
    setInboxUser(null)
    setEditingUser(user)
    setShowForm(true)
  }

  const handleLinkInbox = (user: User) => {
    setShowForm(false)
    setEditingUser(null)
    setInboxUser(user)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingUser(null)
  }

  const handleCloseInbox = () => {
    setInboxUser(null)
  }

  const handleFormSubmit = async (data: {
    email?: string
    password?: string
    name: string
    avatarUrl?: string
    status?: 'active' | 'inactive'
    permissions: string[]
  }) => {
    if (editingUser) {
      await updateMutation.mutateAsync({
        userId: editingUser.id,
        data: {
          name: data.name,
          avatarUrl: data.avatarUrl,
          status: data.status || 'active',
          permissions: data.permissions
        }
      })
    } else {
      await createMutation.mutateAsync({
        email: data.email!,
        password: data.password!,
        name: data.name,
        avatarUrl: data.avatarUrl,
        permissions: data.permissions
      })
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <div>
              <CardTitle>Usuários Independentes</CardTitle>
              <CardDescription>
                Gerencie usuários que acessam o sistema via email/senha
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inline Create/Edit Form */}
          {showForm && (
            <IndependentUserForm
              user={editingUser}
              onSubmit={handleFormSubmit}
              onCancel={handleCancelForm}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          )}

          {/* Inline Inbox Linking Panel */}
          {inboxUser && (
            <InboxLinkingPanel
              user={inboxUser}
              onClose={handleCloseInbox}
            />
          )}

          {/* User List */}
          <IndependentUserList
            onCreateUser={handleCreateUser}
            onEditUser={handleEditUser}
            onLinkInbox={handleLinkInbox}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default IndependentUsersPage
