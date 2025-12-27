/**
 * TypeScript types for Supabase Database Integration
 * Requirements: 2.2, 3.1, 3.2
 */

/**
 * Supabase API key type
 */
export type SupabaseKeyType = 'service_role' | 'anon';

/**
 * Supabase table metadata returned from listTables
 */
export interface SupabaseTable {
  name: string;
  schema: string;
  rowCount?: number;
  rlsEnabled: boolean;
  comment?: string;
}

/**
 * Supabase column metadata returned from getTableColumns
 */
export interface SupabaseColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  defaultValue?: string;
  comment?: string;
}

/**
 * UI input types for form rendering
 */
export type UIInputType = 
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'time'
  | 'json'
  | 'uuid'
  | 'array'
  | 'select';

/**
 * PostgreSQL to UI type mapping
 */
export const PG_TYPE_MAP: Record<string, UIInputType> = {
  // Text types
  'text': 'text',
  'varchar': 'text',
  'character varying': 'text',
  'char': 'text',
  'character': 'text',
  'name': 'text',
  'citext': 'text',
  
  // Numeric types
  'integer': 'number',
  'int': 'number',
  'int4': 'number',
  'bigint': 'number',
  'int8': 'number',
  'smallint': 'number',
  'int2': 'number',
  'numeric': 'number',
  'decimal': 'number',
  'real': 'number',
  'float4': 'number',
  'double precision': 'number',
  'float8': 'number',
  'serial': 'number',
  'bigserial': 'number',
  'smallserial': 'number',
  
  // Boolean
  'boolean': 'checkbox',
  'bool': 'checkbox',
  
  // Date/Time
  'date': 'date',
  'timestamp': 'datetime',
  'timestamp without time zone': 'datetime',
  'timestamptz': 'datetime',
  'timestamp with time zone': 'datetime',
  'time': 'time',
  'time without time zone': 'time',
  'timetz': 'time',
  'time with time zone': 'time',
  
  // JSON
  'json': 'json',
  'jsonb': 'json',
  
  // UUID
  'uuid': 'uuid',
  
  // Arrays (generic)
  'ARRAY': 'array',
  '_text': 'array',
  '_int4': 'array',
  '_int8': 'array',
  '_uuid': 'array',
  '_varchar': 'array',
};

/**
 * Maps a PostgreSQL data type to a UI input type
 * @param pgType - PostgreSQL data type string
 * @returns UI input type
 */
export function mapPgTypeToUIType(pgType: string): UIInputType {
  if (!pgType) return 'text';
  
  const normalizedType = pgType.toLowerCase().trim();
  
  // Check for array types (start with underscore or contain ARRAY)
  if (normalizedType.startsWith('_') || normalizedType.includes('[]')) {
    return 'array';
  }
  
  // Direct mapping
  if (PG_TYPE_MAP[normalizedType]) {
    return PG_TYPE_MAP[normalizedType];
  }
  
  // Check for partial matches (e.g., "character varying(255)")
  for (const [key, value] of Object.entries(PG_TYPE_MAP)) {
    if (normalizedType.startsWith(key)) {
      return value;
    }
  }
  
  // Default to text for unknown types
  return 'text';
}

/**
 * Supabase connection configuration fields
 */
export interface SupabaseConnectionConfig {
  supabase_url: string;
  supabase_key: string;
  supabase_key_type: SupabaseKeyType;
  supabase_table?: string;
}

/**
 * Extended DatabaseConnection type with Supabase fields
 */
export interface DatabaseConnection {
  id?: string;
  account_id?: string;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SUPABASE';
  host: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  table_name?: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  
  // NocoDB fields
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  
  // Supabase fields
  supabase_url?: string;
  supabase_key?: string;
  supabase_key_type?: SupabaseKeyType;
  supabase_table?: string;
  
  // Common fields
  user_link_field?: string;
  field_mappings?: FieldMapping[];
  view_configuration?: ViewConfiguration;
  default_view_mode?: 'list' | 'single';
  assigned_users?: string[];
  
  created_at?: string;
  updated_at?: string;
}

/**
 * Field mapping configuration
 */
export interface FieldMapping {
  source_field: string;
  display_name: string;
  visible: boolean;
  editable: boolean;
  field_type?: UIInputType;
  options?: string[];
}

/**
 * View configuration for calendar, kanban, etc.
 */
export interface ViewConfiguration {
  calendar?: {
    date_field: string;
    title_field: string;
    color_field?: string;
  };
  kanban?: {
    status_field: string;
    title_field: string;
    columns: string[];
  };
  edit_theme?: {
    primary_color?: string;
    background_color?: string;
  };
}

/**
 * Supabase connection test result
 */
export interface SupabaseTestResult {
  success: boolean;
  status: 'connected' | 'error';
  message: string;
  details?: {
    projectRef?: string;
    tablesCount?: number;
    rlsEnabled?: boolean;
  };
}

/**
 * Supabase error codes and messages
 */
export const SUPABASE_ERROR_CODES = {
  INVALID_URL: 'INVALID_SUPABASE_URL',
  AUTH_FAILED: 'SUPABASE_AUTH_FAILED',
  PERMISSION_DENIED: 'SUPABASE_PERMISSION_DENIED',
  TABLE_NOT_FOUND: 'SUPABASE_TABLE_NOT_FOUND',
  RLS_VIOLATION: 'SUPABASE_RLS_VIOLATION',
  TIMEOUT: 'SUPABASE_TIMEOUT',
  RATE_LIMITED: 'SUPABASE_RATE_LIMITED',
  UNKNOWN: 'SUPABASE_UNKNOWN_ERROR',
} as const;

export type SupabaseErrorCode = typeof SUPABASE_ERROR_CODES[keyof typeof SUPABASE_ERROR_CODES];
