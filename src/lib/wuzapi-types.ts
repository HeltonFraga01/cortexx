/**
 * WuzAPI TypeScript Interfaces
 * Baseado na documentação oficial da WuzAPI
 * https://wzapi.wasend.com.br/docs
 */

// ============================================================================
// TIPOS BASE E UTILITÁRIOS
// ============================================================================

export interface WuzAPIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: number;
}

export interface WuzAPIError {
  success: false;
  error: string;
  message: string;
  code?: number;
}

// ============================================================================
// INSTÂNCIAS
// ============================================================================

export type WuzAPIInstanceStatus = 'connected' | 'disconnected' | 'connecting' | 'qr' | 'error';

export interface WuzAPIInstance {
  name: string;
  phoneNumber?: string;
  status: WuzAPIInstanceStatus;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
  settings?: WuzAPISettings;
  webhook?: WuzAPIWebhookConfig;
}

export interface CreateInstancePayload {
  name: string;
  webhook?: string;
  webhook_events?: {
    message?: boolean;
    connect?: boolean;
    disconnect?: boolean;
    received?: boolean;
    sent?: boolean;
    ack?: boolean;
    typing?: boolean;
    presence?: boolean;
    chatstate?: boolean;
    group?: boolean;
    call?: boolean;
  };
}

// ============================================================================
// AUTENTICAÇÃO E USUÁRIOS
// ============================================================================

export interface WuzAPIAuthConfig {
  adminToken: string;  // Para operações administrativas (Authorization header)
  userToken?: string;  // Para operações de usuário específico (token header)
  baseUrl: string;     // URL base da API WuzAPI
}

export interface WuzAPIUser {
  phone: string;
  name: string;
  token: string;
  webhook?: string;
  webhook_message?: boolean;
  webhook_connect?: boolean;
  webhook_disconnect?: boolean;
  webhook_received?: boolean;
  webhook_sent?: boolean;
  webhook_ack?: boolean;
  webhook_typing?: boolean;
  webhook_presence?: boolean;
  webhook_chatstate?: boolean;
  webhook_group?: boolean;
  webhook_call?: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  qr_code?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  phone: string;
  name: string;
  webhook?: string;
  webhook_message?: boolean;
  webhook_connect?: boolean;
  webhook_disconnect?: boolean;
  webhook_received?: boolean;
  webhook_sent?: boolean;
  webhook_ack?: boolean;
  webhook_typing?: boolean;
  webhook_presence?: boolean;
  webhook_chatstate?: boolean;
  webhook_group?: boolean;
  webhook_call?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  webhook?: string;
  webhook_message?: boolean;
  webhook_connect?: boolean;
  webhook_disconnect?: boolean;
  webhook_received?: boolean;
  webhook_sent?: boolean;
  webhook_ack?: boolean;
  webhook_typing?: boolean;
  webhook_presence?: boolean;
  webhook_chatstate?: boolean;
  webhook_group?: boolean;
  webhook_call?: boolean;
}

// ============================================================================
// MENSAGENS
// ============================================================================

export interface WuzAPIMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction';
  content?: string;
  media_url?: string;
  media_type?: string;
  media_size?: number;
  media_name?: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  is_group: boolean;
  group_id?: string;
  participant?: string;
  quoted_message?: WuzAPIMessage;
}

export interface SendTextMessagePayload {
  Phone: string;
  Body: string;
  isGroup?: boolean;
}

export interface SendMediaMessagePayload {
  Phone: string;
  Image?: string; // Para imagens
  Video?: string; // Para vídeos
  Audio?: string; // Para áudio
  Document?: string; // Para documentos
  Caption?: string;
  FileName?: string;
  isGroup?: boolean;
}

export interface SendLocationMessagePayload {
  phone: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  isGroup?: boolean;
}

export interface SendContactMessagePayload {
  phone: string;
  contact_name: string;
  contact_phone: string;
  isGroup?: boolean;
}

export interface SendReactionPayload {
  phone: string;
  message_id: string;
  reaction: string; // emoji
}

// ============================================================================
// CHATS E CONTATOS
// ============================================================================

export interface WuzAPIChat {
  id: string;
  name: string;
  phone: string;
  is_group: boolean;
  profile_picture?: string;
  last_message?: WuzAPIMessage;
  unread_count: number;
  timestamp: number;
  archived: boolean;
  pinned: boolean;
}

export interface WuzAPIContact {
  phone: string;
  name: string;
  profile_picture?: string;
  status?: string;
  is_business: boolean;
  is_verified: boolean;
  labels?: string[];
}

export interface WuzAPIGroup {
  id: string;
  name: string;
  description?: string;
  profile_picture?: string;
  participants: WuzAPIGroupParticipant[];
  admins: string[];
  owner: string;
  created_at: number;
  invite_link?: string;
  settings: {
    messages_admin_only: boolean;
    edit_group_info_admin_only: boolean;
  };
}

export interface WuzAPIGroupParticipant {
  phone: string;
  name: string;
  is_admin: boolean;
  joined_at: number;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export interface WuzAPIWebhookConfig {
  url: string;
  events: {
    message?: boolean;
    connect?: boolean;
    disconnect?: boolean;
    received?: boolean;
    sent?: boolean;
    ack?: boolean;
    typing?: boolean;
    presence?: boolean;
    chatstate?: boolean;
    group?: boolean;
    call?: boolean;
  };
}

export interface WuzAPIWebhookEvent<T = Record<string, unknown>> {
  event: string;
  phone: string;
  timestamp: number;
  data: T;
}

// Tipos específicos de eventos de webhook
export interface WebhookMessageEvent extends WuzAPIWebhookEvent<WuzAPIMessage> {
  event: 'message' | 'received' | 'sent';
}

export interface WebhookConnectionEvent extends WuzAPIWebhookEvent<{
  status: string;
  qr_code?: string;
}> {
  event: 'connect' | 'disconnect';
}

export interface WebhookTypingEvent extends WuzAPIWebhookEvent<{
  from: string;
  is_typing: boolean;
}> {
  event: 'typing';
}

export interface WebhookPresenceEvent extends WuzAPIWebhookEvent<{
  from: string;
  presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
}> {
  event: 'presence';
}

export interface WebhookGroupEvent extends WuzAPIWebhookEvent<{
  action: 'create' | 'update' | 'add_participant' | 'remove_participant' | 'promote' | 'demote';
  group_id: string;
  participant?: string;
  by?: string;
}> {
  event: 'group';
}

// ============================================================================
// STATUS E PRESENÇA
// ============================================================================

export interface WuzAPIStatus {
  phone: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  qr_code?: string;
  profile: {
    name?: string;
    picture?: string;
    status_text?: string;
  };
  battery?: {
    level: number;
    plugged: boolean;
  };
  platform?: string;
  version?: string;
}

export interface SetPresencePayload {
  type: 'available' | 'unavailable';
}

export interface SetStatusPayload {
  status: string;
}

// ============================================================================
// GRUPOS
// ============================================================================

export interface CreateGroupPayload {
  name: string;
  description?: string;
  participants: string[]; // array de números de telefone
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
}

export interface GroupInvitePayload {
  participants: string[];
}

export interface GroupRemovePayload {
  participants: string[];
}

export interface GroupPromotePayload {
  participants: string[];
}

export interface GroupDemotePayload {
  participants: string[];
}

// ============================================================================
// MÍDIA E ARQUIVOS
// ============================================================================

export interface WuzAPIMedia {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  size: number;
  filename?: string;
  mime_type: string;
  created_at: string;
}

export interface UploadMediaPayload {
  file: File | string; // File object ou base64
  type: 'image' | 'video' | 'audio' | 'document';
  filename?: string;
}

// ============================================================================
// CONFIGURAÇÕES E ADMIN
// ============================================================================

export interface WuzAPISettings {
  auto_reply?: boolean;
  auto_reply_message?: string;
  reject_calls?: boolean;
  reject_calls_message?: string;
  read_messages?: boolean;
  read_status?: boolean;
  typing_simulation?: boolean;
  presence_simulation?: boolean;
  webhook_retries?: number;
  webhook_timeout?: number;
}

export interface WuzAPIStats {
  users_count: number;
  messages_sent: number;
  messages_received: number;
  active_connections: number;
  uptime: number;
  version: string;
}

// ============================================================================
// TIPOS DE RESPOSTA ESPECÍFICOS
// ============================================================================

export type WuzAPIUserResponse = WuzAPIResponse<WuzAPIUser>;
export type WuzAPIUsersResponse = WuzAPIResponse<WuzAPIUser[]>;
export type WuzAPIMessageResponse = WuzAPIResponse<WuzAPIMessage>;
export type WuzAPIMessagesResponse = WuzAPIResponse<WuzAPIMessage[]>;
export type WuzAPIChatResponse = WuzAPIResponse<WuzAPIChat>;
export type WuzAPIChatsResponse = WuzAPIResponse<WuzAPIChat[]>;
export type WuzAPIContactResponse = WuzAPIResponse<WuzAPIContact>;
export type WuzAPIContactsResponse = WuzAPIResponse<WuzAPIContact[]>;
export type WuzAPIGroupResponse = WuzAPIResponse<WuzAPIGroup>;
export type WuzAPIGroupsResponse = WuzAPIResponse<WuzAPIGroup[]>;
export type WuzAPIStatusResponse = WuzAPIResponse<WuzAPIStatus>;
export type WuzAPIMediaResponse = WuzAPIResponse<WuzAPIMedia>;
export type WuzAPISettingsResponse = WuzAPIResponse<WuzAPISettings>;
export type WuzAPIStatsResponse = WuzAPIResponse<WuzAPIStats>;

// ============================================================================
// TIPOS AUXILIARES PARA MIGRAÇÃO
// ============================================================================

/**
 * Mapeamento de Instance (Evolution API) para User (WuzAPI)
 */
export interface InstanceToUserMapping {
  // Evolution API fields
  evolutionInstanceName: string;
  evolutionToken: string;
  evolutionIntegration: string;
  
  // WuzAPI equivalent fields
  wuzapiPhone: string;
  wuzapiName: string;
  wuzapiToken: string;
}

/**
 * Configuração de migração
 */
export interface MigrationConfig {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  wuzapiBaseUrl: string;
  wuzapiAdminToken: string;
  preserveData: boolean;
  dryRun: boolean;
}