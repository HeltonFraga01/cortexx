/**
 * MacrosSection Component
 * 
 * Displays and executes macros
 * 
 * Requirements: 5.5, 5.6
 */

import { useCallback, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useChatApi } from '@/hooks/useChatApi'
import { Play, Loader2, Zap } from 'lucide-react'

interface MacrosSectionProps {
  conversationId: number
}

export function MacrosSection({ conversationId }: MacrosSectionProps) {
  const [executingId, setExecutingId] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const chatApi = useChatApi()

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ['macros', chatApi.isAgentMode],
    queryFn: chatApi.getMacros,
    staleTime: 60000
  })

  const executeMutation = useMutation({
    mutationFn: (macroId: number) => chatApi.executeMacro(macroId, conversationId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      const failedActions = result.results.filter(r => !r.success)
      if (failedActions.length === 0) {
        toast.success(`Macro "${result.macro}" executada com sucesso`)
      } else {
        toast.warning(`Macro "${result.macro}" executada com ${failedActions.length} erro(s)`)
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao executar macro', { description: error.message })
    },
    onSettled: () => {
      setExecutingId(null)
    }
  })

  const handleExecute = useCallback((macroId: number) => {
    setExecutingId(macroId)
    executeMutation.mutate(macroId)
  }, [executeMutation])

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>
  }

  if (macros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma macro configurada</p>
        <p className="text-xs text-muted-foreground mt-1">
          Macros permitem executar múltiplas ações com um clique
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {macros.map((macro) => (
        <Button
          key={macro.id}
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => handleExecute(macro.id)}
          disabled={executingId !== null}
        >
          {executingId === macro.id ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          <div className="flex-1 text-left">
            <span>{macro.name}</span>
            {macro.description && (
              <span className="text-xs text-muted-foreground ml-2">
                {macro.description}
              </span>
            )}
          </div>
        </Button>
      ))}
    </div>
  )
}

export default MacrosSection
