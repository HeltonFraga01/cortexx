/**
 * ModernInboxHeader Component
 * 
 * Header modernizado para página de edição de inbox.
 * Exibe nome, avatar, status de conexão em tempo real e ações rápidas.
 * 
 * Features:
 * - Status indicator com pulse animation quando conectado
 * - Quick actions responsivas (icon-only em mobile)
 * - Avatar com ring indicator de status
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  ArrowLeft, 
  Loader2, 
  QrCode, 
  RefreshCw, 
  User 
} from 'lucide-react'

type ConnectionStatus = 'logged_in' | 'connected' | 'offline'

interface ModernInboxHeaderProps {
  /** Nome da inbox */
  inboxName: string
  /** Número de telefone (exibido quando conectado) */
  phoneNumber?: string
  /** URL do avatar */
  avatarUrl?: string
  /** Status de conexão */
  connectionStatus: ConnectionStatus
  /** Callback para voltar */
  onBack: () => void
  /** Callback para atualizar status */
  onRefresh: () => void
  /** Callback para gerar QR Code */
  onGenerateQR: () => void
  /** Indica se está atualizando */
  isRefreshing?: boolean
  /** Indica se está gerando QR */
  isGeneratingQR?: boolean
  /** Classes adicionais */
  className?: string
}

/** Configuração de cores e labels por status */
const STATUS_CONFIG = {
  logged_in: { 
    color: 'bg-green-500', 
    ringColor: 'ring-green-500/30',
    pulse: true, 
    label: 'Logado',
    textColor: 'text-green-600 dark:text-green-400'
  },
  connected: { 
    color: 'bg-yellow-500', 
    ringColor: 'ring-yellow-500/30',
    pulse: false, 
    label: 'Conectado',
    textColor: 'text-yellow-600 dark:text-yellow-400'
  },
  offline: { 
    color: 'bg-gray-400', 
    ringColor: 'ring-gray-400/30',
    pulse: false, 
    label: 'Offline',
    textColor: 'text-gray-500 dark:text-gray-400'
  }
} as const

/** Indicador de status com animação pulse */
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const config = STATUS_CONFIG[status]
  
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
            config.color
          )} />
        )}
        <span className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          config.color
        )} />
      </span>
      <span className={cn("text-sm font-medium", config.textColor)}>
        {config.label}
      </span>
    </div>
  )
}

export function ModernInboxHeader({
  inboxName,
  phoneNumber,
  avatarUrl,
  connectionStatus,
  onBack,
  onRefresh,
  onGenerateQR,
  isRefreshing = false,
  isGeneratingQR = false,
  className
}: ModernInboxHeaderProps) {
  const config = STATUS_CONFIG[connectionStatus]
  const isConnected = connectionStatus !== 'offline'

  return (
    <div className={cn("space-y-4", className)}>
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar</span>
      </Button>

      {/* Main header content */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Avatar with status ring */}
        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            "h-16 w-16 sm:h-20 sm:w-20 border-4 border-background shadow-lg ring-4",
            config.ringColor
          )}>
            {avatarUrl ? (
              <AvatarImage 
                src={avatarUrl} 
                alt={inboxName}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className={cn(
              "text-xl sm:text-2xl",
              connectionStatus === 'logged_in' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-muted'
            )}>
              <User className="h-8 w-8 sm:h-10 sm:w-10" />
            </AvatarFallback>
          </Avatar>
          
          {/* Status dot on avatar */}
          <span className={cn(
            "absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background",
            config.color
          )} />
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {inboxName}
            </h1>
            <StatusIndicator status={connectionStatus} />
          </div>
          
          {/* Phone number when connected */}
          {isConnected && phoneNumber && (
            <p className="text-base sm:text-lg text-muted-foreground font-medium">
              {phoneNumber}
            </p>
          )}
          
          <p className="text-sm text-muted-foreground">
            {connectionStatus === 'logged_in' 
              ? 'Pronto para enviar e receber mensagens'
              : connectionStatus === 'connected'
              ? 'Escaneie o QR Code para autenticar'
              : 'Gere um QR Code para conectar'
            }
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={onGenerateQR}
            disabled={isGeneratingQR}
            className="gap-2"
          >
            {isGeneratingQR ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">QR Code</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ModernInboxHeader
