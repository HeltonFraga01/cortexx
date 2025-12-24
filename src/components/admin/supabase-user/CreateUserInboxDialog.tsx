/**
 * CreateUserInboxDialog
 * 
 * Dialog to create a new inbox or assign an existing one for a specific user (admin context).
 * Uses the admin endpoint to create/assign inbox linked to user's account.
 */

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Inbox, Loader2, Search, Plus, Link2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { supabaseUserService } from '@/services/supabase-user'
import type { UnassignedInbox } from '@/types/supabase-user'

const createInboxSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  phone_number: z.string().optional(),
  wuzapi_token: z.string().optional(),
  channel_type: z.enum(['whatsapp', 'email', 'web', 'api']).default('whatsapp'),
})

type CreateInboxFormData = z.infer<typeof createInboxSchema>

interface CreateUserInboxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSuccess?: () => void
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'web', label: 'Web Chat', icon: '💬' },
  { value: 'api', label: 'API', icon: '🔌' },
]

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱',
  email: '📧',
  web: '💬',
  api: '🔌',
}

export function CreateUserInboxDialog({ 
  open, 
  onOpenChange, 
  userId, 
  onSuccess 
}: CreateUserInboxDialogProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'create' | 'assign'>('create')
  const [unassignedInboxes, setUnassignedInboxes] = useState<UnassignedInbox[]>([])
  const [loadingInboxes, setLoadingInboxes] = useState(false)
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const form = useForm<CreateInboxFormData>({
    resolver: zodResolver(createInboxSchema),
    defaultValues: {
      name: '',
      phone_number: '',
      wuzapi_token: '',
      channel_type: 'whatsapp',
    },
  })

  // Load unassigned inboxes when tab changes to 'assign'
  useEffect(() => {
    if (open && activeTab === 'assign') {
      loadUnassignedInboxes()
    }
  }, [open, activeTab])

  const loadUnassignedInboxes = async () => {
    try {
      setLoadingInboxes(true)
      const inboxes = await supabaseUserService.getUnassignedInboxes()
      setUnassignedInboxes(inboxes)
    } catch (error) {
      toast.error('Erro ao carregar inboxes disponíveis')
    } finally {
      setLoadingInboxes(false)
    }
  }

  // Filter inboxes by search query
  const filteredInboxes = useMemo(() => {
    if (!searchQuery.trim()) return unassignedInboxes
    const query = searchQuery.toLowerCase()
    return unassignedInboxes.filter(inbox => 
      inbox.name.toLowerCase().includes(query) ||
      (inbox.phone_number && inbox.phone_number.includes(query))
    )
  }, [unassignedInboxes, searchQuery])

  const handleCreateSubmit = async (data: CreateInboxFormData) => {
    try {
      setLoading(true)
      await supabaseUserService.createInbox(userId, {
        name: data.name,
        phone_number: data.phone_number || undefined,
        wuzapi_token: data.wuzapi_token || undefined,
        channel_type: data.channel_type,
      })
      toast.success('Inbox criada com sucesso!')
      form.reset()
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar inbox')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignSubmit = async () => {
    if (!selectedInboxId) {
      toast.error('Selecione uma inbox para atribuir')
      return
    }

    try {
      setLoading(true)
      await supabaseUserService.assignInboxToUser(userId, selectedInboxId)
      toast.success('Inbox atribuída com sucesso!')
      setSelectedInboxId(null)
      setSearchQuery('')
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atribuir inbox')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    setSelectedInboxId(null)
    setSearchQuery('')
    setActiveTab('create')
    onOpenChange(false)
  }

  const selectedInbox = unassignedInboxes.find(i => i.id === selectedInboxId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Gerenciar Caixa de Entrada
          </DialogTitle>
          <DialogDescription>
            Crie uma nova caixa de entrada ou atribua uma existente para este usuário.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'assign')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova
            </TabsTrigger>
            <TabsTrigger value="assign" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Atribuir Existente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Caixa de Entrada *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: WhatsApp Suporte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channel_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Canal</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o canal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHANNEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                              </span>
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
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Telefone (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="5511999999999" {...field} />
                      </FormControl>
                      <FormDescription>
                        Formato: código do país + DDD + número
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wuzapi_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token WUZAPI (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Token de autenticação WUZAPI" {...field} />
                      </FormControl>
                      <FormDescription>
                        Token para integração com WUZAPI (WhatsApp)
                      </FormDescription>
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
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Inbox'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="assign" className="mt-4 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar inbox por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Inbox List */}
            <div className="border rounded-lg max-h-[280px] overflow-y-auto">
              {loadingInboxes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInboxes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Inbox className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {unassignedInboxes.length === 0 
                      ? 'Nenhuma caixa de entrada disponível'
                      : 'Nenhuma inbox encontrada para esta busca'
                    }
                  </p>
                  {unassignedInboxes.length === 0 && (
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => setActiveTab('create')}
                    >
                      Criar nova inbox
                    </Button>
                  )}
                </div>
              ) : (
                <RadioGroup
                  value={selectedInboxId || ''}
                  onValueChange={(value) => setSelectedInboxId(value)}
                  className="divide-y"
                >
                  {filteredInboxes.map((inbox) => (
                    <div
                      key={inbox.id}
                      className={`flex items-center space-x-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedInboxId === inbox.id ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => setSelectedInboxId(inbox.id)}
                    >
                      <RadioGroupItem value={inbox.id} id={inbox.id} />
                      <Label htmlFor={inbox.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{inbox.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{CHANNEL_ICONS[inbox.channel_type] || '📱'}</span>
                          <span className="capitalize">{inbox.channel_type}</span>
                          {inbox.phone_number && (
                            <>
                              <span>•</span>
                              <span>{inbox.phone_number}</span>
                            </>
                          )}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* Selected Inbox Preview */}
            {selectedInbox && (
              <div className="bg-muted/30 rounded-lg p-3 border">
                <p className="text-sm font-medium">Inbox selecionada:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedInbox.name} ({selectedInbox.channel_type})
                  {selectedInbox.phone_number && ` - ${selectedInbox.phone_number}`}
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAssignSubmit} 
                disabled={loading || !selectedInboxId}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Atribuindo...
                  </>
                ) : (
                  'Atribuir Inbox'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default CreateUserInboxDialog
