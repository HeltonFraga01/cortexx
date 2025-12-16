/**
 * Migration: Create user_feature_overrides table for custom feature flags
 * Version: 063
 * Date: 2025-12-09
 * 
 * This migration creates the user_feature_overrides table to store custom feature flags per user.
 * Overrides take precedence over plan defaults.
 * 
 * Requirements: 4.2, 4.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 063: Criar tabela user_feature_overrides');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_feature_overrides'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela user_feature_overrides já existe');
      return;
    }
    
    // Create user_feature_overrides table
    const createTableSql = `
      CREATE TABLE user_feature_overrides (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        set_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, feature_name)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela user_feature_overrides criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_user_feature_overrides_user_id ON user_feature_overrides(user_id)');
    logger.info('✅ Índice idx_user_feature_overrides_user_id criado');
    
    await db.query('CREATE INDEX idx_user_feature_overrides_feature_name ON user_feature_overrides(feature_name)');
    logger.info('✅ Índice idx_user_feature_overrides_feature_name criado');
    
    logger.info('✅ Migration 063 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 063:', error.message);
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
    logger.info('🔄 Revertendo migration 063: Remover tabela user_feature_overrides');
    
    await db.query('DROP TABLE IF EXISTS user_feature_overrides');
    logger.info('✅ Tabela user_feature_overrides removida');
    
    logger.info('✅ Migration 063 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 063:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 63,
  description: 'Create user_feature_overrides table for custom feature flags'
};
