/**
 * ContactTimeline Component
 * 
 * Unified activity feed showing all contact interactions.
 * Supports filtering by event type and pagination.
 * 
 * Requirements: 1.3, 8.5 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  MessageSquare,
  Phone,
  Mail,
  StickyNote,
  RefreshCw,
  ShoppingCart,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineEvent, TimelineEventType } from '@/types/crm'

interface ContactTimelineProps {
  events: TimelineEvent[]
  total: number
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  onFilterChange?: (types: TimelineEventType[] | undefined) => void
  selectedTypes?: TimelineEventType[]
}

const eventConfig: Record<TimelineEventType, {
  icon: typeof MessageSquare
  label: string
  color: string
  bgColor: string
}> = {
  message: { icon: MessageSquare, label: 'Mensagem', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  call: { icon: Phone, label: 'Ligação', color: 'text-green-600', bgColor: 'bg-green-100' },
  email: { icon: Mail, label: 'Email', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  note: { icon: StickyNote, label: 'Nota', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  status_change: { icon: RefreshCw, label: 'Status', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  purchase: { icon: ShoppingCart, label: 'Compra', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  credit: { icon: Coins, label: 'Crédito', color: 'text-amber-600', bgColor: 'bg-amber-100' }
}

const filterOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'message', label: 'Mensagens' },
  { value: 'purchase', label: 'Compras' },
  { value: 'credit', label: 'Créditos' },
  { value: 'note', label: 'Notas' }
]

export function ContactTimeline({
  events,
  total,
  isLoading,
  onLoadMore,
  hasMore,
  onFilterChange,
  selectedTypes
}: ContactTimelineProps) {
  const [filter, setFilter] = useState<string>('all')

  const handleFilterChange = (value: string) => {
    setFilter(value)
    if (value === 'all') {
      onFilterChange?.(undefined)
    } else {
      onFilterChange?.([value as TimelineEventType])
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  if (isLoading && events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </CardTitle>
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma atividade registrada
          </p>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => {
              const config = eventConfig[event.type]
              const Icon = config.icon
              const isLast = index === events.length - 1

              return (
                <div key={event.id} className="flex gap-3">
                  <div className="relative">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center',
                      config.bgColor
                    )}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    {!isLast && (
                      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{config.label}</span>
                      {event.direction && (
                        event.direction === 'incoming' ? (
                          <ArrowDownLeft className="h-3 w-3 text-green-600" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 text-blue-600" />
                        )
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.content}
                    </p>
                    {event.createdByType && (
                      <span className="text-xs text-muted-foreground">
                        por {event.createdByType === 'system' ? 'Sistema' : 
                             event.createdByType === 'agent' ? 'Agente' : 'Usuário'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Carregando...' : 'Carregar mais'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ContactTimeline
