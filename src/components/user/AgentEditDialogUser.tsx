/**
 * AgentEditDialogUser Component
 * 
 * Edit agent form dialog for user dashboard.
 * 
 * Requirements: 2.1
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

import type { Agent, AgentRole, AvailabilityStatus } from '@/types/multi-user'
import { updateAgent, updateAgentRole } from '@/services/account-agents'

const editAgentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  availability: z.enum(['online', 'busy', 'offline']),
  role: z.enum(['owner', 'administrator', 'agent', 'viewer']),
})

type EditAgentFormData = z.infer<typeof editAgentSchema>

interface AgentEditDialogUserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: Agent | null
  onSuccess?: () => void
}

const ROLE_LABELS: Record<AgentRole, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  online: 'Online',
  busy: 'Ocupado',
  offline: 'Offline',
}

export function AgentEditDialogUser({ 
  open, 
  onOpenChange, 
  agent,
  onSuccess 
}: AgentEditDialogUserProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<EditAgentFormData>({
    resolver: zodResolver(editAgentSchema),
    defaultValues: {
      name: '',
      avatarUrl: '',
      availability: 'offline',
      role: 'agent',
    },
  })

  useEffect(() => {
    if (open && agent) {
      form.reset({
        name: agent.name,
        avatarUrl: agent.avatarUrl || '',
        availability: agent.availability,
        role: agent.role,
      })
    }
  }, [open, agent, form])

  const handleSubmit = async (data: EditAgentFormData) => {
    if (!agent) return

    try {
      setLoading(true)
      
      // Update basic info
      await updateAgent(agent.id, {
        name: data.name,
        avatarUrl: data.avatarUrl || undefined,
        availability: data.availability,
      })

      // Update role if changed and not owner
      if (data.role !== agent.role && agent.role !== 'owner') {
        await updateAgentRole(agent.id, data.role)
      }

      toast.success('Agente atualizado com sucesso!')
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar agente')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  const isOwner = agent?.role === 'owner'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Agente
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do agente.
          </DialogDescription>
        </DialogHeader>

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
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Avatar (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://exemplo.com/avatar.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disponibilidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isOwner}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem 
                          key={value} 
                          value={value}
                          disabled={value === 'owner'}
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isOwner && (
                    <FormDescription>
                      O papel de proprietário não pode ser alterado.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AgentEditDialogUser
