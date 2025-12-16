/**
 * Migration: Create conversations table for chat interface
 * Version: 020
 * Date: 2025-12-04
 * 
 * This migration creates the conversations table to store WhatsApp chat threads.
 * Each conversation represents a thread between a user and a specific WhatsApp contact.
 * 
 * Requirements: 1.1, 1.3
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 020: Criar tabela conversations');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela conversations já existe');
      return;
    }
    
    // Create conversations table
    const createTableSql = `
      CREATE TABLE conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        contact_jid TEXT NOT NULL,
        contact_name TEXT,
        contact_avatar_url TEXT,
        last_message_at DATETIME,
        last_message_preview TEXT,
        unread_count INTEGER DEFAULT 0,
        assigned_bot_id INTEGER,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'pending')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_bot_id) REFERENCES agent_bots(id) ON DELETE SET NULL,
        UNIQUE(user_id, contact_jid)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela conversations criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_conversations_user_id ON conversations(user_id)');
    logger.info('✅ Índice idx_conversations_user_id criado');
    
    await db.query('CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC)');
    logger.info('✅ Índice idx_conversations_last_message criado');
    
    await db.query('CREATE INDEX idx_conversations_status ON conversations(status)');
    logger.info('✅ Índice idx_conversations_status criado');
    
    await db.query('CREATE INDEX idx_conversations_assigned_bot ON conversations(assigned_bot_id)');
    logger.info('✅ Índice idx_conversations_assigned_bot criado');
    
    logger.info('✅ Migration 020 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 020:', error.message);
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
    logger.info('🔄 Revertendo migration 020: Remover tabela conversations');
    
    await db.query('DROP TABLE IF EXISTS conversations');
    logger.info('✅ Tabela conversations removida');
    
    logger.info('✅ Migration 020 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 020:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 20,
  description: 'Create conversations table for chat interface'
};
