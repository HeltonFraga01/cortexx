/**
 * SupabaseUserSubscriptionCard
 * 
 * Displays subscription and plan information with actions.
 * Requirements: 2.3, 5.1, 5.2, 5.3, 5.4
 */

import { useState } from 'react'
import { CreditCard, Calendar, AlertCircle, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlanAssignmentDialog } from '@/components/admin/PlanAssignmentDialog'
import type { UserSubscription } from '@/types/supabase-user'

interface SupabaseUserSubscriptionCardProps {
  subscription: UserSubscription | null
  userId: string
  userName: string
  onUpdate: () => void
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Trial', variant: 'outline' },
  active: { label: 'Ativo', variant: 'default' },
  past_due: { label: 'Pagamento Pendente', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'secondary' },
  expired: { label: 'Expirado', variant: 'secondary' },
  suspended: { label: 'Suspenso', variant: 'destructive' }
}

export function SupabaseUserSubscriptionCard({ subscription, userId, userName, onUpdate }: SupabaseUserSubscriptionCardProps) {
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100)
  }
  
  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Nenhuma assinatura ativa</span>
          </div>
          <Button onClick={() => setPlanDialogOpen(true)}>
            <Crown className="h-4 w-4 mr-2" />
            Atribuir Plano
          </Button>
          
          <PlanAssignmentDialog
            open={planDialogOpen}
            onOpenChange={setPlanDialogOpen}
            userId={userId}
            userName={userName}
            onSuccess={onUpdate}
          />
        </CardContent>
      </Card>
    )
  }
  
  const statusInfo = STATUS_LABELS[subscription.status] || STATUS_LABELS.expired
  const plan = subscription.plan
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Assinatura
        </CardTitle>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Info */}
        {plan && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  {plan.name}
                </h4>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(plan.price_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  /{plan.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Período atual:</span>
            <span>
              {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
            </span>
          </div>
          
          {subscription.trial_end && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Trial até:</span>
              <span>{formatDate(subscription.trial_end)}</span>
            </div>
          )}
          
          {subscription.canceled_at && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Calendar className="h-4 w-4" />
              <span>Cancelado em:</span>
              <span>{formatDate(subscription.canceled_at)}</span>
            </div>
          )}
        </div>
        
        {/* Features */}
        {plan?.features && Object.keys(plan.features).length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Recursos inclusos:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(plan.features).map(([key, value]) => (
                value && (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}
                  </Badge>
                )
              ))}
            </div>
          </div>
        )}
        
        {/* Limits */}
        {plan?.limits && Object.keys(plan.limits).length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Limites:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium">{value === -1 ? 'Ilimitado' : value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => setPlanDialogOpen(true)}>
            <Crown className="h-4 w-4 mr-2" />
            Alterar Plano
          </Button>
        </div>
        
        <PlanAssignmentDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          userId={userId}
          userName={userName}
          currentPlanId={subscription.plan_id}
          onSuccess={onUpdate}
        />
      </CardContent>
    </Card>
  )
}
