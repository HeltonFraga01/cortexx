/**
 * Multi-User Management Page
 * 
 * Centralizes management of Agents, Teams, Inboxes, and Roles
 * for the multi-user inbox system.
 * 
 * Requirements: 2.6, 3.1, 4.1, 5.4, 6.4
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, UsersRound, Inbox, Shield, FileText, UserCog } from 'lucide-react'

import { AgentList } from '@/components/admin/AgentList'
import { AgentInviteDialog } from '@/components/admin/AgentInviteDialog'
import { AgentCreateDialog } from '@/components/admin/AgentCreateDialog'
import { TeamList } from '@/components/admin/TeamList'
import { InboxList } from '@/components/admin/InboxList'
import { RoleList } from '@/components/admin/RoleList'
import { AuditLog } from '@/components/admin/AuditLog'
import { SupabaseUsersList } from '@/components/admin/SupabaseUsersList'

export default function MultiUserManagement() {
  const [activeTab, setActiveTab] = useState('supabase')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestão Multi-Usuário</h1>
        <p className="text-muted-foreground">
          Gerencie caixas de entrada, usuários do sistema, agentes, equipes e permissões
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
           <TabsTrigger value="supabase" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">Admin/Login</span>
          </TabsTrigger>
          <TabsTrigger value="wuzapi" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Caixas de Entrada</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Agentes</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Equipes</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Papéis</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supabase" className="mt-6">
          <SupabaseUsersList />
        </TabsContent>

        <TabsContent value="wuzapi" className="mt-6">
           <InboxList />
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <AgentList
            onCreateAgent={() => setCreateDialogOpen(true)}
            onInviteAgent={() => setInviteDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          <TeamList />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RoleList />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLog />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AgentInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
      <AgentCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}
