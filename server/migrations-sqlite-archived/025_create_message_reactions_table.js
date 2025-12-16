/**
 * Migration: Create message_reactions table for chat interface
 * Version: 025
 * Date: 2025-12-04
 * 
 * This migration creates the message_reactions table to store emoji reactions
 * on chat messages.
 * 
 * Requirements: 5.1-5.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 025: Criar tabela message_reactions');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='message_reactions'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela message_reactions já existe');
      return;
    }
    
    // Create message_reactions table
    const createTableSql = `
      CREATE TABLE message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        reactor_jid TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
        UNIQUE(message_id, reactor_jid)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela message_reactions criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_reactions_message_id ON message_reactions(message_id)');
    logger.info('✅ Índice idx_reactions_message_id criado');
    
    await db.query('CREATE INDEX idx_reactions_reactor_jid ON message_reactions(reactor_jid)');
    logger.info('✅ Índice idx_reactions_reactor_jid criado');
    
    logger.info('✅ Migration 025 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 025:', error.message);
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
    logger.info('🔄 Revertendo migration 025: Remover tabela message_reactions');
    
    await db.query('DROP TABLE IF EXISTS message_reactions');
    logger.info('✅ Tabela message_reactions removida');
    
    logger.info('✅ Migration 025 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 025:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 25,
  description: 'Create message_reactions table for chat interface'
};
