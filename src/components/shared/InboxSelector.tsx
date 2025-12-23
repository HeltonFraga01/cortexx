/**
 * InboxSelector - Dropdown para selecionar inbox ativa
 * 
 * Permite ao usuário trocar entre as inboxes disponíveis.
 * Mostra apenas se o usuário tem múltiplas inboxes.
 * 
 * Requirements: 7.3, 12.1, 12.2
 */

import { useState } from 'react'
import { Check, ChevronDown, Inbox, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

interface InboxSelectorProps {
  /** Mostrar mesmo com apenas uma inbox */
  showSingle?: boolean
  /** Classe CSS adicional */
  className?: string
  /** Variante do botão */
  variant?: 'default' | 'outline' | 'ghost'
  /** Tamanho do botão */
  size?: 'default' | 'sm' | 'lg'
}

export function InboxSelector({ 
  showSingle = false,
  className,
  variant = 'outline',
  size = 'default'
}: InboxSelectorProps) {
  const { 
    activeInbox, 
    availableInboxes, 
    switchInbox, 
    isLoading 
  } = useSupabaseInbox()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Não mostrar se não há inboxes ou apenas uma (a menos que showSingle)
  if (!activeInbox) return null
  if (availableInboxes.length <= 1 && !showSingle) return null

  const handleSelect = async (inboxId: string) => {
    if (inboxId === activeInbox.id) {
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    try {
      await switchInbox(inboxId)
    } finally {
      setIsSwitching(false)
      setIsOpen(false)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={cn('gap-2', className)}
          disabled={isLoading || isSwitching}
        >
          <Inbox className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {activeInbox.name}
          </span>
          <ConnectionStatusBadge 
            isConnected={activeInbox.isConnected} 
            size="sm" 
            showLabel={false}
          />
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel>Caixas de Entrada</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableInboxes.map((inbox) => (
          <DropdownMenuItem
            key={inbox.id}
            onClick={() => handleSelect(inbox.id)}
            className="flex items-center justify-between cursor-pointer"
            disabled={isSwitching}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Inbox className="h-4 w-4 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">
                  {inbox.name}
                </span>
                {inbox.phoneNumber && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {inbox.phoneNumber}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <ConnectionStatusBadge 
                isConnected={inbox.isConnected} 
                size="sm" 
                showLabel={false}
              />
              {inbox.id === activeInbox.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default InboxSelector
