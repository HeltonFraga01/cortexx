/**
 * Performance Monitoring Module (Task 4.1)
 * Collects Core Web Vitals and reports them to the backend
 */

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  id: string
  delta: number
  navigationType: string
}

interface MetricPayload {
  type: 'web-vital'
  name: string
  value: number
  rating: string
  delta: number
  id: string
  navigationType: string
  url: string
  timestamp: number
  userAgent: string
}

// Thresholds for Core Web Vitals
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
}

/**
 * Reports a metric to the backend
 */
function reportMetric(metric: PerformanceMetric): void {
  // Log warning for poor metrics in development
  if (import.meta.env.DEV && metric.rating === 'poor') {
    console.warn(`[Performance] ${metric.name} is poor: ${metric.value.toFixed(2)}ms`)
  }
  
  // Send to backend in production
  if (import.meta.env.PROD) {
    const payload: MetricPayload = {
      type: 'web-vital',
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      url: window.location.pathname,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    }
    
    // Use sendBeacon for non-blocking transmission
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon('/api/metrics', blob)
  }
}

/**
 * Initializes performance monitoring with web-vitals
 * Dynamically imports web-vitals to avoid blocking initial load
 */
export async function initPerformanceMonitoring(): Promise<void> {
  // Only run in browser environment
  if (typeof window === 'undefined') return
  
  try {
    // Dynamic import to avoid blocking initial bundle
    const webVitals = await import('web-vitals')
    
    // Collect all Core Web Vitals
    webVitals.onLCP((metric) => {
      reportMetric({
        name: 'LCP',
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      })
    })
    
    webVitals.onFID((metric) => {
      reportMetric({
        name: 'FID',
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      })
    })
    
    webVitals.onCLS((metric) => {
      reportMetric({
        name: 'CLS',
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      })
    })
    
    webVitals.onINP((metric) => {
      reportMetric({
        name: 'INP',
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      })
    })
    
    webVitals.onTTFB((metric) => {
      reportMetric({
        name: 'TTFB',
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
      })
    })
    
    if (import.meta.env.DEV) {
      console.log('[Performance] Web Vitals monitoring initialized')
    }
  } catch (error) {
    // Silently fail if web-vitals is not available
    if (import.meta.env.DEV) {
      console.warn('[Performance] Failed to initialize web-vitals:', error)
    }
  }
}

/**
 * Manually report a custom performance metric
 */
export function reportCustomMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor'): void {
  const calculatedRating = rating || (value < 1000 ? 'good' : value < 3000 ? 'needs-improvement' : 'poor')
  
  reportMetric({
    name,
    value,
    rating: calculatedRating,
    id: `custom-${Date.now()}`,
    delta: value,
    navigationType: 'custom',
  })
}

export default initPerformanceMonitoring
