/**
 * EditContactForm Component
 * 
 * Inline Card-based form for editing contact basic information.
 * Follows UX pattern: No modals for forms.
 * 
 * Requirements: 8.6 (Contact CRM Evolution) - Inline editing of contact fields
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Check } from 'lucide-react'

const editContactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  phone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone muito longo'),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal(''))
})

type EditContactFormData = z.infer<typeof editContactSchema>

interface ContactData {
  id: string
  name: string | null
  phone: string
  avatarUrl?: string | null
}

interface EditContactFormProps {
  contact: ContactData
  onSave: (data: EditContactFormData) => Promise<void>
  onCancel: () => void
}

export function EditContactForm({
  contact,
  onSave,
  onCancel
}: EditContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<EditContactFormData>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      name: contact.name || '',
      phone: contact.phone || '',
      avatarUrl: contact.avatarUrl || ''
    }
  })

  // Reset form when contact changes
  useEffect(() => {
    reset({
      name: contact.name || '',
      phone: contact.phone || '',
      avatarUrl: contact.avatarUrl || ''
    })
  }, [contact, reset])

  const onSubmit = async (data: EditContactFormData) => {
    try {
      setIsSubmitting(true)
      await onSave(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Editar Contato</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="5511999999999"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="avatarUrl">URL do Avatar (opcional)</Label>
            <Input
              id="avatarUrl"
              placeholder="https://exemplo.com/avatar.jpg"
              {...register('avatarUrl')}
            />
            {errors.avatarUrl && (
              <p className="text-sm text-red-500">{errors.avatarUrl.message}</p>
            )}
          </div>

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
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default EditContactForm
