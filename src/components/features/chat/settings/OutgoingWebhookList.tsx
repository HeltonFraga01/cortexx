/**
 * OutgoingWebhookList Component
 * 
 * Manages outgoing webhooks for a specific inbox.
 * Allows creating, editing, deleting, and testing webhooks.
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  getOutgoingWebhooks,
  createOutgoingWebhook,
  updateOutgoingWebhook,
  deleteOutgoingWebhook,
  testWebhook
} from '@/services/chat'
import type { OutgoingWebhook, CreateWebhookData } from '@/types/chat'
import { Plus, Edit, Trash2, Webhook, X, Check, TestTube, Activity, Loader2 } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

const AVAILABLE_EVENTS = [
  { id: 'message.received', label: 'Mensagem Recebida' },
  { id: 'message.sent', label: 'Mensagem Enviada' },
  { id: 'message.read', label: 'Mensagem Lida' },
  { id: 'message.delivered', label: 'Mensagem Entregue' },
  { id: 'conversation.created', label: 'Conversa Criada' },
  { id: 'conversation.updated', label: 'Conversa Atualizada' },
  { id: 'bot.handoff', label: 'Transferência de Bot' }
]

interface OutgoingWebhookListProps {
  inboxId: string
}

export function OutgoingWebhookList({ inboxId }: OutgoingWebhookListProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [showForm, setShowForm] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<OutgoingWebhook | null>(null)
  const [formData, setFormData] = useState<CreateWebhookData>({
    url: '',
    events: [],
    isActive: true,
    inboxId
  })

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['outgoing-webhooks', inboxId],
    queryFn: () => getOutgoingWebhooks(inboxId)
  })

  const createMutation = useMutation({
    mutationFn: createOutgoingWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outgoing-webhooks', inboxId] })
      toast.success('Webhook criado com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar webhook', { description: error.message })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateWebhookData> }) =>
      updateOutgoingWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outgoing-webhooks', inboxId] })
      toast.success('Webhook atualizado com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar webhook', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOutgoingWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outgoing-webhooks', inboxId] })
      toast.success('Webhook excluído com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir webhook', { description: error.message })
    }
  })

  const testMutation = useMutation({
    mutationFn: testWebhook,
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Teste enviado com sucesso!')
      } else {
        toast.error('Falha no teste', { description: result.error })
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar webhook', { description: error.message })
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingWebhook(null)
    setFormData({ url: '', events: [], isActive: true, inboxId })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data: formData })
    } else {
      createMutation.mutate({ ...formData, inboxId })
    }
  }

  const handleEdit = (webhook: OutgoingWebhook) => {
    setEditingWebhook(webhook)
    setFormData({
      url: webhook.url,
      events: webhook.events || [],
      isActive: webhook.isActive,
      inboxId
    })
    setShowForm(true)
  }

  const handleDelete = async (webhookId: number) => {
    const confirmed = await confirm({
      title: 'Excluir Webhook',
      description: 'Tem certeza que deseja excluir este webhook? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(webhookId)
    }
  }

  const toggleEvent = (eventId: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId as any)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId as any]
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando webhooks...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium">Webhooks de Saída</h4>
          <p className="text-sm text-muted-foreground">
            Envie eventos de chat para sistemas externos
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Webhook
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-primary">
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL do Webhook</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://seu-servidor.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Eventos</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`event-${event.id}`}
                        checked={formData.events.includes(event.id as any)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <label htmlFor={`event-${event.id}`} className="text-sm cursor-pointer">
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Ativo</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Check className="h-4 w-4 mr-2" />
                  {editingWebhook ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {webhooks.length === 0 && !showForm ? (
        <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
          <Webhook className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum webhook configurado</p>
          <p className="text-xs mt-1">Configure webhooks para integrar com outros sistemas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div 
              key={webhook.id} 
              className="flex items-start justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                  <Webhook className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[250px]">
                      {webhook.url}
                    </code>
                    <Badge variant={webhook.isActive ? 'default' : 'secondary'} className="text-xs">
                      {webhook.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.events?.slice(0, 3).map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {AVAILABLE_EVENTS.find((e) => e.id === event)?.label || event}
                      </Badge>
                    ))}
                    {webhook.events?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{webhook.events.length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {webhook.successCount} sucesso
                    </span>
                    <span>{webhook.failureCount} falhas</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => testMutation.mutate(webhook.id)}
                  disabled={testMutation.isPending}
                  title="Testar webhook"
                >
                  <TestTube className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleEdit(webhook)}
                  title="Editar webhook"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(webhook.id)}
                  disabled={deleteMutation.isPending}
                  title="Excluir webhook"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}

export default OutgoingWebhookList
