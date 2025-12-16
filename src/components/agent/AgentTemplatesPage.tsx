/**
 * AgentTemplatesPage
 * 
 * Page for agents to manage message templates.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  Plus, 
  Loader2, 
  FileText, 
  Edit, 
  Trash2, 
  Send, 
  X, 
  Check,
  Search
} from 'lucide-react'
import {
  getAgentTemplates,
  createAgentTemplate,
  updateAgentTemplate,
  deleteAgentTemplate,
  type AgentTemplate
} from '@/services/agent-messaging'

export default function AgentTemplatesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({ name: '', content: '' })
  
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['agent-templates'],
    queryFn: getAgentTemplates,
    staleTime: 60000
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createAgentTemplate,
    onSuccess: () => {
      toast.success('Template criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['agent-templates'] })
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar template', { description: error.message })
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; content?: string } }) =>
      updateAgentTemplate(id, data),
    onSuccess: () => {
      toast.success('Template atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['agent-templates'] })
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar template', { description: error.message })
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAgentTemplate,
    onSuccess: () => {
      toast.success('Template excluído com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['agent-templates'] })
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir template', { description: error.message })
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setFormData({ name: '', content: '' })
  }

  const handleEdit = (template: AgentTemplate) => {
    setEditingTemplate(template)
    setFormData({ name: template.name, content: template.content })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Preencha todos os campos')
      return
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleUseTemplate = (template: AgentTemplate) => {
    navigate('/agent/messaging', { state: { template } })
  }

  const handleDelete = (templateId: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      deleteMutation.mutate(templateId)
    }
  }

  // Filter templates by search
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Templates de Mensagem</h1>
          <p className="text-muted-foreground">
            Gerencie seus modelos de mensagem para reutilização
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* Form Card */}
      {showForm && (
        <Card className="mb-6 border-2 border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Boas-vindas"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo do template. Use {{nome}} para variáveis."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variavel}}'} para inserir variáveis que serão substituídas durante o envio.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {editingTemplate ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Seus Templates
          </CardTitle>
          <CardDescription>
            {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'Nenhum template encontrado' : 'Nenhum template cadastrado'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prévia</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {template.content.substring(0, 50)}
                      {template.content.length > 50 && '...'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUseTemplate(template)}
                          title="Usar template"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(template)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(template.id)}
                          disabled={deleteMutation.isPending}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
