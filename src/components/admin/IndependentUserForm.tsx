/**
 * IndependentUserForm Component
 * 
 * Inline form for creating/editing independent users.
 * Requirements: 7.2, 7.3
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Check, X } from 'lucide-react'

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  permissions: z.array(z.string()).default([])
})

const editUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  permissions: z.array(z.string()).default([])
})

type CreateUserFormData = z.infer<typeof createUserSchema>
type EditUserFormData = z.infer<typeof editUserSchema>

interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  status: 'active' | 'inactive'
  permissions: string[]
}

interface IndependentUserFormProps {
  user?: User | null
  onSubmit: (data: CreateUserFormData | EditUserFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const AVAILABLE_PERMISSIONS = [
  { value: 'messages:read', label: 'Ler mensagens' },
  { value: 'messages:send', label: 'Enviar mensagens' },
  { value: 'contacts:read', label: 'Ver contatos' },
  { value: 'contacts:write', label: 'Gerenciar contatos' },
  { value: 'campaigns:read', label: 'Ver campanhas' },
  { value: 'campaigns:write', label: 'Gerenciar campanhas' },
  { value: 'bots:read', label: 'Ver bots' },
  { value: 'bots:write', label: 'Gerenciar bots' },
  { value: 'webhooks:read', label: 'Ver webhooks' },
  { value: 'webhooks:write', label: 'Gerenciar webhooks' }
]

export function IndependentUserForm({
  user,
  onSubmit,
  onCancel,
  isLoading = false
}: IndependentUserFormProps) {
  const isEditing = !!user

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<CreateUserFormData | EditUserFormData>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema),
    defaultValues: user ? {
      name: user.name,
      avatarUrl: user.avatarUrl || '',
      status: user.status,
      permissions: user.permissions || []
    } : {
      email: '',
      password: '',
      name: '',
      avatarUrl: '',
      permissions: ['messages:read', 'messages:send']
    }
  })

  const permissions = watch('permissions') || []

  const handlePermissionChange = (permission: string, checked: boolean) => {
    const current = permissions
    if (checked) {
      setValue('permissions', [...current, permission])
    } else {
      setValue('permissions', current.filter(p => p !== permission))
    }
  }

  const handleFormSubmit = async (data: CreateUserFormData | EditUserFormData) => {
    await onSubmit(data)
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  disabled={isLoading}
                  {...register('email' as keyof CreateUserFormData)}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {(errors as { email?: { message?: string } }).email?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  disabled={isLoading}
                  {...register('password' as keyof CreateUserFormData)}
                />
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {(errors as { password?: { message?: string } }).password?.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              disabled={isLoading}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">URL do Avatar (opcional)</Label>
            <Input
              id="avatarUrl"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              disabled={isLoading}
              {...register('avatarUrl')}
            />
            {errors.avatarUrl && (
              <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
            )}
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status' as keyof EditUserFormData) as string}
                onValueChange={(value) => setValue('status' as keyof EditUserFormData, value as 'active' | 'inactive')}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <div key={perm.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={perm.value}
                    checked={permissions.includes(perm.value)}
                    onCheckedChange={(checked) =>
                      handlePermissionChange(perm.value, checked as boolean)
                    }
                    disabled={isLoading}
                  />
                  <label
                    htmlFor={perm.value}
                    className="text-sm cursor-pointer"
                  >
                    {perm.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditing ? 'Salvar' : 'Criar'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
