/**
 * UserDashboardModern Component
 * Main dashboard component composing all sub-components
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { RefreshCw, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'
import { getAccountSummary } from '@/services/user-subscription'
import {
  getDashboardMetrics,
  getMessageActivity,
  getContactGrowth
} from '@/services/dashboard-metrics'
import {
  InboxOverviewCard,
  ConversationStatsCard,
  MessageActivityChart,
  AgentPerformanceCard,
  CampaignStatusCard,
  QuotaUsagePanel,
  ContactGrowthChart,
  QuickActionsPanel
} from './dashboard'
import type { DashboardMetrics, MessageActivityData, ContactGrowthData } from '@/types/dashboard'

const REFRESH_INTERVAL = 30000 // 30 seconds for inbox status

interface UserDashboardModernProps {
  onSwitchToConnection?: (inboxId: string) => void
}

export function UserDashboardModern({ onSwitchToConnection }: UserDashboardModernProps) {
  const navigate = useNavigate()
  const { 
    availableInboxes, 
    selectedInboxIds, 
    isAllSelected,
    selectSingle,
    selectAll,
    isLoading: inboxLoading 
  } = useSupabaseInbox()
  
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null)
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'hourly'>('daily')
  const [hasManagementPermission, setHasManagementPermission] = useState(false)

  // Memoize inbox IDs for API calls - use context selection
  const inboxIdsForApi = useMemo(() => {
    // If all selected or no specific selection, don't filter (return undefined)
    if (isAllSelected || selectedInboxIds.length === 0) {
      return undefined
    }
    return selectedInboxIds
  }, [selectedInboxIds, isAllSelected])

  // Fetch dashboard metrics with inbox filter
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics', inboxIdsForApi],
    queryFn: () => getDashboardMetrics(inboxIdsForApi),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000
  })

  // Fetch message activity with inbox filter
  const {
    data: messageActivity,
    isLoading: activityLoading
  } = useQuery<MessageActivityData[]>({
    queryKey: ['message-activity', inboxIdsForApi],
    queryFn: () => getMessageActivity(7, inboxIdsForApi),
    staleTime: 60000
  })

  // Fetch contact growth with inbox filter
  const {
    data: contactGrowth,
    isLoading: growthLoading
  } = useQuery<ContactGrowthData[]>({
    queryKey: ['contact-growth', inboxIdsForApi],
    queryFn: () => getContactGrowth(30, inboxIdsForApi),
    staleTime: 300000 // 5 minutes
  })

  // Fetch account summary for management permissions
  useEffect(() => {
    async function checkPermissions() {
      try {
        const summary = await getAccountSummary()
        setHasManagementPermission(
          summary.features.some(f => f.featureName === 'agent_management' && f.enabled) ||
          summary.subscription?.planName !== 'free'
        )
      } catch {
        setHasManagementPermission(false)
      }
    }
    checkPermissions()
  }, [])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refetchMetrics()
      toast.success('Dashboard atualizado')
    } catch {
      toast.error('Erro ao atualizar dashboard')
    }
  }, [refetchMetrics])

  // Handle inbox selection from the card - switch to connection tab
  const handleInboxSelect = useCallback((inboxId: string | null) => {
    setSelectedInboxId(inboxId)
    // Also update the context selection for filtering
    if (inboxId) {
      selectSingle(inboxId)
      // Switch to connection tab to show inbox details
      if (onSwitchToConnection) {
        onSwitchToConnection(inboxId)
      }
    } else {
      selectAll()
    }
  }, [selectSingle, selectAll, onSwitchToConnection])

  // Handle agent click
  const handleAgentClick = useCallback((agentId: string) => {
    navigate(`/user/agents/${agentId}`)
  }, [navigate])

  // Handle campaign click
  const handleCampaignClick = useCallback((campaignId: string) => {
    navigate(`/user/campaigns/${campaignId}`)
  }, [navigate])

  // Format last updated time
  const formatLastUpdated = (dateStr: string | undefined) => {
    if (!dateStr) return 'Nunca'
    const date = new Date(dateStr)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Map available inboxes from context to the format expected by InboxOverviewCard
  const inboxesForCard = useMemo(() => {
    return availableInboxes.map(inbox => ({
      id: inbox.id,
      name: inbox.name,
      phoneNumber: inbox.phoneNumber,
      isConnected: inbox.isConnected,
      unreadCount: inbox.unreadCount || 0,
      lastActivityAt: null // Not available in context, will be fetched from metrics
    }))
  }, [availableInboxes])

  // Use inboxes from metrics if available, otherwise use context inboxes
  const displayInboxes = metrics?.inboxes?.length ? metrics.inboxes : inboxesForCard

  // Show error state
  if (metricsError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            Erro ao carregar dados do dashboard
          </p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Refresh button - aligned right, compact */}
      <div className="flex items-center justify-between">
        {/* Inbox Overview - Full width horizontal scroll */}
        <InboxOverviewCard
          inboxes={displayInboxes}
          onInboxSelect={handleInboxSelect}
          selectedInboxId={selectedInboxId}
          isLoading={metricsLoading || inboxLoading}
        />
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatLastUpdated(metrics?.lastUpdated)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${metricsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Grid - Responsive layout */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Conversation Stats */}
        <ConversationStatsCard
          stats={metrics?.conversations || { openCount: 0, resolvedCount: 0, pendingCount: 0, averageResponseTimeMinutes: 0 }}
          previousPeriodStats={metrics?.previousPeriodConversations || null}
          isLoading={metricsLoading}
        />

        {/* Message Activity Chart - Spans 2 columns on lg */}
        <div className="md:col-span-1 lg:col-span-2">
          <MessageActivityChart
            data={messageActivity || []}
            viewMode={chartViewMode}
            onViewModeChange={setChartViewMode}
            isLoading={activityLoading}
          />
        </div>

        {/* Agent Performance */}
        <AgentPerformanceCard
          agents={metrics?.agents || []}
          onAgentClick={handleAgentClick}
          isLoading={metricsLoading}
        />

        {/* Campaign Status */}
        <CampaignStatusCard
          activeCampaigns={metrics?.campaigns?.active || []}
          recentCampaign={metrics?.campaigns?.recent || null}
          onCampaignClick={handleCampaignClick}
          isLoading={metricsLoading}
        />

        {/* Quota Usage */}
        <QuotaUsagePanel
          quotas={metrics?.quotas || []}
          subscription={metrics?.subscription || null}
          creditBalance={metrics?.creditBalance || 0}
          isLoading={metricsLoading}
        />
      </div>

      {/* Contact Growth Chart - Full width */}
      <ContactGrowthChart
        data={contactGrowth || []}
        totalContacts={metrics?.contacts?.total || 0}
        growthPercentage={metrics?.contacts?.growthPercentage || 0}
        isLoading={growthLoading}
        compact
      />

      {/* Quick Actions - Compact */}
      <QuickActionsPanel hasManagementPermission={hasManagementPermission} compact />
    </div>
  )
}

export default UserDashboardModern
