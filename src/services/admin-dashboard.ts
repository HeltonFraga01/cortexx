/**
 * Admin Dashboard Service
 * 
 * API client for dashboard statistics and alerts.
 */

import { api } from '@/lib/api'
import type { 
  DashboardStats,
  DashboardAlert,
  GrowthMetric,
  ApiResponse 
} from '@/types/admin-management'

const BASE_URL = '/api/admin/management/dashboard'

export const adminDashboardService = {
  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>(`${BASE_URL}/stats`)
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to get dashboard stats')
    }
    return response.data.data!
  },

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<DashboardAlert[]> {
    const response = await api.get<ApiResponse<DashboardAlert[]>>(`${BASE_URL}/alerts`)
    return response.data?.data || []
  },

  /**
   * Get growth metrics over time
   */
  async getGrowthMetrics(days: number = 30): Promise<GrowthMetric[]> {
    const response = await api.get<ApiResponse<GrowthMetric[]>>(`${BASE_URL}/growth?days=${days}`)
    return response.data?.data || []
  }
}
