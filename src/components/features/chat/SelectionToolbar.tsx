/**
 * SelectionToolbar Component
 * 
 * Barra de ferramentas para ações em lote em conversas selecionadas.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.3, 5.4
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { toast } from 'sonner'
import { MailCheck, Mail, CheckCircle, Trash2, Loader2, X } from 'lucide-react'

interface SelectionToolbarProps {
  selectedCount: number
  totalCount: number
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onCancel: () => void
  onMarkAsRead: () => Promise<void>
  onMarkAsUnread: () => Promise<void>
  onResolve: () => Promise<void>
  onDelete: () => Promise<void>
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  isIndeterminate,
  onSelectAll,
  onDeselectAll,
  onCancel,
  onMarkAsRead,
  onMarkAsUnread,
  onResolve,
  onDelete
}: SelectionToolbarProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const handleBulkAction = async (
    action: string, 
    fn: () => Promise<void>, 
    successMsg: string
  ) => {
    setIsLoading(action)
    try {
      await fn()
      toast.success(`${selectedCount} ${successMsg}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao executar ação')
    } finally {
      setIsLoading(null)
    }
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Confirmar exclusão',
      description: `Tem certeza que deseja excluir ${selectedCount} conversa(s)? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      await handleBulkAction('delete', onDelete, 'conversa(s) excluída(s)')
    }
  }

  const handleCheckboxChange = () => {
    if (isAllSelected) {
      onDeselectAll()
    } else {
      onSelectAll()
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            ref={(el) => {
              if (el) {
                // Set indeterminate state via DOM
                const input = el.querySelector('button')
                if (input) {
                  input.setAttribute('data-state', isIndeterminate ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked')
                }
              }
            }}
            onCheckedChange={handleCheckboxChange}
            aria-label="Selecionar todas"
          />
          <span className="text-sm font-medium">{selectedCount}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('read', onMarkAsRead, 'conversa(s) marcada(s) como lida(s)')}
              >
                {isLoading === 'read' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como lidas</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('unread', onMarkAsUnread, 'conversa(s) marcada(s) como não lida(s)')}
              >
                {isLoading === 'unread' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como não lidas</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('resolve', onResolve, 'conversa(s) resolvida(s)')}
              >
                {isLoading === 'resolve' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resolver</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={isLoading !== null}
                onClick={handleDelete}
              >
                {isLoading === 'delete' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-5 bg-border mx-1" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onCancel}
                className="h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancelar seleção</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ConfirmDialog />
    </TooltipProvider>
  )
}

export default SelectionToolbar
