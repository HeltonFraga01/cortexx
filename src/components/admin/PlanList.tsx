/**
 * PlanList Component
 * 
 * Displays a list of subscription plans with subscriber counts and actions.
 * Requirements: 1.4
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { adminPlansService } from '@/services/admin-plans'
import type { Plan, PlanStatus } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Plus, Pencil, Trash2, Users, Star } from 'lucide-react'

interface PlanListProps {
  onEdit?: (plan: Plan) => void
  onCreate?: () => void
}

export function PlanList({ onEdit, onCreate }: PlanListProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      setIsLoading(true)
      const data = await adminPlansService.listPlans()
      setPlans(data)
    } catch (error) {
      toast.error('Falha ao carregar planos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!planToDelete) return

    try {
      await adminPlansService.deletePlan(planToDelete.id)
      toast.success('Plano excluído com sucesso')
      loadPlans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao excluir plano')
    } finally {
      setDeleteDialogOpen(false)
      setPlanToDelete(null)
    }
  }

  const formatPrice = (cents: number, cycle: string) => {
    const price = (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
    const cycleLabel = cycle === 'monthly' ? '/mês' : cycle === 'yearly' ? '/ano' : ''
    return `${price}${cycleLabel}`
  }

  const getStatusBadge = (status: PlanStatus) => {
    const variants: Record<PlanStatus, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      deprecated: 'destructive'
    }
    const labels: Record<PlanStatus, string> = {
      active: 'Ativo',
      inactive: 'Inativo',
      deprecated: 'Descontinuado'
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Planos</CardTitle>
            <CardDescription>Gerencie os planos de assinatura do sistema</CardDescription>
          </div>
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Assinantes</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum plano cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{plan.name}</span>
                        {plan.isDefault && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.priceCents === 0 ? (
                        <span className="text-green-600 font-medium">Grátis</span>
                      ) : (
                        formatPrice(plan.priceCents, plan.billingCycle)
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(plan.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{plan.subscriberCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <div>{plan.quotas.maxAgents} agentes</div>
                        <div>{plan.quotas.maxBots ?? 0} bots</div>
                        <div>{plan.quotas.maxMessagesPerMonth.toLocaleString()} msg/mês</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit?.(plan)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setPlanToDelete(plan)
                              setDeleteDialogOpen(true)
                            }}
                            disabled={(plan.subscriberCount || 0) > 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano "{planToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
