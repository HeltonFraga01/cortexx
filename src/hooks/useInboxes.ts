/**
 * useInboxes Hook
 * 
 * Hook for fetching and managing inboxes
 * 
 * Requirements: REQ-1.1, REQ-2.1
 */

import { useQuery } from '@tanstack/react-query'
import { listInboxes } from '@/services/account-inboxes'
import type { InboxWithStats } from '@/types/multi-user'

export interface UseInboxesResult {
  inboxes: InboxWithStats[] | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useInboxes(): UseInboxesResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['inboxes'],
    queryFn: listInboxes,
    staleTime: 60000, // 1 minute
    retry: 2
  })

  return {
    inboxes: data,
    isLoading,
    error: error as Error | null,
    refetch
  }
}

export default useInboxes
