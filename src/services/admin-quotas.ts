/**
 * Admin Quotas Service
 * 
 * API client for user quota management.
 */

import { api } from '@/lib/api'
import type { 
  UserQuota, 
  QuotaType,
  SetQuotaOverrideRequest,
  QuotaCheckResult,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/users'

export const adminQuotasService = {
  /**
   * Get all quotas for a user
   */
  async getUserQuotas(userId: string): Promise<UserQuota[]> {
    const response = await api.get<ApiResponse<UserQuota[]>>(`${BASE_URL}/${userId}/quotas`)
    return response.data?.data || []
  },

  /**
   * Set a quota override
   */
  async setQuotaOverride(
    userId: string, 
    quotaType: QuotaType, 
    data: SetQuotaOverrideRequest
  ): Promise<void> {
    const response = await api.put<ApiResponse<void>>(
      `${BASE_URL}/${userId}/quotas/${quotaType}`, 
      data
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to set quota override')
    }
  },

  /**
   * Remove a quota override
   */
  async removeQuotaOverride(userId: string, quotaType: QuotaType): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(
      `${BASE_URL}/${userId}/quotas/${quotaType}/override`
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to remove quota override')
    }
  },

  /**
   * Reset cycle-based quota counters
   */
  async resetQuotaCounters(userId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`${BASE_URL}/${userId}/quotas/reset`)
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to reset quota counters')
    }
  },

  /**
   * Get usage for a specific quota
   */
  async getQuotaUsage(userId: string, quotaType: QuotaType): Promise<QuotaCheckResult> {
    const response = await api.get<ApiResponse<QuotaCheckResult>>(
      `${BASE_URL}/${userId}/quotas/${quotaType}/usage`
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to get quota usage')
    }
    return response.data.data!
  }
}
