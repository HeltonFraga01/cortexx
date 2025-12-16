export interface Instance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  integration: string;
  phoneNumber?: string;
  token?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    Message: number;
    Contact: number;
    Chat: number;
  };
  Setting?: {
    id: string;
    rejectCall: boolean;
    msgCall: string;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    readStatus: boolean;
    syncFullHistory: boolean;
    instanceId: string;
  };
}

export interface ApiResponse<T = unknown> {
  status?: number;
  error?: string;
  response?: T;
}

export interface CreateInstancePayload {
  instanceName: string;
  webhook_by_events?: boolean;
  qrcode: boolean;
  integration: string;
  token?: string;
  phoneNumber?: string;
}

export interface PresencePayload {
  type: "available" | "unavailable";
}

export interface QRCodeResponse {
  qrcode?: string; // The QR code string
  base64: string; // The base64 image data
  pairingCode?: string; // Optional pairing code
  connected?: boolean; // Whether the connection was successful
}

export interface TypebotConfig {
  id?: string;
  enabled: boolean;
  url: string;
  typebot: string;
  description: string;
  triggerType: "keyword" | "all";
  triggerOperator?: "contains" | "equals" | "startsWith" | "endsWith" | "regex";
  triggerValue?: string;
  expire: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  createdAt?: string;
  updatedAt?: string;
  ignoreJids?: string[];
  instanceId?: string;
}

export interface TypebotStartPayload {
  url: string;
  typebot: string;
  remoteJid: string;
  startSession: boolean;
  variables?: Array<{
    name: string;
    value: string;
  }>;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers: {
    [key: string]: string;
  };
  byEvents: boolean;
  base64: boolean;
  events: WebhookEventType[];
}

export type WebhookEventType =
  | "APPLICATION_STARTUP"
  | "QRCODE_UPDATED"
  | "MESSAGES_SET"
  | "MESSAGES_UPSERT"
  | "MESSAGES_UPDATE"
  | "MESSAGES_DELETE"
  | "SEND_MESSAGE"
  | "CONTACTS_SET"
  | "CONTACTS_UPSERT"
  | "CONTACTS_UPDATE"
  | "PRESENCE_UPDATE"
  | "CHATS_SET"
  | "CHATS_UPSERT"
  | "CHATS_UPDATE"
  | "CHATS_DELETE"
  | "GROUPS_UPSERT"
  | "GROUP_UPDATE"
  | "GROUP_PARTICIPANTS_UPDATE"
  | "CONNECTION_UPDATE"
  | "LABELS_EDIT"
  | "LABELS_ASSOCIATION"
  | "CALL"
  | "TYPEBOT_START"
  | "TYPEBOT_CHANGE_STATUS";

export interface OpenAICredential {
  id?: string;
  name: string;
  apiKey: string;
  createdAt?: string;
  updatedAt?: string;
  instanceId?: string;
}

export interface Chatbot {
  id?: string;
  name?: string;
  enabled: boolean;
  openaiCredsId: string;
  description: string;
  botType: "assistant" | "chatCompletion";
  // For assistants
  assistantId?: string;
  functionUrl?: string;
  // For chat completion
  model: string;
  systemMessages?: string[];
  assistantMessages?: string[];
  userMessages?: string[];
  maxTokens: number;
  // Options
  triggerType: "keyword" | "all";
  triggerOperator:
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "regex"
    | "none";
  triggerValue: string;
  expire: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  splitMessages?: boolean;
  timePerChar?: number;
  ignoreJids?: string[];
  createdAt?: string;
  updatedAt?: string;
  instanceId?: string;
}

export interface License {
  key: string;
  validUntil: string;
  isValid: boolean;
  createdAt: string;
}

// Database Connection and View Builder Types
export interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
  showInCard?: boolean;
  helperText?: string; // Helper text for form fields (max 500 characters)
}

export interface CalendarViewConfig {
  enabled: boolean;
  dateField?: string; // Column name to use for calendar organization
}

export interface KanbanViewConfig {
  enabled: boolean;
  statusField?: string; // Column name to use for kanban columns
}

export interface EditThemeConfig {
  enabled: boolean;
  themeId: string;
  options?: Record<string, any>; // Theme-specific options
}

export interface ViewConfiguration {
  calendar?: CalendarViewConfig;
  kanban?: KanbanViewConfig;
  editTheme?: EditThemeConfig;
}

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  resource?: any; // Full record data
}

export interface KanbanColumn {
  id: string;
  title: string;
  records: any[];
}

export interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type (Date, DateTime, SingleLineText, etc.)
}

export interface DatabaseConnection {
  id?: number;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assignedUsers: string[];
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  user_link_field?: string;
  userLinkField?: string;
  fieldMappings?: FieldMapping[];
  field_mappings?: FieldMapping[];
  viewConfiguration?: ViewConfiguration;
  view_configuration?: ViewConfiguration;
  created_at?: string;
  updated_at?: string;
}

// Field Type System for Dynamic Inputs
export enum FieldType {
  TEXT = 'text',
  LONG_TEXT = 'longText',
  NUMBER = 'number',
  DECIMAL = 'decimal',
  CURRENCY = 'currency',
  PERCENT = 'percent',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  YEAR = 'year',
  SINGLE_SELECT = 'singleSelect',
  MULTI_SELECT = 'multiSelect',
  CHECKBOX = 'checkbox',
  EMAIL = 'email',
  PHONE = 'phoneNumber',
  URL = 'url',
  RATING = 'rating',
  DURATION = 'duration',
  ATTACHMENT = 'attachment',
  USER = 'user',
  JSON = 'json'
}

export interface SelectOption {
  id: string;
  title: string;
  color?: string; // NocoDB supports colored options
}

export interface FieldMetadata {
  columnName: string;
  label: string;
  type: FieldType;
  uidt: string; // Original NocoDB type
  required: boolean;
  editable: boolean;
  visible: boolean;
  options?: SelectOption[]; // For single/multi select
  meta?: Record<string, any>; // Additional metadata from NocoDB
  displayOrder?: number; // Field ordering
  helperText?: string; // Helper text for form fields
}

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
}

// NocoDB Column Metadata Structure
export interface NocoDBColumnMetadata {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type
  dt: string; // Database Type
  np?: string; // Numeric Precision
  ns?: string; // Numeric Scale
  clen?: number; // Column Length
  cop?: number; // Column Order Position
  pk?: boolean; // Primary Key
  pv?: boolean; // Primary Value
  rqd?: boolean; // Required
  un?: boolean; // Unsigned
  ai?: boolean; // Auto Increment
  unique?: boolean;
  cdf?: string | null; // Column Default
  cc?: string | null; // Computed Column
  csn?: string | null; // Column System Name
  dtx?: string; // Data Type Extended
  dtxp?: string; // Data Type Extended Precision
  dtxs?: string; // Data Type Extended Scale
  au?: boolean; // Auto Update
  colOptions?: {
    options?: Array<{
      id: string;
      title: string;
      color?: string;
      order?: number;
    }>;
  };
  meta?: Record<string, any>;
}

// Table Permissions Types
export interface TablePermission {
  id: number;
  user_id: string;
  table_name: string;
  can_read: number;
  can_write: number;
  can_delete: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePermissionRequest {
  user_id: string;
  table_name: string;
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
}

export interface UpdatePermissionRequest {
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
}

export interface TableInfo {
  table_name: string;
  row_count: number;
  column_count: number;
  index_count: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  not_null: boolean;
  default_value: string | null;
  primary_key: boolean;
}

export interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
}

// Generic Table Operations Types
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, string>;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface QueryResult<T = any> {
  data: T[];
  pagination: PaginationInfo;
}

export interface TableRecord {
  id: number;
  [key: string]: any;
}
