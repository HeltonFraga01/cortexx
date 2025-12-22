/**
 * Supabase Database Types
 * Auto-generated from Supabase schema
 * 
 * Regenerate with: mcp_supabase_generate_typescript_types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          id: string
          locale: string | null
          name: string
          owner_user_id: string
          settings: Json | null
          status: string | null
          timezone: string | null
          updated_at: string | null
          wuzapi_token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          locale?: string | null
          name: string
          owner_user_id: string
          settings?: Json | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wuzapi_token: string
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string | null
          name?: string
          owner_user_id?: string
          settings?: Json | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wuzapi_token?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      agent_bots: {
        Row: {
          account_id: string
          bot_config: Json | null
          bot_type: string | null
          created_at: string | null
          description: string | null
          id: string
          include_history: boolean | null
          name: string
          outgoing_url: string
          priority: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          bot_config?: Json | null
          bot_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          include_history?: boolean | null
          name: string
          outgoing_url: string
          priority?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          bot_config?: Json | null
          bot_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          include_history?: boolean | null
          name?: string
          outgoing_url?: string
          priority?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          account_id: string
          availability: string | null
          avatar_url: string | null
          created_at: string | null
          custom_role_id: string | null
          email: string
          failed_login_attempts: number | null
          id: string
          last_activity_at: string | null
          locked_until: string | null
          name: string
          password_hash: string | null
          role: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          availability?: string | null
          avatar_url?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          email: string
          failed_login_attempts?: number | null
          id?: string
          last_activity_at?: string | null
          locked_until?: string | null
          name: string
          password_hash?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          availability?: string | null
          avatar_url?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          email?: string
          failed_login_attempts?: number | null
          id?: string
          last_activity_at?: string | null
          locked_until?: string | null
          name?: string
          password_hash?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          id: string
          is_private_note: boolean | null
          media_duration_seconds: number | null
          media_filename: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          message_id: string
          message_type: string
          metadata: Json | null
          reply_to_message_id: string | null
          sender_agent_id: string | null
          sender_bot_id: string | null
          sender_type: string | null
          status: string | null
          timestamp: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          direction: string
          id?: string
          is_private_note?: boolean | null
          media_duration_seconds?: number | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_id: string
          message_type: string
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_agent_id?: string | null
          sender_bot_id?: string | null
          sender_type?: string | null
          status?: string | null
          timestamp: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          is_private_note?: boolean | null
          media_duration_seconds?: number | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          message_id?: string
          message_type?: string
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_agent_id?: string | null
          sender_bot_id?: string | null
          sender_type?: string | null
          status?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_bot_id_fkey"
            columns: ["sender_bot_id"]
            isOneToOne: false
            referencedRelation: "agent_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          account_id: string
          assigned_agent_id: string | null
          assigned_bot_id: string | null
          contact_avatar_url: string | null
          contact_jid: string
          contact_name: string | null
          created_at: string | null
          id: string
          inbox_id: string | null
          is_muted: boolean | null
          is_test: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          assigned_agent_id?: string | null
          assigned_bot_id?: string | null
          contact_avatar_url?: string | null
          contact_jid: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          is_muted?: boolean | null
          is_test?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          assigned_agent_id?: string | null
          assigned_bot_id?: string | null
          contact_avatar_url?: string | null
          contact_jid?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          is_muted?: boolean | null
          is_test?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_bot_id_fkey"
            columns: ["assigned_bot_id"]
            isOneToOne: false
            referencedRelation: "agent_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          account_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inboxes: {
        Row: {
          account_id: string
          auto_assignment_availability_status: string | null
          auto_assignment_max_limit: number | null
          channel_type: string | null
          created_at: string | null
          enable_auto_assignment: boolean | null
          greeting_enabled: boolean | null
          greeting_message: string | null
          id: string
          name: string
          phone_number: string | null
          settings: Json | null
          status: string | null
          updated_at: string | null
          wuzapi_token: string | null
        }
        Insert: {
          account_id: string
          auto_assignment_availability_status?: string | null
          auto_assignment_max_limit?: number | null
          channel_type?: string | null
          created_at?: string | null
          enable_auto_assignment?: boolean | null
          greeting_enabled?: boolean | null
          greeting_message?: string | null
          id?: string
          name: string
          phone_number?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          wuzapi_token?: string | null
        }
        Update: {
          account_id?: string
          auto_assignment_availability_status?: string | null
          auto_assignment_max_limit?: number | null
          channel_type?: string | null
          created_at?: string | null
          enable_auto_assignment?: boolean | null
          greeting_enabled?: boolean | null
          greeting_message?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          wuzapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inboxes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          created_at: string | null
          description: string | null
          features: Json
          id: string
          is_default: boolean | null
          name: string
          price_cents: number
          quotas: Json
          status: string
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_default?: boolean | null
          name: string
          price_cents?: number
          quotas?: Json
          status?: string
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          price_cents?: number
          quotas?: Json
          status?: string
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      get_user_account_id: { Args: never; Returns: string }
      get_user_role_in_account: {
        Args: { p_account_id: string }
        Returns: string
      }
      has_account_access: { Args: { p_account_id: string }; Returns: boolean }
      has_permission: {
        Args: { p_account_id: string; p_permission: string }
        Returns: boolean
      }
      user_can_perform_action: {
        Args: { p_account_id: string; p_action: string }
        Returns: boolean
      }
      user_has_account_access: {
        Args: { p_account_id: string }
        Returns: boolean
      }
      user_is_account_admin: {
        Args: { p_account_id: string }
        Returns: boolean
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never
