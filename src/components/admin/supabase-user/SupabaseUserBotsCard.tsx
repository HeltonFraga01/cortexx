/**
 * SupabaseUserBotsCard
 * 
 * Displays user's configured bots
 */

import { Bot, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UserBot } from '@/types/supabase-user'

interface SupabaseUserBotsCardProps {
  bots: UserBot[]
}

export function SupabaseUserBotsCard({ bots }: SupabaseUserBotsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Bots
          </div>
          <Badge variant="secondary">{bots.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bots.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum bot configurado
          </p>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div 
                key={bot.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{bot.name}</p>
                    {bot.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {bot.description}
                      </p>
                    )}
                    {bot.outgoing_url && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {new URL(bot.outgoing_url).hostname}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {bot.enabled !== false ? (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
