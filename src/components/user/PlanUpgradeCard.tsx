/**
 * PlanUpgradeCard - Displays available plans for upgrade
 * 
 * Shows plan comparison with pricing, features, and upgrade buttons.
 * Integrates with Stripe checkout for plan changes.
 * 
 * Requirements: 3.3, 3.4
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Loader2, ArrowRight, Sparkles, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { AvailablePlan } from '@/types/stripe'

interface PlanUpgradeCardProps {
  onClose: () => void
  currentPlanId?: string
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: '/mês',
  yearly: '/ano',
  quarterly: '/trimestre',
  weekly: '/semana',
  biweekly: '/quinzena'
}

function formatPrice(cents: number): string {
  if (!cents) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100)
}

export function PlanUpgradeCard({ onClose, currentPlanId }: PlanUpgradeCardProps) {
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      setIsLoading(true)
      const data = await stripeService.getAvailablePlans()
      setPlans(data || [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar planos'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
      setPlans([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpgrade(planId: string) {
    try {
      setUpgrading(planId)
      const { url } = await stripeService.changePlan(planId)
      window.location.href = url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar upgrade'
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setUpgrading(null)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-2 border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Escolher Plano
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plans.length === 0) {
    return (
      <Card className="border-2 border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Escolher Plano
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Escolher Plano
            </CardTitle>
            <CardDescription>
              Selecione o plano que melhor atende suas necessidades
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.isCurrent ? 'border-primary' : ''}`}
            >
              {plan.isCurrent && (
                <Badge className="absolute -top-2 left-4">Plano Atual</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription className="text-sm">
                    {plan.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">
                    {formatPrice(plan.priceCents)}
                  </span>
                  {plan.priceCents > 0 && (
                    <span className="text-muted-foreground">
                      {BILLING_CYCLE_LABELS[plan.billingCycle] || `/${plan.billingCycle}`}
                    </span>
                  )}
                </div>

                {plan.trialDays > 0 && (
                  <Badge variant="secondary">
                    {plan.trialDays} dias de teste grátis
                  </Badge>
                )}

                {plan.features && plan.features.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {plan.features.slice(0, 5).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 5 && (
                      <li className="text-muted-foreground text-xs">
                        +{plan.features.length - 5} recursos adicionais
                      </li>
                    )}
                  </ul>
                )}

                <Button
                  className="w-full"
                  variant={plan.isCurrent ? 'outline' : 'default'}
                  disabled={plan.isCurrent || !plan.stripePriceId || upgrading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {upgrading === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : plan.isCurrent ? (
                    'Plano Atual'
                  ) : !plan.stripePriceId ? (
                    'Indisponível'
                  ) : (
                    <>
                      Selecionar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default PlanUpgradeCard
