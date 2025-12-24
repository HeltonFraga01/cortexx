/**
 * Dashboard Types
 * TypeScript interfaces for the User Dashboard Modernization
 */

// Inbox Status
export interface InboxStatus {
  id: string
  name: string
  phoneNumber: string | null
  isConnected: boolean
  unreadCount: number
  lastActivityAt: string | null
}

// Conversation Metrics
export interface ConversationMetrics {
  openCount: number
  resolvedCount: number
  pendingCount: number
  averageResponseTimeMinutes: number
}

// Agent Metrics
export interface AgentMetrics {
  id: string
  name: string
  avatarUrl: string | null
  availability: 'online' | 'busy' | 'offline'
  assignedConversations: number
  resolvedConversations: number
}

// Campaign Summary
export interface CampaignSummary {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  totalContacts: number
  sentCount: number
  failedCount: number
  progress: number
  completedAt: string | null
}

// Quota Status
export interface QuotaStatus {
  key: string
  label: string
  used: number
  limit: number
  percentage: number
  status: 'normal' | 'warning' | 'danger'
}

// Subscription Info
export interface SubscriptionInfo {
  planName: string
  renewalDate: string | null
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  creditBalance?: number
}

// Contact Stats
export interface ContactStats {
  total: number
  growthPercentage: number
}

// Message Activity Data (for charts)
export interface MessageActivityData {
  date: string
  incoming: number
  outgoing: number
}

// Contact Growth Data (for charts)
export interface ContactGrowthData {
  date: string
  newContacts: number
  cumulative: number
}

// Dashboard Metrics Response
export interface DashboardMetrics {
  inboxes: InboxStatus[]
  conversations: ConversationMetrics
  previousPeriodConversations: ConversationMetrics | null
  agents: AgentMetrics[]
  campaigns: {
    active: CampaignSummary[]
    recent: CampaignSummary | null
  }
  quotas: QuotaStatus[]
  subscription: SubscriptionInfo | null
  creditBalance: number
  contacts: ContactStats
  lastUpdated: string
}

// Dashboard State
export interface DashboardState {
  selectedInboxId: string | null
  dateRange: DateRange
  isLoading: boolean
  lastUpdated: Date | null
}

export interface DateRange {
  start: Date
  end: Date
  period: 'day' | 'week' | 'month'
}

// Component Props
export interface InboxOverviewProps {
  inboxes: InboxStatus[]
  onInboxSelect: (inboxId: string | null) => void
  selectedInboxId: string | null
  isLoading?: boolean
}

export interface ConversationStatsProps {
  stats: ConversationMetrics
  previousPeriodStats: ConversationMetrics | null
  isLoading?: boolean
}

export interface MessageActivityChartProps {
  data: MessageActivityData[]
  viewMode: 'daily' | 'hourly'
  onViewModeChange: (mode: 'daily' | 'hourly') => void
  isLoading?: boolean
}

export interface AgentPerformanceProps {
  agents: AgentMetrics[]
  onAgentClick: (agentId: string) => void
  isLoading?: boolean
}

export interface CampaignStatusProps {
  activeCampaigns: CampaignSummary[]
  recentCampaign: CampaignSummary | null
  onCampaignClick: (campaignId: string) => void
  isLoading?: boolean
}

export interface QuotaUsagePanelProps {
  quotas: QuotaStatus[]
  subscription: SubscriptionInfo | null
  creditBalance: number
  isLoading?: boolean
}

export interface ContactGrowthChartProps {
  data: ContactGrowthData[]
  totalContacts: number
  growthPercentage: number
  isLoading?: boolean
}

export interface QuickActionsPanelProps {
  hasManagementPermission: boolean
}
