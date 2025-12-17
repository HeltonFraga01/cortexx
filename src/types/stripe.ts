/**
 * Stripe TypeScript Interfaces
 * 
 * Type definitions for Stripe integration.
 * Requirements: 1.1
 */

// ==================== Settings ====================

export interface StripeSettings {
  secretKeyMasked: string
  publishableKey: string
  webhookSecretMasked: string
  connectEnabled: boolean
  isConfigured: boolean
}

export interface StripeSettingsInput {
  secretKey: string
  publishableKey: string
  webhookSecret?: string
  connectEnabled?: boolean
}

// ==================== Subscription ====================

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'expired' | 'suspended'

export interface Subscription {
  id: string
  planId: string
  planName: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeSubscriptionId?: string
  paymentMethod?: PaymentMethod
}

export interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

// ==================== Credits ====================

export interface CreditBalance {
  available: number
  pending: number
  currency: string
  lowBalanceThreshold: number
  isLow: boolean
}

export interface CreditPackage {
  id: string
  name: string
  creditAmount: number
  priceCents: number
  currency: string
  isWholesale: boolean
  volumeDiscount?: number
}

export interface CreditTransaction {
  id: string
  type: 'purchase' | 'grant' | 'consumption' | 'transfer' | 'refund' | 'expiration'
  amount: number
  balanceAfter: number
  description?: string
  createdAt: string
}

// ==================== Invoices ====================

export type InvoiceStatus = 'paid' | 'open' | 'void' | 'uncollectible'

export interface Invoice {
  id: string
  stripeInvoiceId: string
  amount: number
  currency: string
  status: InvoiceStatus
  pdfUrl: string
  createdAt: string
}

// ==================== Stripe Connect ====================

export interface ConnectStatus {
  accountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requiresAction: boolean
  dashboardUrl?: string
}

export interface ResellerPricing {
  packageId: string
  packageName: string
  wholesaleCost: number
  customPrice: number
  profitMargin: number
  platformFee: number
}

// ==================== Affiliate ====================

export interface AffiliateEarnings {
  totalEarned: number
  pendingPayout: number
  paidOut: number
  referralCount: number
  conversionRate: number
}

export interface AffiliateConfig {
  commissionRate: number
  payoutThreshold: number
  enabled: boolean
}

// ==================== Analytics ====================

export interface PaymentAnalytics {
  mrr: number
  totalActiveSubscriptions: number
  statusBreakdown: {
    active: number
    trial: number
    past_due: number
    canceled: number
    expired: number
  }
  creditSales: number
  creditConsumption: number
  affiliateMetrics: {
    totalAffiliates: number
    totalCommissionsPaid: number
  }
}

// ==================== Plans ====================

export interface Plan {
  id: string
  name: string
  description?: string
  priceCents: number
  billingCycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'biweekly'
  status: 'active' | 'inactive'
  isDefault: boolean
  trialDays: number
  stripeProductId?: string
  stripePriceId?: string
  isCreditPackage?: boolean
  creditAmount?: number
  subscriberCount?: number
  createdAt: string
  updatedAt: string
}

// ==================== Plan Sync ====================

export interface PlanSyncResult {
  synced: Array<{ id: string; name: string; stripePriceId: string }>
  skipped: Array<{ id: string; name: string; reason: string }>
  failed: Array<{ id: string; name: string; error: string }>
}

export interface PlanSyncItemResult {
  planId: string
  name: string
  status: 'synced' | 'skipped' | 'error'
  stripeProductId?: string
  stripePriceId?: string
  reason?: string
  error?: string
}

// ==================== User Available Plans ====================

export interface AvailablePlan {
  id: string
  name: string
  description?: string
  priceCents: number
  billingCycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'biweekly'
  trialDays: number
  isDefault: boolean
  isCurrent: boolean
  quotas: Record<string, number>
  features: string[]
  stripePriceId: boolean // Only indicates if synced
}

// ==================== Checkout ====================

export interface CheckoutSessionResponse {
  url: string
  sessionId: string
}

export interface BillingPortalResponse {
  url: string
}
