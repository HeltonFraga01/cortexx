/**
 * ConnectionStatus - Indicador visual de status de conexão WhatsApp
 * 
 * Mostra se a inbox ativa está conectada ao WhatsApp.
 * Inclui tooltip com detalhes e opção de reconectar.
 * 
 * Requirements: 8.2, 8.3
 */

import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'

interface ConnectionStatusProps {
  /** Classe CSS adicional */
  className?: string
  /** Mostrar botão de reconectar */
  showReconnect?: boolean
  /** Mostrar label de texto */
  showLabel?: boolean
  /** Tamanho do indicador */
  size?: 'sm' | 'default' | 'lg'
}

export function ConnectionStatus({ 
  className,
  showReconnect = true,
  showLabel = true,
  size = 'default'
}: ConnectionStatusProps) {
  const { 
    context, 
    isConnected, 
    refreshContext, 
    isLoading 
  } = useSupabaseInbox()
  
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!context) return null

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshContext()
    } finally {
      setIsRefreshing(false)
    }
  }

  const sizeClasses = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const iconSize = sizeClasses[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            {isConnected ? (
              <>
                <div className="relative">
                  <Wifi className={cn(iconSize, 'text-green-500')} />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                {showLabel && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Conectado
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="relative">
                  <WifiOff className={cn(iconSize, 'text-red-500')} />
                  <AlertCircle className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
                </div>
                {showLabel && (
                  <span className="text-sm text-red-600 dark:text-red-400">
                    Desconectado
                  </span>
                )}
              </>
            )}
            
            {showReconnect && !isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                className="h-6 px-2"
              >
                <RefreshCw className={cn(
                  'h-3 w-3',
                  (isLoading || isRefreshing) && 'animate-spin'
                )} />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="bottom" className="max-w-[250px]">
          <div className="space-y-1">
            <p className="font-medium">
              {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
            </p>
            <p className="text-xs text-muted-foreground">
              Inbox: {context.inboxName}
            </p>
            {context.phoneNumber && (
              <p className="text-xs text-muted-foreground">
                Telefone: {context.phoneNumber}
              </p>
            )}
            {!isConnected && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Reconecte para enviar mensagens
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Badge simples de status de conexão
 */
interface ConnectionStatusBadgeProps {
  isConnected: boolean
  size?: 'sm' | 'default' | 'lg'
  showLabel?: boolean
  className?: string
}

export function ConnectionStatusBadge({ 
  isConnected, 
  size = 'default',
  showLabel = false,
  className 
}: ConnectionStatusBadgeProps) {
  const dotSizes = {
    sm: 'h-2 w-2',
    default: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span 
        className={cn(
          'rounded-full',
          dotSizes[size],
          isConnected 
            ? 'bg-green-500' 
            : 'bg-red-500'
        )} 
      />
      {showLabel && (
        <span className={cn(
          'text-xs',
          isConnected 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        )}>
          {isConnected ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  )
}

export default ConnectionStatus
