/**
 * UserSubscriptionCard Component
 * 
 * Displays subscription details with plan change option.
 * Requirements: 2.3
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { adminSubscriptionsService } from '@/services/admin-subscriptions'
import { adminPlansService } from '@/services/admin-plans'
import type { UserSubscription, Plan } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, CreditCard, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

interface UserSubscriptionCardProps {
  userId: string
  subscription: UserSubscription | null
  onUpdate?: () => void
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial: { label: 'Trial', variant: 'outline' },
  active: { label: 'Ativo', variant: 'default' },
  past_due: { label: 'Pagamento Pendente', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'secondary' },
  expired: { label: 'Expirado', variant: 'destructive' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
}

export function UserSubscriptionCard({ userId, subscription, onUpdate }: UserSubscriptionCardProps) {
  const [isChangingPlan, setIsChangingPlan] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isChangingPlan) {
      loadPlans()
    }
  }, [isChangingPlan])

  const loadPlans = async () => {
    try {
      const data = await adminPlansService.listPlans('active')
      setPlans(data)
    } catch (error) {
      toast.error('Falha ao carregar planos')
    }
  }

  const handleChangePlan = async () => {
    if (!selectedPlanId) return

    try {
      setIsLoading(true)
      await adminSubscriptionsService.assignPlan(userId, selectedPlanId)
      toast.success('Plano alterado com sucesso')
      setIsChangingPlan(false)
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao alterar plano')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const formatPrice = (cents?: number, cycle?: string) => {
    if (!cents) return 'Grátis'
    const price = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const cycleLabel = cycle === 'monthly' ? '/mês' : cycle === 'yearly' ? '/ano' : ''
    return `${price}${cycleLabel}`
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
          <p className="text-muted-foreground">Usuário sem assinatura</p>
          <Button className="mt-4" onClick={() => setIsChangingPlan(true)}>
            Atribuir Plano
          </Button>
        </CardContent>
      </Card>
    )
  }

  const status = statusLabels[subscription.status] || { label: subscription.status, variant: 'secondary' as const }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Assinatura
            </CardTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <CardDescription>
            {subscription.plan?.name || 'Plano não encontrado'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Preço</p>
              <p className="font-medium">
                {formatPrice(subscription.plan?.priceCents, subscription.plan?.billingCycle)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ciclo</p>
              <p className="font-medium capitalize">{subscription.plan?.billingCycle || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Início</p>
              <p className="font-medium">{formatDate(subscription.startedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Próxima Cobrança</p>
              <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
          </div>

          {subscription.suspensionReason && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">Motivo da Suspensão:</p>
              <p className="text-destructive/80">{subscription.suspensionReason}</p>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => setIsChangingPlan(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Alterar Plano
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isChangingPlan} onOpenChange={setIsChangingPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Selecione o novo plano para este usuário
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - {formatPrice(plan.priceCents, plan.billingCycle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangingPlan(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePlan} disabled={!selectedPlanId || isLoading}>
              {isLoading ? 'Alterando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
