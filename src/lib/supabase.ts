/**
 * Supabase Client
 * Task 16.2: Create frontend Supabase client
 * 
 * Provides type-safe Supabase client with auth state management
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Create typed Supabase client
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'supabase.auth.token',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Auth state types
export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: Error | null
}

// Auth helper functions
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  
  if (error) throw error
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Auth state listener
export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session)
    }
  )
  
  return () => subscription.unsubscribe()
}

// Database helper functions with type safety
export const db = {
  // Accounts
  accounts: {
    async getById(id: string) {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
    
    async getByOwner() {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    
    async create(account: Database['public']['Tables']['accounts']['Insert']) {
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    
    async update(id: string, updates: Database['public']['Tables']['accounts']['Update']) {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
  },
  
  // Conversations
  conversations: {
    async list(accountId: string, options?: { 
      status?: string
      limit?: number
      offset?: number
    }) {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('account_id', accountId)
        .order('last_message_at', { ascending: false })
      
      if (options?.status) {
        query = query.eq('status', options.status)
      }
      
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    },
    
    async getById(id: string) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
    
    async update(id: string, updates: Database['public']['Tables']['conversations']['Update']) {
      const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
  },
  
  // Messages
  messages: {
    async list(conversationId: string, options?: {
      limit?: number
      before?: string // cursor for pagination
    }) {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
      
      if (options?.before) {
        query = query.lt('timestamp', options.before)
      }
      
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data?.reverse() || [] // Return in chronological order
    },
    
    async create(message: Database['public']['Tables']['chat_messages']['Insert']) {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(message)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
  },
  
  // Agents
  agents: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('account_id', accountId)
        .order('name')
      
      if (error) throw error
      return data
    },
    
    async getById(id: string) {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
    
    async getCurrentAgent() {
      const user = await getUser()
      if (!user) return null
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (error) throw error
      return data
    },
  },
  
  // Inboxes
  inboxes: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('inboxes')
        .select('*')
        .eq('account_id', accountId)
        .order('name')
      
      if (error) throw error
      return data
    },
  },
  
  // Labels
  labels: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('account_id', accountId)
        .order('title')
      
      if (error) throw error
      return data
    },
  },
  
  // Teams
  teams: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('account_id', accountId)
        .order('name')
      
      if (error) throw error
      return data
    },
  },
  
  // Plans
  plans: {
    async list() {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'active')
        .order('price_cents')
      
      if (error) throw error
      return data
    },
    
    async getById(id: string) {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  },
  
  // Webhooks
  webhooks: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('outgoing_webhooks')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    
    async create(webhook: Database['public']['Tables']['outgoing_webhooks']['Insert']) {
      const { data, error } = await supabase
        .from('outgoing_webhooks')
        .insert(webhook)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    
    async update(id: string, updates: Database['public']['Tables']['outgoing_webhooks']['Update']) {
      const { data, error } = await supabase
        .from('outgoing_webhooks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    
    async delete(id: string) {
      const { error } = await supabase
        .from('outgoing_webhooks')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
  },
  
  // Canned Responses
  cannedResponses: {
    async list(accountId: string) {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .eq('account_id', accountId)
        .order('short_code')
      
      if (error) throw error
      return data
    },
  },
}

// RPC function helpers
export const rpc = {
  async getUserAccountId(): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_user_account_id')
    if (error) throw error
    return data
  },
  
  async getUserRoleInAccount(accountId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_user_role_in_account', {
      p_account_id: accountId,
    })
    if (error) throw error
    return data
  },
  
  async hasAccountAccess(accountId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_account_access', {
      p_account_id: accountId,
    })
    if (error) throw error
    return data || false
  },
  
  async hasPermission(accountId: string, permission: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_permission', {
      p_account_id: accountId,
      p_permission: permission,
    })
    if (error) throw error
    return data || false
  },
}

export default supabase
