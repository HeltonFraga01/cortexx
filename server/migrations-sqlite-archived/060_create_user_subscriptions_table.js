/**
 * Migration: Create user_subscriptions table for subscription management
 * Version: 060
 * Date: 2025-12-09
 * 
 * This migration creates the user_subscriptions table to track user plan assignments.
 * Each user has one subscription linking them to a plan with status tracking.
 * 
 * Requirements: 2.1, 2.3
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 060: Criar tabela user_subscriptions');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_subscriptions'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela user_subscriptions já existe');
      return;
    }
    
    // Create user_subscriptions table
    const createTableSql = `
      CREATE TABLE user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trial', 'active', 'past_due', 'canceled', 'expired', 'suspended')),
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        trial_ends_at DATETIME,
        current_period_start DATETIME,
        current_period_end DATETIME,
        canceled_at DATETIME,
        suspension_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES plans(id)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela user_subscriptions criada');
    
    // Create indexes for performance
    await db.query('CREATE UNIQUE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id)');
    logger.info('✅ Índice idx_user_subscriptions_user_id criado');
    
    await db.query('CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id)');
    logger.info('✅ Índice idx_user_subscriptions_plan_id criado');
    
    await db.query('CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status)');
    logger.info('✅ Índice idx_user_subscriptions_status criado');
    
    await db.query('CREATE INDEX idx_user_subscriptions_current_period_end ON user_subscriptions(current_period_end)');
    logger.info('✅ Índice idx_user_subscriptions_current_period_end criado');
    
    logger.info('✅ Migration 060 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 060:', error.message);
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
    logger.info('🔄 Revertendo migration 060: Remover tabela user_subscriptions');
    
    await db.query('DROP TABLE IF EXISTS user_subscriptions');
    logger.info('✅ Tabela user_subscriptions removida');
    
    logger.info('✅ Migration 060 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 060:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 60,
  description: 'Create user_subscriptions table for subscription management'
};
