/**
 * CannedResponseManager Component
 * 
 * Manages canned responses (quick replies)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse
} from '@/services/chat'
import type { CannedResponse, CreateCannedResponseData } from '@/types/chat'
import { Plus, Edit, Trash2, MessageSquareText, X, Check, Search } from 'lucide-react'

export function CannedResponseManager() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState<CreateCannedResponseData>({
    shortcut: '',
    content: ''
  })

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['canned-responses', searchQuery],
    queryFn: () => getCannedResponses(searchQuery || undefined)
  })

  const createMutation = useMutation({
    mutationFn: createCannedResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      toast.success('Resposta rápida criada com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar resposta', { description: error.message })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCannedResponseData> }) =>
      updateCannedResponse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      toast.success('Resposta rápida atualizada com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar resposta', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCannedResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] })
      toast.success('Resposta rápida excluída com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir resposta', { description: error.message })
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingResponse(null)
    setFormData({ shortcut: '', content: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingResponse) {
      updateMutation.mutate({ id: editingResponse.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (response: CannedResponse) => {
    setEditingResponse(response)
    setFormData({ shortcut: response.shortcut, content: response.content })
    setShowForm(true)
  }

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Respostas Rápidas</h3>
          <p className="text-sm text-muted-foreground">
            Crie atalhos para mensagens frequentes (use / no chat)
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Resposta
          </Button>
        )}
      </div>

      {!showForm && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por atalho ou conteúdo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {showForm && (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shortcut">Atalho</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <Input
                    id="shortcut"
                    value={formData.shortcut}
                    onChange={(e) =>
                      setFormData({ ...formData, shortcut: e.target.value.replace(/\s/g, '') })
                    }
                    placeholder="saudacao"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite /{formData.shortcut || 'atalho'} no chat para usar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Olá! Como posso ajudar?"
                  rows={4}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Check className="h-4 w-4 mr-2" />
                  {editingResponse ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {responses.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageSquareText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta rápida criada'}
            </p>
            <p className="text-sm text-muted-foreground">
              Crie respostas rápidas para agilizar o atendimento
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {responses.map((response) => (
            <Card key={response.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                        /{response.shortcut}
                      </code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-3">
                      {response.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(response)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(response.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default CannedResponseManager
