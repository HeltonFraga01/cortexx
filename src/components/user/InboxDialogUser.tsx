/**
 * InboxDialogUser Component
 * 
 * Create/edit inbox form with agent assignment for user dashboard.
 * Reuses logic from admin InboxDialog.
 * 
 * Requirements: 4.2, 4.3, 4.4
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Inbox, Loader2, UserPlus, UserMinus, Search, MessageSquare, AlertTriangle, QrCode, Wifi, WifiOff, RefreshCw } from 'lucide-react'
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
  removeAgentFromInbox,
  getInboxQRCode,
  getInboxStatus
} from '@/services/account-inboxes'
import { listAgents } from '@/services/account-agents'

const inboxSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  phoneNumber: z.string().regex(/^\d{10,15}$/, 'Número inválido (apenas números, com código do país)').optional().or(z.literal('')),
  enableAutoAssignment: z.boolean().default(true),
  maxConversationsPerAgent: z.coerce.number().min(0).max(100).nullable().optional(),
  greetingEnabled: z.boolean().default(false),
  greetingMessage: z.string().max(1000, 'Mensagem muito longa').optional(),
  // WUZAPI configuration for WhatsApp channels
  webhookUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  webhookEvents: z.string().optional(),
  messageHistory: z.coerce.number().min(0).max(100).default(0),
})

type InboxFormData = z.infer<typeof inboxSchema>

// Available webhook events for WUZAPI
const WEBHOOK_EVENTS = [
  { value: 'Message', label: 'Mensagens' },
  { value: 'Receipt', label: 'Confirmações de Leitura' },
  { value: 'Presence', label: 'Presença Online' },
  { value: 'ChatPresence', label: 'Digitando...' },
  { value: 'GroupInfo', label: 'Info de Grupos' },
  { value: 'CallOffer', label: 'Chamadas' },
  { value: 'HistorySync', label: 'Sincronização de Histórico' },
]

interface InboxDialogUserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inbox?: InboxWithStats | null
  onSuccess?: () => void
  maxInboxesReached?: boolean
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

// Only WhatsApp channel is supported
const CHANNEL_TYPE = 'whatsapp'

export function InboxDialogUser({ 
  open, 
  onOpenChange, 
  inbox, 
  onSuccess,
  maxInboxesReached = false 
}: InboxDialogUserProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [inboxMembers, setInboxMembers] = useState<InboxMember[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  
  // QR Code state for WhatsApp inboxes
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'not_configured'>('disconnected')

  const isEditing = !!inbox
  const isWhatsApp = true // Only WhatsApp is supported

  const form = useForm<InboxFormData>({
    resolver: zodResolver(inboxSchema),
    defaultValues: {
      name: '',
      description: '',
      phoneNumber: '',
      enableAutoAssignment: true,
      maxConversationsPerAgent: null,
      greetingEnabled: false,
      greetingMessage: '',
      webhookUrl: '',
      webhookEvents: 'Message',
      messageHistory: 0,
    },
  })

  const greetingEnabled = form.watch('greetingEnabled')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(['Message']))

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

  const loadQrCode = useCallback(async () => {
    if (!inbox?.id || inbox.channelType !== 'whatsapp') return
    try {
      setLoadingQr(true)
      const data = await getInboxQRCode(inbox.id)
      setQrCode(data.qrCode)
      setConnectionStatus(data.connected ? 'connected' : 'disconnected')
    } catch (error) {
      console.error('Error loading QR code:', error)
      toast.error('Erro ao carregar QR Code')
    } finally {
      setLoadingQr(false)
    }
  }, [inbox?.id, inbox?.channelType])

  const checkConnectionStatus = useCallback(async () => {
    if (!inbox?.id || inbox.channelType !== 'whatsapp') return
    try {
      const status = await getInboxStatus(inbox.id)
      setConnectionStatus(status.status)
      if (status.loggedIn) {
        setQrCode(null)
        toast.success('WhatsApp conectado com sucesso!')
        onSuccess?.()
      }
    } catch (error) {
      console.error('Error checking connection status:', error)
    }
  }, [inbox?.id, inbox?.channelType, onSuccess])

  useEffect(() => {
    if (open) {
      if (inbox) {
        form.reset({
          name: inbox.name,
          description: inbox.description || '',
          phoneNumber: inbox.phoneNumber || '',
          enableAutoAssignment: inbox.enableAutoAssignment,
          maxConversationsPerAgent: inbox.autoAssignmentConfig?.maxConversationsPerAgent ?? null,
          greetingEnabled: inbox.greetingEnabled,
          greetingMessage: inbox.greetingMessage || '',
        })
        loadInboxData()
      } else {
        form.reset({
          name: '',
          description: '',
          phoneNumber: '',
          enableAutoAssignment: true,
          maxConversationsPerAgent: null,
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
    if (!isEditing && maxInboxesReached) {
      toast.error('Limite de caixas de entrada atingido. Faça upgrade do seu plano.')
      return
    }

    try {
      setLoading(true)
      
      // Build autoAssignmentConfig
      const autoAssignmentConfig = {
        maxConversationsPerAgent: data.maxConversationsPerAgent || null,
      }
      
      if (isEditing && inbox) {
        const updateData: UpdateInboxDTO = {
          name: data.name,
          description: data.description || undefined,
          enableAutoAssignment: data.enableAutoAssignment,
          autoAssignmentConfig,
          greetingEnabled: data.greetingEnabled,
          greetingMessage: data.greetingEnabled ? data.greetingMessage : undefined,
        }
        await updateInbox(inbox.id, updateData)
        toast.success('Caixa de entrada atualizada com sucesso!')
      } else {
        const createData: CreateInboxDTO = {
          name: data.name,
          description: data.description || undefined,
          channelType: CHANNEL_TYPE,
          phoneNumber: data.phoneNumber || undefined,
          enableAutoAssignment: data.enableAutoAssignment,
          autoAssignmentConfig,
          greetingEnabled: data.greetingEnabled,
          greetingMessage: data.greetingEnabled ? data.greetingMessage : undefined,
          // WUZAPI configuration for WhatsApp
          wuzapiConfig: {
            webhook: data.webhookUrl || '',
            events: Array.from(selectedEvents).join(',') || 'Message',
            history: data.messageHistory || 0,
          },
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
    setSelectedEvents(new Set(['Message']))
    setMemberSearch('')
    setQrCode(null)
    setConnectionStatus('disconnected')
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

        {!isEditing && maxInboxesReached && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você atingiu o limite de caixas de entrada do seu plano. 
              Faça upgrade para criar mais caixas.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className={`grid w-full ${isEditing && isWhatsApp ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            {isEditing && isWhatsApp && (
              <TabsTrigger value="whatsapp" className="flex items-center gap-1">
                {connectionStatus === 'connected' ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                WhatsApp
              </TabsTrigger>
            )}
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
                        <Input 
                          placeholder="Ex: Suporte WhatsApp" 
                          {...field} 
                          disabled={!isEditing && maxInboxesReached}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone Number field */}
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Telefone</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="5521999999999" 
                          {...field} 
                          disabled={!isEditing && maxInboxesReached}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Identificador único do número de telefone para esta instância (apenas números, com código do país)
                      </FormDescription>
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
                          className="resize-none"
                          rows={2}
                          {...field}
                          disabled={!isEditing && maxInboxesReached}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* WUZAPI Configuration for WhatsApp */}
                {!isEditing && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      📱 Configuração WhatsApp
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="webhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL do Webhook (opcional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://seu-servidor.com/webhook" 
                              {...field} 
                              disabled={maxInboxesReached}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            URL para receber notificações de mensagens e eventos
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel className="text-sm">Eventos do Webhook</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {WEBHOOK_EVENTS.map((event) => (
                          <div 
                            key={event.value}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`event-${event.value}`}
                              checked={selectedEvents.has(event.value)}
                              onCheckedChange={(checked) => {
                                const newEvents = new Set(selectedEvents)
                                if (checked) {
                                  newEvents.add(event.value)
                                } else {
                                  newEvents.delete(event.value)
                                }
                                setSelectedEvents(newEvents)
                                form.setValue('webhookEvents', Array.from(newEvents).join(','))
                              }}
                              disabled={maxInboxesReached}
                            />
                            <label 
                              htmlFor={`event-${event.value}`}
                              className="text-sm cursor-pointer"
                            >
                              {event.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="messageHistory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Histórico de Mensagens</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            defaultValue={String(field.value)}
                            disabled={maxInboxesReached}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Não sincronizar histórico</SelectItem>
                              <SelectItem value="10">Últimas 10 mensagens</SelectItem>
                              <SelectItem value="25">Últimas 25 mensagens</SelectItem>
                              <SelectItem value="50">Últimas 50 mensagens</SelectItem>
                              <SelectItem value="100">Últimas 100 mensagens</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Quantidade de mensagens antigas para sincronizar ao conectar
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

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
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          disabled={!isEditing && maxInboxesReached}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('enableAutoAssignment') && (
                  <FormField
                    control={form.control}
                    name="maxConversationsPerAgent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máximo de Conversas por Agente</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === '0' ? null : parseInt(value))} 
                          value={field.value ? String(field.value) : '0'}
                          disabled={!isEditing && maxInboxesReached}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sem limite" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">Sem limite</SelectItem>
                            <SelectItem value="5">5 conversas</SelectItem>
                            <SelectItem value="10">10 conversas</SelectItem>
                            <SelectItem value="15">15 conversas</SelectItem>
                            <SelectItem value="20">20 conversas</SelectItem>
                            <SelectItem value="25">25 conversas</SelectItem>
                            <SelectItem value="50">50 conversas</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          Limite de conversas simultâneas que cada agente pode atender. Agentes que atingirem o limite não receberão novas atribuições automáticas.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          disabled={!isEditing && maxInboxesReached}
                        />
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
                            disabled={!isEditing && maxInboxesReached}
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
                  <Button type="submit" disabled={loading || (!isEditing && maxInboxesReached)}>
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

          {/* WhatsApp Connection Tab */}
          {isEditing && isWhatsApp && (
            <TabsContent value="whatsapp" className="flex-1 overflow-auto mt-4">
              <div className="space-y-6">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {connectionStatus === 'connected' ? (
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <WifiOff className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {connectionStatus === 'connected' ? 'WhatsApp Conectado' : 
                         connectionStatus === 'connecting' ? 'Conectando...' : 'WhatsApp Desconectado'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {connectionStatus === 'connected' 
                          ? 'Sua caixa de entrada está pronta para receber mensagens'
                          : 'Escaneie o QR Code para conectar'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkConnectionStatus}
                    disabled={loadingQr}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingQr ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>

                {/* QR Code Section */}
                {connectionStatus !== 'connected' && (
                  <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-muted/30">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                    <h4 className="font-medium">Conectar WhatsApp</h4>
                    
                    {loadingQr ? (
                      <div className="flex items-center justify-center h-64 w-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : qrCode ? (
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <img 
                          src={qrCode} 
                          alt="QR Code WhatsApp" 
                          className="w-64 h-64"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground text-center">
                          Clique no botão abaixo para gerar o QR Code
                        </p>
                        <Button onClick={loadQrCode} disabled={loadingQr}>
                          <QrCode className="h-4 w-4 mr-2" />
                          Gerar QR Code
                        </Button>
                      </div>
                    )}
                    
                    {qrCode && (
                      <div className="text-center space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Abra o WhatsApp no seu celular e escaneie este código
                        </p>
                        <Button variant="outline" size="sm" onClick={loadQrCode} disabled={loadingQr}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${loadingQr ? 'animate-spin' : ''}`} />
                          Gerar Novo QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Connected Info */}
                {connectionStatus === 'connected' && (
                  <Alert>
                    <Wifi className="h-4 w-4" />
                    <AlertDescription>
                      Sua conexão WhatsApp está ativa. As mensagens recebidas serão direcionadas para esta caixa de entrada.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default InboxDialogUser
