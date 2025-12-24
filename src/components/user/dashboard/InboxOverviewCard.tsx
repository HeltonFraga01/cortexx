/**
 * InboxOverviewCard Component
 * Displays inbox status with connection indicator, name, phone, and unread count
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Inbox, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InboxOverviewProps, InboxStatus } from '@/types/dashboard'

function InboxCard({
  inbox,
  isSelected,
  onSelect
}: {
  inbox: InboxStatus
  isSelected: boolean
  onSelect: () => void
}) {
  const handleClick = () => {
    onSelect()
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md min-w-[160px] max-w-[180px] flex-shrink-0',
        isSelected && 'ring-2 ring-primary',
        inbox.isConnected ? 'border-green-200' : 'border-red-200'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded-full',
                inbox.isConnected ? 'bg-green-100' : 'bg-red-100'
              )}
            >
              {inbox.isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate max-w-[100px]">{inbox.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {inbox.phoneNumber || 'Sem número'}
              </p>
            </div>
          </div>
          {inbox.unreadCount > 0 && (
            <Badge variant="destructive" className="flex-shrink-0 h-5 text-xs px-1.5">
              {inbox.unreadCount}
            </Badge>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Badge
            variant={inbox.isConnected ? 'default' : 'secondary'}
            className={cn(
              'text-xs h-5 px-1.5',
              inbox.isConnected
                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                : 'bg-red-100 text-red-800 hover:bg-red-100'
            )}
          >
            {inbox.isConnected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

export function InboxOverviewCard({
  inboxes,
  onInboxSelect,
  selectedInboxId,
  isLoading
}: InboxOverviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Caixas</span>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-[160px] flex-shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (inboxes.length === 0) {
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Caixas</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma caixa configurada
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Inbox className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Caixas</span>
        {selectedInboxId && (
          <button
            onClick={() => onInboxSelect(null)}
            className="text-xs text-primary hover:underline ml-1"
          >
            (limpar)
          </button>
        )}
      </div>
      <ScrollArea className="flex-1 whitespace-nowrap">
        <div className="flex gap-3 pb-1">
          {inboxes.map((inbox) => (
            <InboxCard
              key={inbox.id}
              inbox={inbox}
              isSelected={selectedInboxId === inbox.id}
              onSelect={() => onInboxSelect(inbox.id)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}

export default InboxOverviewCard
