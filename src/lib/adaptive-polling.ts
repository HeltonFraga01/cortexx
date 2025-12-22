/**
 * Adaptive Polling Utility
 * Implements intelligent polling with adaptive intervals based on activity
 */

interface AdaptivePollerOptions {
  /** Minimum polling interval in ms (default: 10000 - 10 seconds) */
  minInterval?: number
  /** Maximum polling interval in ms (default: 300000 - 5 minutes) */
  maxInterval?: number
  /** Initial polling interval in ms (default: 30000 - 30 seconds) */
  initialInterval?: number
  /** Factor to increase interval when idle (default: 1.5) */
  backoffFactor?: number
  /** Factor to decrease interval when active (default: 0.5) */
  speedupFactor?: number
  /** Number of idle polls before increasing interval (default: 3) */
  idleThreshold?: number
  /** Pause polling when tab is hidden (default: true) */
  pauseWhenHidden?: boolean
  /** Callback when polling is paused/resumed */
  onStateChange?: (state: 'running' | 'paused' | 'stopped') => void
}

type PollingCallback<T> = () => Promise<T>
type ResultCallback<T> = (result: T, hasChanges: boolean) => void

/**
 * Adaptive Poller that adjusts polling frequency based on activity
 * 
 * @example
 * ```typescript
 * const poller = new AdaptivePoller({
 *   minInterval: 5000,
 *   maxInterval: 60000
 * })
 * 
 * poller.start(
 *   async () => await fetchData(),
 *   (data, hasChanges) => {
 *     if (hasChanges) updateUI(data)
 *   }
 * )
 * ```
 */
export class AdaptivePoller<T = unknown> {
  private options: Required<AdaptivePollerOptions>
  private currentInterval: number
  private timerId: ReturnType<typeof setTimeout> | null = null
  private idleCount = 0
  private lastResult: T | null = null
  private isRunning = false
  private isPaused = false
  private pollFn: PollingCallback<T> | null = null
  private resultFn: ResultCallback<T> | null = null
  private visibilityHandler: (() => void) | null = null

  constructor(options: AdaptivePollerOptions = {}) {
    this.options = {
      minInterval: options.minInterval ?? 10000,
      maxInterval: options.maxInterval ?? 300000,
      initialInterval: options.initialInterval ?? 30000,
      backoffFactor: options.backoffFactor ?? 1.5,
      speedupFactor: options.speedupFactor ?? 0.5,
      idleThreshold: options.idleThreshold ?? 3,
      pauseWhenHidden: options.pauseWhenHidden ?? true,
      onStateChange: options.onStateChange ?? (() => {})
    }

    this.currentInterval = this.options.initialInterval

    // Set up visibility change handler
    if (this.options.pauseWhenHidden && typeof document !== 'undefined') {
      this.visibilityHandler = this.handleVisibilityChange.bind(this)
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  /**
   * Start polling with the given callback
   */
  start(pollFn: PollingCallback<T>, resultFn: ResultCallback<T>): void {
    if (this.isRunning) {
      this.stop()
    }

    this.pollFn = pollFn
    this.resultFn = resultFn
    this.isRunning = true
    this.isPaused = false
    this.idleCount = 0
    this.currentInterval = this.options.initialInterval

    this.options.onStateChange('running')
    this.scheduleNextPoll()
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false
    this.isPaused = false
    
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }

    this.options.onStateChange('stopped')
  }

  /**
   * Pause polling (can be resumed)
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return

    this.isPaused = true
    
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }

    this.options.onStateChange('paused')
  }

  /**
   * Resume polling after pause
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return

    this.isPaused = false
    this.options.onStateChange('running')
    this.scheduleNextPoll()
  }

  /**
   * Signal that activity was detected (speeds up polling)
   */
  signalActivity(): void {
    this.idleCount = 0
    this.decreaseInterval()
  }

  /**
   * Get current polling interval
   */
  getCurrentInterval(): number {
    return this.currentInterval
  }

  /**
   * Get polling state
   */
  getState(): 'running' | 'paused' | 'stopped' {
    if (!this.isRunning) return 'stopped'
    if (this.isPaused) return 'paused'
    return 'running'
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop()

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning || this.isPaused || !this.pollFn || !this.resultFn) {
      return
    }

    try {
      const result = await this.pollFn()
      const hasChanges = this.detectChanges(result)

      if (hasChanges) {
        this.idleCount = 0
        this.decreaseInterval()
      } else {
        this.idleCount++
        if (this.idleCount >= this.options.idleThreshold) {
          this.increaseInterval()
        }
      }

      this.lastResult = result
      this.resultFn(result, hasChanges)
    } catch (error) {
      // On error, increase interval to reduce load
      this.increaseInterval()
      console.error('[AdaptivePoller] Poll error:', error)
    }

    this.scheduleNextPoll()
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning || this.isPaused) return

    this.timerId = setTimeout(() => this.poll(), this.currentInterval)
  }

  private increaseInterval(): void {
    const newInterval = Math.min(
      this.currentInterval * this.options.backoffFactor,
      this.options.maxInterval
    )
    this.currentInterval = Math.round(newInterval)
  }

  private decreaseInterval(): void {
    const newInterval = Math.max(
      this.currentInterval * this.options.speedupFactor,
      this.options.minInterval
    )
    this.currentInterval = Math.round(newInterval)
  }

  private detectChanges(newResult: T): boolean {
    if (this.lastResult === null) return true

    try {
      return JSON.stringify(newResult) !== JSON.stringify(this.lastResult)
    } catch {
      // If serialization fails, assume changes
      return true
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.pause()
    } else {
      this.resume()
    }
  }
}

/**
 * Create an adaptive poller with default options
 */
export function createAdaptivePoller<T>(options?: AdaptivePollerOptions): AdaptivePoller<T> {
  return new AdaptivePoller<T>(options)
}

export default AdaptivePoller
