/**
 * Migration: Create chat_messages table for chat interface
 * Version: 021
 * Date: 2025-12-04
 * 
 * This migration creates the chat_messages table to store individual messages
 * within conversations. Supports text, media, location, contact, and other message types.
 * 
 * Requirements: 2.1, 3.1-3.6, 13.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 021: Criar tabela chat_messages');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela chat_messages já existe');
      return;
    }
    
    // Create chat_messages table
    const createTableSql = `
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        message_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
        message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker')),
        content TEXT,
        media_url TEXT,
        media_mime_type TEXT,
        media_filename TEXT,
        reply_to_message_id TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
        is_private_note INTEGER DEFAULT 0,
        sender_type TEXT CHECK(sender_type IN ('user', 'contact', 'bot')),
        sender_bot_id INTEGER,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_bot_id) REFERENCES agent_bots(id) ON DELETE SET NULL
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela chat_messages criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id)');
    logger.info('✅ Índice idx_messages_conversation criado');
    
    await db.query('CREATE INDEX idx_messages_timestamp ON chat_messages(timestamp DESC)');
    logger.info('✅ Índice idx_messages_timestamp criado');
    
    await db.query('CREATE INDEX idx_messages_status ON chat_messages(status)');
    logger.info('✅ Índice idx_messages_status criado');
    
    await db.query('CREATE INDEX idx_messages_message_id ON chat_messages(message_id)');
    logger.info('✅ Índice idx_messages_message_id criado');
    
    await db.query('CREATE INDEX idx_messages_direction ON chat_messages(direction)');
    logger.info('✅ Índice idx_messages_direction criado');
    
    logger.info('✅ Migration 021 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 021:', error.message);
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
    logger.info('🔄 Revertendo migration 021: Remover tabela chat_messages');
    
    await db.query('DROP TABLE IF EXISTS chat_messages');
    logger.info('✅ Tabela chat_messages removida');
    
    logger.info('✅ Migration 021 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 021:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 21,
  description: 'Create chat_messages table for chat interface'
};
