/**
 * useAudioNotification Hook
 * 
 * Manages audio notifications for new incoming messages
 * Inspired by Chatwoot's DashboardAudioNotificationHelper
 * Uses Web Audio API to generate notification sounds programmatically
 */

import { useCallback, useRef, useEffect, useState } from 'react'
import { toast } from 'sonner'

// Notification sound options
export type NotificationTone = 'ding' | 'pop' | 'chime' | 'bell'

export interface AudioNotificationConfig {
  enabled: boolean
  tone: NotificationTone
  playOnlyWhenHidden: boolean
  volume: number
}

interface UseAudioNotificationOptions {
  onPermissionDenied?: () => void
}

interface UseAudioNotificationReturn {
  playNotification: () => Promise<void>
  config: AudioNotificationConfig
  updateConfig: (config: Partial<AudioNotificationConfig>) => void
  isWindowVisible: boolean
  hasPermission: boolean
}

// Storage key for config
const STORAGE_KEY = 'chat_audio_notification_config'

// Default config
const DEFAULT_CONFIG: AudioNotificationConfig = {
  enabled: true,
  tone: 'ding',
  playOnlyWhenHidden: false,
  volume: 0.5
}

/**
 * Creates a notification sound using Web Audio API
 */
function createNotificationSound(
  audioContext: AudioContext,
  tone: NotificationTone,
  volume: number
): void {
  const now = audioContext.currentTime
  const gainNode = audioContext.createGain()
  gainNode.connect(audioContext.destination)
  gainNode.gain.setValueAtTime(volume * 0.3, now)
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

  const oscillator = audioContext.createOscillator()
  oscillator.connect(gainNode)

  // Different tones for different sounds
  switch (tone) {
    case 'ding':
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, now) // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1)
      break
    case 'pop':
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(600, now)
      oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.15)
      break
    case 'chime':
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(1200, now)
      oscillator.frequency.setValueAtTime(900, now + 0.1)
      oscillator.frequency.setValueAtTime(1200, now + 0.2)
      break
    case 'bell':
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(523.25, now) // C5
      // Add harmonics for bell-like sound
      const harmonic = audioContext.createOscillator()
      const harmonicGain = audioContext.createGain()
      harmonic.connect(harmonicGain)
      harmonicGain.connect(audioContext.destination)
      harmonicGain.gain.setValueAtTime(volume * 0.15, now)
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      harmonic.type = 'sine'
      harmonic.frequency.setValueAtTime(1046.5, now) // C6
      harmonic.start(now)
      harmonic.stop(now + 0.5)
      break
  }

  oscillator.start(now)
  oscillator.stop(now + 0.5)
}

/**
 * Hook for managing audio notifications
 */
export function useAudioNotification(
  options: UseAudioNotificationOptions = {}
): UseAudioNotificationReturn {
  const { onPermissionDenied } = options
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const hasRequestedPermissionRef = useRef(false)
  const [isWindowVisible, setIsWindowVisible] = useState(!document.hidden)
  const [hasPermission, setHasPermission] = useState(true)
  const [config, setConfig] = useState<AudioNotificationConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CONFIG
  })

  // Initialize AudioContext lazily (requires user interaction)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  // Track window visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsWindowVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Save config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Ignore storage errors
    }
  }, [config])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Play notification sound
  const playNotification = useCallback(async () => {
    if (!config.enabled) return
    
    // Check if should play only when hidden
    if (config.playOnlyWhenHidden && !document.hidden) return

    try {
      const audioContext = getAudioContext()
      
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      createNotificationSound(audioContext, config.tone, config.volume)
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        if (!hasRequestedPermissionRef.current) {
          hasRequestedPermissionRef.current = true
          setHasPermission(false)
          onPermissionDenied?.()
          
          toast.warning('Notificações sonoras bloqueadas', {
            description: 'Clique em qualquer lugar da página para habilitar sons de notificação',
            duration: 5000
          })
        }
      }
    }
  }, [config.enabled, config.playOnlyWhenHidden, config.tone, config.volume, getAudioContext, onPermissionDenied])

  // Update config
  const updateConfig = useCallback((newConfig: Partial<AudioNotificationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Re-enable audio after user interaction
  useEffect(() => {
    if (hasPermission) return

    const enableAudio = async () => {
      setHasPermission(true)
      hasRequestedPermissionRef.current = false
      
      // Try to resume AudioContext
      try {
        const audioContext = getAudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
      } catch {
        // Still blocked, will try again on next interaction
      }
    }

    document.addEventListener('click', enableAudio, { once: true })
    document.addEventListener('keydown', enableAudio, { once: true })

    return () => {
      document.removeEventListener('click', enableAudio)
      document.removeEventListener('keydown', enableAudio)
    }
  }, [hasPermission, getAudioContext])

  return {
    playNotification,
    config,
    updateConfig,
    isWindowVisible,
    hasPermission
  }
}

export default useAudioNotification
