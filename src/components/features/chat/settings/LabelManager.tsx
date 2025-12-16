/**
 * LabelManager Component
 * 
 * Manages conversation labels
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getLabels, createLabel, updateLabel, deleteLabel } from '@/services/chat'
import type { Label as LabelType } from '@/types/chat'
import { Plus, Edit, Trash2, Tags, X, Check } from 'lucide-react'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
]

export function LabelManager() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null)
  const [formData, setFormData] = useState({ name: '', color: PRESET_COLORS[0] })

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['labels'],
    queryFn: getLabels
  })

  const createMutation = useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      toast.success('Etiqueta criada com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar etiqueta', { description: error.message })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; color?: string } }) =>
      updateLabel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      toast.success('Etiqueta atualizada com sucesso')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar etiqueta', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      toast.success('Etiqueta excluída com sucesso')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir etiqueta', { description: error.message })
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingLabel(null)
    setFormData({ name: '', color: PRESET_COLORS[0] })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingLabel) {
      updateMutation.mutate({ id: editingLabel.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (label: LabelType) => {
    setEditingLabel(label)
    setFormData({ name: label.name, color: label.color || PRESET_COLORS[0] })
    setShowForm(true)
  }

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Etiquetas</h3>
          <p className="text-sm text-muted-foreground">
            Organize conversas com etiquetas coloridas
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Etiqueta
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
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
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        formData.color === color ? 'scale-110 border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className="px-3 py-1 rounded-full text-sm text-white"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.name || 'Preview'}
                </span>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Check className="h-4 w-4 mr-2" />
                  {editingLabel ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {labels.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Tags className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma etiqueta criada</p>
            <p className="text-sm text-muted-foreground">
              Crie etiquetas para organizar suas conversas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="font-medium">{label.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(label)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(label.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LabelManager
