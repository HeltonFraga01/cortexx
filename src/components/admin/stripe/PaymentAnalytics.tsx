/**
 * PaymentAnalytics Component
 * 
 * Admin dashboard for payment and revenue analytics.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  Users, 
  CreditCard, 
  Coins, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { PaymentAnalytics as PaymentAnalyticsType } from '@/types/stripe'

export function PaymentAnalytics() {
  const [analytics, setAnalytics] = useState<PaymentAnalyticsType | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      setLoading(true)
      const data = await stripeService.getAnalytics()
      setAnalytics(data)
    } catch (error) {
      toast.error('Falha ao carregar analytics de pagamentos')
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Não foi possível carregar os dados de analytics.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalSubscriptions = 
    analytics.statusBreakdown.active +
    analytics.statusBreakdown.trial +
    analytics.statusBreakdown.past_due +
    analytics.statusBreakdown.canceled +
    analytics.statusBreakdown.expired

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(analytics.mrr)}</p>
            <p className="text-xs text-muted-foreground">Receita Mensal Recorrente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Assinaturas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.totalActiveSubscriptions}</p>
            <p className="text-xs text-muted-foreground">de {totalSubscriptions} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-500" />
              Vendas de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(analytics.creditSales)}</p>
            <p className="text-xs text-muted-foreground">Total vendido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              Consumo de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.creditConsumption.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Créditos utilizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Status Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Status das Assinaturas
            </CardTitle>
            <CardDescription>
              Distribuição por status de assinatura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Active */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Ativas</span>
                </div>
                <Badge variant="default">{analytics.statusBreakdown.active}</Badge>
              </div>
              <Progress 
                value={totalSubscriptions > 0 ? (analytics.statusBreakdown.active / totalSubscriptions) * 100 : 0} 
                className="[&>div]:bg-green-500"
              />
            </div>

            {/* Trial */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>Em Trial</span>
                </div>
                <Badge variant="secondary">{analytics.statusBreakdown.trial}</Badge>
              </div>
              <Progress 
                value={totalSubscriptions > 0 ? (analytics.statusBreakdown.trial / totalSubscriptions) * 100 : 0} 
                className="[&>div]:bg-blue-500"
              />
            </div>

            {/* Past Due */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>Pagamento Pendente</span>
                </div>
                <Badge variant="outline">{analytics.statusBreakdown.past_due}</Badge>
              </div>
              <Progress 
                value={totalSubscriptions > 0 ? (analytics.statusBreakdown.past_due / totalSubscriptions) * 100 : 0} 
                className="[&>div]:bg-yellow-500"
              />
            </div>

            {/* Canceled */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Canceladas</span>
                </div>
                <Badge variant="destructive">{analytics.statusBreakdown.canceled}</Badge>
              </div>
              <Progress 
                value={totalSubscriptions > 0 ? (analytics.statusBreakdown.canceled / totalSubscriptions) * 100 : 0} 
                className="[&>div]:bg-red-500"
              />
            </div>

            {/* Expired */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-500" />
                  <span>Expiradas</span>
                </div>
                <Badge variant="outline">{analytics.statusBreakdown.expired}</Badge>
              </div>
              <Progress 
                value={totalSubscriptions > 0 ? (analytics.statusBreakdown.expired / totalSubscriptions) * 100 : 0} 
                className="[&>div]:bg-gray-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Affiliate Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Programa de Afiliados
            </CardTitle>
            <CardDescription>
              Métricas do programa de afiliados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total de Afiliados</p>
                <p className="text-2xl font-bold">{analytics.affiliateMetrics.totalAffiliates}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Comissões Pagas</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(analytics.affiliateMetrics.totalCommissionsPaid)}
                </p>
              </div>
            </div>

            {analytics.affiliateMetrics.totalAffiliates === 0 ? (
              <div className="text-center py-4">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum afiliado cadastrado ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Média por Afiliado</p>
                <p className="text-lg">
                  {formatCurrency(
                    analytics.affiliateMetrics.totalAffiliates > 0
                      ? analytics.affiliateMetrics.totalCommissionsPaid / analytics.affiliateMetrics.totalAffiliates
                      : 0
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PaymentAnalytics
