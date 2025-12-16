/**
 * Migration: Create usage_metrics table for tracking detailed usage
 * Version: 064
 * Date: 2025-12-09
 * 
 * This migration creates the usage_metrics table to track detailed usage events.
 * Each event records a specific action with metadata for analytics.
 * 
 * Requirements: 10.1, 10.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 064: Criar tabela usage_metrics');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='usage_metrics'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela usage_metrics já existe');
      return;
    }
    
    // Create usage_metrics table
    const createTableSql = `
      CREATE TABLE usage_metrics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 1,
        metadata TEXT DEFAULT '{}',
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela usage_metrics criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id)');
    logger.info('✅ Índice idx_usage_metrics_user_id criado');
    
    await db.query('CREATE INDEX idx_usage_metrics_user_type ON usage_metrics(user_id, metric_type)');
    logger.info('✅ Índice idx_usage_metrics_user_type criado');
    
    await db.query('CREATE INDEX idx_usage_metrics_recorded_at ON usage_metrics(recorded_at)');
    logger.info('✅ Índice idx_usage_metrics_recorded_at criado');
    
    await db.query('CREATE INDEX idx_usage_metrics_metric_type ON usage_metrics(metric_type)');
    logger.info('✅ Índice idx_usage_metrics_metric_type criado');
    
    logger.info('✅ Migration 064 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 064:', error.message);
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
    logger.info('🔄 Revertendo migration 064: Remover tabela usage_metrics');
    
    await db.query('DROP TABLE IF EXISTS usage_metrics');
    logger.info('✅ Tabela usage_metrics removida');
    
    logger.info('✅ Migration 064 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 064:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 64,
  description: 'Create usage_metrics table for tracking detailed usage'
};
