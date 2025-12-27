/**
 * Global Calendar Page
 * 
 * Shows all appointments across all contacts in a unified calendar view.
 * Allows filtering by status, service, and date range.
 * Allows creating new appointments with contact selection.
 * 
 * Requirements: CRM Global Agenda
 */

import { useState, useMemo, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import './ContactCalendar.css'

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Ban,
  Filter,
  Loader2,
  Users,
  Settings,
  Search,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

import { CalendarEventComponent, getEventStyle } from './CalendarEventComponent'
import { AppointmentPopover } from './AppointmentPopover'
import { AppointmentForm } from './AppointmentForm'
import { BlockedSlotForm } from './BlockedSlotForm'
import { ServiceManagement } from './ServiceManagement'

import {
  getCalendarEvents,
  getServices,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  createBlockedSlot,
  getStatusInfo,
  getTodayAppointmentsCount
} from '@/services/appointmentService'

import { getContacts, type Contact } from '@/services/contactsApiService'

import type {
  CalendarEvent,
  Appointment,
  AppointmentService,
  AppointmentStatus,
  CreateAppointmentData,
  CreateBlockedSlotData
} from '@/types/appointment'

// Simple contact type for search results
interface ContactSearchResult {
  id: string
  name: string | null
  phone: string
}

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '_all', label: 'Todos os status' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'no_show', label: 'Não compareceu' }
]

export function GlobalCalendarPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // State
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('_all')
  const [serviceFilter, setServiceFilter] = useState<string>('_all')
  const [showServiceManagement, setShowServiceManagement] = useState(false)
  
  // New appointment creation state
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [showBlockedForm, setShowBlockedForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time?: string } | null>(null)
  const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [showContactSelector, setShowContactSelector] = useState(false)

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
    queryKey: ['global-calendar-events', dateRange.startDate, dateRange.endDate],
    queryFn: () => getCalendarEvents({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      types: ['appointment', 'blocked']
    })
  })

  const { data: servicesData } = useQuery({
    queryKey: ['appointment-services'],
    queryFn: () => getServices()
  })

  // Search contacts query - using contactsApiService with proper auth
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts-search', contactSearch],
    queryFn: async () => {
      if (!contactSearch || contactSearch.length < 2) return { data: [] }
      const result = await getContacts({
        search: contactSearch,
        pageSize: 10,
        page: 1
      })
      return { data: result.data }
    },
    enabled: contactSearch.length >= 2
  })

  // Mutations
  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-calendar-events'] })
      toast({ title: 'Agendamento criado', description: 'O agendamento foi criado com sucesso.' })
      handleCloseForm()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message
      toast({ title: 'Erro', description: message, variant: 'destructive' })
    }
  })

  const createBlockedSlotMutation = useMutation({
    mutationFn: createBlockedSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-calendar-events'] })
      toast({ title: 'Horário bloqueado' })
      handleCloseForm()
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      updateAppointmentStatus(id, status as AppointmentStatus, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-calendar-events'] })
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
      queryClient.invalidateQueries({ queryKey: ['global-calendar-events'] })
      toast({ title: 'Agendamento excluído' })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  // Transform and filter events for calendar
  const calendarEvents = useMemo(() => {
    if (!eventsData?.data) return []
    
    return eventsData.data
      .filter(event => {
        // Filter by status
        if (statusFilter !== '_all' && event.type === 'appointment') {
          const appointment = event.data as Appointment
          if (appointment.status !== statusFilter) return false
        }
        
        // Filter by service
        if (serviceFilter !== '_all' && event.type === 'appointment') {
          const appointment = event.data as Appointment
          if (appointment.service_id !== serviceFilter) return false
        }
        
        return true
      })
      .map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }))
  }, [eventsData, statusFilter, serviceFilter])

  const services: AppointmentService[] = servicesData?.data || []

  // Stats
  const stats = useMemo(() => {
    if (!eventsData?.data) return { today: 0, scheduled: 0, confirmed: 0 }
    
    const appointments = eventsData.data
      .filter(e => e.type === 'appointment')
      .map(e => e.data as Appointment)
    
    return {
      today: getTodayAppointmentsCount(appointments),
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length
    }
  }, [eventsData])

  // Handlers
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

  const handleEditAppointment = (appointment: Appointment) => {
    // Navigate to contact detail page with agenda tab
    if (appointment.contact_id) {
      navigate(`/user/contacts/${appointment.contact_id}?tab=agenda`)
    }
    setSelectedEvent(null)
  }

  const handleViewContact = (appointment: Appointment) => {
    if (appointment.contact_id) {
      navigate(`/user/contacts/${appointment.contact_id}`)
    }
  }

  // Form handlers
  const handleCloseForm = () => {
    setShowAppointmentForm(false)
    setShowBlockedForm(false)
    setShowContactSelector(false)
    setSelectedSlot(null)
    setSelectedContact(null)
    setContactSearch('')
  }

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({
      date: slotInfo.start,
      time: format(slotInfo.start, 'HH:mm')
    })
    setShowContactSelector(true)
  }, [])

  const handleStartNewAppointment = () => {
    setSelectedSlot({ date: new Date() })
    setShowContactSelector(true)
  }

  const handleSelectContact = (contact: ContactSearchResult) => {
    setSelectedContact(contact)
    setShowContactSelector(false)
    setShowAppointmentForm(true)
  }

  const handleCreateAppointment = async (data: CreateAppointmentData) => {
    await createAppointmentMutation.mutateAsync(data)
  }

  const handleCreateBlockedSlot = async (data: CreateBlockedSlotData) => {
    await createBlockedSlotMutation.mutateAsync(data)
  }

  const searchResults: ContactSearchResult[] = contactsData?.data || []

  // Event style getter
  const eventStyleGetter = useCallback((event: any) => {
    return { style: getEventStyle(event as CalendarEvent) }
  }, [])

  // Custom components
  const components = useMemo(() => ({
    event: ({ event }: { event: any }) => (
      <CalendarEventComponent event={event as CalendarEvent} showContact />
    )
  }), [])

  if (showServiceManagement) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gerenciar Serviços</h1>
          <Button variant="outline" onClick={() => setShowServiceManagement(false)}>
            Voltar para Agenda
          </Button>
        </div>
        <ServiceManagement />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Agenda Global
          </h1>
          <p className="text-muted-foreground">
            Visualize todos os agendamentos de todos os contatos
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowServiceManagement(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Serviços
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleStartNewAppointment} disabled={showAppointmentForm || showBlockedForm}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedSlot({ date: new Date() })
              setShowBlockedForm(true)
            }}
            disabled={showAppointmentForm || showBlockedForm}
          >
            <Ban className="h-4 w-4 mr-2" />
            Bloquear Horário
          </Button>
        </div>
      </div>

      {/* Contact Selector */}
      {showContactSelector && (
        <Card className="border-2 border-primary">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Selecionar Contato</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleCloseForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar contato</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Digite nome ou telefone..."
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {contactsLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!contactsLoading && contactSearch.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum contato encontrado
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {searchResults.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.name || 'Sem nome'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {contactSearch.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Digite pelo menos 2 caracteres para buscar
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appointment Form */}
      {showAppointmentForm && selectedContact && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Badge variant="outline" className="gap-2">
              <Users className="h-3 w-3" />
              {selectedContact.name || selectedContact.phone}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleCloseForm}>
              Trocar contato
            </Button>
          </div>
          <AppointmentForm
            contactId={selectedContact.id}
            services={services}
            initialDate={selectedSlot?.date}
            initialTime={selectedSlot?.time}
            isSubmitting={createAppointmentMutation.isPending}
            onSubmit={handleCreateAppointment}
            onCancel={handleCloseForm}
          />
        </div>
      )}

      {/* Blocked Slot Form */}
      {showBlockedForm && (
        <BlockedSlotForm
          initialDate={selectedSlot?.date}
          initialTime={selectedSlot?.time}
          isSubmitting={createBlockedSlotMutation.isPending}
          onSubmit={handleCreateBlockedSlot}
          onCancel={handleCloseForm}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agendados</p>
                <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">Pendentes</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmados</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-700">Prontos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Card */}
      <Card>
        <CardContent className="pt-6">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-4">
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
              <span className="text-lg font-semibold ml-2">
                {format(date, view === 'month' ? 'MMMM yyyy' : "dd 'de' MMMM yyyy", { locale: ptBR })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filters */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos os serviços</SelectItem>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: service.color }}
                        />
                        {service.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View buttons */}
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
            </div>
          </div>

          {/* Calendar */}
          {eventsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
          )}

          {/* Empty state */}
          {!eventsLoading && calendarEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento para este período</p>
              <Button
                variant="link"
                onClick={handleStartNewAppointment}
                disabled={showAppointmentForm || showBlockedForm}
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
            showContactLink
            onViewContact={handleViewContact}
          />
        </div>
      )}

      {/* Blocked Slot Info */}
      {selectedEvent && selectedEvent.type === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Card className="w-72">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Horário Bloqueado</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedEvent(null)}>
                  <span className="sr-only">Fechar</span>
                  ×
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
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelectedEvent(null)}
              >
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default GlobalCalendarPage
