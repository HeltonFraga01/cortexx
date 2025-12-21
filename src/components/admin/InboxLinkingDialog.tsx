/**
 * InboxLinkingPanel Component
 * 
 * Inline panel for linking/unlinking inboxes to users.
 * Requirements: 3.2, 3.5
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Link, Unlink, Star, Inbox, X } from 'lucide-react'

interface UserInbox {
  id: string
  inboxId: string
  isPrimary: boolean
  createdAt: string
  inbox?: {
    id: string
    name: string
    phone?: string
  }
}

interface AvailableInbox {
  id: string
  name: string
  phone?: string
  connected: boolean
}

interface User {
  id: string
  email: string
  name: string
}

interface InboxLinkingPanelProps {
  user: User
  onClose: () => void
}

export function InboxLinkingPanel({ user, onClose }: InboxLinkingPanelProps) {
  const [selectedInbox, setSelectedInbox] = useState<string>('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch user's linked inboxes
  const { data: userInboxes, isLoading: loadingUserInboxes } = useQuery({
    queryKey: ['user-inboxes', user.id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: UserInbox[] }>(
        `/api/admin/independent-users/${user.id}/inboxes`
      )
      return response.data.data
    }
  })

  // Fetch available inboxes
  const { data: availableInboxes, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-inboxes'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AvailableInbox[] }>(
        '/api/admin/inboxes'
      )
      return response.data.data
    }
  })

  // Link inbox mutation
  const linkMutation = useMutation({
    mutationFn: async ({ inboxId, isPrimary }: { inboxId: string; isPrimary: boolean }) => {
      await api.post(`/api/admin/independent-users/${user.id}/link-inbox`, {
        inboxId,
        isPrimary
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-inboxes', user.id] })
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      setSelectedInbox('')
      toast({
        title: 'Inbox vinculada',
        description: 'A inbox foi vinculada ao usuário com sucesso.'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível vincular a inbox.',
        variant: 'destructive'
      })
    }
  })

  // Unlink inbox mutation
  const unlinkMutation = useMutation({
    mutationFn: async (inboxId: string) => {
      await api.delete(`/api/admin/independent-users/${user.id}/unlink-inbox/${inboxId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-inboxes', user.id] })
      queryClient.invalidateQueries({ queryKey: ['independent-users'] })
      toast({
        title: 'Inbox desvinculada',
        description: 'A inbox foi desvinculada do usuário.'
      })
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível desvincular a inbox.',
        variant: 'destructive'
      })
    }
  })

  // Filter out already linked inboxes
  const linkedInboxIds = userInboxes?.map(ui => ui.inboxId) || []
  const unlinkedInboxes = availableInboxes?.filter(
    inbox => !linkedInboxIds.includes(inbox.id)
  ) || []

  const handleLink = () => {
    if (!selectedInbox) return
    const isPrimary = !userInboxes || userInboxes.length === 0
    linkMutation.mutate({ inboxId: selectedInbox, isPrimary })
  }

  const isLoading = loadingUserInboxes || loadingAvailable

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Inboxes - {user.name}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Linked Inboxes */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Inboxes Vinculadas</h4>
              {userInboxes && userInboxes.length > 0 ? (
                <div className="space-y-2">
                  {userInboxes.map((userInbox) => (
                    <div
                      key={userInbox.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {userInbox.inbox?.name || userInbox.inboxId}
                          </div>
                          {userInbox.inbox?.phone && (
                            <div className="text-sm text-muted-foreground">
                              {userInbox.inbox.phone}
                            </div>
                          )}
                        </div>
                        {userInbox.isPrimary && (
                          <Badge variant="secondary">
                            <Star className="mr-1 h-3 w-3" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkMutation.mutate(userInbox.inboxId)}
                        disabled={unlinkMutation.isPending}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma inbox vinculada
                </p>
              )}
            </div>

            {/* Link New Inbox */}
            {unlinkedInboxes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Vincular Nova Inbox</h4>
                <div className="flex gap-2">
                  <Select value={selectedInbox} onValueChange={setSelectedInbox}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma inbox" />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedInboxes.map((inbox) => (
                        <SelectItem key={inbox.id} value={inbox.id}>
                          <div className="flex items-center gap-2">
                            <span>{inbox.name}</span>
                            {inbox.phone && (
                              <span className="text-muted-foreground">
                                ({inbox.phone})
                              </span>
                            )}
                            {inbox.connected && (
                              <Badge variant="outline" className="ml-2">
                                Conectada
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleLink}
                    disabled={!selectedInbox || linkMutation.isPending}
                  >
                    {linkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {unlinkedInboxes.length === 0 && availableInboxes && availableInboxes.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Todas as inboxes disponíveis já estão vinculadas
              </p>
            )}

            {availableInboxes && availableInboxes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Nenhuma inbox disponível no sistema
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Keep the old export name for backward compatibility
export { InboxLinkingPanel as InboxLinkingDialog }
