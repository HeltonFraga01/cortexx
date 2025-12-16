/**
 * AgentPermissionsSection - Permissions section for agent inline editor
 * 
 * Displays role selector and permission toggles.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Shield, Crown, UserCog, User, Eye } from 'lucide-react'
import type { AgentRole, CustomRole, DefaultRole, Permission } from '@/types/multi-user'

interface AgentPermissionsSectionProps {
  agentId: string
  currentRole: AgentRole
  currentPermissions: Permission[]
  customRoleId?: string | null
  availableRoles: CustomRole[]
  defaultRoles: DefaultRole[]
  allPermissions: string[]
  onChange: (role: AgentRole, permissions: Permission[], customRoleId?: string) => void
  disabled?: boolean
}

const ROLE_CONFIG: Record<AgentRole, { label: string; icon: typeof Shield; color: string; description: string }> = {
  owner: { 
    label: 'Proprietário', 
    icon: Crown, 
    color: 'text-yellow-600',
    description: 'Acesso total ao sistema'
  },
  administrator: { 
    label: 'Administrador', 
    icon: UserCog, 
    color: 'text-purple-600',
    description: 'Gerencia agentes, equipes e configurações'
  },
  agent: { 
    label: 'Agente', 
    icon: User, 
    color: 'text-blue-600',
    description: 'Atende conversas e gerencia contatos'
  },
  viewer: { 
    label: 'Visualizador', 
    icon: Eye, 
    color: 'text-gray-600',
    description: 'Apenas visualização, sem edição'
  }
}

const PERMISSION_GROUPS: Record<string, { label: string; permissions: string[] }> = {
  conversations: {
    label: 'Conversas',
    permissions: ['conversations:view', 'conversations:create', 'conversations:assign', 'conversations:manage', 'conversations:delete']
  },
  messages: {
    label: 'Mensagens',
    permissions: ['messages:send', 'messages:delete']
  },
  contacts: {
    label: 'Contatos',
    permissions: ['contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete']
  },
  agents: {
    label: 'Agentes',
    permissions: ['agents:view', 'agents:create', 'agents:edit', 'agents:delete']
  },
  teams: {
    label: 'Equipes',
    permissions: ['teams:view', 'teams:manage']
  },
  inboxes: {
    label: 'Caixas de Entrada',
    permissions: ['inboxes:view', 'inboxes:manage']
  },
  other: {
    label: 'Outros',
    permissions: ['reports:view', 'settings:view', 'settings:edit', 'webhooks:manage', 'integrations:manage']
  }
}

const PERMISSION_LABELS: Record<string, string> = {
  'conversations:view': 'Visualizar',
  'conversations:create': 'Criar',
  'conversations:assign': 'Atribuir',
  'conversations:manage': 'Gerenciar',
  'conversations:delete': 'Excluir',
  'messages:send': 'Enviar',
  'messages:delete': 'Excluir',
  'contacts:view': 'Visualizar',
  'contacts:create': 'Criar',
  'contacts:edit': 'Editar',
  'contacts:delete': 'Excluir',
  'agents:view': 'Visualizar',
  'agents:create': 'Criar',
  'agents:edit': 'Editar',
  'agents:delete': 'Excluir',
  'teams:view': 'Visualizar',
  'teams:manage': 'Gerenciar',
  'inboxes:view': 'Visualizar',
  'inboxes:manage': 'Gerenciar',
  'reports:view': 'Relatórios',
  'settings:view': 'Ver configurações',
  'settings:edit': 'Editar configurações',
  'webhooks:manage': 'Webhooks',
  'integrations:manage': 'Integrações'
}

export function AgentPermissionsSection({
  currentRole,
  currentPermissions,
  customRoleId,
  availableRoles,
  defaultRoles,
  onChange,
  disabled = false
}: AgentPermissionsSectionProps) {
  const roleConfig = ROLE_CONFIG[currentRole]
  const Icon = roleConfig.icon
  
  // Get permissions for the current role from defaultRoles
  const getDefaultRolePermissions = (role: AgentRole): Permission[] => {
    const defaultRole = defaultRoles.find(r => r.name === role)
    if (defaultRole) {
      return defaultRole.permissions as Permission[]
    }
    return []
  }
  
  const handleRoleChange = (value: string) => {
    if (value.startsWith('custom:')) {
      const roleId = value.replace('custom:', '')
      const customRole = availableRoles.find(r => r.id === roleId)
      if (customRole) {
        onChange(currentRole, customRole.permissions, roleId)
      }
    } else {
      const role = value as AgentRole
      // Get permissions from default role
      const rolePermissions = getDefaultRolePermissions(role)
      onChange(role, rolePermissions, undefined)
    }
  }
  
  // Use default role permissions if currentPermissions is empty and no custom role
  const effectivePermissions = customRoleId 
    ? currentPermissions 
    : (currentPermissions.length > 0 ? currentPermissions : getDefaultRolePermissions(currentRole))
  
  const isOwner = currentRole === 'owner'
  const hasAllPermissions = effectivePermissions.includes('*' as Permission)
  
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-2 block">Papel do Agente</Label>
        <Select
          value={customRoleId ? `custom:${customRoleId}` : currentRole}
          onValueChange={handleRoleChange}
          disabled={disabled || isOwner}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${roleConfig.color}`} />
                <span>{roleConfig.label}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG)
              .filter(([role]) => role !== 'owner')
              .map(([role, config]) => {
                const RoleIcon = config.icon
                return (
                  <SelectItem key={role} value={role}>
                    <div className="flex items-center gap-2">
                      <RoleIcon className={`h-4 w-4 ${config.color}`} />
                      <div>
                        <span className="font-medium">{config.label}</span>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                  </SelectItem>
                )
              })}
            
            {availableRoles.length > 0 && (
              <>
                <Separator className="my-1" />
                {availableRoles.map(role => (
                  <SelectItem key={role.id} value={`custom:${role.id}`}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-600" />
                      <div>
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-1">{roleConfig.description}</p>
      </div>
      
      <Separator />
      
      <div>
        <Label className="text-sm font-medium mb-3 block">Permissões</Label>
        
        {isOwner || hasAllPermissions ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Crown className="h-5 w-5" />
              <span className="font-medium">Acesso Total</span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
              Este agente tem acesso a todas as funcionalidades do sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
              const groupPermissions = group.permissions.filter(p => 
                effectivePermissions.includes(p as Permission)
              )
              
              if (groupPermissions.length === 0) return null
              
              return (
                <div key={groupKey}>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {groupPermissions.map(permission => (
                      <Badge key={permission} variant="secondary" className="text-xs">
                        {PERMISSION_LABELS[permission] || permission.split(':')[1]}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
            
            {effectivePermissions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma permissão específica configurada para este papel.
              </p>
            )}
          </div>
        )}
      </div>
      
      <div className="pt-2 text-sm text-muted-foreground">
        {hasAllPermissions ? (
          <span>Todas as permissões</span>
        ) : (
          <span>{effectivePermissions.length} permissões ativas</span>
        )}
      </div>
    </div>
  )
}
