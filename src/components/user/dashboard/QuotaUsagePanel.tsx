/**
 * QuotaUsagePanel Component
 * Displays quota progress bars with threshold styling and subscription info
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Gauge, CreditCard, Calendar, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuotaUsagePanelProps, QuotaStatus } from '@/types/dashboard'

function QuotaItem({ quota }: { quota: QuotaStatus }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{quota.label}</span>
        <span className={cn(
          'font-medium',
          quota.status === 'danger' && 'text-red-600',
          quota.status === 'warning' && 'text-orange-600'
        )}>
          {quota.used}/{quota.limit}
        </span>
      </div>
      <Progress
        value={Math.min(quota.percentage, 100)}
        className={cn(
          'h-1.5',
          quota.status === 'danger' && '[&>div]:bg-red-500',
          quota.status === 'warning' && '[&>div]:bg-orange-500'
        )}
      />
    </div>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function QuotaUsagePanel({
  quotas,
  subscription,
  creditBalance,
  isLoading
}: QuotaUsagePanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-2 px-3">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="px-3 pb-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const statusBadge = {
    active: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
    trial: { label: 'Trial', color: 'bg-blue-100 text-blue-800' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    expired: { label: 'Expirado', color: 'bg-gray-100 text-gray-800' }
  }

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          Uso e Limites
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2 space-y-2">
        {/* Subscription info */}
        {subscription && (
          <div className="p-2 rounded-md bg-muted/50 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-xs">{subscription.planName}</span>
              </div>
              <Badge className={cn('text-[10px] px-1.5 py-0', statusBadge[subscription.status]?.color || 'bg-gray-100')}>
                {statusBadge[subscription.status]?.label || subscription.status}
              </Badge>
            </div>
            {subscription.renewalDate && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                <span>Renovação: {formatDate(subscription.renewalDate)}</span>
              </div>
            )}
          </div>
        )}

        {/* Credit balance */}
        {creditBalance > 0 && (
          <div className="flex items-center justify-between p-2 rounded-md bg-primary/5">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3 w-3 text-primary" />
              <span className="text-xs">Créditos</span>
            </div>
            <span className="font-bold text-xs text-primary">
              {creditBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}

        {/* Quotas */}
        {quotas.length > 0 ? (
          <div className="space-y-2">
            {quotas.map((quota) => (
              <QuotaItem key={quota.key} quota={quota} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma quota configurada
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default QuotaUsagePanel
