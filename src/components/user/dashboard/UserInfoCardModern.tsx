/**
 * UserInfoCardModern Component
 * Displays user profile info with avatar, name, phone, and token
 * Requirements: 7.2, 8.1, 8.2, 8.3, 8.4
 * 
 * @deprecated Use InboxInfoCard from '@/components/shared/inbox' instead.
 * This component will be removed in a future version.
 * 
 * Migration guide:
 * ```tsx
 * // Before
 * import { UserInfoCardModern } from '@/components/user/dashboard'
 * <UserInfoCardModern user={user} sessionStatus={status} />
 * 
 * // After
 * import { InboxInfoCard } from '@/components/shared/inbox'
 * import { adaptConnectionDataToInboxInfo } from '@/lib/adapters/inbox-adapters'
 * <InboxInfoCard {...adaptConnectionDataToInboxInfo(connectionData, sessionStatus)} />
 * ```
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
  Hash,
  Key
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/services/wuzapi'

export interface UserInfoCardModernProps {
  user: {
    id: string
    name: string
    email?: string
    phone?: string
    jid?: string
    token: string
    profilePicture?: string
  }
  sessionStatus: SessionStatus | null
  /** Status de conexão do contexto (prioridade sobre sessionStatus) */
  isConnectedOverride?: boolean
  onRefreshAvatar?: () => void
  isLoadingAvatar?: boolean
}

export function UserInfoCardModern({
  user,
  sessionStatus,
  isConnectedOverride,
  onRefreshAvatar,
  isLoadingAvatar = false
}: UserInfoCardModernProps) {
  const [showToken, setShowToken] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatPhone = (phone: string) => {
    // Format: +55 (11) 99999-9999
    return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
  }

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(user.token)
      toast.success('Token copiado!')
    } catch {
      toast.error('Erro ao copiar token')
    }
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      toast.success('ID copiado!')
    } catch {
      toast.error('Erro ao copiar ID')
    }
  }

  // Usar isConnectedOverride se fornecido, senão usar sessionStatus.loggedIn
  const isConnected = isConnectedOverride !== undefined 
    ? isConnectedOverride 
    : (sessionStatus?.loggedIn ?? sessionStatus?.connected ?? false)

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Informações do Usuário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Section */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              {isLoadingAvatar ? (
                <AvatarFallback className="bg-muted animate-pulse">
                  <User className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              ) : user.profilePicture ? (
                <AvatarImage 
                  src={user.profilePicture} 
                  alt={user.name}
                  className="object-cover"
                />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              )}
            </Avatar>
            {/* Connection status indicator */}
            <div
              className={cn(
                'absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-background flex items-center justify-center',
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              )}
            >
              <Wifi className="h-3 w-3 text-white" />
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className="text-lg font-semibold truncate">{user.name}</h3>
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs',
                  isConnected 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400'
                )}
              >
                {isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>

            {/* Phone */}
            {user.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhone(user.phone)}</span>
              </div>
            )}

            {/* Refresh avatar button */}
            {isConnected && !user.profilePicture && !isLoadingAvatar && onRefreshAvatar && (
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
        <div className="grid gap-4 sm:grid-cols-2">
          {/* User ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              ID do Usuário
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted px-2 py-1.5 rounded truncate">
                {user.id}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0"
                onClick={handleCopyId}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* JID */}
          {user.jid && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                JID WhatsApp
              </label>
              <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded truncate">
                {user.jid}
              </code>
            </div>
          )}
        </div>

        {/* Token Section */}
        <div className="space-y-1.5 pt-2 border-t">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Key className="h-3 w-3" />
            Token de Acesso
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded overflow-x-auto">
              {showToken ? user.token : `${user.token.substring(0, 20)}...`}
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
              onClick={handleCopyToken}
              title="Copiar token"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mantenha seu token seguro. Não compartilhe em prints ou mensagens.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default UserInfoCardModern
