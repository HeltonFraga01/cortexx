/**
 * InboxStatusBadge Component
 * 
 * Displays the connection status of an inbox with appropriate visual indicators.
 * Used in AgentInboxesPage and AgentOverview to show WhatsApp connection status.
 * 
 * Requirements: 1.2, 1.3, 1.4, 2.3
 */

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Wifi, WifiOff, RefreshCw, AlertCircle, Minus } from 'lucide-react'
import type { InboxConnectionStatus } from '@/services/agent-data'

interface InboxStatusBadgeProps {
  status: InboxConnectionStatus
  isLoading?: boolean
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<InboxConnectionStatus, {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
  icon: typeof Wifi
  animate?: boolean
}> = {
  connected: {
    label: 'Online',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-600 text-white',
    icon: Wifi
  },
  connecting: {
    label: 'Conectando',
    variant: 'secondary',
    className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
    icon: RefreshCw,
    animate: true
  },
  disconnected: {
    label: 'Offline',
    variant: 'outline',
    className: 'text-muted-foreground',
    icon: WifiOff
  },
  not_configured: {
    label: 'Não configurado',
    variant: 'outline',
    className: 'text-muted-foreground',
    icon: WifiOff
  },
  not_applicable: {
    label: 'N/A',
    variant: 'outline',
    className: 'text-muted-foreground',
    icon: Minus
  },
  unknown: {
    label: 'Desconhecido',
    variant: 'outline',
    className: 'text-muted-foreground',
    icon: AlertCircle
  }
}

export function InboxStatusBadge({ status, isLoading = false, size = 'sm' }: InboxStatusBadgeProps) {
  if (isLoading) {
    return <Skeleton className={size === 'sm' ? 'h-5 w-16' : 'h-6 w-20'} />
  }

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  const Icon = config.icon
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
    >
      <Icon className={`${iconSize} mr-1 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}

export default InboxStatusBadge
