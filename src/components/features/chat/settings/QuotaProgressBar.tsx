/**
 * QuotaProgressBar Component
 * 
 * Displays progress bars for daily and monthly quotas with threshold indicators.
 * Shows warning at 80% and exceeded at 100%.
 * 
 * Requirements: 9.6, 9.7, 10.1, 10.2
 */

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface QuotaProgressBarProps {
  label: string
  icon: React.ReactNode
  daily: number
  dailyLimit: number
  monthly: number
  monthlyLimit: number
}

export function QuotaProgressBar({
  label,
  icon,
  daily,
  dailyLimit,
  monthly,
  monthlyLimit
}: QuotaProgressBarProps) {
  const dailyPercent = dailyLimit > 0 ? Math.round((daily / dailyLimit) * 100) : 0
  const monthlyPercent = monthlyLimit > 0 ? Math.round((monthly / monthlyLimit) * 100) : 0
  const maxPercent = Math.max(dailyPercent, monthlyPercent)

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-destructive'
    if (percent >= 80) return 'bg-yellow-500'
    return 'bg-primary'
  }

  const getStatusBadge = () => {
    if (maxPercent >= 100) {
      return <Badge variant="destructive" className="text-xs">Excedido</Badge>
    }
    if (maxPercent >= 80) {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
          Atenção
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Daily progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Diário</span>
          <span>{daily.toLocaleString('pt-BR')} / {dailyLimit.toLocaleString('pt-BR')}</span>
        </div>
        <div className="relative">
          <Progress 
            value={Math.min(dailyPercent, 100)} 
            className={cn("h-2", dailyPercent >= 100 && "[&>div]:bg-destructive", dailyPercent >= 80 && dailyPercent < 100 && "[&>div]:bg-yellow-500")}
          />
        </div>
      </div>

      {/* Monthly progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mensal</span>
          <span>{monthly.toLocaleString('pt-BR')} / {monthlyLimit.toLocaleString('pt-BR')}</span>
        </div>
        <div className="relative">
          <Progress 
            value={Math.min(monthlyPercent, 100)} 
            className={cn("h-2", monthlyPercent >= 100 && "[&>div]:bg-destructive", monthlyPercent >= 80 && monthlyPercent < 100 && "[&>div]:bg-yellow-500")}
          />
        </div>
      </div>
    </div>
  )
}

export default QuotaProgressBar
