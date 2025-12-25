/**
 * TanStack Query Client Configuration (Task 1.2)
 * Optimized defaults for performance and deduplication
 */
import { QueryClient } from '@tanstack/react-query'

// Duplicate request detection for development
const pendingRequests = new Map<string, number>()

/**
 * Track request start/end for duplicate detection
 * @param key - Request key (e.g., "GET:/api/admin/dashboard-stats")
 * @param action - 'start' or 'end'
 */
export function trackRequest(key: string, action: 'start' | 'end') {
  if (import.meta.env.PROD) return
  
  const count = pendingRequests.get(key) || 0
  if (action === 'start') {
    if (count > 0) {
      console.warn(`[Query] Duplicate request detected: ${key}`)
    }
    pendingRequests.set(key, count + 1)
  } else {
    pendingRequests.set(key, Math.max(0, count - 1))
  }
}

function setupDuplicateDetection() {
  if (import.meta.env.DEV) {
    const originalFetch = window.fetch
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = init?.method || 'GET'
      const key = `${method}:${url}`
      
      const count = pendingRequests.get(key) || 0
      
      if (count > 0) {
        console.warn(`[Query] Duplicate request detected: ${key}`)
      }
      
      pendingRequests.set(key, count + 1)
      
      try {
        return await originalFetch(input, init)
      } finally {
        const currentCount = pendingRequests.get(key) || 1
        if (currentCount <= 1) {
          pendingRequests.delete(key)
        } else {
          pendingRequests.set(key, currentCount - 1)
        }
      }
    }
  }
}

// Initialize duplicate detection
setupDuplicateDetection()

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 30 seconds before considering it stale
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus (reduces unnecessary requests)
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data exists in cache
      refetchOnMount: false,
      // Always refetch on reconnect to ensure fresh data
      refetchOnReconnect: 'always',
      // Smart retry logic
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors (except 408 Request Timeout)
        if (error instanceof Error && 'status' in error) {
          const status = (error as Error & { status: number }).status
          if (status >= 400 && status < 500 && status !== 408) {
            return false
          }
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})

export default queryClient
