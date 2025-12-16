import { cn } from '@/lib/utils'
import { CardContent } from '@/components/ui/card'
import { GradientCard, getIconClasses, type GradientVariant } from './GradientCard'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { ComponentType } from 'react'

export interface StatsCardProps {
  /** Card title/label */
  title: string
  /** Main value to display */
  value: string | number
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>
  /** Color variant for gradient and icon */
  variant: GradientVariant
  /** Optional trend indicator */
  trend?: {
    value: number
    isPositive: boolean
  }
  /** Additional CSS classes */
  className?: string
}

/**
 * StatsCard Component
 * 
 * A statistics card with gradient background, icon, title, value and optional trend.
 * Uses GradientCard as base for consistent styling.
 * 
 * @example
 * ```tsx
 * <StatsCard
 *   title="Total Revenue"
 *   value="R$ 5.000,00"
 *   icon={DollarSign}
 *   variant="green"
 *   trend={{ value: 12.5, isPositive: true }}
 * />
 * ```
 */
export function StatsCard({
  title,
  value,
  icon: Icon,
  variant,
  trend,
  className,
}: StatsCardProps) {
  const iconClasses = getIconClasses(variant)

  return (
    <GradientCard variant={variant} className={className}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 text-xs">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={cn(
                  trend.isPositive ? 'text-green-500' : 'text-red-500'
                )}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', iconClasses)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </GradientCard>
  )
}

export default StatsCard
