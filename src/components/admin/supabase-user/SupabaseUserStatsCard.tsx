/**
 * SupabaseUserStatsCard
 * 
 * Displays overview stats for a user (conversations, messages, contacts, etc.)
 */

import { MessageSquare, Users, MessagesSquare, CheckCircle, Clock, Pause } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { UserStats } from '@/types/supabase-user'

interface SupabaseUserStatsCardProps {
  stats: UserStats
}

export function SupabaseUserStatsCard({ stats }: SupabaseUserStatsCardProps) {
  const statItems = [
    {
      label: 'Conversas',
      value: stats.conversations.total,
      icon: MessagesSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      label: 'Abertas',
      value: stats.conversations.open,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    {
      label: 'Resolvidas',
      value: stats.conversations.resolved,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    {
      label: 'Mensagens',
      value: stats.messages,
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
      label: 'Contatos',
      value: stats.contacts,
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30'
    },
    {
      label: 'Pausadas',
      value: stats.conversations.snoozed,
      icon: Pause,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30'
    }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
