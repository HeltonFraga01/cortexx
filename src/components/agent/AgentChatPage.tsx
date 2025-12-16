/**
 * AgentChatPage
 * 
 * Chat page for agents - uses the same ChatLayout as user chat
 * but with AgentInboxProvider for agent-specific inbox filtering
 */

import { ChatLayout } from '@/components/features/chat/ChatLayout'
import { AgentInboxProvider } from '@/contexts/AgentInboxContext'

export default function AgentChatPage() {
  return (
    <AgentInboxProvider>
      <div className="-m-4 lg:-m-6 h-[calc(100vh-4rem)] lg:h-screen">
        <ChatLayout className="h-full" isAgentMode />
      </div>
    </AgentInboxProvider>
  )
}
