/**
 * QuotaUsageCard - Displays user's quota usage with progress bars
 * 
 * Shows all quotas with current usage, limit, and percentage.
 * Warning state at 80%, error state at 100%.
 * 
 * Requirements: 1.3, 1.4, 6.2, 6.3, 6.4
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Gauge, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuotaStatus } from '@/services/user-subscription'

interface QuotaUsageCardProps {
  quotas: QuotaStatus[]
  onQuotaClick?: (quota: QuotaStatus) => void
  compact?: boolean
}

const QUOTA_LABELS: Record<string, string> = {
  max_agents: 'Agentes',
  max_connections: 'Conexões',
  max_messages_per_day: 'Mensagens/Dia',
  max_messages_per_month: 'Mensagens/Mês',
  max_inboxes: 'Caixas de Entrada',
  max_teams: 'Equipes',
  max_webhooks: 'Webhooks',
  max_campaigns: 'Campanhas',
  max_storage_mb: 'Armazenamento (MB)',
  max_bots: 'Bots',
  // Bot usage quotas
  max_bot_calls_per_day: 'Chamadas Bot/Dia',
  max_bot_calls_per_month: 'Chamadas Bot/Mês',
  max_bot_messages_per_day: 'Msgs Bot/Dia',
  max_bot_messages_per_month: 'Msgs Bot/Mês',
  max_bot_tokens_per_day: 'Tokens IA/Dia',
  max_bot_tokens_per_month: 'Tokens IA/Mês'
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-destructive'
  if (percentage >= 80) return 'bg-yellow-500'
  return 'bg-primary'
}

function getStatusIcon(quota: QuotaStatus) {
  if (quota.exceeded) {
    return <XCircle className="h-4 w-4 text-destructive" />
  }
  if (quota.warning) {
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  }
  return <CheckCircle className="h-4 w-4 text-green-500" />
}

function QuotaItem({ quota, onClick, compact }: { quota: QuotaStatus; onClick?: () => void; compact?: boolean }) {
  const label = QUOTA_LABELS[quota.quotaType] || quota.quotaType
  const progressColor = getProgressColor(quota.percentage)
  
  return (
    <div 
      className={cn(
        "space-y-2",
        onClick && "cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!compact && getStatusIcon(quota)}
          <span className="text-sm font-medium">{label}</span>
          {quota.source === 'override' && (
            <Badge variant="outline" className="text-xs">Override</Badge>
          )}
        </div>
        <span className={cn(
          "text-sm",
          quota.exceeded && "text-destructive font-medium",
          quota.warning && !quota.exceeded && "text-yellow-600 font-medium"
        )}>
          {quota.currentUsage} / {quota.limit}
        </span>
      </div>
      <div className="relative">
        <Progress 
          value={Math.min(quota.percentage, 100)} 
          className="h-2"
        />
        <div 
          className={cn(
            "absolute inset-0 h-2 rounded-full transition-all",
            progressColor
          )}
          style={{ width: `${Math.min(quota.percentage, 100)}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{quota.percentage}% utilizado</span>
          <span>{quota.limit - quota.currentUsage} restante</span>
        </div>
      )}
    </div>
  )
}

export function QuotaUsageCard({ quotas, onQuotaClick, compact = false }: QuotaUsageCardProps) {
  const warningCount = quotas.filter(q => q.warning && !q.exceeded).length
  const exceededCount = quotas.filter(q => q.exceeded).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Uso de Recursos
          </CardTitle>
          <div className="flex gap-2">
            {exceededCount > 0 && (
              <Badge variant="destructive">{exceededCount} excedido(s)</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                {warningCount} alerta(s)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "space-y-4",
          compact && "space-y-3"
        )}>
          {quotas.map((quota) => (
            <QuotaItem
              key={quota.quotaType}
              quota={quota}
              onClick={onQuotaClick ? () => onQuotaClick(quota) : undefined}
              compact={compact}
            />
          ))}
        </div>
        
        {quotas.length === 0 && (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma quota configurada.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact version for dashboard summary
 */
export function QuotaSummaryCard({ quotas }: { quotas: QuotaStatus[] }) {
  const keyQuotas = quotas.filter(q => 
    ['max_messages_per_day', 'max_agents', 'max_connections'].includes(q.quotaType)
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Quotas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {keyQuotas.map((quota) => (
          <QuotaItem key={quota.quotaType} quota={quota} compact />
        ))}
      </CardContent>
    </Card>
  )
}

export default QuotaUsageCard
