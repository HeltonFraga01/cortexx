/**
 * Dashboard Components Index
 * 
 * Exports all dashboard components for easy importing.
 */

// Original components
export { InboxOverviewCard } from './InboxOverviewCard'
export { ConversationStatsCard } from './ConversationStatsCard'
export { MessageActivityChart } from './MessageActivityChart'
export { AgentPerformanceCard } from './AgentPerformanceCard'
export { CampaignStatusCard } from './CampaignStatusCard'
export { QuotaUsagePanel } from './QuotaUsagePanel'
export { ContactGrowthChart } from './ContactGrowthChart'
export { QuickActionsPanel } from './QuickActionsPanel'

// Modern redesign components
export { ModernStatsCard } from './ModernStatsCard'
export type { ModernStatsCardProps, StatsColorVariant } from './ModernStatsCard'
export { DashboardHeader } from './DashboardHeader'
export type { DashboardHeaderProps } from './DashboardHeader'

/**
 * @deprecated Use InboxInfoCard from '@/components/shared/inbox' instead
 */
export { UserInfoCardModern } from './UserInfoCardModern'
export type { UserInfoCardModernProps } from './UserInfoCardModern'

/**
 * @deprecated Use ConnectionControlCard from '@/components/shared/inbox' instead
 */
export { ConnectionControlCardModern } from './ConnectionControlCardModern'
export type { ConnectionControlCardModernProps } from './ConnectionControlCardModern'

/**
 * @deprecated Use WebhookConfigCard from '@/components/shared/inbox' instead
 */
export { WebhookConfigCardModern } from './WebhookConfigCardModern'
export type { WebhookConfigCardModernProps } from './WebhookConfigCardModern'
