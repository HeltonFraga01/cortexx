/**
 * SupabaseUserInboxesCard
 * 
 * Displays user's inboxes (WhatsApp channels) with navigation to create page
 */

import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { Inbox, Phone, CheckCircle, XCircle, Plus, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabaseUserService } from '@/services/supabase-user'
import type { UserInbox } from '@/types/supabase-user'

interface SupabaseUserInboxesCardProps {
  inboxes: UserInbox[]
  userId: string
  onUpdate: () => void
}

export function SupabaseUserInboxesCard({ inboxes, userId, onUpdate }: SupabaseUserInboxesCardProps) {
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleCreateInbox = () => {
    // Navigate to the WUZAPI user creation page
    navigate('/admin/users/new')
  }

  const handleDelete = async (inboxId: number) => {
    try {
      setDeletingId(inboxId)
      await supabaseUserService.deleteInbox(userId, inboxId)
      toast.success('Inbox removida com sucesso')
      onUpdate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover inbox')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Inboxes
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{inboxes.length}</Badge>
            <Button size="sm" variant="outline" onClick={handleCreateInbox}>
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {inboxes.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma inbox configurada
          </p>
        ) : (
          <div className="space-y-3">
            {inboxes.map((inbox) => (
              <div 
                key={inbox.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Phone className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{inbox.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {inbox.phone_number || inbox.channel_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inbox.enabled !== false ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inativo
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(inbox.id)}
                    disabled={deletingId === inbox.id}
                  >
                    {deletingId === inbox.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
