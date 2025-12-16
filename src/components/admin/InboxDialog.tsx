/**
 * InboxDialog Component
 * 
 * Create/edit inbox form with agent assignment.
 * 
 * Requirements: 4.2, 4.3
 */

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Inbox, Loader2, UserPlus, UserMinus, Search, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

import type { 
  InboxWithStats, 
  InboxMember,
  Agent,
  CreateInboxDTO, 
  UpdateInboxDTO 
} from '@/types/multi-user'
import { 
  createInbox, 
  updateInbox, 
  getInbox, 
  assignAgentsToInbox, 
  removeAgentFromInbox 
} from '@/services/account-inboxes'
import { listAgents } from '@/services/account-agents'

const inboxSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  channelType: z.enum(['whatsapp', 'email', 'web', 'api']).default('whatsapp'),
  enableAutoAssignment: z.boolean().default(true),
  greetingEnabled: z.boolean().default(false),
  greetingMessage: z.string().max(1000, 'Mensagem muito longa').optional(),
})

type InboxFormData = z.infer<typeof inboxSchema>

interface InboxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inbox?: InboxWithStats | null
  onSuccess?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

const AVAILABILITY_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'web', label: 'Web Chat', icon: '💬' },
  { value: 'api', label: 'API', icon: '🔌' },
]

export function InboxDialog({ open, onOpenChange, inbox, onSuccess }: InboxDialogProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [inboxMembers, setInboxMembers] = useState<InboxMember[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  const isEditing = !!inbox

  const form = useForm<InboxFormData>({
    resolver: zodResolver(inboxSchema),
    defaultValues: {
      name: '',
      description: '',
      channelType: 'whatsapp',
      enableAutoAssignment: true,
      greetingEnabled: false,
      greetingMessage: '',
    },
  })

  const greetingEnabled = form.watch('greetingEnabled')

  const loadInboxData = useCallback(async () => {
    if (!inbox?.id) return
    try {
      setLoadingMembers(true)
      const inboxData = await getInbox(inbox.id)
      setInboxMembers(inboxData.members || [])
    } catch (error) {
      console.error('Error loading inbox data:', error)
      toast.error('Erro ao carregar dados da caixa de entrada')
    } finally {
      setLoadingMembers(false)
    }
  }, [inbox?.id])

  const loadAvailableAgents = useCallback(async () => {
    try {
      const agents = await listAgents({ status: 'active' })
      setAvailableAgents(agents)
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }, [])

  useEffect(() => {
    if (open) {
      if (inbox) {
        form.reset({
          name: inbox.name,
          description: inbox.description || '',
          channelType: inbox.channelType as 'whatsapp' | 'email' | 'web' | 'api',
          enableAutoAssignment: inbox.enableAutoAssignment,
          greetingEnabled: inbox.greetingEnabled,
          greetingMessage: inbox.greetingMessage || '',
        })
        loadInboxData()
      } else {
        form.reset({
          name: '',
          description: '',
          channelType: 'whatsapp',
          enableAutoAssignment: true,
          greetingEnabled: false,
          greetingMessage: '',
        })
        setInboxMembers([])
      }
      loadAvailableAgents()
      setActiveTab('details')
      setSelectedAgents(new Set())
      setMemberSearch('')
    }
  }, [open, inbox, form, loadInboxData, loadAvailableAgents])

  const handleSubmit = async (data: InboxFormData) => {
    try {
      setLoading(true)
      if (isEditing && inbox) {
        const updateData: UpdateInboxDTO = {
          name: data.name,
          description: data.description || undefined,
          enableAutoAssignment: data.enableAutoAssignment,
          greetingEnabled: data.greetingEnabled,
          greetingMessage: data.greetingEnabled ? data.greetingMessage : undefined,
        }
        await updateInbox(inbox.id, updateData)
        toast.success('Caixa de entrada atualizada com sucesso!')
      } else {
        const createData: CreateInboxDTO = {
          name: data.name,
          description: data.description || undefined,
          channelType: data.channelType,
          enableAutoAssignment: data.enableAutoAssignment,
          greetingEnabled: data.greetingEnabled,
          greetingMessage: data.greetingEnabled ? data.greetingMessage : undefined,
        }
        await createInbox(createData)
        toast.success('Caixa de entrada criada com sucesso!')
      }
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar caixa de entrada')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMembers = async () => {
    if (!inbox?.id || selectedAgents.size === 0) return
    try {
      setAddingMembers(true)
      await assignAgentsToInbox(inbox.id, Array.from(selectedAgents))
      toast.success(`${selectedAgents.size} agente(s) adicionado(s)`)
      setSelectedAgents(new Set())
      loadInboxData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar agentes')
    } finally {
      setAddingMembers(false)
    }
  }

  const handleRemoveMember = async (agentId: string) => {
    if (!inbox?.id) return
    try {
      setRemovingMember(agentId)
      await removeAgentFromInbox(inbox.id, agentId)
      toast.success('Agente removido da caixa de entrada')
      loadInboxData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover agente')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleClose = () => {
    form.reset()
    setInboxMembers([])
    setSelectedAgents(new Set())
    setMemberSearch('')
    onOpenChange(false)
  }

  const toggleAgentSelection = (agentId: string) => {
    const newSelected = new Set(selectedAgents)
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId)
    } else {
      newSelected.add(agentId)
    }
    setSelectedAgents(newSelected)
  }

  const memberIds = new Set(inboxMembers.map(m => m.id))
  const filteredAvailableAgents = availableAgents
    .filter(agent => !memberIds.has(agent.id))
    .filter(agent => 
      agent.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      agent.email.toLowerCase().includes(memberSearch.toLowerCase())
    )

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            {isEditing ? 'Editar Caixa de Entrada' : 'Nova Caixa de Entrada'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as configurações da caixa de entrada e gerencie os agentes.'
              : 'Crie uma nova caixa de entrada para receber conversas.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="agents" disabled={!isEditing}>
              Agentes {isEditing && `(${inboxMembers.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-auto mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Caixa de Entrada</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Suporte WhatsApp" {...field} />
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
                          placeholder="Descreva o propósito desta caixa de entrada..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Canal</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isEditing}
                      >
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
                      {isEditing && (
                        <FormDescription>O tipo de canal não pode ser alterado após a criação.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableAutoAssignment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Auto-Atribuição</FormLabel>
                        <FormDescription className="text-xs">
                          Atribuir conversas automaticamente aos agentes disponíveis.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="greetingEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Mensagem de Boas-vindas</FormLabel>
                        <FormDescription className="text-xs">
                          Enviar mensagem automática ao iniciar conversa.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {greetingEnabled && (
                  <FormField
                    control={form.control}
                    name="greetingMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensagem de Boas-vindas</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Olá! Como posso ajudá-lo hoje?"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                    ) : isEditing ? 'Salvar Alterações' : 'Criar Caixa'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="agents" className="flex-1 overflow-hidden flex flex-col mt-4">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden flex flex-col">
                  <h4 className="text-sm font-medium mb-2">Agentes Atribuídos ({inboxMembers.length})</h4>
                  {inboxMembers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum agente atribuído</p>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 border rounded-md">
                      <div className="p-2 space-y-1">
                        {inboxMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.avatarUrl} />
                                  <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${AVAILABILITY_COLORS[member.availability]}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{ROLE_LABELS[member.role]}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMember === member.id}
                              >
                                {removingMember === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Adicionar Agentes
                  </h4>
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar agentes..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <ScrollArea className="h-[150px] border rounded-md">
                    <div className="p-2 space-y-1">
                      {filteredAvailableAgents.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          {memberSearch ? 'Nenhum agente encontrado' : 'Todos os agentes já estão atribuídos'}
                        </div>
                      ) : (
                        filteredAvailableAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleAgentSelection(agent.id)}
                          >
                            <Checkbox checked={selectedAgents.has(agent.id)} onCheckedChange={() => toggleAgentSelection(agent.id)} />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agent.avatarUrl} />
                              <AvatarFallback className="text-xs">{getInitials(agent.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">{ROLE_LABELS[agent.role]}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {selectedAgents.size > 0 && (
                    <Button onClick={handleAddMembers} disabled={addingMembers} className="w-full">
                      {addingMembers ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adicionando...</>
                      ) : (
                        <><UserPlus className="h-4 w-4 mr-2" />Adicionar {selectedAgents.size} Agente(s)</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default InboxDialog
