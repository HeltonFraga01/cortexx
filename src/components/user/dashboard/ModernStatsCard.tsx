/**
 * ModernStatsCard Component
 * Displays a metric with colored icon, value, and optional trend indicator
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.2
 */

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type StatsColorVariant = 'blue' | 'green' | 'orange' | 'purple' | 'red'

interface TrendData {
  value: number
  direction: 'up' | 'down' | 'neutral'
}

export interface ModernStatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColor: StatsColorVariant
  trend?: TrendData
  isLoading?: boolean
  className?: string
}

const colorMap: Record<StatsColorVariant, { bg: string; text: string }> = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400'
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400'
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400'
  }
}

export function ModernStatsCard({
  title,
  value,
  icon: Icon,
  iconColor,
  trend,
  isLoading = false,
  className
}: ModernStatsCardProps) {
  const colors = colorMap[iconColor]

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-lg', colors.bg)}>
            <Icon className={cn('h-6 w-6', colors.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              </span>
              {trend && trend.direction !== 'neutral' && (
                <div
                  className={cn(
                    'flex items-center text-xs font-medium',
                    trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 mr-0.5" />
                  )}
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ModernStatsCard
