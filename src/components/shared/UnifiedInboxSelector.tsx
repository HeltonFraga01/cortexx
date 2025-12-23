/**
 * UnifiedInboxSelector - Seletor unificado de caixas de entrada
 * 
 * Permite selecionar "Todas as Caixas" ou múltiplas inboxes específicas.
 * Exibe contagem de mensagens não lidas e status de conexão.
 * 
 * Requirements: 2.1, 2.3, 3.1, 3.3, 3.4, 3.5, 3.6, 6.1, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5
 */

import { useState } from 'react'
import { Check, ChevronDown, Inbox, MessageSquare, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'
import { ConnectionStatusBadge } from './ConnectionStatus'

interface UnifiedInboxSelectorProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function UnifiedInboxSelector({ 
  className,
  variant = 'outline',
  size = 'default'
}: UnifiedInboxSelectorProps) {
  const { 
    availableInboxes,
    isLoading,
    isAllSelected,
    selection,
    selectedInboxIds,
    selectAll,
    toggleInbox,
    isInboxSelected,
    getSelectedCount,
    totalUnreadCount,
    hasDisconnectedInbox
  } = useSupabaseInbox()
  
  const [isOpen, setIsOpen] = useState(false)

  // Não mostrar se não há inboxes
  if (availableInboxes.length === 0) return null

  // Determinar texto do botão
  const getButtonText = () => {
    if (isAllSelected) {
      return 'Todas as Caixas'
    }
    const count = getSelectedCount()
    if (count === 1) {
      const selectedInbox = availableInboxes.find(i => selectedInboxIds.includes(i.id))
      return selectedInbox?.name || 'Caixa selecionada'
    }
    return `${count} caixas selecionadas`
  }

  // Determinar indicador de status agregado
  const getStatusIndicator = () => {
    if (isAllSelected && hasDisconnectedInbox) {
      return <AlertTriangle className="h-3 w-3 text-yellow-500" />
    }
    if (isAllSelected) {
      // Verificar se todas estão conectadas
      const allConnected = availableInboxes.every(i => i.isConnected)
      return (
        <span className={cn(
          'w-2 h-2 rounded-full',
          allConnected ? 'bg-green-500' : 'bg-yellow-500'
        )} />
      )
    }
    // Para seleção específica, mostrar status da primeira selecionada
    const firstSelected = availableInboxes.find(i => selectedInboxIds.includes(i.id))
    if (firstSelected) {
      return (
        <span className={cn(
          'w-2 h-2 rounded-full',
          firstSelected.isConnected ? 'bg-green-500' : 'bg-red-500'
        )} />
      )
    }
    return null
  }

  const handleAllClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    selectAll()
  }

  const handleInboxClick = (e: React.MouseEvent, inboxId: string) => {
    e.preventDefault()
    e.stopPropagation()
    toggleInbox(inboxId)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={cn('gap-2', className)}
          disabled={isLoading}
        >
          <Inbox className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {getButtonText()}
          </span>
          {getStatusIndicator()}
          {totalUnreadCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Selecionar Caixa de Entrada
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Opção "Todas as Caixas" */}
        <DropdownMenuItem
          onClick={handleAllClick}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-1">
            <Checkbox 
              checked={isAllSelected}
              onCheckedChange={() => selectAll()}
              onClick={(e) => e.stopPropagation()}
            />
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">Todas as Caixas</span>
          </div>
          <div className="flex items-center gap-2">
            {totalUnreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Badge>
            )}
            {hasDisconnectedInbox && (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            )}
            {isAllSelected && <Check className="h-4 w-4 text-primary" />}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Lista de inboxes */}
        {availableInboxes.map((inbox) => {
          const isSelected = isInboxSelected(inbox.id)
          const unreadCount = inbox.unreadCount || 0
          
          return (
            <DropdownMenuItem
              key={inbox.id}
              onClick={(e) => handleInboxClick(e, inbox.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => toggleInbox(inbox.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="truncate">{inbox.name}</span>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
                <ConnectionStatusBadge 
                  isConnected={inbox.isConnected} 
                  size="sm" 
                  showLabel={false}
                />
                {isSelected && !isAllSelected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UnifiedInboxSelector
