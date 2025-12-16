/**
 * AgentManagementPage
 * 
 * Page for managing agents in user dashboard.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6
 */

import { useState, useCallback, useEffect } from 'react'
import { AgentListUser } from '@/components/user/AgentListUser'
import { AgentInviteDialogUser } from '@/components/user/AgentInviteDialogUser'
import { AgentCreateDialogUser } from '@/components/user/AgentCreateDialogUser'
import { AgentEditDialogUser } from '@/components/user/AgentEditDialogUser'
import { QuotaWarning } from '@/components/user/QuotaGate'
import { useAgentContext } from '@/contexts/AgentContext'
import type { Agent } from '@/types/multi-user'

export default function AgentManagementPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [maxAgentsReached, setMaxAgentsReached] = useState(false)
  
  const { checkQuota } = useAgentContext()

  useEffect(() => {
    const quotaStatus = checkQuota('max_agents')
    setMaxAgentsReached(quotaStatus?.exceeded || false)
  }, [checkQuota])

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleInvite = () => {
    if (maxAgentsReached) return
    setInviteDialogOpen(true)
  }

  const handleCreate = () => {
    if (maxAgentsReached) return
    setCreateDialogOpen(true)
  }

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent)
    setEditDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <QuotaWarning quotaType="max_agents" />
      
      <AgentListUser
        key={refreshKey}
        onInviteAgent={handleInvite}
        onCreateAgent={handleCreate}
        onEditAgent={handleEdit}
        maxAgentsReached={maxAgentsReached}
      />

      <AgentInviteDialogUser
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={handleRefresh}
        maxAgentsReached={maxAgentsReached}
      />

      <AgentCreateDialogUser
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleRefresh}
        maxAgentsReached={maxAgentsReached}
      />

      <AgentEditDialogUser
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        agent={selectedAgent}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
