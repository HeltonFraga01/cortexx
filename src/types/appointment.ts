/**
 * Appointment Types
 * 
 * TypeScript interfaces for the CRM Contact Calendar feature.
 * 
 * Requirements: 2.1, 3.1, 4.1, 5.1 (CRM Contact Calendar)
 */

// ==================== ENUMS & TYPES ====================

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'
export type RecurringType = 'weekly' | 'monthly'
export type BlockedSlotRecurringType = 'daily' | 'weekly'
export type CalendarEventType = 'appointment' | 'scheduled_message' | 'campaign' | 'blocked'

// ==================== INTERFACES ====================

export interface AppointmentService {
  id: string
  name: string
  description: string | null
  default_duration_minutes: number
  default_price_cents: number
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurringPattern {
  type: RecurringType
  interval: number
  endDate: string | null
}

export interface BlockedSlotRecurringPattern {
  type: BlockedSlotRecurringType
  days?: number[] // 0-6 for weekly (Sunday = 0)
}

export interface FinancialRecord {
  id: string
  appointment_id: string
  amount_cents: number
  payment_status: PaymentStatus
  payment_date: string | null
  payment_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  name: string | null
  phone: string
  avatar_url: string | null
}

export interface Appointment {
  id: string
  contact_id: string
  service_id: string | null
  service: AppointmentService | null
  contact?: Contact
  title: string
  description: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  price_cents: number
  notes: string | null
  cancellation_reason: string | null
  recurring_parent_id: string | null
  recurring_pattern: RecurringPattern | null
  financial_record: FinancialRecord[] | null
  created_at: string
  updated_at: string
}

export interface BlockedSlot {
  id: string
  start_time: string
  end_time: string
  reason: string | null
  is_recurring: boolean
  recurring_pattern: BlockedSlotRecurringPattern | null
  is_occurrence?: boolean
  parent_id?: string
  created_at: string
}

// ==================== CALENDAR EVENT ====================

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  start: string
  end: string
  color: string
  status?: AppointmentStatus | string
  data: Appointment | BlockedSlot | ScheduledEvent
}

export interface ScheduledEvent {
  id: string
  type: 'single' | 'campaign'
  scheduledAt: string
  status: string
  instance: string
  phone?: string
  message?: string
  campaignName?: string
}

// ==================== FORM DATA ====================

export interface CreateAppointmentData {
  contactId: string
  serviceId?: string
  title: string
  description?: string
  startTime: string
  endTime: string
  priceCents?: number
  notes?: string
  recurringPattern?: RecurringPattern
}

export interface UpdateAppointmentData {
  serviceId?: string
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  status?: AppointmentStatus
  priceCents?: number
  notes?: string
  cancellationReason?: string
}

export interface CreateBlockedSlotData {
  startTime: string
  endTime: string
  reason?: string
  isRecurring?: boolean
  recurringPattern?: BlockedSlotRecurringPattern
}

export interface CreateServiceData {
  name: string
  description?: string
  defaultDurationMinutes: number
  defaultPriceCents?: number
  color?: string
}

export interface UpdateServiceData {
  name?: string
  description?: string
  defaultDurationMinutes?: number
  defaultPriceCents?: number
  color?: string
  isActive?: boolean
}

// ==================== API RESPONSES ====================

export interface AppointmentListResponse {
  success: boolean
  data: Appointment[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CalendarEventsResponse {
  success: boolean
  data: CalendarEvent[]
}

export interface ServiceListResponse {
  success: boolean
  data: AppointmentService[]
}

export interface BlockedSlotListResponse {
  success: boolean
  data: BlockedSlot[]
}

export interface AvailabilityResponse {
  success: boolean
  data: {
    available: boolean
  }
}

// ==================== CALENDAR COMPONENT PROPS ====================

export interface CalendarEventProps {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
}

export interface ContactCalendarProps {
  contactId: string
  contactPhone: string
  contactName: string | null
}

// ==================== UTILITY TYPES ====================

export interface DateRange {
  start: Date
  end: Date
}

export type ViewMode = 'day' | 'week' | 'month'

export interface CalendarFilters {
  statuses?: AppointmentStatus[]
  serviceIds?: string[]
  eventTypes?: CalendarEventType[]
}
