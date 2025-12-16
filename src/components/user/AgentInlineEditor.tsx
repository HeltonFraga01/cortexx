/**
 * AgentInlineEditor - Inline editor for agent configuration
 * 
 * Expandable row editor with tabs for teams, inboxes, databases, and permissions.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, X, Users, Inbox, Database, Shield } from 'lucide-react'
import { AgentTeamSection } from './AgentTeamSection'
import { AgentInboxSection } from './AgentInboxSection'
import { AgentDatabaseSection } from './AgentDatabaseSection'
import { AgentPermissionsSection } from './AgentPermissionsSection'
import type {
  Agent,
  Team,
  Inbox,
  CustomRole,
  DefaultRole,
  DatabaseConnection,
  DatabaseAccessConfig,
  AgentUpdates,
  AgentRole,
  Permission
} from '@/types/multi-user'

interface AgentInlineEditorProps {
  agent: Agent
  teams: Team[]
  inboxes: Inbox[]
  databaseConnections: DatabaseConnection[]
  customRoles: CustomRole[]
  defaultRoles: DefaultRole[]
  currentTeamIds: string[]
  currentInboxIds: string[]
  currentDatabaseAccess: DatabaseAccessConfig[]
  currentPermissions: Permission[]
  onSave: (updates: AgentUpdates) => Promise<void>
  onCancel: () => void
  isExpanded: boolean
}

export function AgentInlineEditor({
  agent,
  teams,
  inboxes,
  databaseConnections,
  customRoles,
  defaultRoles,
  currentTeamIds,
  currentInboxIds,
  currentDatabaseAccess,
  currentPermissions,
  onSave,
  onCancel,
  isExpanded
}: AgentInlineEditorProps) {
  // Form state
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(currentTeamIds)
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>(currentInboxIds)
  const [databaseAccess, setDatabaseAccess] = useState<DatabaseAccessConfig[]>(currentDatabaseAccess)
  const [selectedRole, setSelectedRole] = useState<AgentRole>(agent.role)
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(agent.customRoleId || null)
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(currentPermissions)
  
  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('teams')
  
  // Reset form when agent changes
  useEffect(() => {
    setSelectedTeamIds(currentTeamIds)
    setSelectedInboxIds(currentInboxIds)
    setDatabaseAccess(currentDatabaseAccess)
    setSelectedRole(agent.role)
    setSelectedCustomRoleId(agent.customRoleId || null)
    setSelectedPermissions(currentPermissions)
  }, [agent.id, currentTeamIds, currentInboxIds, currentDatabaseAccess, currentPermissions, agent.role, agent.customRoleId])
  
  // Check if form has unsaved changes
  const isDirty = useCallback(() => {
    const teamsChanged = JSON.stringify([...selectedTeamIds].sort()) !== JSON.stringify([...currentTeamIds].sort())
    const inboxesChanged = JSON.stringify([...selectedInboxIds].sort()) !== JSON.stringify([...currentInboxIds].sort())
    const dbAccessChanged = JSON.stringify(databaseAccess) !== JSON.stringify(currentDatabaseAccess)
    const roleChanged = selectedRole !== agent.role
    const customRoleChanged = selectedCustomRoleId !== (agent.customRoleId || null)
    
    return teamsChanged || inboxesChanged || dbAccessChanged || roleChanged || customRoleChanged
  }, [selectedTeamIds, selectedInboxIds, databaseAccess, selectedRole, selectedCustomRoleId, 
      currentTeamIds, currentInboxIds, currentDatabaseAccess, agent.role, agent.customRoleId])
  
  const handleSave = async () => {
    if (!isDirty()) {
      onCancel()
      return
    }
    
    setIsSaving(true)
    try {
      const updates: AgentUpdates = {}
      
      if (JSON.stringify([...selectedTeamIds].sort()) !== JSON.stringify([...currentTeamIds].sort())) {
        updates.teamIds = selectedTeamIds
      }
      
      if (JSON.stringify([...selectedInboxIds].sort()) !== JSON.stringify([...currentInboxIds].sort())) {
        updates.inboxIds = selectedInboxIds
      }
      
      if (JSON.stringify(databaseAccess) !== JSON.stringify(currentDatabaseAccess)) {
        updates.databaseAccess = databaseAccess
      }
      
      if (selectedRole !== agent.role) {
        updates.role = selectedRole
      }
      
      if (selectedCustomRoleId !== (agent.customRoleId || null)) {
        updates.customRoleId = selectedCustomRoleId
      }
      
      await onSave(updates)
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancel = () => {
    // Reset to original values
    setSelectedTeamIds(currentTeamIds)
    setSelectedInboxIds(currentInboxIds)
    setDatabaseAccess(currentDatabaseAccess)
    setSelectedRole(agent.role)
    setSelectedCustomRoleId(agent.customRoleId || null)
    setSelectedPermissions(currentPermissions)
    onCancel()
  }
  
  const handlePermissionsChange = (role: AgentRole, permissions: Permission[], customRoleId?: string) => {
    setSelectedRole(role)
    setSelectedPermissions(permissions)
    setSelectedCustomRoleId(customRoleId || null)
  }
  
  if (!isExpanded) return null
  
  const isOwner = agent.role === 'owner'
  
  return (
    <Card className="mt-2 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Configurar {agent.name}</span>
            {isDirty() && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Alterações não salvas
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty()}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="teams" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Equipes</span>
              {selectedTeamIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedTeamIds.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inboxes" className="flex items-center gap-1">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Caixas</span>
              {selectedInboxIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedInboxIds.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="databases" className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Databases</span>
              {databaseAccess.filter(d => d.accessLevel !== 'none').length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {databaseAccess.filter(d => d.accessLevel !== 'none').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissões</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="teams" className="mt-4">
            <AgentTeamSection
              agentId={agent.id}
              currentTeamIds={selectedTeamIds}
              availableTeams={teams}
              onChange={setSelectedTeamIds}
              disabled={isOwner}
            />
          </TabsContent>
          
          <TabsContent value="inboxes" className="mt-4">
            <AgentInboxSection
              agentId={agent.id}
              currentInboxIds={selectedInboxIds}
              availableInboxes={inboxes}
              onChange={setSelectedInboxIds}
              disabled={isOwner}
            />
          </TabsContent>
          
          <TabsContent value="databases" className="mt-4">
            <AgentDatabaseSection
              agentId={agent.id}
              currentAccess={databaseAccess}
              availableConnections={databaseConnections}
              onChange={setDatabaseAccess}
              disabled={isOwner}
            />
          </TabsContent>
          
          <TabsContent value="permissions" className="mt-4">
            <AgentPermissionsSection
              agentId={agent.id}
              currentRole={selectedRole}
              currentPermissions={selectedPermissions}
              customRoleId={selectedCustomRoleId}
              availableRoles={customRoles}
              defaultRoles={defaultRoles}
              allPermissions={[
                'conversations:view', 'conversations:create', 'conversations:assign', 
                'conversations:manage', 'conversations:delete', 'messages:send', 
                'messages:delete', 'contacts:view', 'contacts:create', 'contacts:edit',
                'contacts:delete', 'agents:view', 'agents:create', 'agents:edit',
                'agents:delete', 'teams:view', 'teams:manage', 'inboxes:view',
                'inboxes:manage', 'reports:view', 'settings:view', 'settings:edit',
                'webhooks:manage', 'integrations:manage'
              ]}
              onChange={handlePermissionsChange}
              disabled={isOwner}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
