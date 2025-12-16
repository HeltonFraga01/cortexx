/**
 * Migration: Add is_test column to conversations table
 * Version: 081
 * Date: 2025-12-16
 * 
 * This migration adds the is_test column to the conversations table
 * to distinguish test conversations from real WhatsApp conversations.
 * 
 * Requirements: 1.3, 4.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 081: Adicionar coluna is_test à tabela conversations');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(conversations)");
    const columnExists = tableInfo.rows.some(col => col.name === 'is_test');
    
    if (columnExists) {
      logger.info('ℹ️ Coluna is_test já existe na tabela conversations');
      return;
    }
    
    // Add is_test column with default value 0 (false)
    await db.query(`
      ALTER TABLE conversations ADD COLUMN is_test INTEGER DEFAULT 0
    `);
    logger.info('✅ Coluna is_test adicionada à tabela conversations');
    
    // Create index for filtering test conversations
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_is_test ON conversations(is_test)
    `);
    logger.info('✅ Índice idx_conversations_is_test criado');
    
    logger.info('✅ Migration 081 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 081:', error.message);
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
    logger.info('🔄 Revertendo migration 081: Remover coluna is_test');
    
    // SQLite doesn't support DROP COLUMN directly in older versions
    // We need to recreate the table without the column
    // For simplicity, we'll just drop the index (column removal requires table recreation)
    await db.query('DROP INDEX IF EXISTS idx_conversations_is_test');
    logger.info('✅ Índice idx_conversations_is_test removido');
    
    // Note: Full column removal would require table recreation
    // which is complex and risky for production data
    logger.warn('⚠️ Coluna is_test não foi removida (requer recriação da tabela)');
    
    logger.info('✅ Migration 081 revertida parcialmente');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 081:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 81,
  description: 'Add is_test column to conversations table for bot test chat'
};
