/**
 * InboxTransferSelector Component
 * 
 * Allows transferring a conversation to another inbox
 * 
 * Requirements: REQ-1.1, REQ-1.2, REQ-1.4, REQ-1.5, REQ-2.1
 */

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowRightLeft, Inbox, Loader2, CheckCircle2 } from 'lucide-react'
import { useInboxes } from '@/hooks/useInboxes'
import { chatInboxApi } from '@/services/chat-inbox-api'
import type { Conversation } from '@/types/chat'

interface InboxTransferSelectorProps {
  conversation: Conversation
  className?: string
}

export function InboxTransferSelector({ conversation, className }: InboxTransferSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedInboxId, setSelectedInboxId] = useState<string>('')
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()
  
  // Get available inboxes
  const { inboxes, isLoading: isLoadingInboxes } = useInboxes()
  
  // Current inbox info
  const currentInbox = inboxes?.find(inbox => inbox.id === conversation.inboxId)
  
  // Filter out current inbox from options
  const availableInboxes = inboxes?.filter(inbox => inbox.id !== conversation.inboxId) || []

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async ({ targetInboxId, reason }: { targetInboxId: string; reason?: string }) => {
      const response = await chatInboxApi.transferConversation(conversation.id, targetInboxId, reason)
      return response
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
      
      const targetInbox = inboxes?.find(i => i.id === selectedInboxId)
      toast.success(`Conversa transferida para ${targetInbox?.name || 'nova inbox'}`)
      
      // Reset and close
      setSelectedInboxId('')
      setReason('')
      setIsOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao transferir conversa')
    }
  })

  const handleTransfer = useCallback(() => {
    if (!selectedInboxId) {
      toast.error('Selecione uma caixa de entrada de destino')
      return
    }
    
    transferMutation.mutate({
      targetInboxId: selectedInboxId,
      reason: reason.trim() || undefined
    })
  }, [selectedInboxId, reason, transferMutation])

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSelectedInboxId('')
      setReason('')
    }
  }, [])

  // Don't show if no other inboxes available
  if (!isLoadingInboxes && availableInboxes.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("w-full justify-start gap-2", className)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transferir para outra caixa
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            Transfira esta conversa para outra caixa de entrada. As mensagens serão enviadas pelo número da nova caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current inbox info */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Caixa atual</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currentInbox?.name || 'Desconhecida'}</span>
              {currentInbox?.phoneNumber && (
                <Badge variant="secondary" className="ml-auto">
                  {currentInbox.phoneNumber}
                </Badge>
              )}
            </div>
          </div>

          {/* Target inbox selector */}
          <div className="space-y-2">
            <Label htmlFor="target-inbox">Transferir para</Label>
            <Select
              value={selectedInboxId}
              onValueChange={setSelectedInboxId}
              disabled={isLoadingInboxes || transferMutation.isPending}
            >
              <SelectTrigger id="target-inbox">
                <SelectValue placeholder="Selecione a caixa de destino" />
              </SelectTrigger>
              <SelectContent>
                {availableInboxes.map((inbox) => (
                  <SelectItem key={inbox.id} value={inbox.id}>
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4" />
                      <span>{inbox.name}</span>
                      {inbox.phoneNumber && (
                        <span className="text-muted-foreground text-xs">
                          ({inbox.phoneNumber})
                        </span>
                      )}
                      {inbox.wuzapiConnected && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Transferindo para equipe de suporte técnico"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={transferMutation.isPending}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={transferMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedInboxId || transferMutation.isPending}
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default InboxTransferSelector
