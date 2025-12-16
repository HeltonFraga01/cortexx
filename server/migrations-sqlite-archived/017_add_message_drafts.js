/**
 * Migration: Add message drafts table
 * Version: 017
 * Date: 2025-11-29
 * 
 * This migration adds support for:
 * - Message drafts persistence for send flow state
 * - Auto-save functionality for messaging system
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 017: Criar tabela message_drafts');
    
    // 1. Create message_drafts table
    const createDraftsTableSql = `
      CREATE TABLE IF NOT EXISTS message_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        draft_type TEXT NOT NULL DEFAULT 'send_flow',
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createDraftsTableSql);
    logger.info('✅ Tabela message_drafts criada com sucesso');
    
    // 2. Create index on user_id for faster lookups
    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON message_drafts(user_id)
    `;
    
    await db.query(createIndexSql);
    logger.info('✅ Índice idx_drafts_user_id criado');
    
    // 3. Create index on draft_type for filtering
    const createTypeIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_drafts_type ON message_drafts(draft_type)
    `;
    
    await db.query(createTypeIndexSql);
    logger.info('✅ Índice idx_drafts_type criado');
    
    logger.info('✅ Migration 017 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 017:', error.message);
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
    logger.info('🔄 Revertendo migration 017: Remover tabela message_drafts');
    
    // Drop indexes first
    await db.query('DROP INDEX IF EXISTS idx_drafts_type');
    logger.info('✅ Índice idx_drafts_type removido');
    
    await db.query('DROP INDEX IF EXISTS idx_drafts_user_id');
    logger.info('✅ Índice idx_drafts_user_id removido');
    
    // Drop table
    await db.query('DROP TABLE IF EXISTS message_drafts');
    logger.info('✅ Tabela message_drafts removida');
    
    logger.info('✅ Migration 017 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 017:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 17,
  description: 'Add message drafts table for send flow persistence'
};
