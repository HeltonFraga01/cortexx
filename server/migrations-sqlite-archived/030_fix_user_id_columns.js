/**
 * Migration: Fix user_id columns to use TEXT (token) instead of INTEGER
 * Version: 030
 * Date: 2025-12-04
 * 
 * This migration fixes the user_id columns in chat-related tables to use TEXT
 * instead of INTEGER, since the system uses WUZAPI tokens directly as user identifiers
 * and there is no local users table.
 * 
 * Tables affected:
 * - labels
 * - canned_responses
 * - agent_bots
 * - outgoing_webhooks
 * - conversations
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 030: Corrigir colunas user_id para TEXT');
    
    // SQLite doesn't support ALTER COLUMN, so we need to recreate tables
    // We'll check if the column is already TEXT and skip if so
    
    // Fix labels table
    const labelsInfo = await db.query("PRAGMA table_info(labels)");
    const labelsUserIdCol = labelsInfo.rows?.find(col => col.name === 'user_id');
    
    if (labelsUserIdCol && labelsUserIdCol.type.toUpperCase() === 'INTEGER') {
      logger.info('🔄 Recriando tabela labels com user_id TEXT...');
      
      await db.query(`
        CREATE TABLE labels_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);
      
      await db.query(`
        INSERT INTO labels_new (id, user_id, name, color, created_at)
        SELECT id, CAST(user_id AS TEXT), name, color, created_at FROM labels
      `);
      
      await db.query('DROP TABLE labels');
      await db.query('ALTER TABLE labels_new RENAME TO labels');
      await db.query('CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id)');
      
      logger.info('✅ Tabela labels corrigida');
    } else {
      logger.info('ℹ️ Tabela labels já está correta ou não existe');
    }
    
    // Fix canned_responses table
    const cannedInfo = await db.query("PRAGMA table_info(canned_responses)");
    const cannedUserIdCol = cannedInfo.rows?.find(col => col.name === 'user_id');
    
    if (cannedUserIdCol && cannedUserIdCol.type.toUpperCase() === 'INTEGER') {
      logger.info('🔄 Recriando tabela canned_responses com user_id TEXT...');
      
      await db.query(`
        CREATE TABLE canned_responses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          shortcut TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, shortcut)
        )
      `);
      
      await db.query(`
        INSERT INTO canned_responses_new (id, user_id, shortcut, content, created_at, updated_at)
        SELECT id, CAST(user_id AS TEXT), shortcut, content, created_at, updated_at FROM canned_responses
      `);
      
      await db.query('DROP TABLE canned_responses');
      await db.query('ALTER TABLE canned_responses_new RENAME TO canned_responses');
      await db.query('CREATE INDEX IF NOT EXISTS idx_canned_responses_user_id ON canned_responses(user_id)');
      
      logger.info('✅ Tabela canned_responses corrigida');
    } else {
      logger.info('ℹ️ Tabela canned_responses já está correta ou não existe');
    }
    
    // Fix agent_bots table
    const botsInfo = await db.query("PRAGMA table_info(agent_bots)");
    const botsUserIdCol = botsInfo.rows?.find(col => col.name === 'user_id');
    
    if (botsUserIdCol && botsUserIdCol.type.toUpperCase() === 'INTEGER') {
      logger.info('🔄 Recriando tabela agent_bots com user_id TEXT...');
      
      await db.query(`
        CREATE TABLE agent_bots_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          avatar_url TEXT,
          outgoing_url TEXT NOT NULL,
          access_token TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        INSERT INTO agent_bots_new (id, user_id, name, description, avatar_url, outgoing_url, access_token, status, created_at, updated_at)
        SELECT id, CAST(user_id AS TEXT), name, description, avatar_url, outgoing_url, access_token, status, created_at, updated_at FROM agent_bots
      `);
      
      await db.query('DROP TABLE agent_bots');
      await db.query('ALTER TABLE agent_bots_new RENAME TO agent_bots');
      await db.query('CREATE INDEX IF NOT EXISTS idx_agent_bots_user_id ON agent_bots(user_id)');
      
      logger.info('✅ Tabela agent_bots corrigida');
    } else {
      logger.info('ℹ️ Tabela agent_bots já está correta ou não existe');
    }
    
    // Fix outgoing_webhooks table
    const webhooksInfo = await db.query("PRAGMA table_info(outgoing_webhooks)");
    const webhooksUserIdCol = webhooksInfo.rows?.find(col => col.name === 'user_id');
    
    if (webhooksUserIdCol && webhooksUserIdCol.type.toUpperCase() === 'INTEGER') {
      logger.info('🔄 Recriando tabela outgoing_webhooks com user_id TEXT...');
      
      await db.query(`
        CREATE TABLE outgoing_webhooks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          last_delivery_at DATETIME,
          last_error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.query(`
        INSERT INTO outgoing_webhooks_new (id, user_id, url, events, is_active, success_count, failure_count, last_delivery_at, last_error, created_at, updated_at)
        SELECT id, CAST(user_id AS TEXT), url, events, is_active, success_count, failure_count, last_delivery_at, last_error, created_at, updated_at FROM outgoing_webhooks
      `);
      
      await db.query('DROP TABLE outgoing_webhooks');
      await db.query('ALTER TABLE outgoing_webhooks_new RENAME TO outgoing_webhooks');
      await db.query('CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_user_id ON outgoing_webhooks(user_id)');
      
      logger.info('✅ Tabela outgoing_webhooks corrigida');
    } else {
      logger.info('ℹ️ Tabela outgoing_webhooks já está correta ou não existe');
    }
    
    // Fix conversations table
    const convsInfo = await db.query("PRAGMA table_info(conversations)");
    const convsUserIdCol = convsInfo.rows?.find(col => col.name === 'user_id');
    
    if (convsUserIdCol && convsUserIdCol.type.toUpperCase() === 'INTEGER') {
      logger.info('🔄 Recriando tabela conversations com user_id TEXT...');
      
      // Get current columns
      const columns = convsInfo.rows.map(col => col.name).join(', ');
      
      await db.query(`
        CREATE TABLE conversations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          contact_jid TEXT NOT NULL,
          contact_name TEXT,
          contact_avatar_url TEXT,
          last_message_at DATETIME,
          last_message_preview TEXT,
          unread_count INTEGER DEFAULT 0,
          assigned_bot_id INTEGER,
          status TEXT DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, contact_jid)
        )
      `);
      
      await db.query(`
        INSERT INTO conversations_new (id, user_id, contact_jid, contact_name, contact_avatar_url, last_message_at, last_message_preview, unread_count, assigned_bot_id, status, created_at, updated_at)
        SELECT id, CAST(user_id AS TEXT), contact_jid, contact_name, contact_avatar_url, last_message_at, last_message_preview, unread_count, assigned_bot_id, status, created_at, updated_at FROM conversations
      `);
      
      await db.query('DROP TABLE conversations');
      await db.query('ALTER TABLE conversations_new RENAME TO conversations');
      await db.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_conversations_contact_jid ON conversations(contact_jid)');
      
      logger.info('✅ Tabela conversations corrigida');
    } else {
      logger.info('ℹ️ Tabela conversations já está correta ou não existe');
    }
    
    logger.info('✅ Migration 030 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 030:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migration 030: Esta migration não pode ser revertida automaticamente');
    logger.info('ℹ️ Os dados foram convertidos de INTEGER para TEXT e não podem ser revertidos sem perda');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 030:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 30,
  description: 'Fix user_id columns to use TEXT (token) instead of INTEGER'
};
