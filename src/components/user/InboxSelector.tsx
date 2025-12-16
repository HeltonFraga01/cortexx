/**
 * InboxSelector Component
 * 
 * Dropdown to select current inbox for filtering conversations.
 * Uses inbox context (works with both user and agent contexts).
 * 
 * Requirements: 10.2
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Inbox, ChevronDown, Check, MessageSquare } from 'lucide-react'
import { useChatInbox } from '@/hooks/useChatInbox'

import type { InboxWithStats, Inbox as InboxType } from '@/types/multi-user'

interface InboxSelectorProps {
  currentInbox: InboxWithStats | null
  onSelect: (inbox: InboxWithStats | null) => void
  showAllOption?: boolean
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱',
  email: '📧',
  web: '💬',
  api: '🔌',
}

export function InboxSelector({ 
  currentInbox, 
  onSelect,
  showAllOption = true 
}: InboxSelectorProps) {
  // Use inbox context (works with both user and agent)
  const { inboxes: contextInboxes, isLoading: loading } = useChatInbox()
  
  // Cast to InboxWithStats for compatibility
  const inboxes = contextInboxes as InboxWithStats[]

  const handleSelect = (inbox: InboxWithStats | null) => {
    onSelect(inbox)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentInbox ? (
              <>
                <span>{CHANNEL_ICONS[currentInbox.channelType] || '📥'}</span>
                <span className="truncate max-w-[150px]">{currentInbox.name}</span>
              </>
            ) : (
              <>
                <Inbox className="h-4 w-4" />
                <span>Todas as Caixas</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Selecionar Caixa de Entrada
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {showAllOption && (
          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Todas as Caixas</span>
            </div>
            {!currentInbox && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        )}
        
        {showAllOption && inboxes.length > 0 && <DropdownMenuSeparator />}
        
        {loading ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : inboxes.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhuma caixa de entrada disponível
          </div>
        ) : (
          inboxes.map((inbox) => (
            <DropdownMenuItem
              key={inbox.id}
              onClick={() => handleSelect(inbox)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span>{CHANNEL_ICONS[inbox.channelType] || '📥'}</span>
                <span className="truncate">{inbox.name}</span>
                {inbox.memberCount !== undefined && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {inbox.memberCount}
                  </Badge>
                )}
              </div>
              {currentInbox?.id === inbox.id && <Check className="h-4 w-4 ml-2" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default InboxSelector
