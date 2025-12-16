/**
 * AdminBotCard Component
 * 
 * Displays an admin-assigned bot with quota usage information.
 * Does NOT include edit/delete buttons (admin-managed).
 * Includes test button for testing bot webhook.
 * 
 * Requirements: 5.1, 5.2, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Shield, Star, Inbox, Phone, MessageSquare, Cpu, FlaskConical } from 'lucide-react'
import { QuotaProgressBar } from './QuotaProgressBar'
import type { AssignedBot } from '@/services/chat'

interface AdminBotCardProps {
  bot: AssignedBot
  onTest?: (bot: AssignedBot) => void
  isTesting?: boolean
}

export function AdminBotCard({ bot, onTest, isTesting }: AdminBotCardProps) {
  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            {/* Header with name and badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium">{bot.name}</h4>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
              {bot.isDefault && (
                <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  Padrão
                </Badge>
              )}
              </div>
              {onTest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTest(bot)}
                  disabled={isTesting}
                  title="Conversar com o Bot"
                >
                  <FlaskConical className="h-4 w-4 mr-1" />
                  Conversar
                </Button>
              )}
            </div>

            {/* Description */}
            {bot.description && (
              <p className="text-sm text-muted-foreground">
                {bot.description}
              </p>
            )}

            {/* Inbox assignments */}
            {bot.inboxAssignments.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bot.inboxAssignments.map(inbox => (
                  <Badge key={inbox.inboxId} variant="secondary" className="text-xs">
                    <Inbox className="h-3 w-3 mr-1" />
                    {inbox.inboxName}
                  </Badge>
                ))}
              </div>
            )}

            {/* Quota Usage Section */}
            <div className="pt-2 space-y-4 border-t">
              <p className="text-xs text-muted-foreground font-medium">Uso de Cotas</p>
              
              <QuotaProgressBar
                label="Chamadas"
                icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                daily={bot.quotaUsage.calls.daily}
                dailyLimit={bot.quotaUsage.calls.dailyLimit}
                monthly={bot.quotaUsage.calls.monthly}
                monthlyLimit={bot.quotaUsage.calls.monthlyLimit}
              />
              
              <QuotaProgressBar
                label="Mensagens"
                icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                daily={bot.quotaUsage.messages.daily}
                dailyLimit={bot.quotaUsage.messages.dailyLimit}
                monthly={bot.quotaUsage.messages.monthly}
                monthlyLimit={bot.quotaUsage.messages.monthlyLimit}
              />
              
              <QuotaProgressBar
                label="Tokens IA"
                icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
                daily={bot.quotaUsage.tokens.daily}
                dailyLimit={bot.quotaUsage.tokens.dailyLimit}
                monthly={bot.quotaUsage.tokens.monthly}
                monthlyLimit={bot.quotaUsage.tokens.monthlyLimit}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AdminBotCard
