/**
 * Migration: Create user_quota_overrides table for custom quota limits
 * Version: 061
 * Date: 2025-12-09
 * 
 * This migration creates the user_quota_overrides table to store custom quota limits per user.
 * Overrides take precedence over plan defaults.
 * 
 * Requirements: 2.6, 3.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 061: Criar tabela user_quota_overrides');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_quota_overrides'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela user_quota_overrides já existe');
      return;
    }
    
    // Create user_quota_overrides table
    const createTableSql = `
      CREATE TABLE user_quota_overrides (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_type TEXT NOT NULL,
        limit_value INTEGER NOT NULL,
        reason TEXT,
        set_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, quota_type)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela user_quota_overrides criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_user_quota_overrides_user_id ON user_quota_overrides(user_id)');
    logger.info('✅ Índice idx_user_quota_overrides_user_id criado');
    
    await db.query('CREATE INDEX idx_user_quota_overrides_quota_type ON user_quota_overrides(quota_type)');
    logger.info('✅ Índice idx_user_quota_overrides_quota_type criado');
    
    logger.info('✅ Migration 061 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 061:', error.message);
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
    logger.info('🔄 Revertendo migration 061: Remover tabela user_quota_overrides');
    
    await db.query('DROP TABLE IF EXISTS user_quota_overrides');
    logger.info('✅ Tabela user_quota_overrides removida');
    
    logger.info('✅ Migration 061 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 061:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 61,
  description: 'Create user_quota_overrides table for custom quota limits'
};
