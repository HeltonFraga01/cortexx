/**
 * Migration: Create default_labels table for admin automation
 * Version: 046
 * Date: 2025-12-08
 * 
 * This migration creates the default_labels table to store
 * label templates that are automatically created for new users.
 * 
 * Requirements: 5.1, 5.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 046: Criar tabela default_labels');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='default_labels'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela default_labels já existe');
      return;
    }
    
    // Create default_labels table
    const createTableSql = `
      CREATE TABLE default_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela default_labels criada');
    
    // Create index for sort order
    await db.query('CREATE INDEX idx_default_labels_sort ON default_labels(sort_order)');
    logger.info('✅ Índice idx_default_labels_sort criado');
    
    logger.info('✅ Migration 046 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 046:', error.message);
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
    logger.info('🔄 Revertendo migration 046: Remover tabela default_labels');
    
    await db.query('DROP TABLE IF EXISTS default_labels');
    logger.info('✅ Tabela default_labels removida');
    
    logger.info('✅ Migration 046 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 046:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 46,
  description: 'Create default_labels table for admin automation'
};
