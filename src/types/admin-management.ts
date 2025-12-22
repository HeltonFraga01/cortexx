/**
 * Admin User Management Types
 * 
 * TypeScript interfaces for plans, subscriptions, quotas, features,
 * audit logs, and dashboard statistics.
 */

// ============================================================================
// Plan Types
// ============================================================================

export interface Plan {
  id: string
  name: string
  description?: string
  priceCents: number
  billingCycle: BillingCycle
  status: PlanStatus
  isDefault: boolean
  trialDays: number
  quotas: PlanQuotas
  features: PlanFeatures
  subscriberCount?: number
  createdAt: string
  updatedAt: string
}

export type BillingCycle = 'monthly' | 'yearly' | 'lifetime'

export type PlanStatus = 'active' | 'inactive' | 'deprecated'

export interface PlanQuotas {
  maxAgents: number
  maxConnections: number
  maxMessagesPerDay: number
  maxMessagesPerMonth: number
  maxInboxes: number
  maxTeams: number
  maxWebhooks: number
  maxCampaigns: number
  maxStorageMb: number
  maxBots: number
  // Bot usage quotas
  maxBotCallsPerDay: number
  maxBotCallsPerMonth: number
  maxBotMessagesPerDay: number
  maxBotMessagesPerMonth: number
  maxBotTokensPerDay: number
  maxBotTokensPerMonth: number
}

// Plan features in snake_case (matching backend format)
// Only user features - controlled by subscription plans
export interface PlanFeatures {
  bulk_campaigns: boolean
  nocodb_integration: boolean
  bot_automation: boolean
  advanced_reports: boolean
  api_access: boolean
  webhooks: boolean
  scheduled_messages: boolean
  media_storage: boolean
}

export interface CreatePlanRequest {
  name: string
  description?: string
  priceCents?: number
  billingCycle?: BillingCycle
  status?: PlanStatus
  isDefault?: boolean
  trialDays?: number
  quotas?: Partial<PlanQuotas>
  features?: Partial<PlanFeatures>
}

export interface UpdatePlanRequest extends Partial<CreatePlanRequest> {
  effectiveDate?: string
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  plan?: Plan
  status: SubscriptionStatus
  startedAt: string
  trialEndsAt?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  canceledAt?: string
  suspensionReason?: string
  createdAt: string
  updatedAt: string
}

export type SubscriptionStatus = 
  | 'trial' 
  | 'active' 
  | 'past_due' 
  | 'canceled' 
  | 'expired' 
  | 'suspended'

export interface AssignPlanRequest {
  planId: string
}

export interface UpdateSubscriptionRequest {
  status: SubscriptionStatus
  reason?: string
}

export interface ProrationDetails {
  proratedAmount: number
  daysRemaining: number
  credit: number
  charge: number
  currentPlanPrice: number
  newPlanPrice: number
}

// ============================================================================
// Quota Types
// ============================================================================

export interface UserQuota {
  quotaType: QuotaType
  limit: number
  currentUsage: number
  percentage: number
  source: 'plan' | 'override'
  overrideReason?: string
}

export type QuotaType = 
  | 'max_agents'
  | 'max_connections'
  | 'max_messages_per_day'
  | 'max_messages_per_month'
  | 'max_inboxes'
  | 'max_teams'
  | 'max_webhooks'
  | 'max_campaigns'
  | 'max_storage_mb'
  | 'max_bots'
  // Bot usage quotas
  | 'max_bot_calls_per_day'
  | 'max_bot_calls_per_month'
  | 'max_bot_messages_per_day'
  | 'max_bot_messages_per_month'
  | 'max_bot_tokens_per_day'
  | 'max_bot_tokens_per_month'

export interface SetQuotaOverrideRequest {
  limit: number
  reason?: string
}

export interface QuotaCheckResult {
  allowed: boolean
  limit: number
  usage: number
  remaining: number
  quotaType: QuotaType
}

// ============================================================================
// Feature Types
// ============================================================================

export interface UserFeature {
  featureName: UserFeatureName
  enabled: boolean
  source: 'plan' | 'override'
}

// User features - controlled by subscription plans
export type UserFeatureName = 
  | 'bulk_campaigns'
  | 'nocodb_integration'
  | 'bot_automation'
  | 'advanced_reports'
  | 'api_access'
  | 'webhooks'
  | 'scheduled_messages'
  | 'media_storage'

// Admin features - admin-only, not controlled by plans
export type AdminFeatureName = 
  | 'page_builder'
  | 'custom_branding'

// Combined feature name type (for backward compatibility)
export type FeatureName = UserFeatureName | AdminFeatureName

export interface SetFeatureOverrideRequest {
  enabled: boolean
}

export interface FeatureDefinition {
  key: string
  name: UserFeatureName
  defaultValue: boolean
}

// ============================================================================
// User Action Types
// ============================================================================

export interface SuspendUserRequest {
  reason: string
}

export interface ResetPasswordRequest {
  sendEmail?: boolean
}

export interface DeleteUserRequest {
  confirm: true
}

export interface NotifyUserRequest {
  type: string
  title: string
  message: string
}

export interface UserNotification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  readAt?: string
  createdAt: string
}

export interface UserDataExport {
  userId: string
  exportedAt: string
  subscription: UserSubscription | null
  quotas: UserQuota[]
  features: UserFeature[]
  usageMetrics: Record<string, number>
  auditHistory: AdminAuditLog[]
}

// ============================================================================
// Bulk Action Types
// ============================================================================

export interface BulkAssignPlanRequest {
  userIds: string[]
  planId: string
}

export interface BulkSuspendRequest {
  userIds: string[]
  reason: string
}

export interface BulkReactivateRequest {
  userIds: string[]
}

export interface BulkNotifyRequest {
  userIds: string[]
  type: string
  title: string
  message: string
}

export interface BulkActionResult {
  successful: { userId: string; [key: string]: unknown }[]
  failed: { userId: string; error: string }[]
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface AdminAuditLog {
  id: string
  adminId: string
  actionType: AdminActionType
  targetUserId?: string
  targetResourceType?: string
  targetResourceId?: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export type AdminActionType = 
  | 'plan_created'
  | 'plan_updated'
  | 'plan_deleted'
  | 'user_plan_assigned'
  | 'user_suspended'
  | 'user_reactivated'
  | 'user_deleted'
  | 'user_password_reset'
  | 'quota_override_set'
  | 'quota_override_removed'
  | 'feature_override_set'
  | 'feature_override_removed'
  | 'bulk_action_executed'
  | 'user_impersonated'
  | 'setting_changed'
  | 'user_data_exported'
  | 'notification_sent'

export interface AuditLogFilters {
  adminId?: string
  targetUserId?: string
  actionType?: AdminActionType
  startDate?: string
  endDate?: string
}

export interface AuditLogPagination {
  page: number
  pageSize: number
}

export interface AuditLogListResult {
  logs: AdminAuditLog[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardStats {
  users: UserStats
  usage: UsageStats
  revenue: RevenueStats
  timestamp: string
}

export interface UserStats {
  total: number
  active: number
  trial: number
  suspended: number
  byStatus: Record<SubscriptionStatus, number>
  byPlan: Record<string, number>
  growthLast30Days: number
}

export interface UsageStats {
  messagesToday: number
  messagesThisWeek: number
  messagesThisMonth: number
  activeConnections: number
  totalStorageMb: number
}

export interface RevenueStats {
  mrr: number
  arr: number
  churnRate: number
  avgRevenuePerUser: number
}

export interface DashboardAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  userId?: string
  message: string
  createdAt: string
}

export type AlertType = 
  | 'quota_warning' 
  | 'payment_failed' 
  | 'connection_error' 
  | 'security_event'
  | 'user_suspended'

export type AlertSeverity = 'info' | 'warning' | 'error'

export interface GrowthMetric {
  date: string
  totalUsers: number
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
  }
}
