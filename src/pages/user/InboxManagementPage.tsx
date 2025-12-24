/**
 * InboxManagementPage
 * 
 * Page for managing inboxes in user dashboard.
 * 
 * Requirements: 4.1, 4.2, 4.5
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { InboxListUser } from '@/components/user/InboxListUser'
import { InboxDialogUser } from '@/components/user/InboxDialogUser'
import { QuotaWarning } from '@/components/user/QuotaGate'
import { useAgentContext } from '@/contexts/AgentContext'
import type { InboxWithStats } from '@/types/multi-user'

export default function InboxManagementPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedInbox, setSelectedInbox] = useState<InboxWithStats | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [maxInboxesReached, setMaxInboxesReached] = useState(false)
  
  const { checkQuota } = useAgentContext()

  useEffect(() => {
    const quotaStatus = checkQuota('max_inboxes')
    setMaxInboxesReached(quotaStatus?.exceeded || false)
  }, [checkQuota])

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleCreate = () => {
    if (maxInboxesReached) return
    setSelectedInbox(null)
    setDialogOpen(true)
  }

  const handleEdit = (inbox: InboxWithStats) => {
    // Navigate to the new inline edit page
    navigate(`/user/inboxes/edit/${inbox.id}`)
  }

  const handleManageAgents = (inbox: InboxWithStats) => {
    // For agent management, still use the dialog
    setSelectedInbox(inbox)
    setDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      <QuotaWarning quotaType="max_inboxes" />
      
      <InboxListUser
        key={refreshKey}
        onCreateInbox={handleCreate}
        onEditInbox={handleEdit}
        onManageAgents={handleManageAgents}
        maxInboxesReached={maxInboxesReached}
      />

      <InboxDialogUser
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inbox={selectedInbox}
        onSuccess={handleRefresh}
        maxInboxesReached={maxInboxesReached}
      />
    </div>
  )
}
