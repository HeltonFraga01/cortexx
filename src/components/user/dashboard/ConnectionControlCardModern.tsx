/**
 * ConnectionControlCardModern Component
 * Controls WhatsApp connection with connect/disconnect/logout buttons
 * Requirements: 7.3, 8.1, 8.5
 * 
 * @deprecated Use ConnectionControlCard from '@/components/shared/inbox' instead.
 * This component will be removed in a future version.
 * 
 * Migration guide:
 * ```tsx
 * // Before
 * import { ConnectionControlCardModern } from '@/components/user/dashboard'
 * <ConnectionControlCardModern sessionStatus={status} onConnect={...} />
 * 
 * // After
 * import { ConnectionControlCard } from '@/components/shared/inbox'
 * <ConnectionControlCard 
 *   connectionStatus={{ isConnected: status.connected, isLoggedIn: status.loggedIn }}
 *   onConnect={...}
 * />
 * ```
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Power, 
  PowerOff, 
  LogOut, 
  RefreshCw,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/services/wuzapi'

export interface ConnectionControlCardModernProps {
  sessionStatus: SessionStatus | null
  /** Status de conexão do contexto (prioridade sobre sessionStatus) */
  isConnectedOverride?: boolean
  onConnect: () => void
  onDisconnect: () => void
  onLogout: () => void
  onRefreshStatus: () => void
  isConnecting: boolean
  isRefreshing?: boolean
}

export function ConnectionControlCardModern({
  sessionStatus,
  isConnectedOverride,
  onConnect,
  onDisconnect,
  onLogout,
  onRefreshStatus,
  isConnecting,
  isRefreshing = false
}: ConnectionControlCardModernProps) {
  // Usar isConnectedOverride se fornecido, senão usar sessionStatus
  const isConnected = isConnectedOverride !== undefined 
    ? isConnectedOverride 
    : (sessionStatus?.connected ?? false)
  const isLoggedIn = isConnectedOverride !== undefined 
    ? isConnectedOverride 
    : (sessionStatus?.loggedIn ?? false)

  const getStatusBadge = () => {
    if (isLoggedIn) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Logado
        </Badge>
      )
    }
    if (isConnected) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Conectado
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Desconectado
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Controle de Conexão
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshStatus}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Atualizar Status
          </Button>

          {!isConnected ? (
            <Button
              size="sm"
              onClick={onConnect}
              disabled={isConnecting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              Conectar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                className="gap-2"
              >
                <PowerOff className="h-4 w-4" />
                Desconectar
              </Button>
              {isLoggedIn && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout WhatsApp
                </Button>
              )}
            </>
          )}
        </div>

        {/* Success Message */}
        {isLoggedIn && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>Conectado!</strong> Sua conta WhatsApp está ativa e pronta para uso.
              </span>
            </p>
          </div>
        )}

        {/* Waiting for QR Code */}
        {isConnected && !isLoggedIn && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Aguardando login.</strong> Escaneie o QR Code para conectar sua conta WhatsApp.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ConnectionControlCardModern
