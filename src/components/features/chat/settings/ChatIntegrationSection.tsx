/**
 * ChatIntegrationSection Component
 * 
 * Combines incoming and outgoing webhook configuration for a specific inbox.
 * Used in the inbox edit page to manage all chat integrations in one place.
 * 
 * Requirements: 5.1, 5.8, 10.4
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Webhook } from 'lucide-react'
import { IncomingWebhookConfig } from './IncomingWebhookConfig'
import { OutgoingWebhookList } from './OutgoingWebhookList'

interface ChatIntegrationSectionProps {
  inboxId: string
}

export function ChatIntegrationSection({ inboxId }: ChatIntegrationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-foreground">
          <Webhook className="h-5 w-5 mr-2 text-primary" />
          Integrações de Chat
        </CardTitle>
        <CardDescription>
          Configure webhooks para integrar o chat com sistemas externos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Incoming Webhook - receives events from WUZAPI */}
        <IncomingWebhookConfig inboxId={inboxId} />
        
        <Separator />
        
        {/* Outgoing Webhooks - sends events to external systems */}
        <OutgoingWebhookList inboxId={inboxId} />
      </CardContent>
    </Card>
  )
}

export default ChatIntegrationSection
