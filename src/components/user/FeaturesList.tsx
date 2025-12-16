/**
 * FeaturesList - Displays user's available features
 * 
 * Shows all features with enabled/disabled status.
 * Lock icon for disabled features, override indicator.
 * 
 * Requirements: 1.5, 7.1, 7.2, 7.4
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Lock, Sparkles, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserFeature } from '@/types/admin-management'

interface FeaturesListProps {
  features: UserFeature[]
  onUpgrade?: () => void
}

// Only user features - admin features and removed features are excluded
const FEATURE_LABELS: Record<string, { name: string; description: string }> = {
  bulk_campaigns: {
    name: 'Campanhas em Massa',
    description: 'Envie mensagens para múltiplos contatos'
  },
  nocodb_integration: {
    name: 'Integração NocoDB',
    description: 'Conecte seu banco de dados externo'
  },
  bot_automation: {
    name: 'Automação de Bot',
    description: 'Configure respostas automáticas'
  },
  advanced_reports: {
    name: 'Relatórios Avançados',
    description: 'Acesse métricas detalhadas'
  },
  api_access: {
    name: 'Acesso à API',
    description: 'Integre via API REST'
  },
  webhooks: {
    name: 'Webhooks',
    description: 'Receba notificações em tempo real'
  },
  scheduled_messages: {
    name: 'Mensagens Agendadas',
    description: 'Agende envios para o futuro'
  },
  media_storage: {
    name: 'Armazenamento de Mídia',
    description: 'Armazene imagens e arquivos'
  }
}

function FeatureItem({ feature }: { feature: UserFeature }) {
  const info = FEATURE_LABELS[feature.featureName] || {
    name: feature.featureName,
    description: ''
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      feature.enabled ? "bg-background" : "bg-muted/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          feature.enabled ? "bg-primary/10" : "bg-muted"
        )}>
          {feature.enabled ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className={cn(
            "font-medium",
            !feature.enabled && "text-muted-foreground"
          )}>
            {info.name}
          </p>
          {info.description && (
            <p className="text-xs text-muted-foreground">{info.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {feature.source === 'override' && (
          <Badge variant="outline" className="text-xs">Override</Badge>
        )}
        <Badge variant={feature.enabled ? 'default' : 'secondary'}>
          {feature.enabled ? 'Ativo' : 'Bloqueado'}
        </Badge>
      </div>
    </div>
  )
}

export function FeaturesList({ features, onUpgrade }: FeaturesListProps) {
  const enabledCount = features.filter(f => f.enabled).length
  const totalCount = features.length

  // Separate enabled and disabled features
  const enabledFeatures = features.filter(f => f.enabled)
  const disabledFeatures = features.filter(f => !f.enabled)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Funcionalidades
          </CardTitle>
          <Badge variant="outline">
            {enabledCount} / {totalCount} ativas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabledFeatures.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Disponíveis</p>
            <div className="space-y-2">
              {enabledFeatures.map((feature) => (
                <FeatureItem key={feature.featureName} feature={feature} />
              ))}
            </div>
          </div>
        )}

        {disabledFeatures.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Bloqueadas no seu plano</p>
            <div className="space-y-2">
              {disabledFeatures.map((feature) => (
                <FeatureItem key={feature.featureName} feature={feature} />
              ))}
            </div>
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="w-full mt-2 p-3 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-sm font-medium">Fazer upgrade para desbloquear</span>
              </button>
            )}
          </div>
        )}

        {features.length === 0 && (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma funcionalidade configurada.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default FeaturesList
