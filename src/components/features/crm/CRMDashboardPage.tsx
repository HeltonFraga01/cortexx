/**
 * CRMDashboardPage Component
 * 
 * Analytics dashboard with CRM metrics, charts, and top contacts.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4 (Contact CRM Evolution)
 */

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  Activity,
  TrendingUp,
  DollarSign,
  UserCheck,
  UserX,
  Thermometer,
  Crown,
  Flame,
  Snowflake
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/services/purchaseService'
import * as contactCRMService from '@/services/contactCRMService'
import * as purchaseService from '@/services/purchaseService'
import * as creditService from '@/services/creditService'
import type { LeadTier } from '@/types/crm'

const tierConfig: Record<LeadTier, { icon: typeof Snowflake; label: string; color: string; bgColor: string }> = {
  cold: { icon: Snowflake, label: 'Frios', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  warm: { icon: Thermometer, label: 'Mornos', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  hot: { icon: Flame, label: 'Quentes', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  vip: { icon: Crown, label: 'VIP', color: 'text-purple-600', bgColor: 'bg-purple-100' }
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: typeof Users
  iconColor?: string
  trend?: { value: number; direction: 'up' | 'down' }
  isLoading?: boolean
}

function MetricCard({ title, value, icon: Icon, iconColor = 'text-primary', trend, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="text-right space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={cn('p-3 rounded-full', iconColor.replace('text-', 'bg-').replace('600', '100'))}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p className={cn(
                'text-xs',
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CRMDashboardPage() {
  // Fetch lead score distribution
  const { data: scoreDistribution, isLoading: distributionLoading } = useQuery({
    queryKey: ['lead-score-distribution'],
    queryFn: () => contactCRMService.getLeadScoreDistribution()
  })

  // Fetch opt-in stats
  const { data: optInStats, isLoading: optInLoading } = useQuery({
    queryKey: ['opt-in-stats'],
    queryFn: () => contactCRMService.getOptInStats()
  })

  // Fetch purchase stats
  const { data: purchaseStats, isLoading: purchaseLoading } = useQuery({
    queryKey: ['purchase-stats'],
    queryFn: () => purchaseService.getPurchaseStats()
  })

  // Fetch top customers
  const { data: topCustomers, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['top-customers'],
    queryFn: () => purchaseService.getTopCustomers(5)
  })

  // Fetch credit summary
  const { data: creditSummary, isLoading: creditLoading } = useQuery({
    queryKey: ['credit-summary'],
    queryFn: () => creditService.getCreditSummary()
  })

  // Calculate totals
  const totalContacts = scoreDistribution
    ? scoreDistribution.cold + scoreDistribution.warm + scoreDistribution.hot + scoreDistribution.vip
    : 0

  const isLoading = distributionLoading || optInLoading || purchaseLoading

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Dashboard CRM</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral dos seus contatos e métricas de engajamento
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Contatos"
          value={totalContacts}
          icon={Users}
          iconColor="text-blue-600"
          isLoading={distributionLoading}
        />
        <MetricCard
          title="Contatos Ativos"
          value={optInStats?.optedIn || 0}
          icon={UserCheck}
          iconColor="text-green-600"
          isLoading={optInLoading}
        />
        <MetricCard
          title="LTV Total"
          value={formatCurrency(purchaseStats?.totalRevenueCents || 0)}
          icon={DollarSign}
          iconColor="text-emerald-600"
          isLoading={purchaseLoading}
        />
        <MetricCard
          title="Ticket Médio"
          value={formatCurrency(purchaseStats?.averageOrderValueCents || 0)}
          icon={TrendingUp}
          iconColor="text-purple-600"
          isLoading={purchaseLoading}
        />
      </div>

      {/* Lead Score Distribution & Opt-in Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Distribuição por Lead Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributionLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : scoreDistribution ? (
              <div className="space-y-4">
                {(Object.entries(tierConfig) as [LeadTier, typeof tierConfig.cold][]).map(([tier, config]) => {
                  const count = scoreDistribution[tier] || 0
                  const percentage = totalContacts > 0 ? (count / totalContacts) * 100 : 0
                  const Icon = config.icon

                  return (
                    <div key={tier} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1.5 rounded', config.bgColor)}>
                            <Icon className={cn('h-4 w-4', config.color)} />
                          </div>
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{count}</Badge>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </CardContent>
        </Card>

        {/* Opt-in Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Preferências de Comunicação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {optInLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-12" />
              </div>
            ) : optInStats ? (
              <div className="space-y-6">
                {/* Opt-in Rate */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <UserCheck className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">
                        {optInStats.optedIn}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Opt-in</p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <UserX className="h-5 w-5 text-red-600" />
                      <span className="text-2xl font-bold text-red-600">
                        {optInStats.optedOut}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Opt-out</p>
                  </div>
                </div>

                {/* Rate Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de Opt-in</span>
                    <span className="font-medium">{(optInStats.optInRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={optInStats.optInRate * 100} className="h-3" />
                </div>

                {/* Opt-out by Method */}
                {Object.keys(optInStats.optOutByMethod).length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Opt-out por método
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(optInStats.optOutByMethod).map(([method, count]) => (
                        <Badge key={method} variant="outline">
                          {method === 'keyword' ? 'Palavra-chave' : 
                           method === 'manual' ? 'Manual' : method}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Customers & Credit Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Top Clientes por LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : topCustomers && topCustomers.length > 0 ? (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {customer.name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {formatCurrency(customer.lifetimeValueCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.purchaseCount} compra{customer.purchaseCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum cliente com compras
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credit Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumo de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-16" />
              </div>
            ) : creditSummary ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-muted-foreground mb-1">Saldo Total</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {creditService.formatCredits(creditSummary.totalBalance)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Contatos com Créditos</p>
                    <p className="text-2xl font-bold">
                      {creditSummary.contactsWithCredits}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Adicionados (mês)</p>
                    <p className="text-lg font-semibold text-green-600">
                      +{creditService.formatCredits(creditSummary.monthlyCreditsAdded)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Consumidos (mês)</p>
                    <p className="text-lg font-semibold text-red-600">
                      -{creditService.formatCredits(creditSummary.monthlyCreditsConsumed)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CRMDashboardPage
