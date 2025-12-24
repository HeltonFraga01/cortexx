/**
 * SupabaseUserQuotaCard
 * 
 * Displays user quota usage with progress bars and plan limits.
 * Requirements: 2.4
 */

import { BarChart3, MessageSquare, Bot, Megaphone, Users, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { QuotaUsageItem, UserSubscription } from '@/types/supabase-user'

interface SupabaseUserQuotaCardProps {
  quotas: Record<string, QuotaUsageItem>
  planLimits: Record<string, number>
  subscription: UserSubscription | null
}

const QUOTA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  messages: { label: 'Mensagens', icon: MessageSquare, color: 'bg-blue-500' },
  bots: { label: 'Bots', icon: Bot, color: 'bg-purple-500' },
  campaigns: { label: 'Campanhas', icon: Megaphone, color: 'bg-green-500' },
  contacts: { label: 'Contatos', icon: Users, color: 'bg-orange-500' },
  templates: { label: 'Templates', icon: FileText, color: 'bg-pink-500' },
  agents: { label: 'Agentes', icon: Users, color: 'bg-indigo-500' },
  inboxes: { label: 'Inboxes', icon: MessageSquare, color: 'bg-teal-500' }
}

export function SupabaseUserQuotaCard({ quotas, planLimits, subscription }: SupabaseUserQuotaCardProps) {
  const hasQuotas = Object.keys(quotas).length > 0 || Object.keys(planLimits).length > 0
  
  // Merge quotas with plan limits to show all available quotas
  const allQuotaKeys = new Set([...Object.keys(quotas), ...Object.keys(planLimits)])
  
  const getQuotaPercentage = (key: string) => {
    const used = quotas[key]?.used || 0
    const limit = planLimits[key] || 0
    if (limit === 0 || limit === -1) return 0 // -1 means unlimited
    return Math.min(Math.round((used / limit) * 100), 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formatLimit = (limit: number) => {
    if (limit === -1) return 'Ilimitado'
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(1)}M`
    if (limit >= 1000) return `${(limit / 1000).toFixed(1)}K`
    return limit.toString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Uso de Quotas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasQuotas ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma quota configurada
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(allQuotaKeys).map((key) => {
              const config = QUOTA_CONFIG[key] || { 
                label: key.charAt(0).toUpperCase() + key.slice(1), 
                icon: BarChart3, 
                color: 'bg-gray-500' 
              }
              const Icon = config.icon
              const used = quotas[key]?.used || 0
              const limit = planLimits[key] || 0
              const percentage = getQuotaPercentage(key)
              const isUnlimited = limit === -1

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {used.toLocaleString('pt-BR')} / {formatLimit(limit)}
                    </span>
                  </div>
                  {!isUnlimited && limit > 0 && (
                    <div className="relative">
                      <Progress 
                        value={percentage} 
                        className="h-2"
                      />
                      <div 
                        className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(percentage)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                  {isUnlimited && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-green-500/20 to-green-500/40" />
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* Plan info */}
            {subscription?.plan && (
              <div className="pt-4 mt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Plano: <span className="font-medium">{subscription.plan.name}</span>
                </p>
                {subscription.current_period_end && (
                  <p className="text-xs text-muted-foreground">
                    Renova em: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
