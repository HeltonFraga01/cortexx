/**
 * Migration: Create default_canned_responses table for admin automation
 * Version: 047
 * Date: 2025-12-08
 * 
 * This migration creates the default_canned_responses table to store
 * quick reply templates that are automatically created for new users.
 * 
 * Requirements: 6.1, 6.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 047: Criar tabela default_canned_responses');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='default_canned_responses'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela default_canned_responses já existe');
      return;
    }
    
    // Create default_canned_responses table
    const createTableSql = `
      CREATE TABLE default_canned_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shortcut TEXT NOT NULL,
        content TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela default_canned_responses criada');
    
    // Create index for sort order
    await db.query('CREATE INDEX idx_default_canned_sort ON default_canned_responses(sort_order)');
    logger.info('✅ Índice idx_default_canned_sort criado');
    
    // Create index for shortcut lookup
    await db.query('CREATE INDEX idx_default_canned_shortcut ON default_canned_responses(shortcut)');
    logger.info('✅ Índice idx_default_canned_shortcut criado');
    
    logger.info('✅ Migration 047 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 047:', error.message);
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
    logger.info('🔄 Revertendo migration 047: Remover tabela default_canned_responses');
    
    await db.query('DROP TABLE IF EXISTS default_canned_responses');
    logger.info('✅ Tabela default_canned_responses removida');
    
    logger.info('✅ Migration 047 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 047:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 47,
  description: 'Create default_canned_responses table for admin automation'
};
