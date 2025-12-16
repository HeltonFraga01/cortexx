/**
 * ContactNotesSection Component
 * 
 * Displays and manages contact notes
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.6
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import { Plus, X, Check, Trash2 } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ContactNotesSectionProps {
  contactJid: string
}

export function ContactNotesSection({ contactJid }: ContactNotesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  
  const queryClient = useQueryClient()
  const chatApi = useChatApi()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['contactNotes', contactJid, chatApi.isAgentMode],
    queryFn: () => chatApi.getContactNotes(contactJid),
    staleTime: 30000
  })

  const createMutation = useMutation({
    mutationFn: (content: string) => chatApi.createContactNote(contactJid, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactNotes', contactJid] })
      setShowAddForm(false)
      setNewContent('')
      toast.success('Nota adicionada')
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar nota', { description: error.message })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chatApi.deleteContactNote(contactJid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactNotes', contactJid] })
      toast.success('Nota removida')
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover nota', { description: error.message })
    }
  })

  const handleAdd = useCallback(() => {
    if (!newContent.trim()) return
    createMutation.mutate(newContent.trim())
  }, [newContent, createMutation])

  const handleDelete = useCallback(async (id: number) => {
    const confirmed = await confirm({
      title: 'Excluir nota',
      description: 'Tem certeza que deseja excluir esta nota?',
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(id)
    }
  }, [confirm, deleteMutation])

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR })
    } catch {
      return dateStr
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog />
      
      {notes.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground">Nenhuma nota</p>
      )}

      {notes.map((note) => (
        <div key={note.id} className="p-2 bg-muted/50 rounded-lg group">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(note.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(note.createdAt)}</p>
        </div>
      ))}

      {showAddForm ? (
        <div className="space-y-2">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="text-sm min-h-[80px]"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending || !newContent.trim()}>
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="h-3 w-3 mr-1" />
          Adicionar nota
        </Button>
      )}
    </div>
  )
}

export default ContactNotesSection
