/**
 * ChatInboxPage
 * 
 * Page wrapper for the chat inbox interface
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import { ChatLayout } from '@/components/features/chat/ChatLayout'
import { InboxProvider } from '@/contexts/InboxContext'

export default function ChatInboxPage() {
  return (
    <InboxProvider>
      <div className="-m-4 lg:-m-6 h-[calc(100vh-4rem)] lg:h-screen">
        <ChatLayout className="h-full" />
      </div>
    </InboxProvider>
  )
}
