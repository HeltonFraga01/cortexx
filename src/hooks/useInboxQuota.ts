/**
 * useInboxQuota Hook
 * 
 * Manages inbox quota state with automatic refresh.
 * 
 * Requirements: 7.1, 7.2 (connection-status-sync spec)
 */

import { useState, useEffect, useCallback } from 'react'
import { getInboxQuota, type InboxQuotaInfo } from '@/services/account-inboxes'

interface UseInboxQuotaReturn {
  quota: InboxQuotaInfo | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  canCreate: boolean
}

export function useInboxQuota(): UseInboxQuotaReturn {
  const [quota, setQuota] = useState<InboxQuotaInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchQuota = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getInboxQuota()
      setQuota(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch quota'))
      // Set default quota on error to allow UI to function
      setQuota({
        current: 0,
        limit: 1,
        canCreate: true,
        remaining: 1
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuota()
  }, [fetchQuota])

  return {
    quota,
    isLoading,
    error,
    refresh: fetchQuota,
    canCreate: quota?.canCreate ?? false
  }
}

export default useInboxQuota
