/**
 * Contact Calendar Component
 * 
 * Main calendar component for CRM contact appointments.
 * Uses react-big-calendar with custom event rendering.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 (CRM Contact Calendar)
 */

import { useState, useMemo, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './ContactCalendar.css'

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Ban,
  Settings,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'

import { CalendarEventComponent, getEventStyle } from './CalendarEventComponent'
import { AppointmentForm } from './AppointmentForm'
import { BlockedSlotForm } from './BlockedSlotForm'
import { AppointmentPopover } from './AppointmentPopover'

import {
  getCalendarEvents,
  getServices,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  createBlockedSlot,
  deleteBlockedSlot,
  getTodayAppointmentsCount
} from '@/services/appointmentService'

import type {
  CalendarEvent,
  Appointment,
  AppointmentService,
  CreateAppointmentData,
  CreateBlockedSlotData,
  ContactCalendarProps,
  ViewMode
} from '@/types/appointment'

const locales = { 'pt-BR': ptBR }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales
})

const messages = {
  allDay: 'Dia inteiro',
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Não há eventos neste período.',
  showMore: (total: number) => `+ ${total} mais`
}

export function ContactCalendar({ contactId, contactPhone, contactName }: ContactCalendarProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [showBlockedForm, setShowBlockedForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time?: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

  // Calculate date range for query
  const dateRange = useMemo(() => {
    const start = startOfMonth(subDays(date, 7))
    const end = endOfMonth(addDays(date, 7))
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }
  }, [date])

  // Queries
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['calendar-events', contactId, dateRange.startDate, dateRange.endDate],
    queryFn: () => getCalendarEvents({
      contactId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      types: ['appointment', 'blocked']
    })
  })

  const { data: servicesData } = useQuery({
    queryKey: ['appointment-services'],
    queryFn: () => getServices(true)
  })

  // Mutations
  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Agendamento criado', description: 'O agendamento foi criado com sucesso.' })
      handleCloseForm()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  })

  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Agendamento atualizado' })
      handleCloseForm()
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      updateAppointmentStatus(id, status as any, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Status atualizado' })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const deleteAppointmentMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Agendamento excluído' })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const createBlockedSlotMutation = useMutation({
    mutationFn: createBlockedSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Horário bloqueado' })
      handleCloseForm()
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const deleteBlockedSlotMutation = useMutation({
    mutationFn: deleteBlockedSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast({ title: 'Bloqueio removido' })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  // Transform events for calendar
  const calendarEvents = useMemo(() => {
    if (!eventsData?.data) return []
    return eventsData.data.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    }))
  }, [eventsData])

  const services: AppointmentService[] = servicesData?.data || []

  // Today's count
  const todayCount = useMemo(() => {
    if (!eventsData?.data) return 0
    const appointments = eventsData.data
      .filter(e => e.type === 'appointment')
      .map(e => e.data as Appointment)
    return getTodayAppointmentsCount(appointments)
  }, [eventsData])

  // Handlers
  const handleCloseForm = () => {
    setShowAppointmentForm(false)
    setShowBlockedForm(false)
    setSelectedSlot(null)
    setEditingAppointment(null)
  }

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({
      date: slotInfo.start,
      time: format(slotInfo.start, 'HH:mm')
    })
    setShowAppointmentForm(true)
  }, [])

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedEvent(event as CalendarEvent)
  }, [])

  const handleNavigate = (newDate: Date) => setDate(newDate)
  const handleViewChange = (newView: View) => setView(newView)

  const goToToday = () => setDate(new Date())
  const goToPrevious = () => {
    const newDate = new Date(date)
    if (view === 'month') newDate.setMonth(date.getMonth() - 1)
    else if (view === 'week') newDate.setDate(date.getDate() - 7)
    else newDate.setDate(date.getDate() - 1)
    setDate(newDate)
  }
  const goToNext = () => {
    const newDate = new Date(date)
    if (view === 'month') newDate.setMonth(date.getMonth() + 1)
    else if (view === 'week') newDate.setDate(date.getDate() + 7)
    else newDate.setDate(date.getDate() + 1)
    setDate(newDate)
  }

  const handleCreateAppointment = async (data: CreateAppointmentData) => {
    await createAppointmentMutation.mutateAsync(data)
  }

  const handleUpdateAppointment = async (data: CreateAppointmentData) => {
    if (!editingAppointment) return
    await updateAppointmentMutation.mutateAsync({
      id: editingAppointment.id,
      data: {
        title: data.title,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime: data.endTime,
        priceCents: data.priceCents,
        notes: data.notes
      }
    })
  }

  const handleCreateBlockedSlot = async (data: CreateBlockedSlotData) => {
    await createBlockedSlotMutation.mutateAsync(data)
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setShowAppointmentForm(true)
    setSelectedEvent(null)
  }

  // Event style getter
  const eventStyleGetter = useCallback((event: any) => {
    return { style: getEventStyle(event as CalendarEvent) }
  }, [])

  // Custom components
  const components = useMemo(() => ({
    event: ({ event }: { event: any }) => (
      <CalendarEventComponent event={event as CalendarEvent} />
    )
  }), [])

  if (eventsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Forms */}
      {showAppointmentForm && (
        <AppointmentForm
          contactId={contactId}
          services={services}
          appointment={editingAppointment || undefined}
          initialDate={selectedSlot?.date}
          initialTime={selectedSlot?.time}
          isSubmitting={createAppointmentMutation.isPending || updateAppointmentMutation.isPending}
          onSubmit={editingAppointment ? handleUpdateAppointment : handleCreateAppointment}
          onCancel={handleCloseForm}
        />
      )}

      {showBlockedForm && (
        <BlockedSlotForm
          initialDate={selectedSlot?.date}
          initialTime={selectedSlot?.time}
          isSubmitting={createBlockedSlotMutation.isPending}
          onSubmit={handleCreateBlockedSlot}
          onCancel={handleCloseForm}
        />
      )}

      {/* Calendar Card */}
      <Card>
        <CardContent className="pt-6">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {format(date, view === 'month' ? 'MMMM yyyy' : "dd 'de' MMMM yyyy", { locale: ptBR })}
              </h2>
              {todayCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {todayCount} agendamento{todayCount > 1 ? 's' : ''} hoje
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button
                  variant={view === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleViewChange('month')}
                >
                  Mês
                </Button>
                <Button
                  variant={view === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleViewChange('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={view === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleViewChange('day')}
                >
                  Dia
                </Button>
              </div>

              <div className="flex gap-1 ml-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedSlot({ date: new Date() })
                    setShowAppointmentForm(true)
                  }}
                  disabled={showAppointmentForm || showBlockedForm}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agendar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSlot({ date: new Date() })
                    setShowBlockedForm(true)
                  }}
                  disabled={showAppointmentForm || showBlockedForm}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  Bloquear
                </Button>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="contact-calendar-container">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={handleViewChange}
              date={date}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              culture="pt-BR"
              messages={messages}
              toolbar={false}
              eventPropGetter={eventStyleGetter}
              components={components}
            />
          </div>

          {/* Empty state */}
          {calendarEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento para este período</p>
              <Button
                variant="link"
                onClick={() => {
                  setSelectedSlot({ date: new Date() })
                  setShowAppointmentForm(true)
                }}
              >
                Criar primeiro agendamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Popover */}
      {selectedEvent && selectedEvent.type === 'appointment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <AppointmentPopover
            appointment={selectedEvent.data as Appointment}
            onClose={() => setSelectedEvent(null)}
            onConfirm={(id) => updateStatusMutation.mutateAsync({ id, status: 'confirmed' })}
            onComplete={(id) => updateStatusMutation.mutateAsync({ id, status: 'completed' })}
            onCancel={(id, reason) => updateStatusMutation.mutateAsync({ id, status: 'cancelled', reason })}
            onNoShow={(id) => updateStatusMutation.mutateAsync({ id, status: 'no_show' })}
            onEdit={handleEditAppointment}
            onDelete={(id) => deleteAppointmentMutation.mutateAsync(id)}
          />
        </div>
      )}

      {/* Blocked Slot Popover */}
      {selectedEvent && selectedEvent.type === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Card className="w-72">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Horário Bloqueado</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedEvent(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {format(new Date(selectedEvent.start), "dd/MM/yyyy 'às' HH:mm")} -{' '}
                {format(new Date(selectedEvent.end), 'HH:mm')}
              </p>
              {selectedEvent.title !== 'Bloqueado' && (
                <p className="text-sm mb-4">{selectedEvent.title}</p>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  const slotId = selectedEvent.id.split('_')[0] // Handle recurring slot IDs
                  deleteBlockedSlotMutation.mutate(slotId)
                }}
                disabled={deleteBlockedSlotMutation.isPending}
              >
                Remover Bloqueio
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ContactCalendar
