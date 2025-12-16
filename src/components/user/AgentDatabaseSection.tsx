/**
 * AgentDatabaseSection - Database access section for agent inline editor
 * 
 * Displays database connections with access level selectors.
 * 
 * Requirements: 4.1, 4.2
 */

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Database, Eye, Edit, Ban } from 'lucide-react'
import type { DatabaseConnection, DatabaseAccessConfig, DatabaseAccessLevel } from '@/types/multi-user'

interface AgentDatabaseSectionProps {
  agentId: string
  currentAccess: DatabaseAccessConfig[]
  availableConnections: DatabaseConnection[]
  onChange: (access: DatabaseAccessConfig[]) => void
  disabled?: boolean
}

const ACCESS_LEVEL_LABELS: Record<DatabaseAccessLevel, { label: string; icon: typeof Eye; color: string }> = {
  none: { label: 'Sem acesso', icon: Ban, color: 'text-muted-foreground' },
  view: { label: 'Somente leitura', icon: Eye, color: 'text-blue-600' },
  full: { label: 'Acesso total', icon: Edit, color: 'text-green-600' }
}

export function AgentDatabaseSection({
  currentAccess,
  availableConnections,
  onChange,
  disabled = false
}: AgentDatabaseSectionProps) {
  const getAccessLevel = (connectionId: string): DatabaseAccessLevel => {
    const config = currentAccess.find(a => a.connectionId === connectionId)
    return config?.accessLevel || 'none'
  }
  
  const handleAccessChange = (connectionId: string, accessLevel: DatabaseAccessLevel) => {
    const existingIndex = currentAccess.findIndex(a => a.connectionId === connectionId)
    
    if (existingIndex >= 0) {
      const newAccess = [...currentAccess]
      newAccess[existingIndex] = { connectionId, accessLevel }
      onChange(newAccess)
    } else {
      onChange([...currentAccess, { connectionId, accessLevel }])
    }
  }
  
  if (availableConnections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma conexão de banco de dados disponível</p>
        <p className="text-sm">Configure conexões NocoDB para gerenciar acesso</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Configure o nível de acesso deste agente para cada banco de dados
      </p>
      
      <div className="space-y-3">
        {availableConnections.map(connection => {
          const accessLevel = getAccessLevel(connection.id)
          const levelConfig = ACCESS_LEVEL_LABELS[accessLevel]
          const Icon = levelConfig.icon
          
          return (
            <div
              key={connection.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Database className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <Label className="font-medium">{connection.name}</Label>
                  {connection.tableName && (
                    <p className="text-sm text-muted-foreground truncate">
                      Tabela: {connection.tableName}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Select
                  value={accessLevel}
                  onValueChange={(value) => handleAccessChange(connection.id, value as DatabaseAccessLevel)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${levelConfig.color}`} />
                        <span>{levelConfig.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Ban className="h-4 w-4 text-muted-foreground" />
                        <span>Sem acesso</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="view">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-600" />
                        <span>Somente leitura</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="full">
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4 text-green-600" />
                        <span>Acesso total</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="pt-2 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="h-5 px-1.5">
            {currentAccess.filter(a => a.accessLevel === 'full').length}
          </Badge>
          <span>acesso total</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="h-5 px-1.5">
            {currentAccess.filter(a => a.accessLevel === 'view').length}
          </Badge>
          <span>somente leitura</span>
        </div>
      </div>
    </div>
  )
}
