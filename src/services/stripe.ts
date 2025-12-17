/**
 * Stripe Frontend API Client
 * 
 * Service for interacting with Stripe-related backend endpoints.
 * Requirements: 1.1
 */

import { api } from '@/lib/api'
import type {
  StripeSettings,
  StripeSettingsInput,
  Subscription,
  CreditBalance,
  CreditPackage,
  Invoice,
  ConnectStatus,
  ResellerPricing,
  AffiliateEarnings,
  AffiliateConfig,
  PaymentAnalytics,
  Plan,
  PlanSyncResult,
  CheckoutSessionResponse,
  BillingPortalResponse,
  AvailablePlan,
} from '@/types/stripe'

// ==================== Admin Settings ====================

/**
 * Get Stripe settings (masked)
 */
export async function getStripeSettings(): Promise<StripeSettings> {
  const response = await api.get('/api/admin/stripe/settings')
  return response.data.data
}

/**
 * Save Stripe settings
 */
export async function saveStripeSettings(settings: StripeSettingsInput): Promise<{ accountId: string }> {
  const response = await api.post('/api/admin/stripe/settings', settings)
  return response.data
}

/**
 * Test Stripe connection with new keys
 */
export async function testStripeConnection(secretKey: string, publishableKey: string): Promise<{ accountId: string }> {
  const response = await api.post('/api/admin/stripe/test-connection', { secretKey, publishableKey })
  return response.data
}

/**
 * Test Stripe connection with saved keys
 */
export async function testSavedStripeConnection(): Promise<{ accountId: string; accountInfo?: Record<string, unknown> }> {
  const response = await api.post('/api/admin/stripe/test-connection', { useSavedKeys: true })
  return response.data
}

/**
 * Sync all plans with Stripe
 */
export async function syncPlansWithStripe(): Promise<PlanSyncResult> {
  const response = await api.post('/api/admin/stripe/sync-plans')
  return response.data.data
}

/**
 * Sync a single plan with Stripe
 */
export async function syncPlanWithStripe(planId: string, forceResync = false): Promise<PlanSyncResult> {
  const response = await api.post('/api/admin/stripe/sync-plans', { planId, forceResync })
  return response.data.data
}

/**
 * Get all plans
 */
export async function getPlans(): Promise<Plan[]> {
  const response = await api.get('/api/admin/plans')
  return response.data.data
}

/**
 * Get plans not synced with Stripe
 */
export async function getUnsyncedPlans(): Promise<Plan[]> {
  const response = await api.get('/api/admin/stripe/unsynced-plans')
  return response.data.data
}

/**
 * Get payment analytics
 */
export async function getPaymentAnalytics(): Promise<PaymentAnalytics> {
  const response = await api.get('/api/admin/stripe/analytics')
  return response.data.data
}

/**
 * Update affiliate configuration
 */
export async function updateAffiliateConfig(config: AffiliateConfig): Promise<AffiliateConfig> {
  const response = await api.post('/api/admin/stripe/affiliate-config', config)
  return response.data.data
}

// ==================== User Subscription ====================

/**
 * Get available plans for upgrade
 */
export async function getAvailablePlans(): Promise<AvailablePlan[]> {
  const response = await api.get('/api/user/plans')
  return response.data.data
}

/**
 * Get current subscription
 */
export async function getSubscription(): Promise<Subscription | null> {
  const response = await api.get('/api/user/subscription')
  return response.data.data
}

/**
 * Create subscription checkout session
 */
export async function createSubscriptionCheckout(planId: string): Promise<CheckoutSessionResponse> {
  const response = await api.post('/api/user/subscription/checkout', { planId })
  return response.data.data
}

/**
 * Change subscription plan
 */
export async function changePlan(newPlanId: string): Promise<CheckoutSessionResponse> {
  const response = await api.post('/api/user/subscription/change', { planId: newPlanId })
  return response.data.data
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(): Promise<void> {
  await api.post('/api/user/subscription/cancel')
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(): Promise<void> {
  await api.post('/api/user/subscription/reactivate')
}

// ==================== Credits ====================

/**
 * Get credit balance
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const response = await api.get('/api/user/credits')
  return response.data.data
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const response = await api.get('/api/user/credits/packages')
  return response.data.data
}

/**
 * Purchase credits
 */
export async function purchaseCredits(packageId: string): Promise<CheckoutSessionResponse> {
  const response = await api.post('/api/user/credits/purchase', { packageId })
  return response.data.data
}

// ==================== Billing ====================

/**
 * Get billing history (invoices)
 */
export async function getBillingHistory(page = 1): Promise<Invoice[]> {
  const response = await api.get('/api/user/billing/history', { params: { page } })
  return response.data.data
}

/**
 * Open billing portal
 */
export async function openBillingPortal(): Promise<BillingPortalResponse> {
  const response = await api.post('/api/user/billing/portal')
  return response.data.data
}

// ==================== Reseller / Connect ====================

/**
 * Start Stripe Connect onboarding
 */
export async function startConnectOnboarding(): Promise<{ url: string }> {
  const response = await api.post('/api/reseller/connect/onboard')
  return response.data.data
}

/**
 * Get Connect account status
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const response = await api.get('/api/reseller/connect/status')
  return response.data.data
}

/**
 * Get Express Dashboard link
 */
export async function getExpressDashboardLink(): Promise<{ url: string }> {
  const response = await api.post('/api/reseller/connect/dashboard')
  return response.data.data
}

/**
 * Get wholesale packages
 */
export async function getWholesalePackages(): Promise<CreditPackage[]> {
  const response = await api.get('/api/reseller/wholesale/packages')
  return response.data.data
}

/**
 * Purchase wholesale credits
 */
export async function purchaseWholesale(packageId: string): Promise<CheckoutSessionResponse> {
  const response = await api.post('/api/reseller/wholesale/purchase', { packageId })
  return response.data.data
}

/**
 * Get reseller pricing
 */
export async function getResellerPricing(): Promise<ResellerPricing[]> {
  const response = await api.get('/api/reseller/pricing')
  return response.data.data
}

/**
 * Update reseller pricing
 */
export async function updateResellerPricing(pricing: ResellerPricing): Promise<void> {
  await api.put('/api/reseller/pricing', pricing)
}

/**
 * Get affiliate earnings
 */
export async function getAffiliateEarnings(): Promise<AffiliateEarnings> {
  const response = await api.get('/api/reseller/affiliate/earnings')
  return response.data.data
}

// ==================== Stripe Service Object ====================

export const stripeService = {
  // Admin
  getSettings: getStripeSettings,
  saveSettings: saveStripeSettings,
  testConnection: testStripeConnection,
  testSavedConnection: testSavedStripeConnection,
  syncPlans: syncPlansWithStripe,
  syncPlan: syncPlanWithStripe,
  getPlans,
  getUnsyncedPlans,
  getAnalytics: getPaymentAnalytics,
  updateAffiliateConfig,

  // Subscriptions
  getAvailablePlans,
  getSubscription,
  createSubscriptionCheckout,
  changePlan,
  cancelSubscription,
  reactivateSubscription,

  // Credits
  getCreditBalance,
  getCreditPackages,
  purchaseCredits,

  // Billing
  getBillingHistory,
  openBillingPortal,

  // Reseller
  startConnectOnboarding,
  getConnectStatus,
  getExpressDashboardLink,
  getWholesalePackages,
  purchaseWholesale,
  getResellerPricing,
  updateResellerPricing,
  getAffiliateEarnings,
}

export default stripeService
