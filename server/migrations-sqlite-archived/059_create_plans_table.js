/**
 * Migration: Create plans table for subscription management
 * Version: 059
 * Date: 2025-12-09
 * 
 * This migration creates the plans table to store subscription plans with quotas and features.
 * Each plan defines limits and available features for users.
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 059: Criar tabela plans');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='plans'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela plans já existe');
      return;
    }
    
    // Create plans table
    const createTableSql = `
      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        price_cents INTEGER NOT NULL DEFAULT 0,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly', 'lifetime')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deprecated')),
        is_default INTEGER DEFAULT 0,
        trial_days INTEGER DEFAULT 0,
        max_agents INTEGER DEFAULT 1,
        max_connections INTEGER DEFAULT 1,
        max_messages_per_day INTEGER DEFAULT 100,
        max_messages_per_month INTEGER DEFAULT 3000,
        max_inboxes INTEGER DEFAULT 1,
        max_teams INTEGER DEFAULT 1,
        max_webhooks INTEGER DEFAULT 5,
        max_campaigns INTEGER DEFAULT 1,
        max_storage_mb INTEGER DEFAULT 100,
        features TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela plans criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_plans_name ON plans(name)');
    logger.info('✅ Índice idx_plans_name criado');
    
    await db.query('CREATE INDEX idx_plans_status ON plans(status)');
    logger.info('✅ Índice idx_plans_status criado');
    
    await db.query('CREATE INDEX idx_plans_is_default ON plans(is_default)');
    logger.info('✅ Índice idx_plans_is_default criado');
    
    logger.info('✅ Migration 059 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 059:', error.message);
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
    logger.info('🔄 Revertendo migration 059: Remover tabela plans');
    
    await db.query('DROP TABLE IF EXISTS plans');
    logger.info('✅ Tabela plans removida');
    
    logger.info('✅ Migration 059 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 059:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 59,
  description: 'Create plans table for subscription management'
};
