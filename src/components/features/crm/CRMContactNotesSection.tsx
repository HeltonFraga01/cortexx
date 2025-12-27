/**
 * CRMContactNotesSection Component
 * 
 * Displays and manages contact notes in the CRM detail page.
 * Adapted from chat/ContactNotesSection for CRM context.
 * 
 * Requirements: CRM-Chat Integration Spec - Requirement 3
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { StickyNote, Plus, X, Check, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CRMContactNotesSectionProps {
  contactJid: string
}

export function CRMContactNotesSection({ contactJid }: CRMContactNotesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  
  const queryClient = useQueryClient()
  const chatApi = useChatApi()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['crm-contact-notes', contactJid],
    queryFn: () => chatApi.getContactNotes(contactJid),
    enabled: !!contactJid,
    staleTime: 30000
  })

  const createMutation = useMutation({
    mutationFn: (content: string) => chatApi.createContactNote(contactJid, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contact-notes', contactJid] })
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
      queryClient.invalidateQueries({ queryKey: ['crm-contact-notes', contactJid] })
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Notas do contato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfirmDialog />
        
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {notes.length === 0 && !showAddForm && (
              <p className="text-sm text-muted-foreground">Nenhuma nota</p>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-lg group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(note.createdAt)}</p>
                </div>
              ))}
            </div>

            {showAddForm ? (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="text-sm min-h-[80px] resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false)
                      setNewContent('')
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAdd} 
                    disabled={createMutation.isPending || !newContent.trim()}
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
                Adicionar nota
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default CRMContactNotesSection
