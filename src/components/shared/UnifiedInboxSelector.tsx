/**
 * UnifiedInboxSelector - Seletor unificado de caixas de entrada
 * 
 * Permite selecionar "Todas as Caixas" ou múltiplas inboxes específicas.
 * Exibe contagem de mensagens não lidas e status de conexão.
 * 
 * Requirements: 2.1, 2.3, 3.1, 3.3, 3.4, 3.5, 3.6, 6.1, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5
 */

import { useState } from 'react'
import { Check, ChevronDown, Inbox, Layers, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'

interface UnifiedInboxSelectorProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

// Status indicator component
function StatusDot({ isConnected, size = 'sm' }: { isConnected: boolean | null | undefined; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  
  if (isConnected === null || isConnected === undefined) {
    return <span className={cn(sizeClass, 'rounded-full bg-gray-400')} />
  }
  
  return (
    <span className={cn(
      sizeClass,
      'rounded-full',
      isConnected ? 'bg-emerald-500' : 'bg-red-500'
    )} />
  )
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
    selectedInboxIds,
    selectAll,
    toggleInbox,
    isInboxSelected,
    getSelectedCount,
    totalUnreadCount,
    hasDisconnectedInbox
  } = useSupabaseInbox()
  
  const [isOpen, setIsOpen] = useState(false)

  if (availableInboxes.length === 0) return null

  const getButtonText = () => {
    if (isAllSelected) return 'Todas as Caixas'
    const count = getSelectedCount()
    if (count === 1) {
      const selectedInbox = availableInboxes.find(i => selectedInboxIds.includes(i.id))
      return selectedInbox?.name || 'Caixa selecionada'
    }
    return `${count} caixas`
  }

  const getAggregatedStatus = () => {
    if (isAllSelected) {
      return availableInboxes.every(i => i.isConnected)
    }
    const selectedInboxes = availableInboxes.filter(i => selectedInboxIds.includes(i.id))
    return selectedInboxes.every(i => i.isConnected)
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
          className={cn('gap-2 font-medium', className)}
          disabled={isLoading}
        >
          <Inbox className="h-4 w-4" />
          <span className="max-w-[140px] truncate">{getButtonText()}</span>
          <StatusDot isConnected={getAggregatedStatus()} size="md" />
          {hasDisconnectedInbox && isAllSelected && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          {totalUnreadCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs font-semibold">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </Badge>
          )}
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )} />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-[260px] p-1">
        {/* Opção "Todas as Caixas" */}
        <DropdownMenuItem
          onClick={handleAllClick}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer',
            isAllSelected && 'bg-primary/10'
          )}
        >
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            isAllSelected ? 'bg-primary/20' : 'bg-muted'
          )}>
            <Layers className={cn(
              'h-4 w-4',
              isAllSelected ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                'font-medium truncate',
                isAllSelected && 'text-primary'
              )}>
                Todas as Caixas
              </span>
              {hasDisconnectedInbox && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {availableInboxes.length} caixas
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {totalUnreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Badge>
            )}
            {isAllSelected && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="my-1" />
        
        {/* Lista de inboxes */}
        <div className="space-y-0.5">
          {availableInboxes.map((inbox) => {
            const isSelected = isInboxSelected(inbox.id)
            const unreadCount = inbox.unreadCount || 0
            
            return (
              <DropdownMenuItem
                key={inbox.id}
                onClick={(e) => handleInboxClick(e, inbox.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer',
                  isSelected && !isAllSelected && 'bg-primary/10'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg',
                  isSelected && !isAllSelected ? 'bg-primary/20' : 'bg-muted'
                )}>
                  <Inbox className={cn(
                    'h-4 w-4',
                    isSelected && !isAllSelected ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'font-medium truncate',
                      isSelected && !isAllSelected && 'text-primary'
                    )}>
                      {inbox.name}
                    </span>
                    <StatusDot isConnected={inbox.isConnected} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {inbox.isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                  {isSelected && (
                    <Check className={cn(
                      'h-4 w-4',
                      isAllSelected ? 'text-muted-foreground' : 'text-primary'
                    )} />
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UnifiedInboxSelector
