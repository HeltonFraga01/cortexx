/**
 * Types for Inbox Status (Provider API as Source of Truth)
 * 
 * These types represent the status data returned from the Provider API (WUZAPI, Evolution, etc.)
 * The Provider API is the SINGLE source of truth for connection status.
 * 
 * Requirements: 3.1, 3.2, 3.3 (wuzapi-status-source-of-truth spec)
 */

/**
 * Status de conexão de uma inbox
 * Sempre vem do Provider API - nunca do cache
 */
export interface InboxConnectionStatus {
  /** Conexão TCP estabelecida com o servidor */
  connected: boolean
  /** Autenticado e pode enviar mensagens */
  loggedIn: boolean
  /** QR Code para autenticação (se disponível) */
  qrCode?: string
}

/**
 * Resultado da consulta de status de uma inbox
 */
export interface InboxStatusResult {
  /** Se a consulta foi bem-sucedida */
  success: boolean
  /** ID da inbox */
  inboxId: string
  /** Status de conexão */
  status: InboxConnectionStatus
  /** Fonte do status: 'provider' = API do provedor, 'error' = erro na consulta */
  source: 'provider' | 'error'
  /** Mensagem de erro (se source === 'error') */
  error?: string
  /** Código de erro (se source === 'error') */
  code?: InboxStatusErrorCode
  /** Timestamp de quando o cache foi atualizado */
  cachedAt?: string
}

/**
 * Resultado da consulta de status de múltiplas inboxes
 */
export interface MultipleInboxStatusResult {
  /** Lista de status de cada inbox */
  statuses: InboxStatusResult[]
  /** Total de inboxes consultadas */
  totalInboxes: number
  /** Quantidade de inboxes conectadas (loggedIn) */
  connectedCount: number
  /** Quantidade de inboxes com erro */
  errorCount: number
}

/**
 * Códigos de erro possíveis na consulta de status
 */
export type InboxStatusErrorCode =
  | 'INBOX_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_TOKEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'STATUS_ERROR'

/**
 * Resposta da API de status de inbox
 */
export interface InboxStatusApiResponse {
  success: boolean
  data?: InboxStatusResult
  error?: {
    code: InboxStatusErrorCode
    message: string
  }
}

/**
 * Resposta da API de status de múltiplas inboxes
 */
export interface MultipleInboxStatusApiResponse {
  success: boolean
  data?: MultipleInboxStatusResult
  error?: {
    code: InboxStatusErrorCode
    message: string
  }
}

/**
 * Estado do status de uma inbox no contexto
 */
export interface InboxStatusState {
  /** Status atual */
  status: InboxConnectionStatus
  /** Se está carregando */
  isLoading: boolean
  /** Se houve erro */
  hasError: boolean
  /** Mensagem de erro */
  errorMessage?: string
  /** Código de erro */
  errorCode?: InboxStatusErrorCode
  /** Última atualização */
  lastUpdated?: Date
}

/**
 * Mapa de status de inboxes por ID
 */
export type InboxStatusMap = Map<string, InboxStatusState>
