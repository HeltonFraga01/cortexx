/**
 * CRM Types
 * 
 * TypeScript interfaces for the Contact CRM Evolution feature.
 * 
 * Requirements: All (Contact CRM Evolution)
 */

// ==================== CONTACT CRM ====================

export interface Contact {
  id: string
  phone: string
  name: string | null
  avatarUrl: string | null
  whatsappJid: string | null
  source: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ContactCRM extends Contact {
  // Lead scoring
  leadScore: number
  leadTier: LeadTier
  
  // Purchase metrics
  lifetimeValueCents: number
  purchaseCount: number
  lastPurchaseAt: string | null
  
  // Credits
  creditBalance: number
  
  // Activity
  lastInteractionAt: string | null
  isActive: boolean
  
  // Communication preferences
  bulkMessagingOptIn: boolean
  optOutAt: string | null
  optOutMethod: string | null
  
  // Custom fields
  customFields: Record<string, unknown>
}

export type LeadTier = 'cold' | 'warm' | 'hot' | 'vip'

export interface LeadScoreConfig {
  messageReceived: number
  messageSent: number
  purchaseMade: number
  purchaseValueMultiplier: number
  inactivityDecayPerDay: number
  maxScore: number
  tiers: {
    cold: { min: number; max: number }
    warm: { min: number; max: number }
    hot: { min: number; max: number }
    vip: { min: number; max: number }
  }
}

export interface LeadScoreBreakdown {
  messages: number
  purchases: number
  recency: number
  custom: number
}

// ==================== TIMELINE ====================

export type TimelineEventType = 'message' | 'call' | 'email' | 'note' | 'status_change' | 'purchase' | 'credit'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  direction?: 'incoming' | 'outgoing'
  content: string
  fullContent?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  createdByType?: 'account' | 'agent' | 'system'
}

export interface TimelineFilters {
  types?: TimelineEventType[]
  dateRange?: {
    start: string
    end: string
  }
}

// ==================== PURCHASES ====================

export type PurchaseStatus = 'pending' | 'completed' | 'refunded' | 'cancelled'
export type PurchaseSource = 'manual' | 'stripe' | 'webhook' | 'import'

export interface Purchase {
  id: string
  contactId: string
  externalId: string | null
  amountCents: number
  currency: string
  description: string | null
  productName: string | null
  status: PurchaseStatus
  source: PurchaseSource
  metadata: Record<string, unknown>
  purchasedAt: string
  createdAt: string
}

export interface PurchaseMetrics {
  lifetimeValueCents: number
  purchaseCount: number
  averageOrderValueCents: number
  lastPurchaseAt: string | null
}

export interface PurchaseStats {
  totalPurchases: number
  completedPurchases: number
  totalRevenueCents: number
  averageOrderValueCents: number
  refundedCount: number
  pendingCount: number
}

// ==================== CREDITS ====================

export type CreditTransactionType = 'credit' | 'debit' | 'adjustment' | 'expiration'

export interface CreditTransaction {
  id: string
  contactId: string
  type: CreditTransactionType
  amount: number
  balanceAfter: number
  source: string
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string
  createdBy: string | null
  createdByType: 'account' | 'agent' | 'system' | null
}

export interface CreditBalance {
  balance: number
  lastTransaction: CreditTransaction | null
}

export interface CreditSummary {
  totalBalance: number
  contactsWithCredits: number
  monthlyCreditsAdded: number
  monthlyCreditsConsumed: number
}

// ==================== CUSTOM FIELDS ====================

export type CustomFieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url' | 'email' | 'phone'

export interface CustomFieldDefinition {
  id: string
  name: string
  label: string
  fieldType: CustomFieldType
  options: string[] | null
  isRequired: boolean
  isSearchable: boolean
  displayOrder: number
  defaultValue: string | null
  validationRules: CustomFieldValidationRules | null
  createdAt: string
  updatedAt: string
}

export interface CustomFieldValidationRules {
  min?: number
  max?: number
  pattern?: string
}

export interface CustomFieldValue {
  fieldName: string
  value: unknown
}

// ==================== SEGMENTS ====================

export type SegmentOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'

export interface SegmentCondition {
  field: string
  operator: SegmentOperator
  value: unknown
}

export interface SegmentGroup {
  logic: 'AND' | 'OR'
  conditions: (SegmentCondition | SegmentGroup)[]
}

export interface Segment {
  id: string
  name: string
  description: string | null
  conditions: SegmentGroup
  isTemplate: boolean
  templateKey: string | null
  memberCount: number
  lastEvaluatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SegmentTemplate {
  key: string
  name: string
  description: string
  conditions: SegmentGroup
}

export interface SegmentMember {
  id: string
  name: string | null
  phone: string
  leadScore: number
  leadTier: LeadTier
  lifetimeValueCents: number
}

export interface SegmentPreview {
  count: number
  sample: SegmentMember[]
}

// ==================== COMMUNICATION PREFERENCES ====================

export interface CommunicationPreferences {
  bulkMessagingOptIn: boolean
  optOutAt: string | null
  optOutMethod: string | null
}

export interface OptInStats {
  totalContacts: number
  optedIn: number
  optedOut: number
  optInRate: number
  optOutByMethod: Record<string, number>
}

// ==================== ANALYTICS ====================

export interface CRMDashboardMetrics {
  totalContacts: number
  activeContacts: number
  averageLeadScore: number
  totalLTV: number
  leadScoreDistribution: {
    cold: number
    warm: number
    hot: number
    vip: number
  }
}

export interface TopContact {
  id: string
  name: string | null
  phone: string
  leadScore: number
  leadTier: LeadTier
  lifetimeValueCents: number
  purchaseCount: number
}

// ==================== API RESPONSES ====================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiError {
  error: string
  details?: unknown
}

// ==================== FORM DATA ====================

export interface CreatePurchaseFormData {
  amountCents: number
  currency: string
  productName: string
  description: string
  status: PurchaseStatus
  purchasedAt: string
}

export interface AddCreditsFormData {
  amount: number
  source: string
  description: string
}

export interface ConsumeCreditsFormData {
  amount: number
  reason: string
  description: string
}

export interface CreateSegmentFormData {
  name: string
  description: string
  conditions: SegmentGroup
}

export interface CreateCustomFieldFormData {
  name: string
  label: string
  fieldType: CustomFieldType
  options: string[]
  isRequired: boolean
  isSearchable: boolean
  defaultValue: string
  validationRules: CustomFieldValidationRules
}
