/**
 * Migration: Create canned_responses table for chat interface
 * Version: 023
 * Date: 2025-12-04
 * 
 * This migration creates the canned_responses table to store quick reply templates
 * that users can insert using shortcut codes.
 * 
 * Requirements: 21.1-21.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 023: Criar tabela canned_responses');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canned_responses'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela canned_responses já existe');
      return;
    }
    
    // Create canned_responses table
    const createTableSql = `
      CREATE TABLE canned_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        shortcut TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, shortcut)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela canned_responses criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_canned_user_id ON canned_responses(user_id)');
    logger.info('✅ Índice idx_canned_user_id criado');
    
    await db.query('CREATE INDEX idx_canned_shortcut ON canned_responses(shortcut)');
    logger.info('✅ Índice idx_canned_shortcut criado');
    
    logger.info('✅ Migration 023 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 023:', error.message);
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
    logger.info('🔄 Revertendo migration 023: Remover tabela canned_responses');
    
    await db.query('DROP TABLE IF EXISTS canned_responses');
    logger.info('✅ Tabela canned_responses removida');
    
    logger.info('✅ Migration 023 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 023:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 23,
  description: 'Create canned_responses table for chat interface'
};
