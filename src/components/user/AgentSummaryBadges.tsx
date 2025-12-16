/**
 * AgentSummaryBadges - Summary badges for agent list
 * 
 * Displays team count, inbox count, and database access indicators.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Users, Inbox, Database } from 'lucide-react'
import type { Team, Inbox as InboxType, DatabaseAccessConfig } from '@/types/multi-user'

interface AgentSummaryBadgesProps {
  teams: Team[]
  inboxes: InboxType[]
  databaseAccess: DatabaseAccessConfig[]
  onTeamClick?: () => void
  onInboxClick?: () => void
  onDatabaseClick?: () => void
}

export function AgentSummaryBadges({
  teams,
  inboxes,
  databaseAccess,
  onTeamClick,
  onInboxClick,
  onDatabaseClick
}: AgentSummaryBadgesProps) {
  const activeDbAccess = databaseAccess.filter(d => d.accessLevel !== 'none')
  const fullAccessCount = databaseAccess.filter(d => d.accessLevel === 'full').length
  const viewAccessCount = databaseAccess.filter(d => d.accessLevel === 'view').length
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Teams Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={teams.length > 0 ? 'secondary' : 'outline'}
              className={`flex items-center gap-1 text-xs ${onTeamClick ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
              onClick={onTeamClick}
            >
              <Users className="h-3 w-3" />
              {teams.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {teams.length === 0 ? (
              <p>Nenhuma equipe atribuída</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Equipes ({teams.length})</p>
                <ul className="text-sm space-y-0.5">
                  {teams.slice(0, 5).map(team => (
                    <li key={team.id}>• {team.name}</li>
                  ))}
                  {teams.length > 5 && (
                    <li className="text-muted-foreground">
                      +{teams.length - 5} mais...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
        
        {/* Inboxes Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={inboxes.length > 0 ? 'secondary' : 'outline'}
              className={`flex items-center gap-1 text-xs ${onInboxClick ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
              onClick={onInboxClick}
            >
              <Inbox className="h-3 w-3" />
              {inboxes.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {inboxes.length === 0 ? (
              <p>Nenhuma caixa de entrada atribuída</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Caixas de Entrada ({inboxes.length})</p>
                <ul className="text-sm space-y-0.5">
                  {inboxes.slice(0, 5).map(inbox => (
                    <li key={inbox.id}>
                      • {inbox.name}
                      {inbox.phoneNumber && (
                        <span className="text-muted-foreground ml-1">
                          ({inbox.phoneNumber})
                        </span>
                      )}
                    </li>
                  ))}
                  {inboxes.length > 5 && (
                    <li className="text-muted-foreground">
                      +{inboxes.length - 5} mais...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
        
        {/* Database Access Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={activeDbAccess.length > 0 ? 'secondary' : 'outline'}
              className={`flex items-center gap-1 text-xs ${onDatabaseClick ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
              onClick={onDatabaseClick}
            >
              <Database className="h-3 w-3" />
              {activeDbAccess.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {activeDbAccess.length === 0 ? (
              <p>Nenhum acesso a banco de dados</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Acesso a Databases ({activeDbAccess.length})</p>
                <div className="text-sm space-y-0.5">
                  {fullAccessCount > 0 && (
                    <p className="text-green-600">
                      {fullAccessCount} com acesso total
                    </p>
                  )}
                  {viewAccessCount > 0 && (
                    <p className="text-blue-600">
                      {viewAccessCount} somente leitura
                    </p>
                  )}
                </div>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
