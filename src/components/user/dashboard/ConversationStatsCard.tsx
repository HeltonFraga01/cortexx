/**
 * ConversationStatsCard Component
 * Displays conversation metrics with trend indicators
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, CheckCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConversationStatsProps } from '@/types/dashboard'

interface StatItemProps {
  label: string
  value: number
  previousValue?: number
  icon: React.ElementType
  iconColor: string
}

function StatItem({ label, value, previousValue, icon: Icon, iconColor }: StatItemProps) {
  const trend = previousValue !== undefined ? value - previousValue : 0
  const trendPercent = previousValue && previousValue > 0 
    ? Math.round((trend / previousValue) * 100) 
    : 0

  return (
    <div className="flex items-center gap-2">
      <div className={cn('p-1.5 rounded-lg', iconColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold">{value}</span>
          {previousValue !== undefined && trend !== 0 && (
            <div
              className={cn(
                'flex items-center text-xs',
                trend > 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              )}
              <span>{Math.abs(trendPercent)}%</span>
            </div>
          )}
          {previousValue !== undefined && trend === 0 && (
            <div className="flex items-center text-xs text-muted-foreground">
              <span>0%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatResponseTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function ConversationStatsCard({
  stats,
  previousPeriodStats,
  isLoading
}: ConversationStatsProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-1 pt-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3 pb-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-10" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Conversas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <StatItem
            label="Abertas"
            value={stats.openCount}
            previousValue={previousPeriodStats?.openCount}
            icon={MessageSquare}
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatItem
            label="Resolvidas"
            value={stats.resolvedCount}
            previousValue={previousPeriodStats?.resolvedCount}
            icon={CheckCircle}
            iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
          <StatItem
            label="Pendentes"
            value={stats.pendingCount}
            previousValue={previousPeriodStats?.pendingCount}
            icon={Clock}
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
        </div>
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
              <span className="text-sm font-semibold">
                {formatResponseTime(stats.averageResponseTimeMinutes)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ConversationStatsCard
