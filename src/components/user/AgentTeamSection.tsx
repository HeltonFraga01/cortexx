/**
 * AgentTeamSection - Team assignment section for agent inline editor
 * 
 * Displays available teams with checkboxes for selection.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import type { Team } from '@/types/multi-user'

interface AgentTeamSectionProps {
  agentId: string
  currentTeamIds: string[]
  availableTeams: Team[]
  onChange: (teamIds: string[]) => void
  disabled?: boolean
}

export function AgentTeamSection({
  currentTeamIds,
  availableTeams,
  onChange,
  disabled = false
}: AgentTeamSectionProps) {
  const handleTeamToggle = (teamId: string, checked: boolean) => {
    if (checked) {
      onChange([...currentTeamIds, teamId])
    } else {
      onChange(currentTeamIds.filter(id => id !== teamId))
    }
  }
  
  if (availableTeams.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma equipe disponível</p>
        <p className="text-sm">Crie equipes para atribuir a este agente</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Selecione as equipes das quais este agente fará parte
      </p>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {availableTeams.map(team => {
          const isSelected = currentTeamIds.includes(team.id)
          
          return (
            <div
              key={team.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !disabled && handleTeamToggle(team.id, !isSelected)}
            >
              <Checkbox
                id={`team-${team.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => handleTeamToggle(team.id, checked as boolean)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`team-${team.id}`}
                  className={`font-medium ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {team.name}
                </Label>
                {team.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {team.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {team.allowAutoAssign && (
                    <Badge variant="outline" className="text-xs">
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
        {currentTeamIds.length} de {availableTeams.length} equipes selecionadas
      </div>
    </div>
  )
}
