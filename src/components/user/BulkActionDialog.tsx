/**
 * BulkActionDialog - Dialog for configuring bulk actions on agents
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Users, Inbox, Shield } from 'lucide-react'
import type { Team, Inbox as InboxType, AgentRole, BulkActionType } from '@/types/multi-user'

interface BulkActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  teams: Team[]
  inboxes: InboxType[]
  onApply: (action: BulkActionType, data: Record<string, unknown>) => Promise<void>
}

export function BulkActionDialog({
  open,
  onOpenChange,
  selectedCount,
  teams,
  inboxes,
  onApply
}: BulkActionDialogProps) {
  const [action, setAction] = useState<BulkActionType>('addTeams')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<AgentRole>('agent')
  const [isApplying, setIsApplying] = useState(false)
  
  const handleApply = async () => {
    setIsApplying(true)
    try {
      let data: Record<string, unknown> = {}
      
      switch (action) {
        case 'addTeams':
        case 'removeTeams':
          data = { teamIds: selectedTeamIds }
          break
        case 'addInboxes':
        case 'removeInboxes':
          data = { inboxIds: selectedInboxIds }
          break
        case 'setRole':
          data = { role: selectedRole }
          break
      }
      
      await onApply(action, data)
      onOpenChange(false)
      
      // Reset state
      setSelectedTeamIds([])
      setSelectedInboxIds([])
    } finally {
      setIsApplying(false)
    }
  }
  
  const handleTeamToggle = (teamId: string, checked: boolean) => {
    if (checked) {
      setSelectedTeamIds([...selectedTeamIds, teamId])
    } else {
      setSelectedTeamIds(selectedTeamIds.filter(id => id !== teamId))
    }
  }
  
  const handleInboxToggle = (inboxId: string, checked: boolean) => {
    if (checked) {
      setSelectedInboxIds([...selectedInboxIds, inboxId])
    } else {
      setSelectedInboxIds(selectedInboxIds.filter(id => id !== inboxId))
    }
  }
  
  const canApply = () => {
    switch (action) {
      case 'addTeams':
      case 'removeTeams':
        return selectedTeamIds.length > 0
      case 'addInboxes':
      case 'removeInboxes':
        return selectedInboxIds.length > 0
      case 'setRole':
        return true
      default:
        return false
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ação em Massa</DialogTitle>
          <DialogDescription>
            Aplicar ação em {selectedCount} agente{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Tipo de Ação</Label>
            <Select value={action} onValueChange={(v) => setAction(v as BulkActionType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="addTeams">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Adicionar a Equipes
                  </div>
                </SelectItem>
                <SelectItem value="removeTeams">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Remover de Equipes
                  </div>
                </SelectItem>
                <SelectItem value="addInboxes">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    Adicionar a Caixas
                  </div>
                </SelectItem>
                <SelectItem value="removeInboxes">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4" />
                    Remover de Caixas
                  </div>
                </SelectItem>
                <SelectItem value="setRole">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Alterar Papel
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(action === 'addTeams' || action === 'removeTeams') && (
            <div>
              <Label>Equipes</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {teams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-team-${team.id}`}
                      checked={selectedTeamIds.includes(team.id)}
                      onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                    />
                    <Label htmlFor={`bulk-team-${team.id}`} className="cursor-pointer">
                      {team.name}
                    </Label>
                  </div>
                ))}
                {teams.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma equipe disponível</p>
                )}
              </div>
            </div>
          )}
          
          {(action === 'addInboxes' || action === 'removeInboxes') && (
            <div>
              <Label>Caixas de Entrada</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {inboxes.map(inbox => (
                  <div key={inbox.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-inbox-${inbox.id}`}
                      checked={selectedInboxIds.includes(inbox.id)}
                      onCheckedChange={(checked) => handleInboxToggle(inbox.id, checked as boolean)}
                    />
                    <Label htmlFor={`bulk-inbox-${inbox.id}`} className="cursor-pointer">
                      {inbox.name}
                    </Label>
                  </div>
                ))}
                {inboxes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma caixa disponível</p>
                )}
              </div>
            </div>
          )}
          
          {action === 'setRole' && (
            <div>
              <Label>Novo Papel</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AgentRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator">Administrador</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!canApply() || isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              'Aplicar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
