/**
 * SupabaseUserActionsCard
 * 
 * Displays dangerous actions like delete user.
 * Requirements: 7.2, 7.3, 7.4, 8.5
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { supabaseUserService } from '@/services/supabase-user'
import type { SupabaseAuthUser, UserAccount } from '@/types/supabase-user'

interface SupabaseUserActionsCardProps {
  user: SupabaseAuthUser
  account: UserAccount | null
  onUpdate: () => void
  onDelete: () => void
}

export function SupabaseUserActionsCard({ user, account, onUpdate, onDelete }: SupabaseUserActionsCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await supabaseUserService.deleteUser(user.id)
      toast.success('Usuário removido com sucesso')
      onDelete()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover usuário')
      setIsDeleting(false)
    }
  }
  
  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ações irreversíveis. Tenha certeza antes de prosseguir.
          </p>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg">
              <div>
                <p className="font-medium">Excluir Usuário</p>
                <p className="text-sm text-muted-foreground">
                  Remove permanentemente o usuário e todos os dados associados.
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* User Info Summary */}
          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            <p>ID: {user.id}</p>
            <p>Email: {user.email}</p>
            {account && <p>Conta: {account.name} (ID: {account.id})</p>}
          </div>
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{user.email}</strong>?
              <br /><br />
              Esta ação é <strong>irreversível</strong> e irá remover:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Conta do usuário no Supabase Auth</li>
                <li>Dados da conta vinculada</li>
                <li>Assinaturas e histórico de pagamentos</li>
                <li>Configurações e preferências</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
