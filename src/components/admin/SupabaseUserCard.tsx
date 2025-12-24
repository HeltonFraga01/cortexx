/**
 * SupabaseUserCard Component
 * 
 * Displays a user card with subscription info and quick actions.
 * Used in the user list for better mobile experience and quick actions.
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
  Mail, 
  Phone, 
  Shield, 
  Check, 
  X, 
  MoreVertical,
  Pencil,
  CreditCard,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
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
const statusConfig: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Trial', variant: 'outline' },
  active: { label: 'Ativo', variant: 'default' },
  past_due: { label: 'Pagamento Pendente', variant: 'destructive' },
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
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  }

  const getInitials = (email?: string) => {
    if (!email) return '?'
    return email.charAt(0).toUpperCase()
  }

  const isAdmin = user.user_metadata?.role === 'admin'
  const hasPlan = !!subscription?.planId
  const statusInfo = subscription?.status ? statusConfig[subscription.status] : null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarFallback className={isAdmin ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}>
              {getInitials(user.email)}
            </AvatarFallback>
          </Avatar>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            {/* Email and Role */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                {user.email || 'Sem email'}
              </span>
              {isAdmin && (
                <Badge variant="default" className="bg-red-100 text-red-800 hover:bg-red-200">
                  <Shield className="h-3 w-3 mr-1" /> Admin
                </Badge>
              )}
            </div>

            {/* Phone */}
            {user.phone && (
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3" />
                {user.phone}
              </div>
            )}

            {/* ID */}
            <div className="text-xs text-muted-foreground font-mono mt-1">
              ID: {user.id.substring(0, 8)}...
            </div>

            {/* Plan Badge */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {hasPlan ? (
                <>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CreditCard className="h-3 w-3 mr-1" />
                    {subscription?.plan?.name || 'Plano'}
                  </Badge>
                  {statusInfo && (
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Sem plano
                </Badge>
              )}
            </div>

            {/* Email Confirmation Status */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {user.email_confirmed_at ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    Email confirmado
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-orange-500" />
                    Email não confirmado
                  </>
                )}
              </span>
              <span>Criado: {formatDate(user.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Quick action for users without plan */}
            {!hasPlan && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAssignPlan(user.id)}
                className="hidden sm:flex text-primary border-primary/50 hover:bg-primary/10"
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Atribuir Plano
              </Button>
            )}

            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
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
        </div>
      </CardContent>
    </Card>
  )
}

export default SupabaseUserCard
