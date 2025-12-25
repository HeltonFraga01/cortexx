/**
 * useResizeObserver Hook (Task 5.2)
 * Efficiently observes element size changes without causing layout thrashing
 */
import { useEffect, useRef, useState, useCallback, RefObject } from 'react'

interface Size {
  width: number
  height: number
}

interface UseResizeObserverOptions {
  /** Debounce delay in milliseconds */
  debounce?: number
  /** Initial size (useful for SSR) */
  initialSize?: Size
  /** Callback when size changes */
  onResize?: (size: Size) => void
}

/**
 * Hook to observe element size changes using ResizeObserver
 * Avoids layout thrashing by not reading layout properties directly
 * 
 * @param options - Configuration options
 * @returns [ref, size] - Ref to attach to element and current size
 */
export function useResizeObserver<T extends HTMLElement = HTMLElement>(
  options: UseResizeObserverOptions = {}
): [RefObject<T>, Size] {
  const { debounce = 0, initialSize = { width: 0, height: 0 }, onResize } = options
  
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>(initialSize)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const callbackRef = useRef(onResize)
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onResize
  }, [onResize])
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    // Check for ResizeObserver support
    if (typeof ResizeObserver === 'undefined') {
      // Fallback: read size once (causes single reflow)
      const rect = element.getBoundingClientRect()
      const newSize = { width: rect.width, height: rect.height }
      setSize(newSize)
      callbackRef.current?.(newSize)
      return
    }
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      
      // Use contentBoxSize if available (more accurate)
      let newWidth: number
      let newHeight: number
      
      if (entry.contentBoxSize) {
        // contentBoxSize can be an array in some browsers
        const boxSize = Array.isArray(entry.contentBoxSize) 
          ? entry.contentBoxSize[0] 
          : entry.contentBoxSize
        newWidth = boxSize.inlineSize
        newHeight = boxSize.blockSize
      } else {
        // Fallback to contentRect
        newWidth = entry.contentRect.width
        newHeight = entry.contentRect.height
      }
      
      const newSize = { width: newWidth, height: newHeight }
      
      // Apply debounce if configured
      if (debounce > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          setSize(newSize)
          callbackRef.current?.(newSize)
        }, debounce)
      } else {
        setSize(newSize)
        callbackRef.current?.(newSize)
      }
    })
    
    observer.observe(element)
    
    return () => {
      observer.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [debounce])
  
  return [ref, size]
}

/**
 * Hook to batch DOM reads and writes
 * Prevents layout thrashing by scheduling reads before writes
 */
export function useBatchedDOMUpdates() {
  const readsRef = useRef<Array<() => void>>([])
  const writesRef = useRef<Array<() => void>>([])
  const scheduledRef = useRef(false)
  
  const scheduleFlush = useCallback(() => {
    if (scheduledRef.current) return
    scheduledRef.current = true
    
    requestAnimationFrame(() => {
      // Execute all reads first
      const reads = readsRef.current
      readsRef.current = []
      reads.forEach(fn => fn())
      
      // Then execute all writes
      const writes = writesRef.current
      writesRef.current = []
      writes.forEach(fn => fn())
      
      scheduledRef.current = false
    })
  }, [])
  
  const scheduleRead = useCallback((fn: () => void) => {
    readsRef.current.push(fn)
    scheduleFlush()
  }, [scheduleFlush])
  
  const scheduleWrite = useCallback((fn: () => void) => {
    writesRef.current.push(fn)
    scheduleFlush()
  }, [scheduleFlush])
  
  return { scheduleRead, scheduleWrite }
}

/**
 * Hook to measure element without causing reflow
 * Returns a function that schedules measurement
 */
export function useMeasure<T extends HTMLElement = HTMLElement>(): [
  RefObject<T>,
  () => Promise<DOMRect | null>
] {
  const ref = useRef<T>(null)
  
  const measure = useCallback((): Promise<DOMRect | null> => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (ref.current) {
          resolve(ref.current.getBoundingClientRect())
        } else {
          resolve(null)
        }
      })
    })
  }, [])
  
  return [ref, measure]
}

export default useResizeObserver
