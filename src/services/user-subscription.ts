/**
 * User Subscription Service
 * 
 * Frontend service for fetching current user's subscription, quotas, and features.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 6.1, 6.2, 7.1
 */

import apiClient from './api-client'
import type { UserSubscription, UserQuota, UserFeature } from '@/types/admin-management'

export interface QuotaStatus {
  quotaType: string
  limit: number
  currentUsage: number
  percentage: number
  source: 'plan' | 'override'
  overrideReason?: string
  warning: boolean
  exceeded: boolean
  allowed: boolean
  remaining: number
}

export interface AccountSummary {
  subscription: UserSubscription | null
  quotas: QuotaStatus[]
  features: UserFeature[]
  summary: {
    planName: string
    status: string
    warningQuotas: number
    exceededQuotas: number
    enabledFeatures: number
    totalFeatures: number
  }
}

/**
 * Get current user's subscription details
 */
export async function getUserSubscription(): Promise<UserSubscription | null> {
  const response = await apiClient.get('/user/subscription')
  return response.data.data
}

/**
 * Get current user's quotas with usage
 */
export async function getUserQuotas(): Promise<QuotaStatus[]> {
  const response = await apiClient.get('/user/quotas')
  return response.data.data
}

/**
 * Get specific quota status
 */
export async function getQuotaStatus(quotaType: string): Promise<QuotaStatus> {
  const response = await apiClient.get(`/user/quotas/${quotaType}`)
  return response.data.data
}

/**
 * Check if a quota allows an action
 */
export async function checkQuotaAllows(quotaType: string, amount = 1): Promise<boolean> {
  const status = await getQuotaStatus(quotaType)
  return status.remaining >= amount
}

/**
 * Get current user's features
 */
export async function getUserFeatures(): Promise<UserFeature[]> {
  const response = await apiClient.get('/user/features')
  return response.data.data
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  const response = await apiClient.get(`/user/features/${featureName}`)
  return response.data.data.enabled
}

/**
 * Get account summary (subscription, quotas, features)
 */
export async function getAccountSummary(): Promise<AccountSummary> {
  const response = await apiClient.get('/user/account-summary')
  return response.data.data
}

export const userSubscriptionService = {
  getUserSubscription,
  getUserQuotas,
  getQuotaStatus,
  checkQuotaAllows,
  getUserFeatures,
  isFeatureEnabled,
  getAccountSummary
}

export default userSubscriptionService
