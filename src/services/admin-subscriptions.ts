/**
 * Admin Subscriptions Service
 * 
 * API client for user subscription management.
 */

import { api } from '@/lib/api'
import type { 
  UserSubscription, 
  AssignPlanRequest,
  UpdateSubscriptionRequest,
  ProrationDetails,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/users'

export const adminSubscriptionsService = {
  /**
   * Get user subscription
   */
  async getSubscription(userId: string): Promise<UserSubscription | null> {
    const response = await api.get<ApiResponse<UserSubscription>>(`${BASE_URL}/${userId}/subscription`)
    return response.data?.data || null
  },

  /**
   * Get subscriptions for multiple users in batch
   * Returns a map of userId -> subscription (or null if no subscription)
   */
  async getSubscriptionsBatch(userIds: string[]): Promise<Record<string, UserSubscription | null>> {
    const response = await api.post<ApiResponse<Record<string, UserSubscription | null>>>(
      `${BASE_URL}/subscriptions/batch`,
      { userIds }
    )
    return response.data?.data || {}
  },

  /**
   * Update subscription status
   */
  async updateSubscription(userId: string, data: UpdateSubscriptionRequest): Promise<UserSubscription> {
    const response = await api.put<ApiResponse<UserSubscription>>(`${BASE_URL}/${userId}/subscription`, data)
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to update subscription')
    }
    return response.data.data!
  },

  /**
   * Assign a plan to a user
   */
  async assignPlan(userId: string, data: AssignPlanRequest): Promise<UserSubscription> {
    const response = await api.post<ApiResponse<UserSubscription>>(
      `${BASE_URL}/${userId}/subscription/assign-plan`, 
      data
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to assign plan')
    }
    return response.data.data!
  },

  /**
   * Calculate proration for plan change
   */
  async calculateProration(userId: string, newPlanId: string): Promise<ProrationDetails> {
    const response = await api.get<ApiResponse<ProrationDetails>>(
      `${BASE_URL}/${userId}/subscription/proration?newPlanId=${newPlanId}`
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to calculate proration')
    }
    return response.data.data!
  }
}
