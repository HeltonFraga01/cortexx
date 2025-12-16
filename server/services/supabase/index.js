/**
 * Supabase Services Index
 * 
 * Exports all Supabase-based services for easy importing.
 * The system now uses Supabase exclusively as the database backend.
 * 
 * Usage:
 *   const { AccountService, AgentService } = require('./services/supabase');
 */

const AccountService = require('../AccountService');
const AgentService = require('../AgentService');
const ChatService = require('../ChatService');
const ConversationInboxService = require('../ConversationInboxService');
const PlanService = require('../PlanService');
const SupabaseService = require('../SupabaseService');
const StorageService = require('../StorageService');

module.exports = {
  // Core service (singleton)
  SupabaseService,
  
  // Domain services (classes - instantiate as needed)
  AccountService,
  AgentService,
  ChatService,
  ConversationInboxService,
  PlanService,
  StorageService
};
