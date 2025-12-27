/**
 * Calendar Event Component
 * 
 * Custom event rendering for react-big-calendar with status colors and indicators.
 * 
 * Requirements: 1.4, 5.4, 6.5, 10.2 (CRM Contact Calendar)
 */

import { useMemo } from 'react'
import { Clock, AlertCircle, DollarSign, User } from 'lucide-react'
import type { CalendarEvent, Appointment, AppointmentStatus } from '@/types/appointment'
import { cn } from '@/lib/utils'

interface CalendarEventComponentProps {
  event: CalendarEvent
  showContact?: boolean
}

export function CalendarEventComponent({ event, showContact = false }: CalendarEventComponentProps) {
  const isOverdue = useMemo(() => {
    if (event.type !== 'appointment') return false
    const appointment = event.data as Appointment
    const now = new Date()
    const startTime = new Date(event.start)
    const activeStatuses: AppointmentStatus[] = ['scheduled', 'confirmed']
    return startTime < now && activeStatuses.includes(appointment.status)
  }, [event])

  const hasPendingPayment = useMemo(() => {
    if (event.type !== 'appointment') return false
    const appointment = event.data as Appointment
    if (!appointment.financial_record?.length) return false
    return appointment.financial_record.some(r => r.payment_status === 'pending')
  }, [event])

  const contactName = useMemo(() => {
    if (!showContact || event.type !== 'appointment') return null
    const appointment = event.data as Appointment
    return appointment.contact?.name || appointment.contact?.phone || null
  }, [event, showContact])

  const statusClass = useMemo(() => {
    if (event.type === 'blocked') return 'event-blocked'
    return `event-${event.status || 'scheduled'}`
  }, [event.type, event.status])

  return (
    <div
      className={cn(
        'flex items-center gap-1 w-full overflow-hidden',
        statusClass
      )}
      style={{ backgroundColor: event.color }}
    >
      <span className="truncate flex-1 text-white text-xs font-medium">
        {showContact && contactName ? `${contactName} - ` : ''}{event.title}
      </span>
      
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {isOverdue && (
          <AlertCircle className="h-3 w-3 text-white opacity-90" />
        )}
        {hasPendingPayment && (
          <DollarSign className="h-3 w-3 text-white opacity-90" />
        )}
      </div>
    </div>
  )
}

/**
 * Get event style based on type and status
 */
export function getEventStyle(event: CalendarEvent): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    backgroundColor: event.color || '#3b82f6',
    borderRadius: '4px',
    border: 'none',
    color: 'white',
    fontSize: '0.75rem',
    padding: '2px 6px'
  }

  if (event.type === 'blocked') {
    return {
      ...baseStyle,
      backgroundColor: '#6b7280',
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
    }
  }

  if (event.status === 'cancelled') {
    return {
      ...baseStyle,
      opacity: 0.7,
      textDecoration: 'line-through'
    }
  }

  return baseStyle
}

export default CalendarEventComponent
