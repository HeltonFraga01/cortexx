/**
 * InboxOverviewCard Component
 * Displays inbox status with connection indicator, name, phone, and unread count
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Inbox, Wifi, WifiOff, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InboxOverviewProps, InboxStatus } from '@/types/dashboard'

interface ModernInboxCardProps {
  inbox: InboxStatus
  isSelected: boolean
  onSelect: () => void
}

function ModernInboxCard({ inbox, isSelected, onSelect }: ModernInboxCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 min-w-[180px] max-w-[200px] flex-shrink-0',
        'hover:shadow-md',
        isSelected && 'ring-2 ring-primary shadow-md',
        !isSelected && inbox.isConnected && 'border-green-200 dark:border-green-800',
        !isSelected && !inbox.isConnected && 'border-red-200 dark:border-red-800'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Header with status indicator */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            {/* Status indicator circle */}
            <div className="relative">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center',
                  inbox.isConnected 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                )}
              >
                {inbox.isConnected ? (
                  <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              {/* Small status dot */}
              <div
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                  inbox.isConnected ? 'bg-green-500' : 'bg-red-500'
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate max-w-[100px]">
                {inbox.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {inbox.phoneNumber || 'Sem número'}
              </p>
            </div>
          </div>
          
          {/* Unread count badge */}
          {inbox.unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="flex-shrink-0 h-5 min-w-[20px] px-1.5 text-xs font-semibold"
            >
              {inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}
            </Badge>
          )}
        </div>

        {/* Status badge */}
        <Badge
          variant="outline"
          className={cn(
            'w-full justify-center text-xs py-1',
            inbox.isConnected
              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          )}
        >
          {inbox.isConnected ? 'Conectado' : 'Desconectado'}
        </Badge>
      </CardContent>
    </Card>
  )
}

function InboxCardSkeleton() {
  return (
    <Card className="min-w-[180px] max-w-[200px] flex-shrink-0">
      <CardContent className="p-4">
        <div className="flex items-start gap-2.5 mb-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-full" />
      </CardContent>
    </Card>
  )
}

export function InboxOverviewCard({
  inboxes,
  onInboxSelect,
  selectedInboxId,
  isLoading
}: InboxOverviewProps) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Inbox className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Minhas Caixas</span>
            </div>
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <InboxCardSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (inboxes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhuma caixa configurada</p>
            <p className="text-xs text-muted-foreground">
              Configure uma caixa de entrada para começar
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">Minhas Caixas</span>
          <Badge variant="secondary" className="text-xs">
            {inboxes.length}
          </Badge>
        </div>
        {selectedInboxId && (
          <button
            onClick={() => onInboxSelect(null)}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Inbox cards scroll */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {inboxes.map((inbox) => (
            <ModernInboxCard
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
