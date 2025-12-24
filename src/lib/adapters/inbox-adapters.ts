/**
 * Inbox Data Adapters
 * 
 * Functions to transform data from different sources to the format
 * expected by shared inbox components.
 * 
 * Requirements: 4.1-4.5
 */

import type { WuzAPIUser, Inbox } from '@/services/wuzapi'
import type { InboxConnectionData } from '@/hooks/useInboxConnectionData'
import type { 
  InboxInfoCardProps, 
  ConnectionControlCardProps,
  WebhookConfigCardProps,
  WebhookConfigData
} from '@/components/shared/inbox'

/**
 * Adapt WuzAPIUser/Inbox to InboxInfoCardProps
 * Used in admin edit page where data comes directly from WUZAPI
 */
export function adaptWuzapiUserToInboxInfo(
  user: WuzAPIUser | Inbox,
  avatarUrl?: string | null
): InboxInfoCardProps {
  // Extract phone from JID (format: 5511999999999:0@s.whatsapp.net)
  const phone = user.jid ? user.jid.split(':')[0] || user.jid.split('@')[0] : undefined

  return {
    inbox: {
      id: user.id,
      name: user.name,
      phone,
      jid: user.jid || undefined,
      token: user.token,
      profilePicture: avatarUrl || undefined
    },
    connectionStatus: {
      isConnected: user.connected ?? false,
      isLoggedIn: user.loggedIn ?? false
    }
  }
}

/**
 * Adapt InboxConnectionData to InboxInfoCardProps
 * Used in user dashboard where data comes from backend proxy
 */
export function adaptConnectionDataToInboxInfo(
  data: InboxConnectionData,
  sessionStatus?: { connected?: boolean; loggedIn?: boolean } | null
): InboxInfoCardProps {
  return {
    inbox: {
      id: data.inboxId,
      name: data.inboxName,
      phone: data.phoneNumber || undefined,
      jid: data.jid || undefined,
      token: data.wuzapiToken,
      profilePicture: data.profilePicture || undefined
    },
    connectionStatus: {
      isConnected: sessionStatus?.connected ?? data.isConnected ?? false,
      isLoggedIn: sessionStatus?.loggedIn ?? false
    }
  }
}

/**
 * Adapt WuzAPIUser/Inbox to ConnectionControlCardProps
 * Used in admin edit page
 */
export function adaptWuzapiUserToConnectionControl(
  user: WuzAPIUser | Inbox
): Pick<ConnectionControlCardProps, 'connectionStatus'> {
  return {
    connectionStatus: {
      isConnected: user.connected ?? false,
      isLoggedIn: user.loggedIn ?? false
    }
  }
}

/**
 * Adapt InboxConnectionData to ConnectionControlCardProps
 * Used in user dashboard
 */
export function adaptConnectionDataToConnectionControl(
  data: InboxConnectionData,
  sessionStatus?: { connected?: boolean; loggedIn?: boolean } | null
): Pick<ConnectionControlCardProps, 'connectionStatus'> {
  return {
    connectionStatus: {
      isConnected: sessionStatus?.connected ?? data.isConnected ?? false,
      isLoggedIn: sessionStatus?.loggedIn ?? false
    }
  }
}

/**
 * Adapt WuzAPIUser/Inbox webhook data to WebhookConfigData
 * Used in admin edit page
 */
export function adaptWuzapiUserToWebhookConfig(
  user: WuzAPIUser | Inbox
): WebhookConfigData {
  // Parse events string to array
  const eventsString = user.events || ''
  let events: string[] = []
  
  if (eventsString === 'All' || eventsString.toLowerCase() === 'all') {
    events = ['All']
  } else if (eventsString) {
    events = eventsString.split(',').map(e => e.trim()).filter(Boolean)
  }

  return {
    webhookUrl: user.webhook || '',
    events
  }
}

/**
 * Adapt webhook config from backend proxy to WebhookConfigData
 * Used in user dashboard
 */
export function adaptWebhookResponseToConfig(
  webhook: string,
  subscribe: string[]
): WebhookConfigData {
  return {
    webhookUrl: webhook || '',
    events: subscribe || []
  }
}

/**
 * Convert WebhookConfigData back to format expected by WUZAPI
 * Used when saving webhook configuration
 */
export function adaptWebhookConfigToWuzapi(
  config: WebhookConfigData
): { webhook: string; events: string[] } {
  return {
    webhook: config.webhookUrl,
    events: config.events.includes('All') ? ['All'] : config.events
  }
}

/**
 * Convert events array to comma-separated string
 * Used for display or legacy API compatibility
 */
export function eventsToString(events: string[]): string {
  if (events.includes('All')) return 'All'
  return events.join(', ')
}

/**
 * Parse events string to array
 * Used when receiving data from legacy APIs
 */
export function stringToEvents(eventsString: string): string[] {
  if (!eventsString) return []
  if (eventsString === 'All' || eventsString.toLowerCase() === 'all') {
    return ['All']
  }
  return eventsString.split(',').map(e => e.trim()).filter(Boolean)
}
