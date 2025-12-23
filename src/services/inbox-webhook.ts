/**
 * Inbox Webhook Service
 * Frontend service for managing inbox webhook configuration
 * 
 * Requirements: 12.1, 12.2, 12.3 (Tenant Webhook Configuration)
 */

import { backendApi } from './api-client'

export interface WebhookStatus {
  isConfigured: boolean
  url: string | null
  events: string[]
  status: 'active' | 'error' | 'not_configured'
  configuredAt: string | null
  lastError: string | null
  errorAt: string | null
  wuzapiStatus?: {
    webhook: string
    events: string[]
  } | null
}

export interface WebhookConfigResult {
  success: boolean
  webhookUrl?: string
  events?: string[]
  configuredAt?: string
  error?: string
}

export interface InboxWithWebhookStatus {
  id: string
  name: string
  phoneNumber: string | null
  hasWuzapiToken: boolean
  isConnected: boolean
  webhookStatus: {
    isConfigured: boolean
    url: string | null
    status: string
    events: string[]
  }
  accountId: string
  accountName: string
}

const API_BASE = '/session/inboxes'

/**
 * Get webhook status for an inbox
 */
export async function getInboxWebhookStatus(inboxId: string): Promise<WebhookStatus> {
  const response = await backendApi.get<{ success: boolean; data: WebhookStatus }>(
    `${API_BASE}/${inboxId}/webhook`
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao carregar status do webhook')
  }

  return response.data?.data!
}

/**
 * Configure webhook for an inbox
 */
export async function configureInboxWebhook(
  inboxId: string,
  options?: { events?: string[]; customWebhookUrl?: string }
): Promise<WebhookConfigResult> {
  const response = await backendApi.post<{ success: boolean; data: WebhookConfigResult }>(
    `${API_BASE}/${inboxId}/webhook/configure`,
    options || {}
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao configurar webhook')
  }

  return response.data?.data!
}

/**
 * Clear webhook configuration for an inbox
 */
export async function clearInboxWebhook(inboxId: string): Promise<void> {
  const response = await backendApi.delete<{ success: boolean }>(
    `${API_BASE}/${inboxId}/webhook`
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao remover webhook')
  }
}

/**
 * List all inboxes with webhook status
 */
export async function listInboxesWithWebhookStatus(): Promise<InboxWithWebhookStatus[]> {
  const response = await backendApi.get<{ success: boolean; data: InboxWithWebhookStatus[] }>(
    `${API_BASE}/webhook-status`
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao listar inboxes')
  }

  return response.data?.data || []
}

/**
 * Generate webhook URL for an inbox (without configuring)
 */
export async function generateInboxWebhookUrl(inboxId: string): Promise<string> {
  const response = await backendApi.get<{ success: boolean; data: { webhookUrl: string } }>(
    `${API_BASE}/${inboxId}/webhook/url`
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao gerar URL do webhook')
  }

  return response.data?.data?.webhookUrl || ''
}

/**
 * Default webhook events for chat integration
 */
export const DEFAULT_WEBHOOK_EVENTS = [
  'Message',
  'ReadReceipt',
  'ChatPresence',
  'MessageStatus'
]

/**
 * All available webhook events
 */
export const ALL_WEBHOOK_EVENTS = [
  'Message',
  'ReadReceipt',
  'ChatPresence',
  'MessageStatus',
  'HistorySync',
  'CallOffer',
  'CallAccept',
  'CallTerminate',
  'CallReject',
  'GroupInfo',
  'GroupParticipants',
  'GroupJoin',
  'GroupLeave',
  'GroupSubject',
  'GroupDescription',
  'GroupAnnounce',
  'GroupLocked',
  'GroupRestrict',
  'GroupEphemeral',
  'GroupDelete',
  'GroupLink',
  'GroupUnlink',
  'GroupPromote',
  'GroupDemote',
  'GroupRequest',
  'GroupRequestMethod',
  'GroupMemberAddMode',
  'GroupPicture',
  'GroupName',
  'GroupInvite',
  'GroupInviteLink',
  'GroupInviteLinkChange',
  'GroupInviteLinkDelete',
  'GroupInviteLinkRevoke',
  'GroupInviteLinkReset',
  'GroupInviteLinkCreate',
  'GroupInviteLinkUpdate',
  'GroupInviteLinkGet',
  'GroupInviteLinkGetAll'
]
