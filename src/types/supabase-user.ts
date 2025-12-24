/**
 * Types for Supabase User Edit Page - Comprehensive Data
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

// Supabase Auth User
export interface SupabaseAuthUser {
  id: string
  email?: string
  phone?: string
  email_confirmed_at?: string
  last_sign_in_at?: string
  created_at: string
  updated_at?: string
  user_metadata: {
    role?: 'admin' | 'user'
    name?: string
    wuzapi_id?: string
    [key: string]: unknown
  }
}

// Account linked to user
export interface UserAccount {
  id: number
  name: string
  owner_user_id: string
  tenant_id: string
  wuzapi_token?: string
  status: 'active' | 'suspended' | 'inactive'
  timezone?: string
  locale?: string
  settings?: Record<string, unknown>
  created_at: string
  updated_at?: string
}

// Subscription plan
export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price_cents: number
  billing_cycle: 'monthly' | 'yearly'
  features: Record<string, unknown>
  limits: Record<string, number>
  quotas?: Record<string, number>
}

// User subscription
export interface UserSubscription {
  id: string
  user_id: string
  account_id?: number
  plan_id: string
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended'
  current_period_start?: string
  current_period_end?: string
  trial_end?: string
  canceled_at?: string
  plan?: SubscriptionPlan
}

// Quota usage item
export interface QuotaUsageItem {
  used: number
  period_start?: string
  period_end?: string
}

// Inbox
export interface UserInbox {
  id: string
  name: string
  channel_type: string
  phone_number?: string
  status?: string
  enabled?: boolean
  account_id?: string
  wuzapi_token?: string
  wuzapi_user_id?: string
  wuzapi_connected?: boolean
  description?: string
  created_at: string
  updated_at?: string
}

// Agent
export interface UserAgent {
  id: number
  name: string
  email?: string
  role?: string
  availability_status?: string
  created_at: string
}

// Bot
export interface UserBot {
  id: number
  name: string
  description?: string
  outgoing_url?: string
  enabled?: boolean
  created_at: string
}

// Team
export interface UserTeam {
  id: number
  name: string
  description?: string
  created_at: string
}

// Label
export interface UserLabel {
  id: number
  title: string
  color?: string
  description?: string
  created_at: string
}

// Webhook
export interface UserWebhook {
  id: number
  url: string
  events?: string[]
  enabled?: boolean
  created_at: string
}

// Database Connection
export interface UserDatabaseConnection {
  id: number
  name: string
  type?: string
  host?: string
  status?: string
  created_at: string
}

// Campaign
export interface UserCampaign {
  id: number
  name: string
  status: string
  total_contacts?: number
  sent_count?: number
  failed_count?: number
  created_at: string
}

// Credit Transaction
export interface UserCreditTransaction {
  id: number
  type: string
  amount: number
  description?: string
  created_at: string
}

// Audit Log Entry
export interface UserAuditLogEntry {
  id: number
  action: string
  resource_type?: string
  resource_id?: string
  details?: Record<string, unknown>
  created_at: string
}

// Conversation Stats
export interface ConversationStats {
  total: number
  open: number
  resolved: number
  pending: number
  snoozed: number
}

// User Stats
export interface UserStats {
  conversations: ConversationStats
  messages: number
  contacts: number
  templates: number
  cannedResponses: number
  scheduledMessages: number
}

// Full user data response (comprehensive)
export interface SupabaseUserFull {
  user: SupabaseAuthUser
  account: UserAccount | null
  subscription: UserSubscription | null
  quotas: Record<string, QuotaUsageItem>
  planLimits: Record<string, number>
  // Resources
  inboxes: UserInbox[]
  agents: UserAgent[]
  bots: UserBot[]
  teams: UserTeam[]
  labels: UserLabel[]
  webhooks: UserWebhook[]
  databaseConnections: UserDatabaseConnection[]
  campaigns: UserCampaign[]
  creditTransactions: UserCreditTransaction[]
  auditLog: UserAuditLogEntry[]
  // Stats
  stats: UserStats
}

// Legacy support - simple quotas
export interface UserQuotaUsage {
  id?: string
  user_id: string
  messages_sent?: number
  messages_limit?: number
  bots_active?: number
  bots_limit?: number
  campaigns_active?: number
  campaigns_limit?: number
  [key: string]: unknown
}

// Update DTOs
export interface UpdateSupabaseUserDTO {
  email?: string
  phone?: string
  email_confirm?: boolean
  user_metadata?: Record<string, unknown>
}

export interface CreateInboxDTO {
  name: string
  phone_number?: string
  wuzapi_token?: string
  channel_type?: string
}

export interface UpdateAccountDTO {
  name?: string
  status?: 'active' | 'suspended' | 'inactive'
  timezone?: string
  locale?: string
  settings?: Record<string, unknown>
}

// Action responses
export interface PasswordResetResponse {
  success: boolean
  message: string
  tempPassword?: string
}

export interface ActionResponse {
  success: boolean
  message?: string
  data?: unknown
}

// Unassigned inbox (not linked to any user)
export interface UnassignedInbox {
  id: string
  name: string
  channel_type: 'whatsapp' | 'email' | 'web' | 'api'
  phone_number?: string
  status?: string
  created_at: string
}
