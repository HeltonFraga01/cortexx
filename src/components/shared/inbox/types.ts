/**
 * Shared Inbox Components - Type Definitions
 * 
 * Types for reusable inbox components used in both admin and user dashboards.
 * Requirements: 1.1-1.8, 2.1-2.8, 3.1-3.8
 */

/**
 * Connection status for an inbox
 */
export interface ConnectionStatus {
  isConnected: boolean
  isLoggedIn: boolean
}

/**
 * Inbox data for display
 */
export interface InboxData {
  id: string
  name: string
  phone?: string
  jid?: string
  token: string
  profilePicture?: string
}

/**
 * Props for InboxInfoCard component
 * Displays inbox profile info with avatar, name, phone, and token
 */
export interface InboxInfoCardProps {
  /** Inbox data to display */
  inbox: InboxData
  /** Connection status */
  connectionStatus: ConnectionStatus
  /** Display variant - compact hides token section */
  variant?: 'compact' | 'full'
  /** Callback to refresh avatar */
  onRefreshAvatar?: () => void
  /** Loading state for avatar refresh */
  isLoadingAvatar?: boolean
  /** Callback to edit inbox settings */
  onEdit?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Loading action types for connection control
 */
export type ConnectionLoadingAction = 'connect' | 'disconnect' | 'logout' | 'qr' | null

/**
 * Props for ConnectionControlCard component
 * Displays connection control buttons (connect, disconnect, logout, QR)
 */
export interface ConnectionControlCardProps {
  /** Connection status */
  connectionStatus: ConnectionStatus
  /** Global loading state */
  isLoading?: boolean
  /** Specific action being loaded */
  loadingAction?: ConnectionLoadingAction
  /** Callback for connect action */
  onConnect?: () => void
  /** Callback for disconnect action */
  onDisconnect?: () => void
  /** Callback for logout action */
  onLogout?: () => void
  /** Callback for generate QR action */
  onGenerateQR?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Available webhook event definition
 */
export interface AvailableEvent {
  /** Event value/identifier */
  value: string
  /** Display label */
  label: string
  /** Category for grouping */
  category: string
}

/**
 * Webhook configuration data
 */
export interface WebhookConfigData {
  /** Webhook URL */
  webhookUrl: string
  /** Selected events (array of event values or 'All') */
  events: string[]
}

/**
 * Props for WebhookConfigCard component
 * Displays webhook URL input and event selection
 */
export interface WebhookConfigCardProps {
  /** Current webhook configuration */
  config: WebhookConfigData
  /** List of available events */
  availableEvents: AvailableEvent[]
  /** Callback when config changes */
  onChange?: (config: WebhookConfigData) => void
  /** Callback to save configuration */
  onSave?: () => void
  /** Loading state for save operation */
  isLoading?: boolean
  /** Read-only mode (disables inputs) */
  readOnly?: boolean
  /** Whether there are unsaved changes */
  hasChanges?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Default available events for webhook configuration
 * Grouped by category for better organization
 */
export const DEFAULT_AVAILABLE_EVENTS: AvailableEvent[] = [
  // Mensagens
  { value: "Message", label: "Message", category: "Mensagens" },
  { value: "UndecryptableMessage", label: "Undecryptable Message", category: "Mensagens" },
  { value: "Receipt", label: "Receipt", category: "Mensagens" },
  { value: "ReadReceipt", label: "Read Receipt", category: "Mensagens" },
  { value: "MediaRetry", label: "Media Retry", category: "Mensagens" },
  
  // Grupos
  { value: "GroupInfo", label: "Group Info", category: "Grupos" },
  { value: "JoinedGroup", label: "Joined Group", category: "Grupos" },
  
  // Newsletter
  { value: "NewsletterMuteChange", label: "Newsletter Mute Change", category: "Newsletter" },
  { value: "NewsletterLiveUpdate", label: "Newsletter Live Update", category: "Newsletter" },
  { value: "NewsletterJoin", label: "Newsletter Join", category: "Newsletter" },
  { value: "NewsletterLeave", label: "Newsletter Leave", category: "Newsletter" },
  { value: "FBMessage", label: "FB Message", category: "Newsletter" },
  
  // Presença
  { value: "Presence", label: "Presence", category: "Presença" },
  { value: "ChatPresence", label: "Chat Presence", category: "Presença" },
  
  // Sistema
  { value: "IdentityChange", label: "Identity Change", category: "Sistema" },
  { value: "CATRefreshError", label: "CAT Refresh Error", category: "Sistema" },
  
  // Sincronização
  { value: "OfflineSyncPreview", label: "Offline Sync Preview", category: "Sincronização" },
  { value: "OfflineSyncCompleted", label: "Offline Sync Completed", category: "Sincronização" },
  { value: "HistorySync", label: "History Sync", category: "Sincronização" },
  { value: "AppState", label: "App State", category: "Sincronização" },
  { value: "AppStateSyncComplete", label: "App State Sync Complete", category: "Sincronização" },
  
  // Chamadas
  { value: "CallOffer", label: "Call Offer", category: "Chamadas" },
  { value: "CallAccept", label: "Call Accept", category: "Chamadas" },
  { value: "CallTerminate", label: "Call Terminate", category: "Chamadas" },
  { value: "CallOfferNotice", label: "Call Offer Notice", category: "Chamadas" },
  { value: "CallRelayLatency", label: "Call Relay Latency", category: "Chamadas" },
  
  // Conexão
  { value: "Connected", label: "Connected", category: "Conexão" },
  { value: "Disconnected", label: "Disconnected", category: "Conexão" },
  { value: "ConnectFailure", label: "Connect Failure", category: "Conexão" },
  { value: "LoggedOut", label: "Logged Out", category: "Conexão" },
  { value: "ClientOutdated", label: "Client Outdated", category: "Conexão" },
  { value: "TemporaryBan", label: "Temporary Ban", category: "Conexão" },
  { value: "StreamError", label: "Stream Error", category: "Conexão" },
  { value: "StreamReplaced", label: "Stream Replaced", category: "Conexão" },
  
  // Keep Alive
  { value: "KeepAliveRestored", label: "Keep Alive Restored", category: "Keep Alive" },
  { value: "KeepAliveTimeout", label: "Keep Alive Timeout", category: "Keep Alive" },
  
  // Pairing
  { value: "PairSuccess", label: "Pair Success", category: "Pairing" },
  { value: "PairError", label: "Pair Error", category: "Pairing" },
  { value: "QR", label: "QR", category: "Pairing" },
  { value: "QRScannedWithoutMultidevice", label: "QR Scanned Without Multidevice", category: "Pairing" },
  
  // Outros
  { value: "Picture", label: "Picture", category: "Outros" },
  { value: "BlocklistChange", label: "Blocklist Change", category: "Outros" },
  { value: "Blocklist", label: "Blocklist", category: "Outros" },
  { value: "PrivacySettings", label: "Privacy Settings", category: "Outros" },
  { value: "PushNameSetting", label: "Push Name Setting", category: "Outros" },
  { value: "UserAbout", label: "User About", category: "Outros" },
]

/**
 * Get unique categories from available events
 */
export function getEventCategories(events: AvailableEvent[]): string[] {
  return [...new Set(events.map(e => e.category))]
}

/**
 * Get events by category
 */
export function getEventsByCategory(events: AvailableEvent[], category: string): AvailableEvent[] {
  return events.filter(e => e.category === category)
}
