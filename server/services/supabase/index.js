/**
 * Supabase Services Index
 * 
 * Exports all Supabase-based services for easy importing.
 * These services replace the SQLite-based services when using Supabase as the database backend.
 * 
 * Usage:
 *   const { AccountService, AgentService } = require('./services/supabase');
 * 
 * Or with feature flag:
 *   const services = process.env.USE_SUPABASE === 'true'
 *     ? require('./services/supabase')
 *     : require('./services/sqlite');
 */

const AccountServiceSupabase = require('../AccountServiceSupabase');
const AgentServiceSupabase = require('../AgentServiceSupabase');
const ChatServiceSupabase = require('../ChatServiceSupabase');
const ConversationInboxServiceSupabase = require('../ConversationInboxServiceSupabase');
const PlanServiceSupabase = require('../PlanServiceSupabase');
const SupabaseService = require('../SupabaseService');
const StorageService = require('../StorageService');

module.exports = {
  // Core service (singleton)
  SupabaseService,
  
  // Domain services (classes - instantiate as needed)
  AccountService: AccountServiceSupabase,
  AgentService: AgentServiceSupabase,
  ChatService: ChatServiceSupabase,
  ConversationInboxService: ConversationInboxServiceSupabase,
  PlanService: PlanServiceSupabase,
  StorageService,
  
  // Named exports for explicit imports
  AccountServiceSupabase,
  AgentServiceSupabase,
  ChatServiceSupabase,
  ConversationInboxServiceSupabase,
  PlanServiceSupabase
};
