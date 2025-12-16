/**
 * CustomRoleDialogUser Component
 * 
 * Create/edit custom role with permission selection for user dashboard.
 * Reuses logic from admin CustomRoleDialog.
 * 
 * Requirements: 5.2
 */

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Shield, Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

import type { CustomRole, Permission, CreateCustomRoleDTO, UpdateCustomRoleDTO } from '@/types/multi-user'
import { createCustomRole, updateCustomRole, listRoles } from '@/services/account-roles'

const roleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50, 'Nome muito longo'),
  description: z.string().max(200, 'Descrição muito longa').optional(),
  permissions: z.array(z.string()).min(1, 'Selecione pelo menos uma permissão'),
})

type RoleFormData = z.infer<typeof roleSchema>

interface CustomRoleDialogUserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: CustomRole | null
  onSuccess?: () => void
}

interface PermissionCategory {
  id: string
  label: string
  description: string
  permissions: { id: Permission; label: string; description: string }[]
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'conversations',
    label: 'Conversas',
    description: 'Gerenciar conversas com clientes',
    permissions: [
      { id: 'conversations:view', label: 'Visualizar', description: 'Ver conversas' },
      { id: 'conversations:create', label: 'Criar', description: 'Iniciar novas conversas' },
      { id: 'conversations:assign', label: 'Atribuir', description: 'Atribuir conversas a agentes' },
      { id: 'conversations:manage', label: 'Gerenciar', description: 'Atualizar status, silenciar e gerenciar labels' },
      { id: 'conversations:delete', label: 'Excluir', description: 'Excluir conversas' },
    ],
  },
  {
    id: 'messages',
    label: 'Mensagens',
    description: 'Enviar e gerenciar mensagens',
    permissions: [
      { id: 'messages:send', label: 'Enviar', description: 'Enviar mensagens' },
      { id: 'messages:delete', label: 'Excluir', description: 'Excluir mensagens' },
    ],
  },
  {
    id: 'contacts',
    label: 'Contatos',
    description: 'Gerenciar contatos',
    permissions: [
      { id: 'contacts:view', label: 'Visualizar', description: 'Ver contatos' },
      { id: 'contacts:create', label: 'Criar', description: 'Adicionar novos contatos' },
      { id: 'contacts:edit', label: 'Editar', description: 'Editar contatos existentes' },
      { id: 'contacts:delete', label: 'Excluir', description: 'Excluir contatos' },
    ],
  },
  {
    id: 'agents',
    label: 'Agentes',
    description: 'Gerenciar agentes da equipe',
    permissions: [
      { id: 'agents:view', label: 'Visualizar', description: 'Ver lista de agentes' },
      { id: 'agents:create', label: 'Criar', description: 'Adicionar novos agentes' },
      { id: 'agents:edit', label: 'Editar', description: 'Editar agentes existentes' },
      { id: 'agents:delete', label: 'Excluir', description: 'Desativar agentes' },
    ],
  },
  {
    id: 'teams',
    label: 'Equipes',
    description: 'Gerenciar equipes',
    permissions: [
      { id: 'teams:view', label: 'Visualizar', description: 'Ver equipes' },
      { id: 'teams:manage', label: 'Gerenciar', description: 'Criar, editar e excluir equipes' },
    ],
  },
  {
    id: 'inboxes',
    label: 'Caixas de Entrada',
    description: 'Gerenciar caixas de entrada',
    permissions: [
      { id: 'inboxes:view', label: 'Visualizar', description: 'Ver caixas de entrada' },
      { id: 'inboxes:manage', label: 'Gerenciar', description: 'Criar, editar e excluir caixas' },
    ],
  },
  {
    id: 'reports',
    label: 'Relatórios',
    description: 'Acessar relatórios e métricas',
    permissions: [
      { id: 'reports:view', label: 'Visualizar', description: 'Ver relatórios e métricas' },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Configurações do sistema',
    permissions: [
      { id: 'settings:view', label: 'Visualizar', description: 'Ver configurações' },
      { id: 'settings:edit', label: 'Editar', description: 'Alterar configurações' },
      { id: 'webhooks:manage', label: 'Webhooks', description: 'Gerenciar webhooks' },
      { id: 'integrations:manage', label: 'Integrações', description: 'Gerenciar integrações' },
    ],
  },
]

export function CustomRoleDialogUser({ open, onOpenChange, role, onSuccess }: CustomRoleDialogUserProps) {
  const [loading, setLoading] = useState(false)
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])

  const isEditing = !!role

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    },
  })

  const selectedPermissions = form.watch('permissions')

  const loadAvailablePermissions = useCallback(async () => {
    try {
      const data = await listRoles()
      setAvailablePermissions(data.availablePermissions)
    } catch (error) {
      console.error('Error loading permissions:', error)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadAvailablePermissions()
      if (role) {
        form.reset({
          name: role.name,
          description: role.description || '',
          permissions: role.permissions as string[],
        })
      } else {
        form.reset({
          name: '',
          description: '',
          permissions: [],
        })
      }
    }
  }, [open, role, form, loadAvailablePermissions])

  const handleSubmit = async (data: RoleFormData) => {
    try {
      setLoading(true)
      if (isEditing && role) {
        const updateData: UpdateCustomRoleDTO = {
          name: data.name,
          description: data.description || undefined,
          permissions: data.permissions as Permission[],
        }
        await updateCustomRole(role.id, updateData)
        toast.success('Papel atualizado com sucesso!')
      } else {
        const createData: CreateCustomRoleDTO = {
          name: data.name,
          description: data.description || undefined,
          permissions: data.permissions as Permission[],
        }
        await createCustomRole(createData)
        toast.success('Papel criado com sucesso!')
      }
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar papel')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  const togglePermission = (permissionId: string) => {
    const current = form.getValues('permissions')
    if (current.includes(permissionId)) {
      form.setValue('permissions', current.filter(p => p !== permissionId), { shouldValidate: true })
    } else {
      form.setValue('permissions', [...current, permissionId], { shouldValidate: true })
    }
  }

  const toggleCategory = (category: PermissionCategory) => {
    const current = form.getValues('permissions')
    const categoryPermissions = category.permissions.map(p => p.id)
    const allSelected = categoryPermissions.every(p => current.includes(p))
    
    if (allSelected) {
      form.setValue('permissions', current.filter(p => !categoryPermissions.includes(p as Permission)), { shouldValidate: true })
    } else {
      const newPermissions = [...new Set([...current, ...categoryPermissions])]
      form.setValue('permissions', newPermissions, { shouldValidate: true })
    }
  }

  const selectAll = () => {
    const allPermissions = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.id))
    form.setValue('permissions', allPermissions, { shouldValidate: true })
  }

  const clearAll = () => {
    form.setValue('permissions', [], { shouldValidate: true })
  }

  const getCategoryStatus = (category: PermissionCategory): 'all' | 'some' | 'none' => {
    const categoryPermissions = category.permissions.map(p => p.id)
    const selectedCount = categoryPermissions.filter(p => selectedPermissions.includes(p)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === categoryPermissions.length) return 'all'
    return 'some'
  }

  // Suppress unused variable warning
  void availablePermissions

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isEditing ? 'Editar Papel' : 'Novo Papel Personalizado'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações e permissões do papel.'
              : 'Crie um papel personalizado com permissões específicas.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Papel</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Supervisor" {...field} />
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
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva as responsabilidades deste papel..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between">
                    <FormLabel>Permissões</FormLabel>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedPermissions.length} selecionadas
                      </Badge>
                      <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Todas
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <FormDescription>
                    Selecione as permissões que este papel terá acesso.
                  </FormDescription>
                  <ScrollArea className="flex-1 border rounded-md mt-2">
                    <Accordion type="multiple" className="w-full" defaultValue={PERMISSION_CATEGORIES.map(c => c.id)}>
                      {PERMISSION_CATEGORIES.map((category) => {
                        const status = getCategoryStatus(category)
                        return (
                          <AccordionItem key={category.id} value={category.id} className="border-b last:border-b-0">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center gap-3 flex-1">
                                <Checkbox
                                  checked={status === 'all'}
                                  className={status === 'some' ? 'data-[state=checked]:bg-primary/50' : ''}
                                  onCheckedChange={() => toggleCategory(category)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="text-left">
                                  <div className="font-medium text-sm">{category.label}</div>
                                  <div className="text-xs text-muted-foreground">{category.description}</div>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs mr-2">
                                {category.permissions.filter(p => selectedPermissions.includes(p.id)).length}/{category.permissions.length}
                              </Badge>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-3">
                              <div className="grid grid-cols-2 gap-2 pl-7">
                                {category.permissions.map((permission) => (
                                  <div
                                    key={permission.id}
                                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                    onClick={() => togglePermission(permission.id)}
                                  >
                                    <Checkbox
                                      checked={selectedPermissions.includes(permission.id)}
                                      onCheckedChange={() => togglePermission(permission.id)}
                                      className="mt-0.5"
                                    />
                                    <div>
                                      <div className="text-sm font-medium">{permission.label}</div>
                                      <div className="text-xs text-muted-foreground">{permission.description}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : isEditing ? 'Salvar Alterações' : 'Criar Papel'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CustomRoleDialogUser
