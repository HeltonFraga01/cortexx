/**
 * SupabaseUserActivityCard
 * 
 * Displays user's recent activity from audit log
 */

import { Activity, User, Settings, MessageSquare, Database, Webhook, Bot } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UserAuditLogEntry } from '@/types/supabase-user'

interface SupabaseUserActivityCardProps {
  auditLog: UserAuditLogEntry[]
}

export function SupabaseUserActivityCard({ auditLog }: SupabaseUserActivityCardProps) {
  const getActionIcon = (action: string, resourceType?: string) => {
    if (resourceType === 'message' || action.includes('message')) {
      return <MessageSquare className="h-4 w-4" />
    }
    if (resourceType === 'webhook' || action.includes('webhook')) {
      return <Webhook className="h-4 w-4" />
    }
    if (resourceType === 'bot' || action.includes('bot')) {
      return <Bot className="h-4 w-4" />
    }
    if (resourceType === 'database' || action.includes('database')) {
      return <Database className="h-4 w-4" />
    }
    if (action.includes('login') || action.includes('user')) {
      return <User className="h-4 w-4" />
    }
    if (action.includes('settings') || action.includes('config')) {
      return <Settings className="h-4 w-4" />
    }
    return <Activity className="h-4 w-4" />
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-600'
    }
    if (action.includes('delete') || action.includes('remove')) {
      return 'bg-red-100 dark:bg-red-900/30 text-red-600'
    }
    if (action.includes('update') || action.includes('edit')) {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
    }
    if (action.includes('login') || action.includes('auth')) {
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
    }
    return 'bg-gray-100 dark:bg-gray-900/30 text-gray-600'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividade Recente
          </div>
          <Badge variant="secondary">{auditLog.length} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditLog.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma atividade registrada
          </p>
        ) : (
          <div className="space-y-3">
            {auditLog.map((entry) => (
              <div 
                key={entry.id} 
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className={`p-2 rounded-lg ${getActionColor(entry.action)}`}>
                  {getActionIcon(entry.action, entry.resource_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">
                      {formatAction(entry.action)}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  {entry.resource_type && (
                    <p className="text-xs text-muted-foreground">
                      {entry.resource_type}
                      {entry.resource_id && ` #${entry.resource_id}`}
                    </p>
                  )}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {JSON.stringify(entry.details)}
                    </p>
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
