/**
 * Admin Audit Service
 * 
 * API client for audit log operations.
 */

import { api } from '@/lib/api'
import type { 
  AdminAuditLog,
  AdminActionType,
  AuditLogFilters,
  AuditLogPagination,
  AuditLogListResult,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/audit'

export const adminAuditService = {
  /**
   * List audit logs with filters and pagination
   */
  async listAuditLogs(
    filters?: AuditLogFilters, 
    pagination?: AuditLogPagination
  ): Promise<AuditLogListResult> {
    const params = new URLSearchParams()
    
    if (filters?.adminId) params.append('adminId', filters.adminId)
    if (filters?.targetUserId) params.append('targetUserId', filters.targetUserId)
    if (filters?.actionType) params.append('actionType', filters.actionType)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (pagination?.page) params.append('page', pagination.page.toString())
    if (pagination?.pageSize) params.append('pageSize', pagination.pageSize.toString())

    const queryString = params.toString()
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL
    
    const response = await api.get<ApiResponse<AuditLogListResult>>(url)
    return response.data?.data || { logs: [], total: 0, page: 1, pageSize: 50 }
  },

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    filters?: AuditLogFilters, 
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const params = new URLSearchParams()
    params.append('format', format)
    
    if (filters?.adminId) params.append('adminId', filters.adminId)
    if (filters?.targetUserId) params.append('targetUserId', filters.targetUserId)
    if (filters?.actionType) params.append('actionType', filters.actionType)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const response = await api.get<string>(`${BASE_URL}/export?${params.toString()}`, {
      responseType: 'text'
    })
    return response.data
  },

  /**
   * Get available action types
   */
  async getActionTypes(): Promise<AdminActionType[]> {
    const response = await api.get<ApiResponse<AdminActionType[]>>(`${BASE_URL}/actions`)
    return response.data?.data || []
  },

  /**
   * Get actions performed by a specific admin
   */
  async getAdminActions(
    adminId: string, 
    dateRange?: { startDate?: string; endDate?: string }
  ): Promise<AdminAuditLog[]> {
    const params = new URLSearchParams()
    if (dateRange?.startDate) params.append('startDate', dateRange.startDate)
    if (dateRange?.endDate) params.append('endDate', dateRange.endDate)

    const queryString = params.toString()
    const url = queryString 
      ? `${BASE_URL}/admin/${adminId}?${queryString}` 
      : `${BASE_URL}/admin/${adminId}`
    
    const response = await api.get<ApiResponse<AdminAuditLog[]>>(url)
    return response.data?.data || []
  },

  /**
   * Get audit history for a specific user
   */
  async getUserAuditHistory(userId: string): Promise<AdminAuditLog[]> {
    const response = await api.get<ApiResponse<AdminAuditLog[]>>(`${BASE_URL}/user/${userId}`)
    return response.data?.data || []
  }
}
