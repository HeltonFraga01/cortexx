/**
 * UserFeaturesCard Component
 * 
 * Displays features with toggle for overrides.
 * Requirements: 4.4
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { adminFeaturesService } from '@/services/admin-features'
import type { UserFeature, UserFeatureName } from '@/types/admin-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Puzzle, X } from 'lucide-react'

interface UserFeaturesCardProps {
  userId: string
  features: UserFeature[]
  onUpdate?: () => void
}

// Only user features - admin features (page_builder, custom_branding) are not shown
const featureLabels: Record<UserFeatureName, string> = {
  bulk_campaigns: 'Campanhas em Massa',
  nocodb_integration: 'Integração NocoDB',
  bot_automation: 'Automação de Bots',
  advanced_reports: 'Relatórios Avançados',
  api_access: 'Acesso à API',
  webhooks: 'Webhooks',
  scheduled_messages: 'Mensagens Agendadas',
  media_storage: 'Armazenamento de Mídia',
}

export function UserFeaturesCard({ userId, features, onUpdate }: UserFeaturesCardProps) {
  const [loadingFeature, setLoadingFeature] = useState<string | null>(null)

  const handleToggleFeature = async (feature: UserFeature) => {
    try {
      setLoadingFeature(feature.featureName)
      await adminFeaturesService.setFeatureOverride(userId, feature.featureName, {
        enabled: !feature.enabled
      })
      toast.success('Feature atualizada')
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar feature')
    } finally {
      setLoadingFeature(null)
    }
  }

  const handleRemoveOverride = async (featureName: UserFeatureName) => {
    try {
      setLoadingFeature(featureName)
      await adminFeaturesService.removeFeatureOverride(userId, featureName)
      toast.success('Override removido')
      onUpdate?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao remover override')
    } finally {
      setLoadingFeature(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-5 w-5" />
          Funcionalidades
        </CardTitle>
        <CardDescription>Features habilitadas para este usuário</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma feature configurada</p>
        ) : (
          features.map((feature) => (
            <div
              key={feature.featureName}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {featureLabels[feature.featureName] || feature.featureName}
                </span>
                {feature.source === 'override' && (
                  <Badge variant="outline" className="text-xs">Override</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={feature.enabled}
                  onCheckedChange={() => handleToggleFeature(feature)}
                  disabled={loadingFeature === feature.featureName}
                />
                {feature.source === 'override' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => handleRemoveOverride(feature.featureName)}
                    disabled={loadingFeature === feature.featureName}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
