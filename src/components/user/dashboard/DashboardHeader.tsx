/**
 * DashboardHeader Component
 * Displays user welcome message, date/time, and refresh button
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { RefreshCw, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface DashboardHeaderProps {
  userName: string
  userAvatar?: string
  onRefresh: () => void
  isRefreshing: boolean
  lastUpdated?: Date
}

export function DashboardHeader({
  userName,
  userAvatar,
  onRefresh,
  isRefreshing,
  lastUpdated
}: DashboardHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatLastUpdated = (date: Date) => {
    return format(date, "HH:mm", { locale: ptBR })
  }

  const currentDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex items-center justify-between gap-4 pb-2">
      {/* Left side: Avatar + Welcome */}
      <div className="flex items-center gap-4 min-w-0">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          {userAvatar ? (
            <AvatarImage src={userAvatar} alt={userName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">
            Olá, {userName.split(' ')[0]}!
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{currentDate}</span>
          </div>
        </div>
      </div>

      {/* Right side: Last updated + Refresh */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {lastUpdated && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            Atualizado às {formatLastUpdated(lastUpdated)}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>
    </div>
  )
}

export default DashboardHeader
