/**
 * PrivateNote Component
 * 
 * Input and display for private notes in conversations
 * 
 * Requirements: 22.1, 22.2, 22.4
 */

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatApi } from '@/hooks/useChatApi'
import { StickyNote, Send, Loader2 } from 'lucide-react'

interface PrivateNoteInputProps {
  conversationId: number
  onSuccess?: () => void
}

export function PrivateNoteInput({ conversationId, onSuccess }: PrivateNoteInputProps) {
  const [content, setContent] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const queryClient = useQueryClient()
  const chatApi = useChatApi()

  const addNoteMutation = useMutation({
    mutationFn: (noteContent: string) => chatApi.addPrivateNote(conversationId, noteContent),
    onSuccess: () => {
      setContent('')
      setIsExpanded(false)
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      onSuccess?.()
    }
  })

  const handleSubmit = useCallback(() => {
    if (content.trim()) {
      addNoteMutation.mutate(content.trim())
    }
  }, [content, addNoteMutation])

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
      >
        <StickyNote className="h-4 w-4 mr-2" />
        Adicionar nota privada
      </Button>
    )
  }

  return (
    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          Nota privada
        </span>
        <span className="text-xs text-yellow-600 dark:text-yellow-500">
          (visível apenas para você)
        </span>
      </div>
      
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva uma nota privada sobre esta conversa..."
        className="min-h-[80px] bg-white dark:bg-background border-yellow-200 dark:border-yellow-800 focus:border-yellow-400"
        autoFocus
      />
      
      <div className="flex justify-end gap-2 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsExpanded(false)
            setContent('')
          }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || addNoteMutation.isPending}
          className="bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          {addNoteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-1" />
              Salvar nota
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

interface PrivateNoteDisplayProps {
  content: string
  timestamp: string
  className?: string
}

export function PrivateNoteDisplay({ content, timestamp, className }: PrivateNoteDisplayProps) {
  const formattedTime = new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div
      className={cn(
        'p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
          Nota privada
        </span>
        <span className="text-xs text-yellow-600 dark:text-yellow-500">
          {formattedTime}
        </span>
      </div>
      <p className="text-sm text-yellow-800 dark:text-yellow-200 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  )
}

export default PrivateNoteInput
