/**
 * WebhookConfigCardModern Component
 * Displays and allows editing of webhook configuration
 * Requirements: 7.4, 8.1
 * 
 * @deprecated Use WebhookConfigCard from '@/components/shared/inbox' instead.
 * This component will be removed in a future version.
 * 
 * Migration guide:
 * ```tsx
 * // Before
 * import { WebhookConfigCardModern } from '@/components/user/dashboard'
 * <WebhookConfigCardModern webhookUrl={url} events={events} onSave={...} />
 * 
 * // After
 * import { WebhookConfigCard, DEFAULT_AVAILABLE_EVENTS } from '@/components/shared/inbox'
 * import { adaptWebhookResponseToConfig } from '@/lib/adapters/inbox-adapters'
 * <WebhookConfigCard 
 *   config={adaptWebhookResponseToConfig(url, events)}
 *   availableEvents={DEFAULT_AVAILABLE_EVENTS}
 *   onChange={...}
 *   onSave={...}
 * />
 * ```
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  Webhook, 
  Save, 
  Settings, 
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WebhookConfigCardModernProps {
  webhookUrl: string
  subscribedEvents: string[]
  onSave: (url: string) => void
  onNavigateToSettings: () => void
  isSaving: boolean
}

export function WebhookConfigCardModern({
  webhookUrl,
  subscribedEvents,
  onSave,
  onNavigateToSettings,
  isSaving
}: WebhookConfigCardModernProps) {
  const [url, setUrl] = useState(webhookUrl)

  // Sync with prop changes
  useEffect(() => {
    setUrl(webhookUrl)
  }, [webhookUrl])

  const handleSave = () => {
    onSave(url)
  }

  const isConfigured = !!webhookUrl
  const hasEvents = subscribedEvents.length > 0

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5 text-purple-500" />
            Configuração de Webhook
          </CardTitle>
          {isConfigured ? (
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <AlertCircle className="h-3 w-3 mr-1" />
              Não configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <Label htmlFor="webhook-url" className="text-sm font-medium">
            URL do Webhook
          </Label>
          <Input
            id="webhook-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://seu-servidor.com/webhook"
            className="font-mono text-sm"
          />
        </div>

        {/* Events Info */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Eventos configurados
            </span>
            <Badge variant="secondary" className="text-xs">
              {subscribedEvents.length} evento{subscribedEvents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {hasEvents && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {subscribedEvents.slice(0, 3).join(', ')}
              {subscribedEvents.length > 3 && ` +${subscribedEvents.length - 3} mais`}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || url === webhookUrl}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToSettings}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Configurar Eventos
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default WebhookConfigCardModern
