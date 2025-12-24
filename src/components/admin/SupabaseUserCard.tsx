/**
 * SupabaseUserCard Component
 * 
 * Displays a user card with subscription info and quick actions.
 * Clean layout with clear visual sections for better UX.
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.4
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Shield, 
  Check, 
  X, 
  MoreVertical,
  Pencil,
  CreditCard,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { SupabaseUser } from '@/services/admin-users'
import type { UserSubscription, SubscriptionStatus } from '@/types/admin-management'

interface SupabaseUserCardProps {
  user: SupabaseUser
  subscription?: UserSubscription | null
  onEdit: (userId: string) => void
  onAssignPlan: (userId: string) => void
  onDelete: (userId: string, email: string) => void
}

// Status labels and colors
const statusConfig: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  trial: { label: 'Trial', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  active: { label: 'Ativo', variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
  past_due: { label: 'Pendente', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'secondary' },
  expired: { label: 'Expirado', variant: 'destructive' },
  suspended: { label: 'Suspenso', variant: 'destructive' }
}

export function SupabaseUserCard({
  user,
  subscription,
  onEdit,
  onAssignPlan,
  onDelete
}: SupabaseUserCardProps) {
  const getInitials = (email?: string) => {
    if (!email) return '?'
    return email.charAt(0).toUpperCase()
  }

  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return null
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR })
    } catch {
      return null
    }
  }

  const formatShortDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), 'dd/MM/yy', { locale: ptBR })
    } catch {
      return '-'
    }
  }

  const isAdmin = user.user_metadata?.role === 'admin'
  const hasPlan = !!subscription?.planId
  const statusInfo = subscription?.status ? statusConfig[subscription.status] : null
  const lastAccess = getRelativeTime(user.last_sign_in_at)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header: Avatar + Email + Actions */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className={isAdmin ? 'bg-red-100 text-red-700 font-semibold' : 'bg-primary/10 text-primary font-semibold'}>
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate text-sm">
                {user.email || 'Sem email'}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {user.id.substring(0, 8)}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(user.id)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssignPlan(user.id)}>
                <CreditCard className="h-4 w-4 mr-2" />
                {hasPlan ? 'Alterar Plano' : 'Atribuir Plano'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(user.id, user.email || '')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges Row: Role + Plan + Status */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {isAdmin && (
            <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-200 text-xs px-1.5 py-0">
              <Shield className="h-3 w-3 mr-0.5" /> Admin
            </Badge>
          )}
          
          {hasPlan ? (
            <>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs px-1.5 py-0">
                {subscription?.plan?.name || 'Plano'}
              </Badge>
              {statusInfo && (
                <Badge variant={statusInfo.variant} className={`text-xs px-1.5 py-0 ${statusInfo.className || ''}`}>
                  {statusInfo.label}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-1.5 py-0">
              <AlertCircle className="h-3 w-3 mr-0.5" />
              Sem plano
            </Badge>
          )}
          
          {/* Email verification indicator */}
          {user.email_confirmed_at ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0">
              <Check className="h-3 w-3 mr-0.5" /> Verificado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs px-1.5 py-0">
              <X className="h-3 w-3 mr-0.5" /> Não verificado
            </Badge>
          )}
        </div>

        {/* Footer: Dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
          <span>
            {lastAccess ? `Acesso ${lastAccess}` : 'Nunca acessou'}
          </span>
          <span>
            Criado: {formatShortDate(user.created_at)}
          </span>
        </div>

        {/* Quick Action for users without plan */}
        {!hasPlan && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAssignPlan(user.id)}
            className="w-full mt-3 text-primary border-primary/30 hover:bg-primary/5"
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            Atribuir Plano
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default SupabaseUserCard
