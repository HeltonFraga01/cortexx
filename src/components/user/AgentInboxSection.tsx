/**
 * AgentInboxSection - Inbox assignment section for agent inline editor
 * 
 * Displays available inboxes with checkboxes for selection.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Inbox, Phone } from 'lucide-react'
import type { Inbox as InboxType } from '@/types/multi-user'

interface AgentInboxSectionProps {
  agentId: string
  currentInboxIds: string[]
  availableInboxes: InboxType[]
  onChange: (inboxIds: string[]) => void
  disabled?: boolean
}

export function AgentInboxSection({
  currentInboxIds,
  availableInboxes,
  onChange,
  disabled = false
}: AgentInboxSectionProps) {
  const handleInboxToggle = (inboxId: string, checked: boolean) => {
    if (checked) {
      onChange([...currentInboxIds, inboxId])
    } else {
      onChange(currentInboxIds.filter(id => id !== inboxId))
    }
  }
  
  if (availableInboxes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma caixa de entrada disponível</p>
        <p className="text-sm">Crie caixas de entrada para atribuir a este agente</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Selecione as caixas de entrada que este agente poderá acessar
      </p>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {availableInboxes.map(inbox => {
          const isSelected = currentInboxIds.includes(inbox.id)
          
          return (
            <div
              key={inbox.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !disabled && handleInboxToggle(inbox.id, !isSelected)}
            >
              <Checkbox
                id={`inbox-${inbox.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => handleInboxToggle(inbox.id, checked as boolean)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`inbox-${inbox.id}`}
                  className={`font-medium ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {inbox.name}
                </Label>
                {inbox.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {inbox.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {inbox.channelType || 'whatsapp'}
                  </Badge>
                  {inbox.phoneNumber && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {inbox.phoneNumber}
                    </Badge>
                  )}
                  {inbox.enableAutoAssignment && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                      Auto-atribuição
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="pt-2 text-sm text-muted-foreground">
        {currentInboxIds.length} de {availableInboxes.length} caixas selecionadas
      </div>
    </div>
  )
}
