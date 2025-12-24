/**
 * WebhookConfigCard Component
 * 
 * Displays webhook URL input and event selection.
 * Shared between admin edit page and user dashboard.
 * 
 * Requirements: 3.1-3.8
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Globe, 
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebhookConfigCardProps, AvailableEvent } from './types'
import { getEventCategories, getEventsByCategory, DEFAULT_AVAILABLE_EVENTS } from './types'

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [urlError, setUrlError] = useState<string | null>(null)

  // Get unique categories
  const categories = useMemo(() => getEventCategories(availableEvents), [availableEvents])

  // Check if "All" is selected
  const isAllSelected = config.events.includes('All') || config.events.length === 0

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

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuração de Webhook
            </CardTitle>
            <CardDescription>
              Configure a URL e eventos para receber notificações
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {selectedCount} evento{selectedCount !== 1 ? 's' : ''}
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
            Deixe vazio para desativar o webhook
          </p>
        </div>

        {/* All Events Toggle */}
        <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="all-events"
            checked={isAllSelected}
            onCheckedChange={handleToggleAll}
            disabled={readOnly || isLoading}
          />
          <Label 
            htmlFor="all-events" 
            className="text-sm font-medium cursor-pointer flex-1"
          >
            Todos os Eventos
          </Label>
          <Badge variant="outline" className="text-xs">
            {availableEvents.length} eventos
          </Badge>
        </div>

        {/* Event Categories */}
        {!isAllSelected && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Eventos Selecionados</Label>
            <div className="border rounded-lg divide-y">
              {categories.map(category => {
                const categoryEvents = getEventsByCategory(availableEvents, category)
                const selectedInCategory = categoryEvents.filter(e => 
                  config.events.includes(e.value)
                ).length
                const isExpanded = expandedCategories.has(category)

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
                      <span className="text-sm font-medium">{category}</span>
                      <div className="flex items-center gap-2">
                        {selectedInCategory > 0 && (
                          <Badge variant="secondary" className="text-xs">
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
                      <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {categoryEvents.map(event => (
                          <div 
                            key={event.value}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`event-${event.value}`}
                              checked={isEventSelected(event.value)}
                              onCheckedChange={() => handleToggleEvent(event.value)}
                              disabled={readOnly || isLoading}
                            />
                            <Label 
                              htmlFor={`event-${event.value}`}
                              className="text-xs cursor-pointer"
                            >
                              {event.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
    </Card>
  )
}

export default WebhookConfigCard
