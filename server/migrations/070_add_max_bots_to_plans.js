/**
 * Migration: Add max_bots column to plans table
 * Version: 070
 * Date: 2025-12-13
 * 
 * This migration adds the max_bots quota to the plans table for limiting
 * the number of automation bots a user can create.
 * 
 * Requirements: 2.1 (Resource Limits Enforcement)
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 070: Adicionar max_bots à tabela plans');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(plans)");
    const hasMaxBots = tableInfo.rows.some(col => col.name === 'max_bots');
    
    if (hasMaxBots) {
      logger.info('ℹ️ Coluna max_bots já existe na tabela plans');
      return;
    }
    
    // Add max_bots column with default value of 3
    await db.query('ALTER TABLE plans ADD COLUMN max_bots INTEGER DEFAULT 3');
    logger.info('✅ Coluna max_bots adicionada à tabela plans');
    
    // Update existing plans with appropriate bot limits
    await db.query("UPDATE plans SET max_bots = 1 WHERE name = 'Free'");
    await db.query("UPDATE plans SET max_bots = 3 WHERE name = 'Basic'");
    await db.query("UPDATE plans SET max_bots = 10 WHERE name = 'Pro'");
    await db.query("UPDATE plans SET max_bots = 50 WHERE name = 'Enterprise'");
    logger.info('✅ Limites de bots atualizados para planos existentes');
    
    logger.info('✅ Migration 070 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 070:', error.message);
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
    logger.info('🔄 Revertendo migration 070: Remover max_bots da tabela plans');
    
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // For simplicity, we'll just log a warning since this is rarely needed
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. A coluna max_bots permanecerá na tabela.');
    
    logger.info('✅ Migration 070 revertida (parcialmente)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 070:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 70,
  description: 'Add max_bots column to plans table'
};
