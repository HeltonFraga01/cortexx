/**
 * AgentInviteDialog Component
 * 
 * Form to create invitation with generated link and copy/share buttons.
 * 
 * Requirements: 2.1, 2.2
 */

import { useState } from 'react'
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
import { Copy, Check, Mail, Link2, Share2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import type { AgentRole, CreateInvitationDTO } from '@/types/multi-user'
import { createInvitation } from '@/services/account-agents'

const invitationSchema = z.object({
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  role: z.enum(['administrator', 'agent', 'viewer'] as const),
})

type InvitationFormData = z.infer<typeof invitationSchema>

interface AgentInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface InvitationResult {
  id: string
  token: string
  role: AgentRole
  email?: string
  expiresAt: string
  invitationUrl: string
}

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

export function AgentInviteDialog({ open, onOpenChange, onSuccess }: AgentInviteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [invitation, setInvitation] = useState<InvitationResult | null>(null)
  const [copied, setCopied] = useState(false)

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      role: 'agent',
    },
  })

  const handleSubmit = async (data: InvitationFormData) => {
    try {
      setLoading(true)
      const dto: CreateInvitationDTO = {
        role: data.role,
        email: data.email || undefined,
      }
      const result = await createInvitation(dto)
      setInvitation(result)
      toast.success('Convite criado com sucesso!')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar convite')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!invitation?.invitationUrl) return

    try {
      await navigator.clipboard.writeText(invitation.invitationUrl)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar link')
    }
  }

  const handleShare = async () => {
    if (!invitation?.invitationUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite para se juntar à equipe',
          text: 'Você foi convidado para se juntar à nossa equipe. Clique no link para se registrar.',
          url: invitation.invitationUrl,
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink()
    }
  }

  const handleClose = () => {
    setInvitation(null)
    form.reset()
    onOpenChange(false)
  }

  const handleNewInvitation = () => {
    setInvitation(null)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {invitation ? 'Convite Criado' : 'Convidar Agente'}
          </DialogTitle>
          <DialogDescription>
            {invitation
              ? 'Compartilhe o link abaixo com o novo agente para que ele possa se registrar.'
              : 'Crie um link de convite para adicionar um novo agente à sua equipe.'}
          </DialogDescription>
        </DialogHeader>

        {invitation ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Papel:</span>
                <span className="text-sm">{ROLE_LABELS[invitation.role]}</span>
              </div>
              {invitation.email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-sm">{invitation.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Expira em:</span>
                <span className="text-sm">48 horas</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Link de Convite</label>
              <div className="flex gap-2">
                <Input
                  value={invitation.invitationUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
                <Link2 className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleNewInvitation} className="w-full sm:w-auto">
                Criar Novo Convite
              </Button>
              <Button onClick={handleClose} className="w-full sm:w-auto">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Se informado, apenas este email poderá usar o convite.
                    </FormDescription>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o papel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administrator">Administrador</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define as permissões que o agente terá no sistema.
                    </FormDescription>
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
                      Criando...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Criar Convite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AgentInviteDialog
