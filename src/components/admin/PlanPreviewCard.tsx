/**
 * PlanPreviewCard Component
 * 
 * Displays a preview card for a subscription plan with features and pricing.
 * Used in plan assignment dialogs and plan selection interfaces.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, X, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Plan, PlanFeatures } from '@/types/admin-management'

interface PlanPreviewCardProps {
  plan: Plan
  selected?: boolean
  onSelect?: (planId: string) => void
  showFeatures?: boolean
  compact?: boolean
}

// Feature labels in Portuguese
const featureLabels: Record<keyof PlanFeatures, string> = {
  bulk_campaigns: 'Campanhas em Massa',
  nocodb_integration: 'Integração NocoDB',
  bot_automation: 'Automação com Bots',
  advanced_reports: 'Relatórios Avançados',
  api_access: 'Acesso à API',
  webhooks: 'Webhooks',
  scheduled_messages: 'Mensagens Agendadas',
  media_storage: 'Armazenamento de Mídia'
}

export function PlanPreviewCard({
  plan,
  selected = false,
  onSelect,
  showFeatures = true,
  compact = false
}: PlanPreviewCardProps) {
  const formatPrice = (cents: number, cycle: string) => {
    if (cents === 0) return 'Grátis'
    const price = (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
    const cycleLabel = cycle === 'monthly' ? '/mês' : cycle === 'yearly' ? '/ano' : ''
    return `${price}${cycleLabel}`
  }

  const handleClick = () => {
    if (onSelect) {
      onSelect(plan.id)
    }
  }

  // Get features as array for display
  const featureEntries = Object.entries(plan.features || {}) as [keyof PlanFeatures, boolean][]

  return (
    <Card
      className={cn(
        'transition-all cursor-pointer hover:shadow-md',
        selected && 'ring-2 ring-primary border-primary bg-primary/5',
        !selected && 'hover:border-primary/50',
        compact && 'p-2'
      )}
      onClick={handleClick}
    >
      <CardHeader className={cn('pb-2', compact && 'p-3 pb-1')}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className={cn('text-lg', compact && 'text-base')}>
              {plan.name}
            </CardTitle>
            {plan.isDefault && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          {selected && (
            <Badge variant="default" className="bg-primary">
              Selecionado
            </Badge>
          )}
        </div>
        {plan.description && !compact && (
          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
        )}
      </CardHeader>
      <CardContent className={cn(compact && 'p-3 pt-0')}>
        {/* Price */}
        <div className="mb-3">
          <span className={cn(
            'font-bold',
            plan.priceCents === 0 ? 'text-green-600' : 'text-foreground',
            compact ? 'text-lg' : 'text-2xl'
          )}>
            {formatPrice(plan.priceCents, plan.billingCycle)}
          </span>
        </div>

        {/* Quotas summary */}
        {!compact && (
          <div className="grid grid-cols-2 gap-2 mb-3 text-sm text-muted-foreground">
            <div>{plan.quotas.maxAgents} agentes</div>
            <div>{plan.quotas.maxBots ?? 0} bots</div>
            <div>{plan.quotas.maxInboxes} inboxes</div>
            <div>{plan.quotas.maxMessagesPerMonth.toLocaleString()} msg/mês</div>
          </div>
        )}

        {/* Features list */}
        {showFeatures && !compact && featureEntries.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recursos incluídos:</p>
            <div className="grid grid-cols-1 gap-1">
              {featureEntries.map(([key, enabled]) => (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    enabled ? 'text-foreground' : 'text-muted-foreground/50'
                  )}
                >
                  {enabled ? (
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <span className={cn(!enabled && 'line-through')}>
                    {featureLabels[key] || key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact features count */}
        {compact && featureEntries.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {featureEntries.filter(([, enabled]) => enabled).length} recursos incluídos
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PlanPreviewCard
