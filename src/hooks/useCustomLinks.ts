/**
 * useCustomLinks Hook
 * 
 * Centralized hook for fetching custom links.
 * Uses TanStack Query for caching and deduplication.
 * 
 * This hook should be used by ALL components that need custom links
 * to prevent duplicate API requests.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customLinksService, type CustomLink, type CreateCustomLinkData, type UpdateCustomLinkData } from '@/services/custom-links'
import { useAuth } from '@/contexts/AuthContext'

// Query key for custom links - must be consistent across all usages
export const CUSTOM_LINKS_QUERY_KEY = ['custom-links'] as const

/**
 * Hook to fetch and cache custom links
 * 
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Request deduplication (multiple components share same request)
 * - Automatic refetch on auth change
 * - Error handling with retry logic
 * 
 * @param options - Optional query options
 * @returns Query result with custom links
 */
export function useCustomLinks(options?: {
  enabled?: boolean
  refetchOnMount?: boolean
}) {
  const { isAuthenticated } = useAuth()
  
  return useQuery<CustomLink[], Error>({
    queryKey: CUSTOM_LINKS_QUERY_KEY,
    queryFn: () => customLinksService.getAll(),
    enabled: isAuthenticated && (options?.enabled ?? true),
    // Use defaults from queryClient, but allow override
    refetchOnMount: options?.refetchOnMount ?? false,
    // Stale time is set in queryClient defaults (5 minutes)
    // gcTime is set in queryClient defaults (10 minutes)
  })
}

/**
 * Hook to create a new custom link
 */
export function useCreateCustomLink() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateCustomLinkData) => customLinksService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_LINKS_QUERY_KEY })
    },
  })
}

/**
 * Hook to update an existing custom link
 */
export function useUpdateCustomLink() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCustomLinkData }) => 
      customLinksService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_LINKS_QUERY_KEY })
    },
  })
}

/**
 * Hook to delete a custom link
 */
export function useDeleteCustomLink() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => customLinksService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_LINKS_QUERY_KEY })
    },
  })
}

/**
 * Helper to get custom link count
 */
export function useCustomLinkCount() {
  const { data, isLoading } = useCustomLinks()
  
  return {
    count: data?.length ?? 0,
    isLoading,
  }
}

export default useCustomLinks
