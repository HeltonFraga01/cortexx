/**
 * Types for Supabase User Inbox Binding
 * 
 * Defines interfaces for inbox context, session, and related data structures.
 */

/**
 * Resumo de uma inbox disponível
 */
export interface InboxSummary {
  id: string
  name: string
  phoneNumber?: string
  isConnected: boolean
  isPrimary: boolean
}

/**
 * Contexto completo da sessão do usuário
 */
export interface SessionContext {
  // Identificação do usuário
  userId: string
  userType: 'owner' | 'agent'
  email: string
  
  // Info do agente (se aplicável)
  agentId?: string
  agentRole?: string
  
  // Info da account
  accountId: string
  accountName: string
  tenantId: string
  
  // Info da inbox ativa
  inboxId: string
  inboxName: string
  wuzapiToken: string
  instance: string
  phoneNumber?: string
  isConnected: boolean
  
  // Permissões
  permissions: string[]
  
  // Inboxes disponíveis
  availableInboxes: InboxSummary[]
}

/**
 * Status da inbox
 */
export interface InboxStatus {
  inboxId: string
  inboxName: string
  phoneNumber?: string
  isConnected: boolean
  instance: string
  lastChecked: string
}

/**
 * Permissões disponíveis no sistema
 */
export type Permission = 
  | '*' // Owner - todas as permissões
  | 'messages:send'
  | 'messages:read'
  | 'messages:delete'
  | 'contacts:read'
  | 'contacts:write'
  | 'contacts:delete'
  | 'conversations:read'
  | 'conversations:write'
  | 'conversations:assign'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'reports:read'
  | 'settings:read'
  | 'settings:write'
  | 'agents:read'
  | 'agents:write'

/**
 * Tipo de usuário
 */
export type UserType = 'owner' | 'agent'

/**
 * Códigos de erro do contexto de inbox
 */
export type InboxContextErrorCode = 
  | 'NO_TOKEN'
  | 'NO_ACCOUNT'
  | 'NO_AGENT'
  | 'NO_INBOX'
  | 'INBOX_ACCESS_DENIED'
  | 'INBOX_DISCONNECTED'
  | 'CONTEXT_LOAD_ERROR'
  | 'SWITCH_ERROR'
  | 'NETWORK_ERROR'
  | 'REQUEST_FAILED'
