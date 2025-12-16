/**
 * AvailabilityToggle - Toggle for agent availability status
 * 
 * Shows current status with visual indicator and allows quick toggle.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Circle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AvailabilityStatus } from '@/types/multi-user'

interface AvailabilityToggleProps {
  status: AvailabilityStatus
  onChange: (status: AvailabilityStatus) => Promise<void>
  compact?: boolean
}

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; color: string; bgColor: string }> = {
  online: {
    label: 'Online',
    color: 'text-green-500',
    bgColor: 'bg-green-500'
  },
  busy: {
    label: 'Ocupado',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500'
  },
  offline: {
    label: 'Offline',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400'
  }
}

export function AvailabilityToggle({ status, onChange, compact = false }: AvailabilityToggleProps) {
  const [isLoading, setIsLoading] = useState(false)
  const config = STATUS_CONFIG[status]

  const handleChange = async (newStatus: AvailabilityStatus) => {
    if (newStatus === status) return
    
    setIsLoading(true)
    try {
      await onChange(newStatus)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={compact ? 'sm' : 'default'}
          className={cn(
            "gap-2",
            compact && "h-8 px-2"
          )}
          disabled={isLoading}
        >
          <Circle className={cn("h-2 w-2 fill-current", config.color)} />
          {!compact && <span>{config.label}</span>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.entries(STATUS_CONFIG) as [AvailabilityStatus, typeof config][]).map(([key, value]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => handleChange(key)}
            className="gap-2"
          >
            <Circle className={cn("h-2 w-2 fill-current", value.color)} />
            <span>{value.label}</span>
            {key === status && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Simple status indicator without dropdown
 */
export function AvailabilityIndicator({ status }: { status: AvailabilityStatus }) {
  const config = STATUS_CONFIG[status]
  
  return (
    <div className="flex items-center gap-1.5">
      <Circle className={cn("h-2 w-2 fill-current", config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  )
}

export default AvailabilityToggle
