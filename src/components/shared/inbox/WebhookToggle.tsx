/**
 * WebhookToggle Component
 * 
 * Toggle global para habilitar/desabilitar webhooks com summary de eventos.
 * 
 * Features:
 * - Switch para habilitar/desabilitar
 * - Badge com contagem de eventos selecionados
 * - Descrição contextual baseada no estado
 */

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Webhook } from 'lucide-react'

interface WebhookToggleProps {
  /** Se webhooks estão habilitados */
  enabled: boolean
  /** Callback quando o toggle muda */
  onChange: (enabled: boolean) => void
  /** Número de eventos selecionados */
  eventCount: number
  /** Total de eventos disponíveis */
  totalEvents?: number
  /** Se está carregando */
  isLoading?: boolean
  /** Classes adicionais */
  className?: string
}

export function WebhookToggle({ 
  enabled, 
  onChange, 
  eventCount,
  totalEvents = 46,
  isLoading = false,
  className 
}: WebhookToggleProps) {
  const isAllEvents = eventCount === 0 || eventCount === totalEvents

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-colors",
      enabled 
        ? "bg-primary/5 border-primary/20" 
        : "bg-muted/30 border-muted",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          enabled ? "bg-primary/10" : "bg-muted"
        )}>
          <Webhook className={cn(
            "h-5 w-5",
            enabled ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label 
              htmlFor="webhook-toggle" 
              className="text-base font-medium cursor-pointer"
            >
              Webhooks
            </Label>
            {enabled && (
              <Badge 
                variant={isAllEvents ? "default" : "secondary"} 
                className="text-xs"
              >
                {isAllEvents 
                  ? `Todos (${totalEvents})` 
                  : `${eventCount} eventos`
                }
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {enabled 
              ? isAllEvents
                ? 'Todos os eventos serão enviados para o webhook configurado'
                : `${eventCount} eventos selecionados serão enviados`
              : 'Nenhum evento será enviado para webhooks'
            }
          </p>
        </div>
      </div>

      <Switch 
        id="webhook-toggle"
        checked={enabled} 
        onCheckedChange={onChange}
        disabled={isLoading}
      />
    </div>
  )
}

export default WebhookToggle
