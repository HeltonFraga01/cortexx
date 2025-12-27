/**
 * Appointment Form Component
 * 
 * Inline form for creating/editing appointments with service pre-fill.
 * 
 * Requirements: 2.1, 3.2, 3.3, 5.5 (CRM Contact Calendar)
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Appointment, AppointmentService, CreateAppointmentData } from '@/types/appointment'
import { formatPrice, calculateEndTime } from '@/services/appointmentService'

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  serviceId: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
  time: z.string().min(1, 'Horário é obrigatório'),
  durationMinutes: z.coerce.number().min(5, 'Mínimo 5 minutos').max(480, 'Máximo 8 horas'),
  priceCents: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional()
})

type FormData = z.infer<typeof formSchema>

interface AppointmentFormProps {
  contactId: string
  services: AppointmentService[]
  appointment?: Appointment
  initialDate?: Date
  initialTime?: string
  isSubmitting?: boolean
  onSubmit: (data: CreateAppointmentData) => Promise<void>
  onCancel: () => void
}

export function AppointmentForm({
  contactId,
  services,
  appointment,
  initialDate,
  initialTime,
  isSubmitting = false,
  onSubmit,
  onCancel
}: AppointmentFormProps) {
  const isEditing = !!appointment

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: appointment?.title || '',
      serviceId: appointment?.service_id || '',
      date: appointment 
        ? format(new Date(appointment.start_time), 'yyyy-MM-dd')
        : initialDate 
          ? format(initialDate, 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd'),
      time: appointment
        ? format(new Date(appointment.start_time), 'HH:mm')
        : initialTime || '09:00',
      durationMinutes: appointment
        ? Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000)
        : 60,
      priceCents: appointment?.price_cents || 0,
      notes: appointment?.notes || ''
    }
  })

  const selectedServiceId = form.watch('serviceId')

  // Pre-fill duration and price when service is selected
  useEffect(() => {
    if (selectedServiceId && selectedServiceId !== '_none' && !isEditing) {
      const service = services.find(s => s.id === selectedServiceId)
      if (service) {
        form.setValue('durationMinutes', service.default_duration_minutes)
        form.setValue('priceCents', service.default_price_cents)
        if (!form.getValues('title')) {
          form.setValue('title', service.name)
        }
      }
    }
  }, [selectedServiceId, services, form, isEditing])

  const handleSubmit = async (data: FormData) => {
    const startTime = new Date(`${data.date}T${data.time}:00`)
    const endTime = new Date(startTime.getTime() + data.durationMinutes * 60000)

    await onSubmit({
      contactId,
      serviceId: data.serviceId && data.serviceId !== '_none' ? data.serviceId : undefined,
      title: data.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      priceCents: data.priceCents,
      notes: data.notes
    })
  }

  const activeServices = services.filter(s => s.is_active)

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {activeServices.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: service.color }}
                            />
                            <span>{service.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({service.default_duration_minutes}min - {formatPrice(service.default_price_cents)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (minutos)</FormLabel>
                    <FormControl>
                      <Input type="number" min={5} max={480} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priceCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (centavos)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(field.value || 0)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default AppointmentForm
