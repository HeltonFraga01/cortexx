/**
 * SubscriptionCard - Displays user's subscription details
 * 
 * Shows plan name, status, billing cycle, and period dates.
 * Integrates with Stripe checkout for subscription management.
 * 
 * Requirements: 1.1, 1.2, 3.3, 3.4, 3.5
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Calendar, Clock, ArrowUpRight, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { UserSubscription } from '@/types/admin-management'

interface SubscriptionCardProps {
  subscription: UserSubscription | null
  onUpgrade?: () => void
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Período de Teste',
  active: 'Ativo',
  past_due: 'Pagamento Pendente',
  canceled: 'Cancelado',
  expired: 'Expirado',
  suspended: 'Suspenso'
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trial: 'secondary',
  active: 'default',
  past_due: 'destructive',
  canceled: 'outline',
  expired: 'destructive',
  suspended: 'destructive'
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  lifetime: 'Vitalício'
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatPrice(cents: number | undefined): string {
  if (!cents) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100)
}

export function SubscriptionCard({ subscription, onUpgrade }: SubscriptionCardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const { toast } = useToast()

  async function handleOpenBillingPortal() {
    try {
      setLoading('portal')
      const { url } = await stripeService.openBillingPortal()
      window.location.href = url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir portal'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma assinatura encontrada.</p>
          {onUpgrade && (
            <Button onClick={onUpgrade} className="mt-4">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Escolher Plano
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const plan = subscription.plan
  const status = subscription.status
  const statusLabel = STATUS_LABELS[status] || status
  const statusVariant = STATUS_VARIANTS[status] || 'outline'
  const billingCycle = plan?.billingCycle || 'monthly'
  const billingLabel = BILLING_CYCLE_LABELS[billingCycle] || billingCycle
  const cancelAtPeriodEnd = (subscription as { cancelAtPeriodEnd?: boolean }).cancelAtPeriodEnd

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinatura
          </CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <p className="font-medium">{plan?.name || 'Sem plano'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="font-medium">
              {formatPrice(plan?.priceCents)}
              {plan?.priceCents ? ` / ${billingLabel.toLowerCase()}` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Início do Período</p>
              <p className="font-medium">{formatDate(subscription.currentPeriodStart)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Próxima Cobrança</p>
              <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
          </div>
        </div>

        {subscription.trialEndsAt && status === 'trial' && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Período de teste termina em: </span>
              <span className="font-medium">{formatDate(subscription.trialEndsAt)}</span>
            </p>
          </div>
        )}

        {cancelAtPeriodEnd && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sua assinatura será cancelada em {formatDate(subscription.currentPeriodEnd)}.
            </AlertDescription>
          </Alert>
        )}

        {status === 'past_due' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Pagamento pendente. Atualize seu método de pagamento.
            </AlertDescription>
          </Alert>
        )}

        {subscription.suspensionReason && status === 'suspended' && (
          <div className="p-3 bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive">
              <span className="font-medium">Motivo da suspensão: </span>
              {subscription.suspensionReason}
            </p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {status !== 'suspended' && (
            <Button
              variant="outline"
              onClick={handleOpenBillingPortal}
              disabled={loading === 'portal'}
            >
              {loading === 'portal' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Gerenciar Pagamento
            </Button>
          )}
          
          {onUpgrade && status !== 'suspended' && (
            <Button variant="outline" onClick={onUpgrade}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default SubscriptionCard
