/**
 * UserDashboardModern Component
 * Main dashboard component composing all sub-components
 * Requirements: 1.1, 1.2, 1.5, 8.1, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw, MessageSquare, CheckCircle, Clock, Users, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAccountSummary } from '@/hooks/useAccountSummary'
import {
  getDashboardMetrics,
  getMessageActivity,
  getContactGrowth
} from '@/services/dashboard-metrics'
import {
  InboxOverviewCard,
  ConversationStatsCard,
  AgentPerformanceCard,
  CampaignStatusCard,
  QuotaUsagePanel,
  QuickActionsPanel,
  ModernStatsCard,
  DashboardHeader
} from './dashboard'

// Lazy load non-critical chart components for better LCP
const MessageActivityChart = lazy(() => 
  import('./dashboard/MessageActivityChart').then(m => ({ default: m.MessageActivityChart }))
)
const ContactGrowthChart = lazy(() => 
  import('./dashboard/ContactGrowthChart').then(m => ({ default: m.ContactGrowthChart }))
)
import type { DashboardMetrics, MessageActivityData, ContactGrowthData } from '@/types/dashboard'
import { Skeleton } from '@/components/ui/skeleton'

// Chart loading skeleton component
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className={`w-full`} style={{ height }} />
        </div>
      </CardContent>
    </Card>
  )
}

const REFRESH_INTERVAL = 30000 // 30 seconds for inbox status

interface UserDashboardModernProps {
  onSwitchToConnection?: (inboxId: string) => void
}

export function UserDashboardModern({ onSwitchToConnection }: UserDashboardModernProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
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
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined)

  // Use centralized hook for account summary (request deduplication)
  const { data: accountSummary } = useAccountSummary()
  const hasManagementPermission = accountSummary?.features.some(
    f => f.featureName === 'agent_management' && f.enabled
  ) || accountSummary?.subscription?.planName !== 'free'

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

  // Update lastUpdated when metrics change
  useEffect(() => {
    if (metrics?.lastUpdated) {
      setLastUpdated(new Date(metrics.lastUpdated))
    }
  }, [metrics?.lastUpdated])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refetchMetrics()
      setLastUpdated(new Date())
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

  // Calculate stats for ModernStatsCards
  const conversationStats = metrics?.conversations || { 
    openCount: 0, 
    resolvedCount: 0, 
    pendingCount: 0, 
    averageResponseTimeMinutes: 0 
  }
  const previousStats = metrics?.previousPeriodConversations

  // Calculate trends
  const calculateTrend = (current: number, previous?: number) => {
    if (!previous || previous === 0) return undefined
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(Math.round(change)),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    } as const
  }

  // Show error state
  if (metricsError) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          userName={user?.name || 'Usuário'}
          userAvatar={undefined}
          onRefresh={handleRefresh}
          isRefreshing={metricsLoading}
          lastUpdated={lastUpdated}
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-muted-foreground mb-4">
              Erro ao carregar dados do dashboard
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with user info and refresh */}
      <DashboardHeader
        userName={user?.name || 'Usuário'}
        userAvatar={undefined}
        onRefresh={handleRefresh}
        isRefreshing={metricsLoading}
        lastUpdated={lastUpdated}
      />

      {/* Stats Cards Grid - 4 columns on desktop */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <ModernStatsCard
          title="Conversas Abertas"
          value={conversationStats.openCount}
          icon={MessageSquare}
          iconColor="blue"
          trend={calculateTrend(conversationStats.openCount, previousStats?.openCount)}
          isLoading={metricsLoading}
        />
        <ModernStatsCard
          title="Resolvidas"
          value={conversationStats.resolvedCount}
          icon={CheckCircle}
          iconColor="green"
          trend={calculateTrend(conversationStats.resolvedCount, previousStats?.resolvedCount)}
          isLoading={metricsLoading}
        />
        <ModernStatsCard
          title="Pendentes"
          value={conversationStats.pendingCount}
          icon={Clock}
          iconColor="orange"
          trend={calculateTrend(conversationStats.pendingCount, previousStats?.pendingCount)}
          isLoading={metricsLoading}
        />
        <ModernStatsCard
          title="Contatos"
          value={metrics?.contacts?.total || 0}
          icon={Users}
          iconColor="purple"
          trend={metrics?.contacts?.growthPercentage ? {
            value: Math.abs(Math.round(metrics.contacts.growthPercentage)),
            direction: metrics.contacts.growthPercentage > 0 ? 'up' : 'down'
          } : undefined}
          isLoading={metricsLoading}
        />
      </div>

      {/* Inbox Overview */}
      <InboxOverviewCard
        inboxes={displayInboxes}
        onInboxSelect={handleInboxSelect}
        selectedInboxId={selectedInboxId}
        isLoading={metricsLoading || inboxLoading}
      />

      {/* Main Grid - Responsive layout */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Message Activity Chart - Spans 2 columns on lg */}
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartSkeleton height={300} />}>
            <MessageActivityChart
              data={messageActivity || []}
              viewMode={chartViewMode}
              onViewModeChange={setChartViewMode}
              isLoading={activityLoading}
            />
          </Suspense>
        </div>

        {/* Conversation Stats */}
        <ConversationStatsCard
          stats={conversationStats}
          previousPeriodStats={previousStats || null}
          isLoading={metricsLoading}
        />
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
      <Suspense fallback={<ChartSkeleton height={200} />}>
        <ContactGrowthChart
          data={contactGrowth || []}
          totalContacts={metrics?.contacts?.total || 0}
          growthPercentage={metrics?.contacts?.growthPercentage || 0}
          isLoading={growthLoading}
          compact
        />
      </Suspense>

      {/* Quick Actions */}
      <QuickActionsPanel hasManagementPermission={hasManagementPermission} />
    </div>
  )
}

export default UserDashboardModern
