/**
 * InboxInfoCard Component
 * 
 * Displays inbox profile info with avatar, name, phone, and token.
 * Shared between admin edit page and user dashboard.
 * 
 * Requirements: 1.1-1.8
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  User, 
  Phone, 
  Copy, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Wifi,
  WifiOff,
  Hash,
  Key,
  Check,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { InboxInfoCardProps } from './types'

/**
 * Get initials from name for avatar fallback
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Format phone number for display
 */
function formatPhone(phone: string): string {
  // Format: +55 (11) 99999-9999
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length >= 12) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
  }
  return phone
}

export function InboxInfoCard({
  inbox,
  connectionStatus,
  variant = 'full',
  onRefreshAvatar,
  isLoadingAvatar = false,
  onEdit,
  className
}: InboxInfoCardProps) {
  const [showToken, setShowToken] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const { isConnected, isLoggedIn } = connectionStatus
  const isCompact = variant === 'compact'

  /**
   * Copy text to clipboard with feedback
   */
  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copiado!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  return (
    <Card className={className}>
      <CardHeader className={cn("pb-4", isCompact && "pb-2")}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações da Inbox
          </CardTitle>
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-8"
            >
              <Settings className="h-4 w-4 mr-1" />
              Configurações
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-6", isCompact && "space-y-4")}>
        {/* Profile Section */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className={cn(
              "border-2 border-primary/20",
              isCompact ? "h-16 w-16" : "h-20 w-20"
            )}>
              {isLoadingAvatar ? (
                <AvatarFallback className="bg-muted animate-pulse">
                  <User className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              ) : inbox.profilePicture ? (
                <AvatarImage 
                  src={inbox.profilePicture} 
                  alt={inbox.name}
                  className="object-cover"
                />
              ) : (
                <AvatarFallback className={cn(
                  "text-xl font-semibold",
                  isLoggedIn 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                    : "bg-primary/10 text-primary"
                )}>
                  {getInitials(inbox.name)}
                </AvatarFallback>
              )}
            </Avatar>
            {/* Connection status indicator */}
            <div
              className={cn(
                'absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-background flex items-center justify-center',
                isLoggedIn ? 'bg-green-500' : isConnected ? 'bg-yellow-500' : 'bg-gray-400'
              )}
            >
              {isLoggedIn || isConnected ? (
                <Wifi className="h-3 w-3 text-white" />
              ) : (
                <WifiOff className="h-3 w-3 text-white" />
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className={cn(
                "font-semibold truncate",
                isCompact ? "text-base" : "text-lg"
              )}>
                {inbox.name}
              </h3>
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs',
                  isLoggedIn 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' 
                    : isConnected
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400'
                )}
              >
                {isLoggedIn ? 'Conectado' : isConnected ? 'Aguardando QR' : 'Desconectado'}
              </Badge>
            </div>

            {/* Phone */}
            {inbox.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhone(inbox.phone)}</span>
              </div>
            )}

            {/* Refresh avatar button */}
            {isLoggedIn && !inbox.profilePicture && !isLoadingAvatar && onRefreshAvatar && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={onRefreshAvatar}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Carregar foto
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className={cn(
          "grid gap-4",
          isCompact ? "grid-cols-1" : "sm:grid-cols-2"
        )}>
          {/* User ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              ID da Inbox
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted px-2 py-1.5 rounded truncate">
                {inbox.id}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => handleCopy(inbox.id, 'ID')}
              >
                {copiedField === 'ID' ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* JID */}
          {inbox.jid && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                JID WhatsApp
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted px-2 py-1.5 rounded truncate">
                  {inbox.jid}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => handleCopy(inbox.jid!, 'JID')}
                >
                  {copiedField === 'JID' ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Token Section - Only in full variant */}
        {!isCompact && (
          <div className="space-y-1.5 pt-2 border-t">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Key className="h-3 w-3" />
              Token de Acesso
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded overflow-x-auto">
                {showToken ? inbox.token : `${inbox.token.substring(0, 20)}...`}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? 'Ocultar token' : 'Mostrar token'}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleCopy(inbox.token, 'Token')}
                title="Copiar token"
              >
                {copiedField === 'Token' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mantenha seu token seguro. Não compartilhe em prints ou mensagens.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default InboxInfoCard
