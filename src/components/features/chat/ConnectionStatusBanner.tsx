/**
 * ConnectionStatusBanner Component
 * 
 * Displays connection status when disconnected with reconnection animation
 * 
 * Requirements: 8.5
 * Task 11.4: Connection status indicator
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { WifiOff, RefreshCw, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConnectionStatusBannerProps {
  isConnected: boolean
  onReconnect?: () => void
  className?: string
}

export function ConnectionStatusBanner({ 
  isConnected, 
  onReconnect,
  className 
}: ConnectionStatusBannerProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  // Show banner when disconnected, hide with delay when reconnected
  useEffect(() => {
    if (!isConnected) {
      setShowBanner(true)
      setWasDisconnected(true)
      setIsReconnecting(false)
    } else if (wasDisconnected) {
      // Show "connected" state briefly before hiding
      const timer = setTimeout(() => {
        setShowBanner(false)
        setWasDisconnected(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isConnected, wasDisconnected])

  const handleReconnect = () => {
    setIsReconnecting(true)
    onReconnect?.()
    
    // Reset reconnecting state after timeout
    setTimeout(() => {
      setIsReconnecting(false)
    }, 5000)
  }

  if (!showBanner) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-300',
        isConnected 
          ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-b border-green-500/20'
          : 'bg-destructive/10 text-destructive border-b border-destructive/20',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Conexão restabelecida</span>
        </>
      ) : (
        <>
          {isReconnecting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <span>
            {isReconnecting ? 'Reconectando...' : 'Sem conexão com o servidor'}
          </span>
          {!isReconnecting && onReconnect && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-destructive/20"
              onClick={handleReconnect}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reconectar
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export default ConnectionStatusBanner
