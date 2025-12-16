/**
 * AdminAssignedBots Component
 * 
 * Displays admin-assigned bots for the user with quota usage.
 * Shows empty state when no bots are assigned.
 * Includes test functionality for each bot.
 * 
 * Requirements: 5.1, 5.2, 9.1, 9.8
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Loader2 } from 'lucide-react'
import { getAssignedBots, type AssignedBot } from '@/services/chat'
import { AdminBotCard } from './AdminBotCard'
import { BotTestChat } from './BotTestChat'

export function AdminAssignedBots() {
  const [testingBot, setTestingBot] = useState<AssignedBot | null>(null)
  
  const { data: assignedBots = [], isLoading, error } = useQuery({
    queryKey: ['assigned-bots'],
    queryFn: getAssignedBots
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-destructive">
            Erro ao carregar bots atribuídos
          </p>
        </CardContent>
      </Card>
    )
  }

  if (assignedBots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum bot atribuído pelo administrador
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Bots configurados pelo admin aparecerão aqui
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Bots do Administrador</h4>
        <Badge variant="secondary" className="text-xs">Gerenciado</Badge>
      </div>
      
      <div className="space-y-4">
        {assignedBots.map(bot => (
          <div key={bot.id} className="space-y-4">
            <AdminBotCard 
              bot={bot} 
              onTest={(b) => setTestingBot(b)}
              isTesting={testingBot?.id === bot.id}
            />
            {testingBot?.id === bot.id && (
              <BotTestChat 
                bot={bot} 
                onClose={() => setTestingBot(null)} 
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminAssignedBots
