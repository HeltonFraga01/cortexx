/**
 * Migration: Create accounts table for multi-user system
 * Version: 050
 * Date: 2025-12-09
 * 
 * This migration creates the accounts table to store organization/company accounts.
 * Each account represents a separate organization with its own WUZAPI connection.
 * 
 * Requirements: 1.1, 1.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 050: Criar tabela accounts');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela accounts já existe');
      return;
    }
    
    // Create accounts table
    const createTableSql = `
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        wuzapi_token TEXT NOT NULL,
        timezone TEXT DEFAULT 'America/Sao_Paulo',
        locale TEXT DEFAULT 'pt-BR',
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela accounts criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_accounts_owner_user_id ON accounts(owner_user_id)');
    logger.info('✅ Índice idx_accounts_owner_user_id criado');
    
    await db.query('CREATE INDEX idx_accounts_status ON accounts(status)');
    logger.info('✅ Índice idx_accounts_status criado');
    
    await db.query('CREATE INDEX idx_accounts_created_at ON accounts(created_at)');
    logger.info('✅ Índice idx_accounts_created_at criado');
    
    logger.info('✅ Migration 050 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 050:', error.message);
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
    logger.info('🔄 Revertendo migration 050: Remover tabela accounts');
    
    await db.query('DROP TABLE IF EXISTS accounts');
    logger.info('✅ Tabela accounts removida');
    
    logger.info('✅ Migration 050 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 050:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 50,
  description: 'Create accounts table for multi-user system'
};
