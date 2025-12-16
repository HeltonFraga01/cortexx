/**
 * Migration: Create user_quota_usage table for tracking quota consumption
 * Version: 062
 * Date: 2025-12-09
 * 
 * This migration creates the user_quota_usage table to track quota consumption per period.
 * Usage is tracked per user, quota type, and billing period.
 * 
 * Requirements: 3.1, 3.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 062: Criar tabela user_quota_usage');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_quota_usage'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela user_quota_usage já existe');
      return;
    }
    
    // Create user_quota_usage table
    const createTableSql = `
      CREATE TABLE user_quota_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quota_type TEXT NOT NULL,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        current_usage INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, quota_type, period_start)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela user_quota_usage criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_user_quota_usage_user_id ON user_quota_usage(user_id)');
    logger.info('✅ Índice idx_user_quota_usage_user_id criado');
    
    await db.query('CREATE INDEX idx_user_quota_usage_user_period ON user_quota_usage(user_id, period_start)');
    logger.info('✅ Índice idx_user_quota_usage_user_period criado');
    
    await db.query('CREATE INDEX idx_user_quota_usage_quota_type ON user_quota_usage(quota_type)');
    logger.info('✅ Índice idx_user_quota_usage_quota_type criado');
    
    logger.info('✅ Migration 062 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 062:', error.message);
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
    logger.info('🔄 Revertendo migration 062: Remover tabela user_quota_usage');
    
    await db.query('DROP TABLE IF EXISTS user_quota_usage');
    logger.info('✅ Tabela user_quota_usage removida');
    
    logger.info('✅ Migration 062 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 062:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 62,
  description: 'Create user_quota_usage table for tracking quota consumption'
};
