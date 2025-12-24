/**
 * QuickActionsPanel Component
 * Quick access buttons for common actions
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Megaphone,
  Users,
  Settings,
  UsersRound,
  UserCog,
  Inbox,
  Contact
} from 'lucide-react'
import type { QuickActionsPanelProps } from '@/types/dashboard'

interface QuickAction {
  label: string
  icon: React.ElementType
  path: string
  requiresManagement?: boolean
}

const quickActions: QuickAction[] = [
  { label: 'Nova Mensagem', icon: MessageSquare, path: '/user/messages/new' },
  { label: 'Nova Campanha', icon: Megaphone, path: '/user/campaigns/new' },
  { label: 'Contatos', icon: Contact, path: '/user/contacts' },
  { label: 'Configurações', icon: Settings, path: '/user/settings' },
  { label: 'Agentes', icon: UserCog, path: '/user/agents', requiresManagement: true },
  { label: 'Equipes', icon: UsersRound, path: '/user/teams', requiresManagement: true },
  { label: 'Caixas', icon: Inbox, path: '/user/inboxes', requiresManagement: true }
]

export function QuickActionsPanel({ hasManagementPermission, compact = false }: QuickActionsPanelProps & { compact?: boolean }) {
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
            className="h-8 gap-1.5"
            onClick={() => navigate(action.path)}
          >
            <action.icon className="h-3.5 w-3.5" />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleActions.map((action) => (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto py-2 flex-col gap-1"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="h-4 w-4" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default QuickActionsPanel
