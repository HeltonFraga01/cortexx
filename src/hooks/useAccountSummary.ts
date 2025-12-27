/**
 * useAccountSummary Hook
 * 
 * Centralized hook for fetching account summary data.
 * Uses TanStack Query for caching and deduplication.
 * 
 * This hook should be used by ALL components that need account summary data
 * to prevent duplicate API requests.
 */

import { useQuery } from '@tanstack/react-query'
import { getAccountSummary, type AccountSummary } from '@/services/user-subscription'
import { useAuth } from '@/contexts/AuthContext'

// Query key for account summary - must be consistent across all usages
export const ACCOUNT_SUMMARY_QUERY_KEY = ['user', 'account-summary'] as const

/**
 * Hook to fetch and cache account summary data
 * 
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Request deduplication (multiple components share same request)
 * - Automatic refetch on auth change
 * - Error handling with retry logic
 * 
 * @param options - Optional query options
 * @returns Query result with account summary data
 */
export function useAccountSummary(options?: {
  enabled?: boolean
  refetchOnMount?: boolean
}) {
  const { isAuthenticated, user } = useAuth()
  
  return useQuery<AccountSummary, Error>({
    queryKey: ACCOUNT_SUMMARY_QUERY_KEY,
    queryFn: getAccountSummary,
    enabled: isAuthenticated && (options?.enabled ?? true),
    // Use defaults from queryClient, but allow override
    refetchOnMount: options?.refetchOnMount ?? false,
    // Stale time is set in queryClient defaults (5 minutes)
    // gcTime is set in queryClient defaults (10 minutes)
  })
}

/**
 * Helper to extract quota status from account summary
 */
export function useQuotas() {
  const { data, isLoading, error } = useAccountSummary()
  
  return {
    quotas: data?.quotas ?? [],
    isLoading,
    error,
  }
}

/**
 * Helper to extract subscription from account summary
 */
export function useSubscription() {
  const { data, isLoading, error } = useAccountSummary()
  
  return {
    subscription: data?.subscription ?? null,
    isLoading,
    error,
  }
}

/**
 * Helper to extract features from account summary
 */
export function useFeatures() {
  const { data, isLoading, error } = useAccountSummary()
  
  return {
    features: data?.features ?? [],
    isLoading,
    error,
    hasFeature: (featureName: string) => 
      data?.features.some(f => f.featureName === featureName && f.enabled) ?? false,
  }
}

/**
 * Helper to check if user has management permission
 */
export function useHasManagementPermission() {
  const { hasFeature, isLoading } = useFeatures()
  
  return {
    hasManagementPermission: hasFeature('agent_management'),
    isLoading,
  }
}

export default useAccountSummary
