/**
 * Admin Dashboard Query Hooks
 * 
 * Dedicated hooks for admin dashboard data with proper deduplication
 * and caching configuration to prevent duplicate API calls.
 * 
 * @module src/hooks/useAdminDashboard
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { trackRequest } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Stale time for admin dashboard queries (30 seconds)
const ADMIN_DASHBOARD_STALE_TIME = 30 * 1000

// Query keys for admin dashboard
export const adminDashboardKeys = {
  all: ['admin', 'dashboard'] as const,
  stats: () => [...adminDashboardKeys.all, 'stats'] as const,
  automationStats: () => ['admin', 'automation', 'statistics'] as const,
  systemHealth: () => ['system', 'health'] as const,
}

/**
 * Fetches data with authentication
 * Tries JWT token from Supabase session first, then falls back to cookie-based auth
 */
async function fetchWithAuth(url: string) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  // Add JWT token if available
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch(url, {
    credentials: 'include', // Always include cookies for fallback auth
    headers,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Dashboard stats response type
 */
export interface DashboardStatsResponse {
  success: boolean
  data: {
    systemStatus: string
    uptime: string
    version: string
    totalUsers: number
    connectedUsers: number
    loggedInUsers: number
    activeConnections: number
    memoryStats: {
      alloc_mb: string
      sys_mb: string
      total_alloc_mb: string
      num_gc: number
      heapUsed?: number
      heapTotal?: number
      rss?: number
      external?: number
    }
    goroutines: number
    users: Array<{
      id: string
      name: string
      connected: boolean
      loggedIn: boolean
      jid: string
      webhook: string
      events: string
      token: string // Masked: "***XXXX"
    }>
    wuzapiConfigured: boolean
  }
  timestamp?: string
}

/**
 * Hook for fetching admin dashboard stats
 * 
 * Features:
 * - 30 second stale time to prevent duplicate requests
 * - No refetch on window focus
 * - Waits for auth to be ready before fetching
 * - Request tracking for duplicate detection
 */
export function useAdminDashboardStats(
  options?: Omit<UseQueryOptions<DashboardStatsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { user, isLoading: authLoading } = useAuth()
  
  return useQuery<DashboardStatsResponse, Error>({
    queryKey: adminDashboardKeys.stats(),
    queryFn: async () => {
      const key = 'GET:/api/admin/dashboard-stats'
      trackRequest(key, 'start')
      try {
        return await fetchWithAuth('/api/admin/dashboard-stats')
      } finally {
        trackRequest(key, 'end')
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    // Only enable when user is authenticated (works with both Supabase and cookie auth)
    enabled: !authLoading && !!user,
    ...options,
  })
}

/**
 * Automation statistics response type
 */
export interface AutomationStatsResponse {
  success: boolean
  data: {
    total: number
    successful: number
    failed: number
    successRate: number
    byType?: Record<string, number>
    byStatus?: Record<string, number>
  }
}

/**
 * Hook for fetching automation statistics
 * 
 * Features:
 * - 30 second stale time to prevent duplicate requests
 * - No refetch on window focus
 * - Waits for auth to be ready before fetching
 * - Request tracking for duplicate detection
 */
export function useAutomationStatistics(
  options?: Omit<UseQueryOptions<AutomationStatsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { user, isLoading: authLoading } = useAuth()
  
  return useQuery<AutomationStatsResponse, Error>({
    queryKey: adminDashboardKeys.automationStats(),
    queryFn: async () => {
      const key = 'GET:/api/admin/automation/statistics'
      trackRequest(key, 'start')
      try {
        return await fetchWithAuth('/api/admin/automation/statistics')
      } finally {
        trackRequest(key, 'end')
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    // Only enable when user is authenticated
    enabled: !authLoading && !!user,
    ...options,
  })
}

/**
 * Management dashboard stats response type
 */
export interface ManagementDashboardStatsResponse {
  success: boolean
  data: {
    users: {
      total: number
      active: number
      trial: number
      suspended: number
      byStatus: Record<string, number>
      byPlan: Record<string, number>
      growthLast30Days: number
    }
    usage: {
      messagesToday: number
      messagesThisWeek: number
      messagesThisMonth: number
      activeConnections: number
      totalStorageMb: number
    }
    revenue: {
      mrr: number
      arr: number
      churnRate: number
      avgRevenuePerUser: number
    }
    tenantId: string
    timestamp: string
  }
}

/**
 * Hook for fetching management dashboard stats
 * 
 * Features:
 * - 30 second stale time to prevent duplicate requests
 * - No refetch on window focus
 * - Waits for auth to be ready before fetching
 * - Request tracking for duplicate detection
 */
export function useManagementDashboardStats(
  options?: Omit<UseQueryOptions<ManagementDashboardStatsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { user, isLoading: authLoading } = useAuth()
  
  return useQuery<ManagementDashboardStatsResponse, Error>({
    queryKey: ['admin', 'management', 'dashboard', 'stats'],
    queryFn: async () => {
      const key = 'GET:/api/admin/management/dashboard/stats'
      trackRequest(key, 'start')
      try {
        return await fetchWithAuth('/api/admin/management/dashboard/stats')
      } finally {
        trackRequest(key, 'end')
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    // Only enable when user is authenticated
    enabled: !authLoading && !!user,
    ...options,
  })
}

/**
 * Hook for fetching system health status
 */
export function useSystemHealth(
  options?: Omit<UseQueryOptions<any, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adminDashboardKeys.systemHealth(),
    queryFn: async () => {
      const key = 'GET:/health'
      trackRequest(key, 'start')
      try {
        const response = await fetch('/health', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        return response.json()
      } finally {
        trackRequest(key, 'end')
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    ...options,
  })
}
