/**
 * Appointment Service
 * 
 * Frontend API client for appointment, service, and blocked slot management.
 * 
 * Requirements: 2.1, 3.1, 4.1 (CRM Contact Calendar)
 */

import { api } from '@/lib/api'
import type {
  Appointment,
  AppointmentService,
  BlockedSlot,
  CalendarEvent,
  CreateAppointmentData,
  UpdateAppointmentData,
  CreateBlockedSlotData,
  CreateServiceData,
  UpdateServiceData,
  AppointmentStatus,
  AppointmentListResponse,
  CalendarEventsResponse,
  ServiceListResponse,
  BlockedSlotListResponse,
  AvailabilityResponse
} from '@/types/appointment'

const BASE_URL = '/api/user/appointments'

// ==================== APPOINTMENTS ====================

export async function getAppointments(params: {
  contactId?: string
  startDate?: string
  endDate?: string
  statuses?: AppointmentStatus[]
  serviceId?: string
  page?: number
  limit?: number
}): Promise<AppointmentListResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.contactId) searchParams.set('contactId', params.contactId)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.statuses?.length) searchParams.set('statuses', params.statuses.join(','))
  if (params.serviceId) searchParams.set('serviceId', params.serviceId)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())

  const response = await api.get(`${BASE_URL}?${searchParams.toString()}`)
  return response.data
}

export async function getAppointmentById(id: string): Promise<{ success: boolean; data: Appointment }> {
  const response = await api.get(`${BASE_URL}/${id}`)
  return response.data
}

export async function createAppointment(data: CreateAppointmentData): Promise<{ success: boolean; data: Appointment }> {
  const response = await api.post(BASE_URL, data)
  return response.data
}

export async function updateAppointment(
  id: string,
  data: UpdateAppointmentData
): Promise<{ success: boolean; data: Appointment }> {
  const response = await api.put(`${BASE_URL}/${id}`, data)
  return response.data
}

export async function deleteAppointment(id: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete(`${BASE_URL}/${id}`)
  return response.data
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  reason?: string
): Promise<{ success: boolean; data: Appointment }> {
  const response = await api.post(`${BASE_URL}/${id}/status`, { status, reason })
  return response.data
}

export async function checkAvailability(
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<AvailabilityResponse> {
  const searchParams = new URLSearchParams({
    startTime,
    endTime
  })
  if (excludeId) searchParams.set('excludeId', excludeId)

  const response = await api.get(`${BASE_URL}/check-availability?${searchParams.toString()}`)
  return response.data
}

// ==================== CALENDAR EVENTS ====================

export async function getCalendarEvents(params: {
  contactId?: string
  startDate: string
  endDate: string
  types?: string[]
}): Promise<CalendarEventsResponse> {
  const searchParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate
  })
  
  if (params.contactId) searchParams.set('contactId', params.contactId)
  if (params.types?.length) searchParams.set('types', params.types.join(','))

  const response = await api.get(`${BASE_URL}/calendar-events?${searchParams.toString()}`)
  return response.data
}

// ==================== SERVICES ====================

export async function getServices(activeOnly = false): Promise<ServiceListResponse> {
  const searchParams = new URLSearchParams()
  if (activeOnly) searchParams.set('activeOnly', 'true')

  const response = await api.get(`${BASE_URL}/services?${searchParams.toString()}`)
  return response.data
}

export async function createService(data: CreateServiceData): Promise<{ success: boolean; data: AppointmentService }> {
  const response = await api.post(`${BASE_URL}/services`, data)
  return response.data
}

export async function updateService(
  id: string,
  data: UpdateServiceData
): Promise<{ success: boolean; data: AppointmentService }> {
  const response = await api.put(`${BASE_URL}/services/${id}`, data)
  return response.data
}

export async function deleteService(id: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete(`${BASE_URL}/services/${id}`)
  return response.data
}

// ==================== BLOCKED SLOTS ====================

export async function getBlockedSlots(params?: {
  startDate?: string
  endDate?: string
}): Promise<BlockedSlotListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)

  const response = await api.get(`${BASE_URL}/blocked-slots?${searchParams.toString()}`)
  return response.data
}

export async function createBlockedSlot(data: CreateBlockedSlotData): Promise<{ success: boolean; data: BlockedSlot }> {
  const response = await api.post(`${BASE_URL}/blocked-slots`, data)
  return response.data
}

export async function deleteBlockedSlot(id: string): Promise<{ success: boolean; message: string }> {
  const response = await api.delete(`${BASE_URL}/blocked-slots/${id}`)
  return response.data
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100)
}

/**
 * Format duration in minutes to display string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}min`
}

/**
 * Get status display info
 */
export function getStatusInfo(status: AppointmentStatus): { label: string; color: string; bgColor: string } {
  const statusMap: Record<AppointmentStatus, { label: string; color: string; bgColor: string }> = {
    scheduled: { label: 'Agendado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    confirmed: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
    completed: { label: 'Concluído', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    cancelled: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100' },
    no_show: { label: 'Não compareceu', color: 'text-orange-700', bgColor: 'bg-orange-100' }
  }
  return statusMap[status]
}

/**
 * Get payment status display info
 */
export function getPaymentStatusInfo(status: string): { label: string; color: string; bgColor: string } {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'Pendente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    paid: { label: 'Pago', color: 'text-green-700', bgColor: 'bg-green-100' },
    refunded: { label: 'Reembolsado', color: 'text-purple-700', bgColor: 'bg-purple-100' }
  }
  return statusMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' }
}

/**
 * Calculate end time from start time and duration
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const start = new Date(startTime)
  start.setMinutes(start.getMinutes() + durationMinutes)
  return start.toISOString()
}

/**
 * Check if appointment is overdue (past start time and not completed/cancelled)
 */
export function isAppointmentOverdue(appointment: Appointment): boolean {
  const now = new Date()
  const startTime = new Date(appointment.start_time)
  const activeStatuses: AppointmentStatus[] = ['scheduled', 'confirmed']
  
  return startTime < now && activeStatuses.includes(appointment.status)
}

/**
 * Get today's appointments count
 */
export function getTodayAppointmentsCount(appointments: Appointment[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return appointments.filter(apt => {
    const startTime = new Date(apt.start_time)
    return startTime >= today && startTime < tomorrow
  }).length
}

// Export all functions as default object for convenience
export default {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  checkAvailability,
  getCalendarEvents,
  getServices,
  createService,
  updateService,
  deleteService,
  getBlockedSlots,
  createBlockedSlot,
  deleteBlockedSlot,
  formatPrice,
  formatDuration,
  getStatusInfo,
  getPaymentStatusInfo,
  calculateEndTime,
  isAppointmentOverdue,
  getTodayAppointmentsCount
}
