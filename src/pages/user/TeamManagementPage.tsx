/**
 * TeamManagementPage
 * 
 * Page for managing teams in user dashboard.
 * 
 * Requirements: 3.1, 3.2, 3.5
 */

import { useState, useCallback, useEffect } from 'react'
import { TeamListUser } from '@/components/user/TeamListUser'
import { TeamDialogUser } from '@/components/user/TeamDialogUser'
import { QuotaWarning } from '@/components/user/QuotaGate'
import { useAgentContext } from '@/contexts/AgentContext'
import type { TeamWithStats } from '@/types/multi-user'

export default function TeamManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [maxTeamsReached, setMaxTeamsReached] = useState(false)
  
  const { checkQuota } = useAgentContext()

  useEffect(() => {
    const quotaStatus = checkQuota('max_teams')
    setMaxTeamsReached(quotaStatus?.exceeded || false)
  }, [checkQuota])

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleCreate = () => {
    if (maxTeamsReached) return
    setSelectedTeam(null)
    setDialogOpen(true)
  }

  const handleEdit = (team: TeamWithStats) => {
    setSelectedTeam(team)
    setDialogOpen(true)
  }

  const handleManageMembers = (team: TeamWithStats) => {
    setSelectedTeam(team)
    setDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <QuotaWarning quotaType="max_teams" />
      
      <TeamListUser
        key={refreshKey}
        onCreateTeam={handleCreate}
        onEditTeam={handleEdit}
        onManageMembers={handleManageMembers}
        maxTeamsReached={maxTeamsReached}
      />

      <TeamDialogUser
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={selectedTeam}
        onSuccess={handleRefresh}
        maxTeamsReached={maxTeamsReached}
      />
    </div>
  )
}
