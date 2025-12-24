/**
 * SupabaseUserResourcesCard
 * 
 * Displays user's teams, labels, webhooks, and database connections
 */

import { 
  UsersRound, Tag, Webhook, Database, 
  CheckCircle, XCircle, ExternalLink 
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { UserTeam, UserLabel, UserWebhook, UserDatabaseConnection } from '@/types/supabase-user'

interface SupabaseUserResourcesCardProps {
  teams: UserTeam[]
  labels: UserLabel[]
  webhooks: UserWebhook[]
  databaseConnections: UserDatabaseConnection[]
}

export function SupabaseUserResourcesCard({ 
  teams, 
  labels, 
  webhooks, 
  databaseConnections 
}: SupabaseUserResourcesCardProps) {
  const totalResources = teams.length + labels.length + webhooks.length + databaseConnections.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Outros Recursos</span>
          <Badge variant="secondary">{totalResources}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {/* Teams */}
          <AccordionItem value="teams" className="border-b-0">
            <AccordionTrigger className="px-6 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                <span>Equipes</span>
                <Badge variant="outline" className="ml-2">{teams.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma equipe</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm font-medium">{team.name}</span>
                      {team.description && (
                        <span className="text-xs text-muted-foreground">{team.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Labels */}
          <AccordionItem value="labels" className="border-b-0">
            <AccordionTrigger className="px-6 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>Etiquetas</span>
                <Badge variant="outline" className="ml-2">{labels.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              {labels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma etiqueta</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <Badge 
                      key={label.id} 
                      style={{ 
                        backgroundColor: label.color ? `${label.color}20` : undefined,
                        borderColor: label.color || undefined,
                        color: label.color || undefined
                      }}
                      variant="outline"
                    >
                      {label.title}
                    </Badge>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Webhooks */}
          <AccordionItem value="webhooks" className="border-b-0">
            <AccordionTrigger className="px-6 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                <span>Webhooks</span>
                <Badge variant="outline" className="ml-2">{webhooks.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum webhook</p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2 min-w-0">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="text-sm truncate">{webhook.url}</span>
                      </div>
                      {webhook.enabled !== false ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Database Connections */}
          <AccordionItem value="databases" className="border-b-0">
            <AccordionTrigger className="px-6 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Conexões de Banco</span>
                <Badge variant="outline" className="ml-2">{databaseConnections.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              {databaseConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conexão</p>
              ) : (
                <div className="space-y-2">
                  {databaseConnections.map((conn) => (
                    <div key={conn.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <span className="text-sm font-medium">{conn.name}</span>
                        {conn.type && (
                          <Badge variant="outline" className="ml-2 text-xs">{conn.type}</Badge>
                        )}
                      </div>
                      {conn.status === 'connected' ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          {conn.status || 'Desconhecido'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
