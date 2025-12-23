/**
 * ConversationInboxBadge Component
 * 
 * Badge compacto que mostra a qual inbox uma conversa pertence.
 * Exibido apenas quando múltiplas inboxes estão selecionadas.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Inbox } from 'lucide-react'

interface ConversationInboxBadgeProps {
  inboxId: string
  inboxName?: string
  className?: string
}

// Cores distintivas para diferentes inboxes (baseado no hash do ID)
const INBOX_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
]

/**
 * Gera um índice de cor consistente baseado no ID da inbox
 */
function getColorIndex(inboxId: string): number {
  let hash = 0
  for (let i = 0; i < inboxId.length; i++) {
    const char = inboxId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % INBOX_COLORS.length
}

export function ConversationInboxBadge({ 
  inboxId, 
  inboxName,
  className 
}: ConversationInboxBadgeProps) {
  const colorIndex = useMemo(() => getColorIndex(inboxId), [inboxId])
  const colors = INBOX_COLORS[colorIndex]
  
  // Truncar nome se muito longo
  const displayName = useMemo(() => {
    if (!inboxName) return 'Inbox'
    return inboxName.length > 12 ? inboxName.slice(0, 10) + '...' : inboxName
  }, [inboxName])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        colors.bg,
        colors.text,
        className
      )}
      title={inboxName || 'Inbox'}
    >
      <Inbox className="h-2.5 w-2.5" />
      <span className="truncate max-w-[60px]">{displayName}</span>
    </span>
  )
}

export default ConversationInboxBadge
