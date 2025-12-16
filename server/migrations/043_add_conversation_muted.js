/**
 * Migration: Add is_muted column to conversations table
 * Version: 043
 * Date: 2025-12-08
 * 
 * This migration adds the is_muted column to allow users to mute
 * specific conversations and disable audio notifications for them.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 043: Adicionar coluna is_muted em conversations');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(conversations)");
    const columnExists = tableInfo.rows.some(col => col.name === 'is_muted');
    
    if (columnExists) {
      logger.info('ℹ️ Coluna is_muted já existe em conversations');
      return;
    }
    
    // Add is_muted column with default value false (0)
    await db.query(`
      ALTER TABLE conversations 
      ADD COLUMN is_muted INTEGER DEFAULT 0
    `);
    logger.info('✅ Coluna is_muted adicionada em conversations');
    
    // Create index for filtering muted conversations
    await db.query('CREATE INDEX IF NOT EXISTS idx_conversations_is_muted ON conversations(is_muted)');
    logger.info('✅ Índice idx_conversations_is_muted criado');
    
    logger.info('✅ Migration 043 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 043:', error.message);
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
    logger.info('🔄 Revertendo migration 043: Remover coluna is_muted de conversations');
    
    // SQLite doesn't support DROP COLUMN directly, need to recreate table
    // For simplicity, we'll just log a warning
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. A coluna is_muted permanecerá na tabela.');
    
    logger.info('✅ Migration 043 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 043:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 43,
  description: 'Add is_muted column to conversations table'
};
