/**
 * PlanAssignmentDialog Component
 * 
 * Modal dialog for assigning a plan to a user.
 * Displays available plans with preview cards and handles assignment.
 * 
 * Requirements: 2.2, 2.3, 2.5, 4.4, 4.5
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CreditCard, AlertCircle } from 'lucide-react'
import { adminPlansService } from '@/services/admin-plans'
import { adminSubscriptionsService } from '@/services/admin-subscriptions'
import { PlanPreviewCard } from './PlanPreviewCard'
import type { Plan } from '@/types/admin-management'

interface PlanAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName?: string
  currentPlanId?: string
  onSuccess: () => void
}

export function PlanAssignmentDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentPlanId,
  onSuccess
}: PlanAssignmentDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load plans when dialog opens
  useEffect(() => {
    if (open) {
      loadPlans()
      // Pre-select current plan if exists
      if (currentPlanId) {
        setSelectedPlanId(currentPlanId)
      } else {
        setSelectedPlanId('')
      }
    }
  }, [open, currentPlanId])

  const loadPlans = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await adminPlansService.listPlans('active')
      setPlans(data)
    } catch (err) {
      setError('Falha ao carregar planos disponíveis')
      toast.error('Erro ao carregar planos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedPlanId) {
      toast.error('Selecione um plano')
      return
    }

    try {
      setIsAssigning(true)
      await adminSubscriptionsService.assignPlan(userId, { planId: selectedPlanId })
      
      const selectedPlan = plans.find(p => p.id === selectedPlanId)
      toast.success(`Plano "${selectedPlan?.name}" atribuído com sucesso`)
      
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atribuir plano'
      toast.error(message)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleCancel = () => {
    if (!isAssigning) {
      onOpenChange(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId)
  const isChangingPlan = currentPlanId && selectedPlanId && currentPlanId !== selectedPlanId

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {currentPlanId ? 'Alterar Plano' : 'Atribuir Plano'}
          </DialogTitle>
          <DialogDescription>
            {userName 
              ? `Selecione um plano para ${userName}`
              : 'Selecione um plano para atribuir ao usuário'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando planos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadPlans} className="mt-4">
                Tentar novamente
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum plano disponível</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie planos na seção de gerenciamento de planos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {plans.map((plan) => (
                <PlanPreviewCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlanId === plan.id}
                  onSelect={setSelectedPlanId}
                  showFeatures={true}
                  compact={plans.length > 4}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary of selection */}
        {selectedPlan && (
          <div className="bg-muted/50 rounded-lg p-4 border">
            <p className="text-sm font-medium mb-1">
              {isChangingPlan ? 'Alteração de plano:' : 'Plano selecionado:'}
            </p>
            <p className="text-lg font-semibold">{selectedPlan.name}</p>
            <p className="text-sm text-muted-foreground">
              {selectedPlan.priceCents === 0 
                ? 'Grátis' 
                : `${(selectedPlan.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/${selectedPlan.billingCycle === 'monthly' ? 'mês' : 'ano'}`
              }
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isAssigning}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedPlanId || isAssigning || isLoading}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Atribuindo...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {isChangingPlan ? 'Alterar Plano' : 'Atribuir Plano'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PlanAssignmentDialog
