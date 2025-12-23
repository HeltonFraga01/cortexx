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
      {/* 
        Negative margins to counteract parent padding (p-4 lg:p-6)
        Height calculation:
        - Mobile: 100vh - mobile top bar (56px/3.5rem) - desktop top bar (0) - parent padding (32px/2rem)
        - Desktop: 100vh - desktop top bar (~52px/3.25rem) - parent padding (48px/3rem)
      */}
      <div className="-m-4 lg:-m-6 h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.25rem-3rem)]">
        <ChatLayout className="h-full" />
      </div>
    </InboxProvider>
  )
}
