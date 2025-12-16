/**
 * BotSettings Component
 * 
 * Manages agent bots for automated responses with priority ordering
 * and drag-and-drop reordering support.
 * Also displays admin-assigned bots with quota usage.
 * 
 * Requirements: 2.1, 3.1, 3.3, 4.1, 4.2, 4.3, 4.4, 9.1, 9.4
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  getBots, 
  createBot, 
  updateBot, 
  deleteBot, 
  pauseBot, 
  resumeBot,
  setDefaultBot,
  updateBotPriorities
} from '@/services/chat'
import type { AgentBot, CreateBotData } from '@/types/chat'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, Edit, Trash2, Play, Pause, Bot, Copy, X, Check, 
  Star, ChevronUp, ChevronDown, History, FlaskConical
} from 'lucide-react'
import { AdminAssignedBots } from './AdminAssignedBots'
import { BotTestChat } from './BotTestChat'

export function BotSettings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingBot, setEditingBot] = useState<AgentBot | null>(null)
  const [testingBot, setTestingBot] = useState<AgentBot | null>(null)
  const [formData, setFormData] = useState<CreateBotData>({
    name: '',
    description: '',
    outgoingUrl: '',
    includeHistory: false
  })

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: getBots
  })

  const createMutation = useMutation({
    mutationFn: createBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot criado com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar bot', { description: error.message })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateBotData> }) => updateBot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot atualizado com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar bot', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot excluído com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir bot', { description: error.message })
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      status === 'active' ? pauseBot(id) : resumeBot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Status do bot atualizado')
    },
    onError: (error: Error) => {
      toast.error('Erro ao alterar status', { description: error.message })
    }
  })

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Bot definido como padrão')
    },
    onError: (error: Error) => {
      toast.error('Erro ao definir bot padrão', { description: error.message })
    }
  })

  const reorderMutation = useMutation({
    mutationFn: updateBotPriorities,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      toast.success('Ordem atualizada')
    },
    onError: (error: Error) => {
      toast.error('Erro ao reordenar bots', { description: error.message })
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingBot(null)
    setFormData({ name: '', description: '', outgoingUrl: '', includeHistory: false })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingBot) {
      updateMutation.mutate({ id: editingBot.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (bot: AgentBot) => {
    setEditingBot(bot)
    setFormData({
      name: bot.name,
      description: bot.description || '',
      outgoingUrl: bot.outgoingUrl || '',
      includeHistory: bot.includeHistory || false
    })
    setShowForm(true)
  }

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success('Token copiado!')
    } catch {
      toast.error('Erro ao copiar token')
    }
  }

  const moveBot = useCallback((botId: number, direction: 'up' | 'down') => {
    const currentIndex = bots.findIndex(b => b.id === botId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= bots.length) return

    // Create new priorities array
    const newBots = [...bots]
    const [movedBot] = newBots.splice(currentIndex, 1)
    newBots.splice(newIndex, 0, movedBot)

    const priorities = newBots.map((bot, index) => ({
      id: bot.id,
      priority: index + 1
    }))

    reorderMutation.mutate(priorities)
  }, [bots, reorderMutation])

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Admin-assigned bots section */}
      <AdminAssignedBots />

      {/* Divider between admin bots and user bots */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Seus Bots
          </span>
        </div>
      </div>

      {/* User bots section */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Bots de Atendimento</h3>
          <p className="text-sm text-muted-foreground">
            Configure bots para automatizar respostas. O bot padrão será atribuído automaticamente a novas conversas.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Bot
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>{editingBot ? 'Editar Bot' : 'Novo Bot'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outgoingUrl">URL do Webhook</Label>
                <Input
                  id="outgoingUrl"
                  type="url"
                  placeholder="https://seu-servidor.com/webhook"
                  value={formData.outgoingUrl}
                  onChange={(e) => setFormData({ ...formData, outgoingUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  URL que receberá as mensagens para processamento pelo bot
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="includeHistory" className="text-sm font-medium">
                    Incluir histórico de mensagens
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Envia as últimas 10 mensagens da conversa no payload do webhook
                  </p>
                </div>
                <Switch
                  id="includeHistory"
                  checked={formData.includeHistory || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeHistory: checked })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Check className="h-4 w-4 mr-2" />
                  {editingBot ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {bots.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum bot configurado</p>
            <p className="text-sm text-muted-foreground">
              Crie um bot para automatizar respostas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bots.map((bot, index) => (
            <Card key={bot.id} className={bot.isDefault ? 'border-primary' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveBot(bot.id, 'up')}
                        disabled={index === 0 || reorderMutation.isPending}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveBot(bot.id, 'down')}
                        disabled={index === bots.length - 1 || reorderMutation.isPending}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="p-2 rounded-full bg-primary/10">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{bot.name}</h4>
                        {bot.isDefault && (
                          <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                            <Star className="h-3 w-3 mr-1" />
                            Padrão
                          </Badge>
                        )}
                        <Badge variant={bot.status === 'active' ? 'default' : 'secondary'}>
                          {bot.status === 'active' ? 'Ativo' : 'Pausado'}
                        </Badge>
                        {bot.includeHistory && (
                          <Badge variant="outline" className="text-xs">
                            <History className="h-3 w-3 mr-1" />
                            Histórico
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Prioridade: {bot.priority}
                        </span>
                      </div>
                      {bot.description && (
                        <p className="text-sm text-muted-foreground mt-1">{bot.description}</p>
                      )}
                      {bot.accessToken && (
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {bot.accessToken.substring(0, 20)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToken(bot.accessToken!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestingBot(bot)}
                      disabled={testingBot?.id === bot.id}
                      title="Conversar com o Bot"
                    >
                      <FlaskConical className="h-4 w-4 mr-1" />
                      Conversar
                    </Button>
                    {!bot.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(bot.id)}
                        disabled={setDefaultMutation.isPending}
                        title="Definir como padrão"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Padrão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatusMutation.mutate({ id: bot.id, status: bot.status })}
                      disabled={toggleStatusMutation.isPending}
                      title={bot.status === 'active' ? 'Pausar' : 'Ativar'}
                    >
                      {bot.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(bot)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(bot.id)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                {/* Test chat inline */}
                {testingBot?.id === bot.id && (
                  <div className="mt-4 pt-4 border-t">
                    <BotTestChat 
                      bot={bot} 
                      onClose={() => setTestingBot(null)} 
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default BotSettings
