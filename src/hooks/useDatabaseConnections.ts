/**
 * useDatabaseConnections Hook
 * 
 * Centralized hook for fetching user database connections.
 * Uses TanStack Query for caching and deduplication.
 * 
 * This hook should be used by ALL components that need database connections
 * to prevent duplicate API requests.
 */

import { useQuery } from '@tanstack/react-query'
import { databaseConnectionsService, type DatabaseConnection } from '@/services/database-connections'
import { useAuth } from '@/contexts/AuthContext'

// Query key for user database connections - must be consistent across all usages
export const USER_DATABASE_CONNECTIONS_QUERY_KEY = ['user', 'database-connections'] as const

/**
 * Hook to fetch and cache user database connections
 * 
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Request deduplication (multiple components share same request)
 * - Automatic refetch on auth change
 * - Error handling with retry logic
 * 
 * @param options - Optional query options
 * @returns Query result with database connections
 */
export function useDatabaseConnections(options?: {
  enabled?: boolean
  refetchOnMount?: boolean
}) {
  const { isAuthenticated } = useAuth()
  
  return useQuery<DatabaseConnection[], Error>({
    queryKey: USER_DATABASE_CONNECTIONS_QUERY_KEY,
    queryFn: () => databaseConnectionsService.getUserConnections(),
    enabled: isAuthenticated && (options?.enabled ?? true),
    // Use defaults from queryClient, but allow override
    refetchOnMount: options?.refetchOnMount ?? false,
    // Stale time is set in queryClient defaults (5 minutes)
    // gcTime is set in queryClient defaults (10 minutes)
  })
}

/**
 * Hook to fetch a specific database connection by ID
 */
export function useDatabaseConnection(connectionId: string | number | null) {
  const { isAuthenticated } = useAuth()
  
  return useQuery<DatabaseConnection | null, Error>({
    queryKey: ['user', 'database-connections', connectionId],
    queryFn: () => connectionId 
      ? databaseConnectionsService.getUserConnectionById(Number(connectionId))
      : Promise.resolve(null),
    enabled: isAuthenticated && connectionId !== null,
    refetchOnMount: false,
  })
}

/**
 * Helper to get connection count
 */
export function useConnectionCount() {
  const { data, isLoading } = useDatabaseConnections()
  
  return {
    count: data?.length ?? 0,
    isLoading,
  }
}

export default useDatabaseConnections
