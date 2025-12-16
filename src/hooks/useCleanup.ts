import { useRef, useEffect, useCallback } from 'react'

/**
 * Hook for managing cleanup of timers, intervals, and subscriptions
 * Prevents memory leaks by automatically cleaning up on component unmount
 */

type TimerId = ReturnType<typeof setTimeout>
type IntervalId = ReturnType<typeof setInterval>
type UnsubscribeFn = () => void

interface CleanupManager {
  /** Add a setTimeout reference for automatic cleanup */
  addTimer: (id: TimerId) => void
  /** Add a setInterval reference for automatic cleanup */
  addInterval: (id: IntervalId) => void
  /** Add a subscription cleanup function */
  addSubscription: (unsubscribe: UnsubscribeFn) => void
  /** Create a managed setTimeout that auto-cleans */
  setTimeout: (callback: () => void, delay: number) => TimerId
  /** Create a managed setInterval that auto-cleans */
  setInterval: (callback: () => void, delay: number) => IntervalId
  /** Manually trigger cleanup of all resources */
  cleanup: () => void
  /** Clear a specific timer */
  clearTimer: (id: TimerId) => void
  /** Clear a specific interval */
  clearInterval: (id: IntervalId) => void
}

/**
 * Hook that provides automatic cleanup of timers, intervals, and subscriptions
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const cleanup = useCleanup()
 *   
 *   useEffect(() => {
 *     // These will be automatically cleaned up on unmount
 *     cleanup.setTimeout(() => console.log('delayed'), 1000)
 *     cleanup.setInterval(() => console.log('repeated'), 5000)
 *     
 *     // Or add existing timers
 *     const timerId = setTimeout(() => {}, 1000)
 *     cleanup.addTimer(timerId)
 *   }, [])
 *   
 *   return <div>...</div>
 * }
 * ```
 */
export function useCleanup(): CleanupManager {
  const timers = useRef<Set<TimerId>>(new Set())
  const intervals = useRef<Set<IntervalId>>(new Set())
  const subscriptions = useRef<Set<UnsubscribeFn>>(new Set())

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear all timers
    timers.current.forEach((id) => {
      clearTimeout(id)
    })
    timers.current.clear()

    // Clear all intervals
    intervals.current.forEach((id) => {
      clearInterval(id)
    })
    intervals.current.clear()

    // Call all subscription cleanup functions
    subscriptions.current.forEach((unsubscribe) => {
      try {
        unsubscribe()
      } catch (error) {
        console.error('Error during subscription cleanup:', error)
      }
    })
    subscriptions.current.clear()
  }, [])

  // Auto-cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  const addTimer = useCallback((id: TimerId) => {
    timers.current.add(id)
  }, [])

  const addInterval = useCallback((id: IntervalId) => {
    intervals.current.add(id)
  }, [])

  const addSubscription = useCallback((unsubscribe: UnsubscribeFn) => {
    subscriptions.current.add(unsubscribe)
  }, [])

  const clearTimerById = useCallback((id: TimerId) => {
    clearTimeout(id)
    timers.current.delete(id)
  }, [])

  const clearIntervalById = useCallback((id: IntervalId) => {
    clearInterval(id)
    intervals.current.delete(id)
  }, [])

  // Managed setTimeout
  const managedSetTimeout = useCallback((callback: () => void, delay: number): TimerId => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      callback()
    }, delay)
    timers.current.add(id)
    return id
  }, [])

  // Managed setInterval
  const managedSetInterval = useCallback((callback: () => void, delay: number): IntervalId => {
    const id = setInterval(callback, delay)
    intervals.current.add(id)
    return id
  }, [])

  return {
    addTimer,
    addInterval,
    addSubscription,
    setTimeout: managedSetTimeout,
    setInterval: managedSetInterval,
    cleanup,
    clearTimer: clearTimerById,
    clearInterval: clearIntervalById
  }
}

export default useCleanup
