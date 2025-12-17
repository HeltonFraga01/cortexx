/**
 * SubscriptionManager Component
 * 
 * User interface for managing subscription - view, upgrade, downgrade, cancel.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { Subscription, Plan } from '@/types/stripe'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function SubscriptionManager() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [sub, availablePlans] = await Promise.all([
        stripeService.getSubscription(),
        stripeService.getAvailablePlans()
      ])
      setSubscription(sub)
      // Filter out credit packages (user plans endpoint already filters by active status)
      setPlans(availablePlans.filter(p => !p.isCreditPackage) as unknown as Plan[])
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados da assinatura',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(planId: string) {
    try {
      setActionLoading(planId)
      const { url } = await stripeService.createSubscriptionCheckout(planId)
      window.location.href = url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar checkout'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleChangePlan(planId: string) {
    try {
      setActionLoading(planId)
      const { url } = await stripeService.changePlan(planId)
      window.location.href = url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao alterar plano'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel() {
    try {
      setActionLoading('cancel')
      await stripeService.cancelSubscription()
      toast({
        title: 'Assinatura cancelada',
        description: 'Sua assinatura será cancelada ao final do período atual',
      })
      await loadData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao cancelar assinatura'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReactivate() {
    try {
      setActionLoading('reactivate')
      await stripeService.reactivateSubscription()
      toast({
        title: 'Assinatura reativada',
        description: 'Sua assinatura foi reativada com sucesso',
      })
      await loadData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao reativar assinatura'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleOpenBillingPortal() {
    try {
      setActionLoading('portal')
      const { url } = await stripeService.openBillingPortal()
      window.location.href = url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao abrir portal de cobrança'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  function getStatusBadge(status: string) {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Ativa' },
      trialing: { variant: 'secondary', label: 'Período de teste' },
      past_due: { variant: 'destructive', label: 'Pagamento pendente' },
      canceled: { variant: 'outline', label: 'Cancelada' },
      expired: { variant: 'destructive', label: 'Expirada' },
    }
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sua Assinatura</CardTitle>
              <CardDescription>
                Gerencie seu plano e método de pagamento
              </CardDescription>
            </div>
            {subscription && getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              {/* Plan Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{subscription.planName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(subscription.paymentMethod ? 0 : 0)}/mês
                  </p>
                </div>
              </div>

              <Separator />

              {/* Billing Cycle */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Período atual</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>

                {subscription.paymentMethod && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Método de pagamento</p>
                      <p className="text-sm text-muted-foreground">
                        {subscription.paymentMethod.brand.toUpperCase()} •••• {subscription.paymentMethod.last4}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancel Warning */}
              {subscription.cancelAtPeriodEnd && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Sua assinatura será cancelada em {formatDate(subscription.currentPeriodEnd)}.
                    Você pode reativar a qualquer momento antes dessa data.
                  </AlertDescription>
                </Alert>
              )}

              {/* Past Due Warning */}
              {subscription.status === 'past_due' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Seu pagamento falhou. Atualize seu método de pagamento para evitar a suspensão do serviço.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Você ainda não possui uma assinatura ativa
              </p>
              <p className="text-sm text-muted-foreground">
                Escolha um plano abaixo para começar
              </p>
            </div>
          )}
        </CardContent>
        {subscription && (
          <CardFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleOpenBillingPortal}
              disabled={actionLoading === 'portal'}
            >
              {actionLoading === 'portal' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Gerenciar Pagamento
            </Button>

            {subscription.cancelAtPeriodEnd ? (
              <Button
                onClick={handleReactivate}
                disabled={actionLoading === 'reactivate'}
              >
                {actionLoading === 'reactivate' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Reativar Assinatura
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={actionLoading === 'cancel'}>
                    {actionLoading === 'cancel' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cancelar Assinatura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sua assinatura será cancelada ao final do período atual 
                      ({formatDate(subscription.currentPeriodEnd)}). 
                      Você continuará tendo acesso até essa data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>
                      Confirmar Cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Planos Disponíveis</CardTitle>
          <CardDescription>
            {subscription ? 'Altere seu plano a qualquer momento' : 'Escolha o plano ideal para você'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan = subscription?.planId === plan.id
              return (
                <Card key={plan.id} className={isCurrentPlan ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrentPlan && (
                        <Badge variant="default">Atual</Badge>
                      )}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatCurrency(plan.priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.billingCycle === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </div>
                    {!plan.stripePriceId && (
                      <p className="text-xs text-destructive mt-2">
                        Plano não disponível para assinatura
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    {isCurrentPlan ? (
                      <Button variant="outline" disabled className="w-full">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Plano Atual
                      </Button>
                    ) : subscription ? (
                      <Button
                        className="w-full"
                        onClick={() => handleChangePlan(plan.id)}
                        disabled={actionLoading === plan.id || !plan.stripePriceId}
                      >
                        {actionLoading === plan.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Alterar para este plano
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={actionLoading === plan.id || !plan.stripePriceId}
                      >
                        {actionLoading === plan.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Assinar
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SubscriptionManager
