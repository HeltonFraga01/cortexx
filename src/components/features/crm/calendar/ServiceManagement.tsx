/**
 * Service Management Component
 * 
 * CRUD interface for appointment service types.
 * 
 * Requirements: 3.1 (CRM Contact Calendar)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Loader2,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

import {
  getServices,
  createService,
  updateService,
  deleteService,
  formatPrice,
  formatDuration
} from '@/services/appointmentService'

import type { AppointmentService, CreateServiceData, UpdateServiceData } from '@/types/appointment'

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  description: z.string().max(1000).optional(),
  defaultDurationMinutes: z.coerce.number().min(5).max(480),
  defaultPriceCents: z.coerce.number().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
})

type FormData = z.infer<typeof formSchema>

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16'  // lime
]

export function ServiceManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<AppointmentService | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<AppointmentService | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      defaultDurationMinutes: 60,
      defaultPriceCents: 0,
      color: '#3b82f6'
    }
  })

  // Query
  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['appointment-services-all'],
    queryFn: () => getServices(false)
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
      toast({ title: 'Serviço criado' })
      handleCloseForm()
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceData }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
      toast({ title: 'Serviço atualizado' })
      handleCloseForm()
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] })
      toast({ title: 'Serviço excluído' })
      setDeleteDialogOpen(false)
      setServiceToDelete(null)
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  const services: AppointmentService[] = servicesData?.data || []

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingService(null)
    form.reset({
      name: '',
      description: '',
      defaultDurationMinutes: 60,
      defaultPriceCents: 0,
      color: '#3b82f6'
    })
  }

  const handleEdit = (service: AppointmentService) => {
    setEditingService(service)
    form.reset({
      name: service.name,
      description: service.description || '',
      defaultDurationMinutes: service.default_duration_minutes,
      defaultPriceCents: service.default_price_cents,
      color: service.color
    })
    setShowForm(true)
  }

  const handleSubmit = async (data: FormData) => {
    if (editingService) {
      await updateMutation.mutateAsync({
        id: editingService.id,
        data: {
          name: data.name,
          description: data.description,
          defaultDurationMinutes: data.defaultDurationMinutes,
          defaultPriceCents: data.defaultPriceCents,
          color: data.color
        }
      })
    } else {
      await createMutation.mutateAsync({
        name: data.name,
        description: data.description,
        defaultDurationMinutes: data.defaultDurationMinutes,
        defaultPriceCents: data.defaultPriceCents,
        color: data.color
      })
    }
  }

  const handleDelete = (service: AppointmentService) => {
    setServiceToDelete(service)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (serviceToDelete) {
      deleteMutation.mutate(serviceToDelete.id)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      {/* Form */}
      {showForm && (
        <Card className="border-2 border-primary">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {editingService ? 'Editar Serviço' : 'Novo Serviço'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="defaultDurationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duração padrão (min)</FormLabel>
                        <FormControl>
                          <Input type="number" min={5} max={480} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultPriceCents"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço padrão (centavos)</FormLabel>
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
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input type="color" className="w-12 h-10 p-1" {...field} />
                        </FormControl>
                        <div className="flex gap-1">
                          {DEFAULT_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-400"
                              style={{ backgroundColor: color }}
                              onClick={() => form.setValue('color', color)}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseForm}
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
                    {editingService ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Services List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Tipos de Serviço
              </CardTitle>
              <CardDescription>
                Configure os serviços disponíveis para agendamento
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={showForm}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo Serviço
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum serviço cadastrado</p>
              <Button
                variant="link"
                onClick={() => setShowForm(true)}
              >
                Criar primeiro serviço
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(service => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: service.color }}
                        />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDuration(service.default_duration_minutes)}</TableCell>
                    <TableCell>{formatPrice(service.default_price_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={service.is_active ? 'default' : 'secondary'}>
                        {service.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(service)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(service)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço "{serviceToDelete?.name}"?
              Agendamentos existentes não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ServiceManagement
