/**
 * Blocked Slot Form Component
 * 
 * Inline form for creating blocked time slots with recurring options.
 * 
 * Requirements: 4.1, 4.4 (CRM Contact Calendar)
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { CreateBlockedSlotData, BlockedSlotRecurringPattern } from '@/types/appointment'

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' }
]

const formSchema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  startTime: z.string().min(1, 'Horário inicial é obrigatório'),
  endTime: z.string().min(1, 'Horário final é obrigatório'),
  reason: z.string().max(255).optional(),
  isRecurring: z.boolean().default(false),
  recurringType: z.enum(['daily', 'weekly']).optional(),
  recurringDays: z.array(z.number()).optional()
}).refine(data => {
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime
  }
  return true
}, {
  message: 'Horário final deve ser após o inicial',
  path: ['endTime']
})

type FormData = z.infer<typeof formSchema>

interface BlockedSlotFormProps {
  initialDate?: Date
  initialTime?: string
  isSubmitting?: boolean
  onSubmit: (data: CreateBlockedSlotData) => Promise<void>
  onCancel: () => void
}

export function BlockedSlotForm({
  initialDate,
  initialTime,
  isSubmitting = false,
  onSubmit,
  onCancel
}: BlockedSlotFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      startTime: initialTime || '12:00',
      endTime: initialTime ? `${parseInt(initialTime.split(':')[0]) + 1}:00` : '13:00',
      reason: '',
      isRecurring: false,
      recurringType: 'weekly',
      recurringDays: []
    }
  })

  const isRecurring = form.watch('isRecurring')
  const recurringType = form.watch('recurringType')

  const handleSubmit = async (data: FormData) => {
    const startDateTime = new Date(`${data.date}T${data.startTime}:00`)
    const endDateTime = new Date(`${data.date}T${data.endTime}:00`)

    let recurringPattern: BlockedSlotRecurringPattern | undefined
    if (data.isRecurring && data.recurringType) {
      recurringPattern = {
        type: data.recurringType,
        days: data.recurringType === 'weekly' ? data.recurringDays : undefined
      }
    }

    await onSubmit({
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      reason: data.reason,
      isRecurring: data.isRecurring,
      recurringPattern
    })
  }

  const toggleDay = (day: number) => {
    const current = form.getValues('recurringDays') || []
    if (current.includes(day)) {
      form.setValue('recurringDays', current.filter(d => d !== day))
    } else {
      form.setValue('recurringDays', [...current, day].sort())
    }
  }

  const selectedDays = form.watch('recurringDays') || []

  return (
    <Card className="border-2 border-muted">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Bloquear Horário</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Repetir</FormLabel>
                    <FormDescription>
                      Bloquear este horário regularmente
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {isRecurring && (
              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <FormField
                  control={form.control}
                  name="recurringType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Diariamente</SelectItem>
                          <SelectItem value="weekly">Semanalmente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {recurringType === 'weekly' && (
                  <FormItem>
                    <FormLabel>Dias da semana</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map(day => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDay(day.value)}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </FormItem>
                )}
              </div>
            )}

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
                Bloquear
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default BlockedSlotForm
