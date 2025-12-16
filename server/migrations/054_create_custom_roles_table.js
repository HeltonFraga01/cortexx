/**
 * Migration: Create custom_roles table for multi-user system
 * Version: 054
 * Date: 2025-12-09
 * 
 * This migration creates the custom_roles table to store custom permission roles.
 * Each role has a name and a JSON array of permissions.
 * 
 * Requirements: 3.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 054: Criar tabela custom_roles');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_roles'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela custom_roles já existe');
      return;
    }
    
    // Create custom_roles table
    const createTableSql = `
      CREATE TABLE custom_roles (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, name)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela custom_roles criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_custom_roles_account_id ON custom_roles(account_id)');
    logger.info('✅ Índice idx_custom_roles_account_id criado');
    
    await db.query('CREATE UNIQUE INDEX idx_custom_roles_account_name ON custom_roles(account_id, name)');
    logger.info('✅ Índice idx_custom_roles_account_name criado');
    
    logger.info('✅ Migration 054 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 054:', error.message);
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
    logger.info('🔄 Revertendo migration 054: Remover tabela custom_roles');
    
    await db.query('DROP TABLE IF EXISTS custom_roles');
    logger.info('✅ Tabela custom_roles removida');
    
    logger.info('✅ Migration 054 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 054:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 54,
  description: 'Create custom_roles table for multi-user system'
};
