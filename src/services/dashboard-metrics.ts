/**
 * Dashboard Metrics Service
 * Frontend API client for dashboard metrics endpoints
 */

import { backendApi } from '@/services/api-client'
import type {
  DashboardMetrics,
  MessageActivityData,
  ContactGrowthData
} from '@/types/dashboard'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

/**
 * Fetch all dashboard metrics
 * @param inboxIds - Optional array of inbox IDs to filter by
 */
export async function getDashboardMetrics(inboxIds?: string[]): Promise<DashboardMetrics> {
  const params = new URLSearchParams()
  if (inboxIds && inboxIds.length > 0) {
    params.append('inboxIds', inboxIds.join(','))
  }
  
  const url = params.toString() 
    ? `/user/dashboard/dashboard-metrics?${params.toString()}`
    : '/user/dashboard/dashboard-metrics'
  
  const response = await backendApi.get<ApiResponse<DashboardMetrics>>(url)
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch dashboard metrics')
  }
  
  return response.data.data
}

/**
 * Fetch message activity data for charts
 * @param days - Number of days to fetch (default: 7)
 * @param inboxIds - Optional array of inbox IDs to filter by
 */
export async function getMessageActivity(
  days = 7,
  inboxIds?: string[]
): Promise<MessageActivityData[]> {
  const params = new URLSearchParams({ days: days.toString() })
  if (inboxIds && inboxIds.length > 0) {
    params.append('inboxIds', inboxIds.join(','))
  }
  
  const response = await backendApi.get<ApiResponse<MessageActivityData[]>>(
    `/user/dashboard/messages/activity?${params.toString()}`
  )
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch message activity')
  }
  
  return response.data.data
}

/**
 * Fetch contact growth data for charts
 * @param days - Number of days to fetch (default: 30)
 * @param inboxIds - Optional array of inbox IDs to filter by
 */
export async function getContactGrowth(
  days = 30,
  inboxIds?: string[]
): Promise<ContactGrowthData[]> {
  const params = new URLSearchParams({ days: days.toString() })
  if (inboxIds && inboxIds.length > 0) {
    params.append('inboxIds', inboxIds.join(','))
  }
  
  const response = await backendApi.get<ApiResponse<ContactGrowthData[]>>(
    `/user/dashboard/contacts/growth?${params.toString()}`
  )
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch contact growth')
  }
  
  return response.data.data
}

/**
 * Dashboard metrics service object for convenience
 */
export const dashboardMetricsService = {
  getDashboardMetrics,
  getMessageActivity,
  getContactGrowth
}

export default dashboardMetricsService
