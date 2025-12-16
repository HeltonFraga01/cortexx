/**
 * Admin User Actions Service
 * 
 * API client for user actions: suspend, reactivate, delete, export, notify.
 */

import { api } from '@/lib/api'
import type { 
  UserSubscription,
  SuspendUserRequest,
  ResetPasswordRequest,
  NotifyUserRequest,
  UserNotification,
  UserDataExport,
  BulkAssignPlanRequest,
  BulkSuspendRequest,
  BulkReactivateRequest,
  BulkNotifyRequest,
  BulkActionResult,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/users'
const BULK_URL = '/api/admin/users/bulk'

export const adminUserActionsService = {
  /**
   * Suspend a user
   */
  async suspendUser(userId: string, data: SuspendUserRequest): Promise<UserSubscription> {
    const response = await api.post<ApiResponse<UserSubscription>>(
      `${BASE_URL}/${userId}/suspend`, 
      data
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to suspend user')
    }
    return response.data.data!
  },

  /**
   * Reactivate a suspended user
   */
  async reactivateUser(userId: string): Promise<UserSubscription> {
    const response = await api.post<ApiResponse<UserSubscription>>(
      `${BASE_URL}/${userId}/reactivate`
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to reactivate user')
    }
    return response.data.data!
  },

  /**
   * Reset user password
   */
  async resetPassword(userId: string, data?: ResetPasswordRequest): Promise<void> {
    const response = await api.post<ApiResponse<void>>(
      `${BASE_URL}/${userId}/reset-password`, 
      data || {}
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to reset password')
    }
  },

  /**
   * Delete a user and all related data
   */
  async deleteUser(userId: string): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`${BASE_URL}/${userId}`, {
      data: { confirm: true }
    })
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to delete user')
    }
  },

  /**
   * Export user data
   */
  async exportUserData(userId: string, format: 'json' | 'csv' = 'json'): Promise<UserDataExport | string> {
    const response = await api.get<ApiResponse<UserDataExport> | string>(
      `${BASE_URL}/${userId}/export?format=${format}`,
      { responseType: format === 'csv' ? 'text' : 'json' }
    )
    
    if (format === 'csv') {
      return response.data as string
    }
    
    const jsonResponse = response.data as ApiResponse<UserDataExport>
    if (!jsonResponse?.success) {
      throw new Error(jsonResponse?.error || 'Failed to export user data')
    }
    return jsonResponse.data!
  },

  /**
   * Send notification to a user
   */
  async notifyUser(userId: string, data: NotifyUserRequest): Promise<UserNotification> {
    const response = await api.post<ApiResponse<UserNotification>>(
      `${BASE_URL}/${userId}/notify`, 
      data
    )
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to send notification')
    }
    return response.data.data!
  },

  // Bulk Actions

  /**
   * Bulk assign plan to multiple users
   */
  async bulkAssignPlan(data: BulkAssignPlanRequest): Promise<BulkActionResult> {
    const response = await api.post<ApiResponse<BulkActionResult>>(
      `${BULK_URL}/assign-plan`, 
      data
    )
    return response.data?.data || { successful: [], failed: [] }
  },

  /**
   * Bulk suspend multiple users
   */
  async bulkSuspend(data: BulkSuspendRequest): Promise<BulkActionResult> {
    const response = await api.post<ApiResponse<BulkActionResult>>(
      `${BULK_URL}/suspend`, 
      data
    )
    return response.data?.data || { successful: [], failed: [] }
  },

  /**
   * Bulk reactivate multiple users
   */
  async bulkReactivate(data: BulkReactivateRequest): Promise<BulkActionResult> {
    const response = await api.post<ApiResponse<BulkActionResult>>(
      `${BULK_URL}/reactivate`, 
      data
    )
    return response.data?.data || { successful: [], failed: [] }
  },

  /**
   * Bulk notify multiple users
   */
  async bulkNotify(data: BulkNotifyRequest): Promise<BulkActionResult> {
    const response = await api.post<ApiResponse<BulkActionResult>>(
      `${BULK_URL}/notify`, 
      data
    )
    return response.data?.data || { successful: [], failed: [] }
  }
}
