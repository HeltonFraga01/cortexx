/**
 * Migration: Add include_history column to agent_bots table
 * Version: 040
 * Date: 2025-12-06
 * 
 * This migration adds an option to include or exclude message history
 * in the webhook payload sent to bots.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 040: Adicionar include_history à tabela agent_bots');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(agent_bots)");
    const columns = tableInfo.rows.map(row => row.name);
    
    // Add include_history column if not exists (default false to reduce payload size)
    if (!columns.includes('include_history')) {
      await db.query('ALTER TABLE agent_bots ADD COLUMN include_history INTEGER DEFAULT 0');
      logger.info('✅ Coluna include_history adicionada (padrão: desativado)');
    } else {
      logger.info('ℹ️ Coluna include_history já existe');
    }
    
    logger.info('✅ Migration 040 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 040:', error.message);
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
    logger.info('🔄 Revertendo migration 040');
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. Coluna include_history permanecerá na tabela.');
    logger.info('✅ Migration 040 revertida (parcialmente)');
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 040:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 40,
  description: 'Add include_history column to agent_bots table'
};
