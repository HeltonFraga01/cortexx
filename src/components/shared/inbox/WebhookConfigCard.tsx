/**
 * WebhookConfigCard Component
 * 
 * Displays webhook URL input and event selection.
 * Shared between admin edit page and user dashboard.
 * 
 * Requirements: 3.1-3.8
 */

import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Webhook,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  MessageSquare,
  Users,
  Radio,
  Settings,
  RefreshCw,
  Phone,
  Link,
  Zap,
  Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebhookConfigCardProps, AvailableEvent } from './types'
import { getEventCategories, getEventsByCategory, DEFAULT_AVAILABLE_EVENTS } from './types'

/**
 * Category icons mapping
 */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Mensagens': <MessageSquare className="h-4 w-4 text-blue-500" />,
  'Grupos': <Users className="h-4 w-4 text-green-500" />,
  'Newsletter': <Radio className="h-4 w-4 text-purple-500" />,
  'Presença': <Radio className="h-4 w-4 text-emerald-500" />,
  'Sistema': <Settings className="h-4 w-4 text-gray-500" />,
  'Sincronização': <RefreshCw className="h-4 w-4 text-orange-500" />,
  'Chamadas': <Phone className="h-4 w-4 text-red-500" />,
  'Conexão': <Link className="h-4 w-4 text-cyan-500" />,
  'Keep Alive': <Zap className="h-4 w-4 text-yellow-500" />,
  'Pairing': <Link className="h-4 w-4 text-indigo-500" />,
  'Outros': <Settings className="h-4 w-4 text-gray-400" />
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return true // Empty is valid
  
  const trimmed = url.trim()
  if (!trimmed) return true
  
  try {
    const urlObj = new URL(trimmed)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

export function WebhookConfigCard({
  config,
  availableEvents = DEFAULT_AVAILABLE_EVENTS,
  onChange,
  onSave,
  isLoading = false,
  readOnly = false,
  hasChanges = false,
  className
}: WebhookConfigCardProps) {
  // Iniciar com todas as categorias expandidas por padrão
  const categories = useMemo(() => getEventCategories(availableEvents), [availableEvents])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(categories))
  const [urlError, setUrlError] = useState<string | null>(null)

  // Atualizar categorias expandidas quando availableEvents mudar
  useEffect(() => {
    setExpandedCategories(new Set(categories))
  }, [categories])

  // Check if "All" is selected - only true if explicitly set to 'All'
  const isAllSelected = config.events.includes('All')

  // Count selected events
  const selectedCount = isAllSelected 
    ? availableEvents.length 
    : config.events.filter(e => e !== 'All').length

  /**
   * Handle URL change with validation
   */
  const handleUrlChange = (value: string) => {
    if (!onChange) return
    
    // Validate URL
    if (value && !isValidUrl(value)) {
      setUrlError('URL inválida. Deve começar com http:// ou https://')
    } else {
      setUrlError(null)
    }
    
    onChange({ ...config, webhookUrl: value })
  }

  /**
   * Toggle "All Events" selection
   */
  const handleToggleAll = () => {
    if (!onChange) return
    
    if (isAllSelected) {
      onChange({ ...config, events: [] })
    } else {
      onChange({ ...config, events: ['All'] })
    }
  }

  /**
   * Toggle individual event
   */
  const handleToggleEvent = (eventValue: string) => {
    if (!onChange) return
    
    const currentEvents = config.events.filter(e => e !== 'All')
    
    if (currentEvents.includes(eventValue)) {
      onChange({ 
        ...config, 
        events: currentEvents.filter(e => e !== eventValue) 
      })
    } else {
      onChange({ 
        ...config, 
        events: [...currentEvents, eventValue] 
      })
    }
  }

  /**
   * Check if event is selected
   */
  const isEventSelected = (eventValue: string): boolean => {
    if (isAllSelected) return true
    return config.events.includes(eventValue)
  }

  /**
   * Toggle category expansion
   */
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  /**
   * Handle save with validation
   */
  const handleSave = () => {
    if (!onSave) return
    
    // Validate URL before saving
    if (config.webhookUrl && !isValidUrl(config.webhookUrl)) {
      setUrlError('URL inválida. Corrija antes de salvar.')
      return
    }
    
    onSave()
  }

  // Verificar se webhook está configurado
  const isWebhookConfigured = config.webhookUrl && config.webhookUrl.trim() !== ''

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Configuração de Webhook
            </CardTitle>
            <CardDescription>
              Configure o webhook para receber eventos do WhatsApp em tempo real
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-2">
          <Label htmlFor="webhook-url" className="text-sm font-medium">
            URL do Webhook
          </Label>
          <Input
            id="webhook-url"
            type="url"
            value={config.webhookUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://seu-servidor.com/webhook"
            disabled={readOnly || isLoading}
            className={cn(urlError && "border-destructive focus:border-destructive")}
          />
          {urlError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {urlError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            URL onde os eventos do WhatsApp serão enviados via POST
          </p>
        </div>

        {/* Eventos para Receber */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Eventos para Receber</Label>
            <Badge variant="outline" className="text-xs">
              {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* All Events Toggle */}
          <div className="flex items-center space-x-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Checkbox
              id="all-events"
              checked={isAllSelected}
              onCheckedChange={handleToggleAll}
              disabled={readOnly || isLoading}
              className="border-primary data-[state=checked]:bg-primary"
            />
            <Star className="h-4 w-4 text-yellow-500" />
            <div className="flex-1">
              <Label 
                htmlFor="all-events" 
                className="text-sm font-medium cursor-pointer"
              >
                Todos os Eventos
              </Label>
              <p className="text-xs text-muted-foreground">
                Receber todos os 50+ tipos de eventos disponíveis automaticamente
              </p>
            </div>
          </div>

          {/* Event Categories - Always visible */}
          <div className="border rounded-lg divide-y">
            {categories.map(category => {
              const categoryEvents = getEventsByCategory(availableEvents, category)
              const selectedInCategory = categoryEvents.filter(e => 
                isAllSelected || config.events.includes(e.value)
              ).length
              const isExpanded = expandedCategories.has(category)
              const categoryIcon = CATEGORY_ICONS[category] || <Settings className="h-4 w-4 text-gray-400" />

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    disabled={readOnly || isLoading}
                    className={cn(
                      "w-full flex items-center justify-between p-3 text-left",
                      "hover:bg-muted/50 transition-colors",
                      (readOnly || isLoading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {categoryIcon}
                      <span className="text-sm font-medium">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedInCategory > 0 && (
                        <Badge 
                          variant={selectedInCategory === categoryEvents.length ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          {selectedInCategory}/{categoryEvents.length}
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Category Events */}
                  {isExpanded && (
                    <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/20">
                      {categoryEvents.map(event => (
                        <div 
                          key={event.value}
                          className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`event-${event.value}`}
                            checked={isEventSelected(event.value)}
                            onCheckedChange={() => handleToggleEvent(event.value)}
                            disabled={readOnly || isLoading || isAllSelected}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <Label 
                              htmlFor={`event-${event.value}`}
                              className={cn(
                                "text-sm cursor-pointer block",
                                isAllSelected && "text-muted-foreground"
                              )}
                            >
                              {event.label}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Save Button */}
        {onSave && !readOnly && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || !hasChanges || !!urlError}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Webhook
            </Button>
          </div>
        )}
      </CardContent>

      {/* Footer - Webhook Status */}
      {isWebhookConfigured && (
        <CardFooter className="bg-green-500/10 border-t border-green-500/20">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Webhook configurado</span>
            <span className="text-xs text-muted-foreground">
              Seu webhook receberá notificações em tempo real para os eventos selecionados
            </span>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

export default WebhookConfigCard
