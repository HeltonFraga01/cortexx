/**
 * CRMContactAttributesSection Component
 * 
 * Displays and manages custom contact attributes in the CRM detail page.
 * Adapted from chat/ContactAttributesSection for CRM context.
 * 
 * Requirements: CRM-Chat Integration Spec - Requirement 2
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import type { ContactAttribute } from '@/types/chat'
import { FileText, Plus, X, Check, Pencil, Trash2 } from 'lucide-react'

interface CRMContactAttributesSectionProps {
  contactJid: string
}

export function CRMContactAttributesSection({ contactJid }: CRMContactAttributesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  
  const queryClient = useQueryClient()
  const chatApi = useChatApi()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ['crm-contact-attributes', contactJid],
    queryFn: () => chatApi.getContactAttributes(contactJid),
    enabled: !!contactJid,
    staleTime: 30000
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; value: string }) => 
      chatApi.createContactAttribute(contactJid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contact-attributes', contactJid] })
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
      queryClient.invalidateQueries({ queryKey: ['crm-contact-attributes', contactJid] })
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
      queryClient.invalidateQueries({ queryKey: ['crm-contact-attributes', contactJid] })
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Atributos do contato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfirmDialog />
        
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : (
          <>
            {attributes.length === 0 && !showAddForm && (
              <p className="text-sm text-muted-foreground">Nenhum atributo</p>
            )}

            {attributes.map((attr) => (
              <div key={attr.id} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground min-w-[100px] truncate">
                  {attr.name}:
                </span>
                {editingId === attr.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8" 
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8" 
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1 truncate">{attr.value}</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8" 
                      onClick={() => handleStartEdit(attr)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive hover:text-destructive" 
                      onClick={() => handleDelete(attr.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}

            {showAddForm ? (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-2">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false)
                      setNewName('')
                      setNewValue('')
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAdd} 
                    disabled={createMutation.isPending || !newName.trim() || !newValue.trim()}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowAddForm(true)} 
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar atributo
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default CRMContactAttributesSection
