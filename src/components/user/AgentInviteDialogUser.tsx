/**
 * AgentInviteDialogUser Component
 * 
 * Form to create invitation with generated link and WhatsApp share for user dashboard.
 * Sends invitation via WhatsApp instead of email.
 * 
 * Requirements: 2.2
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, Link2, Loader2, AlertTriangle, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import type { AgentRole, CreateInvitationDTO } from '@/types/multi-user'
import { createInvitation } from '@/services/account-agents'

const invitationSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\d{10,15}$/, 'Número deve ter entre 10 e 15 dígitos (apenas números)')
    .optional()
    .or(z.literal('')),
  role: z.enum(['administrator', 'agent', 'viewer'] as const),
})

type InvitationFormData = z.infer<typeof invitationSchema>

interface AgentInviteDialogUserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  maxAgentsReached?: boolean
}

interface InvitationResult {
  id: string
  token: string
  role: AgentRole
  phoneNumber?: string
  expiresAt: string
  invitationUrl: string
}

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

export function AgentInviteDialogUser({ 
  open, 
  onOpenChange, 
  onSuccess,
  maxAgentsReached = false 
}: AgentInviteDialogUserProps) {
  const [loading, setLoading] = useState(false)
  const [invitation, setInvitation] = useState<InvitationResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedPhoneNumber, setSavedPhoneNumber] = useState('')

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      phoneNumber: '',
      role: 'agent',
    },
  })

  const handleSubmit = async (data: InvitationFormData) => {
    if (maxAgentsReached) {
      toast.error('Limite de agentes atingido. Faça upgrade do seu plano.')
      return
    }

    try {
      setLoading(true)
      // Store phone number for WhatsApp sharing
      setSavedPhoneNumber(data.phoneNumber || '')
      
      const dto: CreateInvitationDTO = {
        role: data.role,
      }
      const result = await createInvitation(dto)
      setInvitation({ ...result, phoneNumber: data.phoneNumber || undefined })
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

  const handleSendWhatsApp = () => {
    if (!invitation?.invitationUrl) return

    const message = encodeURIComponent(
      `🎉 Você foi convidado para se juntar à nossa equipe!\n\n` +
      `Papel: ${ROLE_LABELS[invitation.role]}\n\n` +
      `Clique no link abaixo para se registrar:\n${invitation.invitationUrl}\n\n` +
      `⏰ Este convite expira em 48 horas.`
    )

    // If phone number provided, open chat directly
    if (savedPhoneNumber) {
      window.open(`https://wa.me/${savedPhoneNumber}?text=${message}`, '_blank')
    } else {
      // Open WhatsApp without specific number (user can choose contact)
      window.open(`https://wa.me/?text=${message}`, '_blank')
    }
  }

  const handleClose = () => {
    setInvitation(null)
    setSavedPhoneNumber('')
    form.reset()
    onOpenChange(false)
  }

  const handleNewInvitation = () => {
    setInvitation(null)
    setSavedPhoneNumber('')
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            {invitation ? 'Convite Criado' : 'Convidar Agente'}
          </DialogTitle>
          <DialogDescription>
            {invitation
              ? 'Compartilhe o link abaixo via WhatsApp com o novo agente.'
              : 'Crie um link de convite para adicionar um novo agente à sua equipe.'}
          </DialogDescription>
        </DialogHeader>

        {!invitation && maxAgentsReached && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você atingiu o limite de agentes do seu plano. 
              Faça upgrade para adicionar mais agentes.
            </AlertDescription>
          </Alert>
        )}

        {invitation ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Papel:</span>
                <span className="text-sm">{ROLE_LABELS[invitation.role]}</span>
              </div>
              {savedPhoneNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">WhatsApp:</span>
                  <span className="text-sm">+{savedPhoneNumber}</span>
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
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                onClick={handleSendWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar via WhatsApp
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="5511999999999" 
                        {...field} 
                        disabled={maxAgentsReached}
                      />
                    </FormControl>
                    <FormDescription>
                      Número com código do país (ex: 5511999999999). Se informado, abrirá o chat diretamente.
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
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={maxAgentsReached}
                    >
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
                <Button 
                  type="submit" 
                  disabled={loading || maxAgentsReached}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
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

export default AgentInviteDialogUser
