/**
 * ConnectionControlCard Component
 * 
 * Displays connection control buttons (connect, disconnect, logout, QR).
 * Shared between admin edit page and user dashboard.
 * 
 * Requirements: 2.1-2.8
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Wifi, 
  WifiOff, 
  LogOut,
  QrCode,
  Loader2,
  Power,
  PowerOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConnectionControlCardProps } from './types'

export function ConnectionControlCard({
  connectionStatus,
  isLoading = false,
  loadingAction = null,
  onConnect,
  onDisconnect,
  onLogout,
  onGenerateQR,
  className
}: ConnectionControlCardProps) {
  const { isConnected, isLoggedIn } = connectionStatus

  /**
   * Get status description text
   */
  const getStatusDescription = () => {
    if (isLoggedIn) {
      return 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
    }
    if (isConnected) {
      return 'Conectado mas não autenticado. É necessário escanear o QR Code.'
    }
    return 'Não conectado ao WhatsApp. Conecte para começar.'
  }

  /**
   * Check if a specific action is loading
   */
  const isActionLoading = (action: string) => {
    return isLoading && loadingAction === action
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {isLoggedIn ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : isConnected ? (
            <Wifi className="h-5 w-5 text-yellow-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-gray-400" />
          )}
          Controle de Conexão
        </CardTitle>
        <CardDescription>
          {getStatusDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {/* Disconnected state - Show Connect and QR buttons */}
          {!isConnected && !isLoggedIn && (
            <>
              {onConnect && (
                <Button
                  onClick={onConnect}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isActionLoading('connect') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4 mr-2" />
                  )}
                  Conectar
                </Button>
              )}
              {onGenerateQR && (
                <Button
                  variant="outline"
                  onClick={onGenerateQR}
                  disabled={isLoading}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  {isActionLoading('qr') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Gerar QR Code
                </Button>
              )}
            </>
          )}

          {/* Connected but not logged in - Show QR prominently */}
          {isConnected && !isLoggedIn && (
            <>
              {onGenerateQR && (
                <Button
                  onClick={onGenerateQR}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isActionLoading('qr') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Escanear QR Code
                </Button>
              )}
              {onDisconnect && (
                <Button
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={isLoading}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                >
                  {isActionLoading('disconnect') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2" />
                  )}
                  Desconectar
                </Button>
              )}
            </>
          )}

          {/* Logged in - Show Disconnect and Logout */}
          {isLoggedIn && (
            <>
              {onDisconnect && (
                <Button
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={isLoading}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                >
                  {isActionLoading('disconnect') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2" />
                  )}
                  Desconectar
                </Button>
              )}
              {onLogout && (
                <Button
                  variant="outline"
                  onClick={onLogout}
                  disabled={isLoading}
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {isActionLoading('logout') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Logout WhatsApp
                </Button>
              )}
              {onGenerateQR && (
                <Button
                  variant="ghost"
                  onClick={onGenerateQR}
                  disabled={isLoading}
                  className="text-muted-foreground"
                >
                  {isActionLoading('qr') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Novo QR Code
                </Button>
              )}
            </>
          )}
        </div>

        {/* Status indicator bar */}
        <div className={cn(
          "mt-4 h-1 rounded-full",
          isLoggedIn 
            ? "bg-green-500" 
            : isConnected 
            ? "bg-yellow-500" 
            : "bg-gray-300 dark:bg-gray-700"
        )} />
      </CardContent>
    </Card>
  )
}

export default ConnectionControlCard
