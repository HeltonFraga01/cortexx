/**
 * UserActionsCard Component
 * 
 * Buttons for suspend, reactivate, reset password, delete, export.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { adminUserActionsService } from '@/services/admin-user-actions'
import type { SubscriptionStatus } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Settings,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  Download,
  Loader2,
} from 'lucide-react'

interface UserActionsCardProps {
  userId: string
  subscriptionStatus?: SubscriptionStatus
  onUpdate?: () => void
}

export function UserActionsCard({ userId, subscriptionStatus, onUpdate }: UserActionsCardProps) {
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const isSuspended = subscriptionStatus === 'suspended'

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error('Motivo da suspensão é obrigatório')
      return
    }

    try {
      setIsLoading('suspend')
      await adminUserActionsService.suspendUser(userId, suspendReason)
      toast.success('Usuário suspenso')
      setSuspendDialogOpen(false)
      setSuspendReason('')
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao suspender usuário')
    } finally {
      setIsLoading(null)
    }
  }

  const handleReactivate = async () => {
    try {
      setIsLoading('reactivate')
      await adminUserActionsService.reactivateUser(userId)
      toast.success('Usuário reativado')
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao reativar usuário')
    } finally {
      setIsLoading(null)
    }
  }

  const handleResetPassword = async () => {
    try {
      setIsLoading('reset')
      await adminUserActionsService.resetPassword(userId, { sendEmail: true })
      toast.success('Email de reset de senha enviado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao resetar senha')
    } finally {
      setIsLoading(null)
    }
  }

  const handleDelete = async () => {
    try {
      setIsLoading('delete')
      await adminUserActionsService.deleteUser(userId)
      toast.success('Usuário excluído')
      setDeleteDialogOpen(false)
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao excluir usuário')
    } finally {
      setIsLoading(null)
    }
  }

  const handleExport = async () => {
    try {
      setIsLoading('export')
      const data = await adminUserActionsService.exportUserData(userId)
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-${userId}-export.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Dados exportados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao exportar dados')
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ações
          </CardTitle>
          <CardDescription>Ações administrativas para este usuário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isSuspended ? (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleReactivate}
              disabled={isLoading === 'reactivate'}
            >
              {isLoading === 'reactivate' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Reativar Usuário
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setSuspendDialogOpen(true)}
              disabled={isLoading === 'suspend'}
            >
              <UserX className="h-4 w-4 mr-2" />
              Suspender Usuário
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleResetPassword}
            disabled={isLoading === 'reset'}
          >
            {isLoading === 'reset' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            Resetar Senha
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExport}
            disabled={isLoading === 'export'}
          >
            {isLoading === 'export' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar Dados
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isLoading === 'delete'}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Usuário
          </Button>
        </CardContent>
      </Card>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Usuário</DialogTitle>
            <DialogDescription>
              O usuário terá acesso somente leitura enquanto suspenso.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Motivo da Suspensão</label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Informe o motivo da suspensão..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || isLoading === 'suspend'}
            >
              {isLoading === 'suspend' ? 'Suspendendo...' : 'Suspender'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados do usuário serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {isLoading === 'delete' ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
