/**
 * QuickActionsPanel Component
 * Quick access buttons for common actions
 * Requirements: 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Megaphone,
  Settings,
  UsersRound,
  UserCog,
  Inbox,
  Contact,
  Zap,
  MessagesSquare
} from 'lucide-react'
import type { QuickActionsPanelProps } from '@/types/dashboard'

interface QuickAction {
  label: string
  icon: React.ElementType
  path: string
  requiresManagement?: boolean
  color?: string
}

const quickActions: QuickAction[] = [
  { label: 'Chat', icon: MessagesSquare, path: '/user/chat', color: 'text-blue-600' },
  { label: 'Mensagens', icon: MessageSquare, path: '/user/mensagens', color: 'text-green-600' },
  { label: 'Campanhas', icon: Megaphone, path: '/user/mensagens/caixa', color: 'text-purple-600' },
  { label: 'Contatos', icon: Contact, path: '/user/contacts', color: 'text-orange-600' },
  { label: 'Agentes', icon: UserCog, path: '/user/agents', requiresManagement: true, color: 'text-indigo-600' },
  { label: 'Equipes', icon: UsersRound, path: '/user/teams', requiresManagement: true, color: 'text-pink-600' },
  { label: 'Caixas', icon: Inbox, path: '/user/inboxes', requiresManagement: true, color: 'text-cyan-600' },
  { label: 'Configurações', icon: Settings, path: '/user/settings', color: 'text-gray-600' }
]

export function QuickActionsPanel({ 
  hasManagementPermission, 
  compact = false 
}: QuickActionsPanelProps & { compact?: boolean }) {
  const navigate = useNavigate()

  const visibleActions = quickActions.filter(
    action => !action.requiresManagement || hasManagementPermission
  )

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visibleActions.slice(0, 6).map((action) => (
          <Button
            key={action.path}
            variant="outline"
            size="sm"
            className="h-9 gap-2 hover:bg-primary/5"
            onClick={() => navigate(action.path)}
          >
            <action.icon className={`h-4 w-4 ${action.color || ''}`} />
            <span className="text-xs font-medium">{action.label}</span>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleActions.map((action) => (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto py-3 flex-col gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              onClick={() => navigate(action.path)}
            >
              <action.icon className={`h-5 w-5 ${action.color || ''}`} />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default QuickActionsPanel
