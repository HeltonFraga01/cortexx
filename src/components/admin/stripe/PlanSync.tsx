/**
 * PlanSync Component
 * 
 * Admin interface for synchronizing plans with Stripe products/prices.
 * Requirements: 2.4, 2.5
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle, Link2, Settings, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { Plan, PlanSyncResult } from '@/types/stripe'

export function PlanSync() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [unsyncedPlans, setUnsyncedPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<PlanSyncResult | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      setLoading(true)
      const [allPlans, unsynced] = await Promise.all([
        stripeService.getPlans().catch(() => []),
        stripeService.getUnsyncedPlans().catch(() => [])
      ])
      setPlans(allPlans || [])
      setUnsyncedPlans(unsynced || [])
    } catch (error) {
      toast.error('Falha ao carregar planos')
      setPlans([])
      setUnsyncedPlans([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncAll() {
    try {
      setSyncing(true)
      setLastSyncResult(null)
      const result = await stripeService.syncPlans()
      setLastSyncResult(result)
      await loadPlans()
      
      toast.success(`Sincronização concluída: ${result.synced.length} sincronizados, ${result.skipped.length} ignorados, ${result.failed.length} falhas`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha na sincronização'
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncPlan(planId: string, forceResync = false) {
    try {
      setSyncingPlanId(planId)
      await stripeService.syncPlan(planId, forceResync)
      await loadPlans()
      
      toast.success('Plano sincronizado com o Stripe')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar plano'
      toast.error(message)
    } finally {
      setSyncingPlanId(null)
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100)
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
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sincronização de Planos</CardTitle>
              <CardDescription>
                Sincronize os planos locais com produtos e preços no Stripe
              </CardDescription>
            </div>
            <Button onClick={handleSyncAll} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Warning for unsynced plans */}
          {unsyncedPlans.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {unsyncedPlans.length} plano(s) não sincronizado(s) com o Stripe. 
                Usuários não poderão assinar estes planos até que sejam sincronizados.
              </AlertDescription>
            </Alert>
          )}

          {/* Last sync result */}
          {lastSyncResult && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Última sincronização: {lastSyncResult.synced.length} sincronizados, {' '}
                {lastSyncResult.skipped.length} ignorados, {lastSyncResult.failed.length} falhas
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Planos</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/plans">
                <Settings className="mr-2 h-4 w-4" />
                Gerenciar Planos
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{formatCurrency(plan.priceCents)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {plan.billingCycle === 'monthly' ? 'Mensal' : 
                       plan.billingCycle === 'yearly' ? 'Anual' : plan.billingCycle}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {plan.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {plan.stripePriceId ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={plan.stripePriceId}>
                          {plan.stripePriceId.slice(0, 15)}...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">Não sincronizado</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {plan.stripePriceId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncPlan(plan.id, true)}
                          disabled={syncingPlanId === plan.id}
                        >
                          {syncingPlanId === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSyncPlan(plan.id)}
                          disabled={syncingPlanId === plan.id}
                        >
                          {syncingPlanId === plan.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="mr-2 h-4 w-4" />
                          )}
                          Sincronizar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum plano encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default PlanSync
