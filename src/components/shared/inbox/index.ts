/**
 * Shared Inbox Components
 * 
 * Reusable components for inbox management in both admin and user dashboards.
 * 
 * Usage:
 * import { InboxInfoCard, ConnectionControlCard, WebhookConfigCard } from '@/components/shared/inbox'
 */

// Components
export { InboxInfoCard } from './InboxInfoCard'
export { ConnectionControlCard } from './ConnectionControlCard'
export { WebhookConfigCard } from './WebhookConfigCard'

// Modern Components (UX Modernization)
export { ModernInboxHeader } from './ModernInboxHeader'
export { ModernConnectionCard } from './ModernConnectionCard'
export { BotCard } from './BotCard'
export { BotGrid } from './BotGrid'
export { WebhookToggle } from './WebhookToggle'

// Modern Component Types
export type { BotInfo } from './BotCard'

// Types
export type {
  InboxInfoCardProps,
  ConnectionControlCardProps,
  WebhookConfigCardProps,
  ConnectionStatus,
  InboxData,
  ConnectionLoadingAction,
  AvailableEvent,
  WebhookConfigData
} from './types'

// Utilities
export {
  DEFAULT_AVAILABLE_EVENTS,
  getEventCategories,
  getEventsByCategory
} from './types'
