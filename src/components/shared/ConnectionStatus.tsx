/**
 * ConnectionStatus - Indicador visual de status de conexão WhatsApp
 * 
 * Mostra se a inbox ativa está conectada ao WhatsApp.
 * Inclui tooltip com detalhes e opção de reconectar.
 * Suporta estado "desconhecido" quando há erro na consulta de status.
 * 
 * Requirements: 8.2, 8.3, 3.3, 6.3, 6.4 (wuzapi-status-source-of-truth spec)
 */

import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw, AlertCircle, HelpCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'

/** Status de conexão possíveis */
type ConnectionState = 'connected' | 'disconnected' | 'unknown' | 'loading'

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
    refreshInboxStatus,
    isLoading,
    error,
    hasDisconnectedInbox
  } = useSupabaseInbox()
  
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!context) return null

  // Determinar estado de conexão
  const getConnectionState = (): ConnectionState => {
    if (isLoading || isRefreshing) return 'loading'
    if (error) return 'unknown'
    return isConnected ? 'connected' : 'disconnected'
  }

  const connectionState = getConnectionState()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Usar refreshInboxStatus para a inbox ativa (fonte única de verdade)
      if (context.inboxId) {
        await refreshInboxStatus(context.inboxId)
      } else {
        await refreshContext()
      }
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

  // Renderizar ícone baseado no estado
  const renderIcon = () => {
    switch (connectionState) {
      case 'loading':
        return (
          <div className="relative">
            <Loader2 className={cn(iconSize, 'text-muted-foreground animate-spin')} />
          </div>
        )
      case 'connected':
        return (
          <div className="relative">
            <Wifi className={cn(iconSize, 'text-green-500')} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )
      case 'unknown':
        return (
          <div className="relative">
            <HelpCircle className={cn(iconSize, 'text-gray-500')} />
            <AlertCircle className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
          </div>
        )
      case 'disconnected':
      default:
        return (
          <div className="relative">
            <WifiOff className={cn(iconSize, 'text-red-500')} />
            <AlertCircle className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
          </div>
        )
    }
  }

  // Renderizar label baseado no estado
  const renderLabel = () => {
    if (!showLabel) return null

    switch (connectionState) {
      case 'loading':
        return (
          <span className="text-sm text-muted-foreground">
            Verificando...
          </span>
        )
      case 'connected':
        return (
          <span className="text-sm text-green-600 dark:text-green-400">
            Conectado
          </span>
        )
      case 'unknown':
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Status desconhecido
          </span>
        )
      case 'disconnected':
      default:
        return (
          <span className="text-sm text-red-600 dark:text-red-400">
            Desconectado
          </span>
        )
    }
  }

  // Obter título do tooltip
  const getTooltipTitle = () => {
    switch (connectionState) {
      case 'loading':
        return 'Verificando conexão...'
      case 'connected':
        return 'WhatsApp Conectado'
      case 'unknown':
        return 'Status Desconhecido'
      case 'disconnected':
      default:
        return 'WhatsApp Desconectado'
    }
  }

  // Obter mensagem de ajuda do tooltip
  const getTooltipHelp = () => {
    switch (connectionState) {
      case 'loading':
        return 'Consultando status do provedor...'
      case 'connected':
        return null
      case 'unknown':
        return 'Não foi possível verificar o status. Clique para tentar novamente.'
      case 'disconnected':
      default:
        return 'Reconecte para enviar mensagens'
    }
  }

  // Mostrar botão de refresh em estados que permitem
  const showRefreshButton = showReconnect && (connectionState === 'disconnected' || connectionState === 'unknown')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            {renderIcon()}
            {renderLabel()}
            
            {showRefreshButton && (
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
              {getTooltipTitle()}
            </p>
            <p className="text-xs text-muted-foreground">
              Inbox: {context.inboxName}
            </p>
            {context.phoneNumber && (
              <p className="text-xs text-muted-foreground">
                Telefone: {context.phoneNumber}
              </p>
            )}
            {hasDisconnectedInbox && connectionState === 'connected' && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Algumas caixas estão desconectadas
              </p>
            )}
            {getTooltipHelp() && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                {getTooltipHelp()}
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
 * Suporta três estados: conectado, desconectado, desconhecido
 */
interface ConnectionStatusBadgeProps {
  /** Status de conexão: true = conectado, false = desconectado, null/undefined = desconhecido */
  isConnected: boolean | null | undefined
  /** Se houve erro ao consultar status */
  hasError?: boolean
  size?: 'sm' | 'default' | 'lg'
  showLabel?: boolean
  className?: string
}

export function ConnectionStatusBadge({ 
  isConnected, 
  hasError = false,
  size = 'default',
  showLabel = false,
  className 
}: ConnectionStatusBadgeProps) {
  const dotSizes = {
    sm: 'h-2 w-2',
    default: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  }

  // Determinar estado: unknown se hasError ou isConnected é null/undefined
  const isUnknown = hasError || isConnected === null || isConnected === undefined

  const getColor = () => {
    if (isUnknown) return 'bg-gray-500'
    return isConnected ? 'bg-green-500' : 'bg-red-500'
  }

  const getTextColor = () => {
    if (isUnknown) return 'text-gray-600 dark:text-gray-400'
    return isConnected 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400'
  }

  const getLabel = () => {
    if (isUnknown) return 'Desconhecido'
    return isConnected ? 'Online' : 'Offline'
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span 
        className={cn(
          'rounded-full',
          dotSizes[size],
          getColor()
        )} 
      />
      {showLabel && (
        <span className={cn('text-xs', getTextColor())}>
          {getLabel()}
        </span>
      )}
    </div>
  )
}

export default ConnectionStatus
