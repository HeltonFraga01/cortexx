/**
 * ContactAttributesSection Component
 * 
 * Displays and manages custom contact attributes
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import type { ContactAttribute } from '@/types/chat'
import { Plus, X, Check, Pencil, Trash2 } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface ContactAttributesSectionProps {
  contactJid: string
}

export function ContactAttributesSection({ contactJid }: ContactAttributesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  
  const queryClient = useQueryClient()
  const chatApi = useChatApi()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ['contactAttributes', contactJid, chatApi.isAgentMode],
    queryFn: () => chatApi.getContactAttributes(contactJid),
    staleTime: 30000
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; value: string }) => 
      chatApi.createContactAttribute(contactJid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactAttributes', contactJid] })
      setShowAddForm(false)
      setNewName('')
      setNewValue('')
      toast.success('Atributo adicionado')
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar atributo', { description: error.message })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) =>
      chatApi.updateContactAttribute(contactJid, id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactAttributes', contactJid] })
      setEditingId(null)
      setEditValue('')
      toast.success('Atributo atualizado')
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar atributo', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chatApi.deleteContactAttribute(contactJid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactAttributes', contactJid] })
      toast.success('Atributo removido')
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover atributo', { description: error.message })
    }
  })

  const handleAdd = useCallback(() => {
    if (!newName.trim() || !newValue.trim()) return
    createMutation.mutate({ name: newName.trim(), value: newValue.trim() })
  }, [newName, newValue, createMutation])

  const handleStartEdit = useCallback((attr: ContactAttribute) => {
    setEditingId(attr.id)
    setEditValue(attr.value)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingId === null || !editValue.trim()) return
    updateMutation.mutate({ id: editingId, value: editValue.trim() })
  }, [editingId, editValue, updateMutation])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  const handleDelete = useCallback(async (id: number) => {
    const confirmed = await confirm({
      title: 'Excluir atributo',
      description: 'Tem certeza que deseja excluir este atributo?',
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(id)
    }
  }, [confirm, deleteMutation])

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog />
      
      {attributes.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground">Nenhum atributo</p>
      )}

      {attributes.map((attr) => (
        <div key={attr.id} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground min-w-[80px]">{attr.name}:</span>
          {editingId === attr.id ? (
            <>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-7 text-sm flex-1"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm flex-1">{attr.value}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStartEdit(attr)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(attr.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      ))}

      {showAddForm ? (
        <div className="space-y-2 p-2 bg-muted/50 rounded-lg">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending}>
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="h-3 w-3 mr-1" />
          Adicionar atributo
        </Button>
      )}
    </div>
  )
}

export default ContactAttributesSection
