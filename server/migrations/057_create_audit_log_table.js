/**
 * Migration: Create audit_log table for multi-user system
 * Version: 057
 * Date: 2025-12-09
 * 
 * This migration creates the audit_log table to track all agent actions.
 * Every action is logged with agent ID, timestamp, and details.
 * 
 * Requirements: 6.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 057: Criar tabela audit_log');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela audit_log já existe');
      return;
    }
    
    // Create audit_log table
    const createTableSql = `
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        agent_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela audit_log criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_audit_log_account_id ON audit_log(account_id)');
    logger.info('✅ Índice idx_audit_log_account_id criado');
    
    await db.query('CREATE INDEX idx_audit_log_agent_id ON audit_log(agent_id)');
    logger.info('✅ Índice idx_audit_log_agent_id criado');
    
    await db.query('CREATE INDEX idx_audit_log_action ON audit_log(action)');
    logger.info('✅ Índice idx_audit_log_action criado');
    
    await db.query('CREATE INDEX idx_audit_log_resource_type ON audit_log(resource_type)');
    logger.info('✅ Índice idx_audit_log_resource_type criado');
    
    await db.query('CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC)');
    logger.info('✅ Índice idx_audit_log_created_at criado');
    
    // Composite index for common queries
    await db.query('CREATE INDEX idx_audit_log_account_created ON audit_log(account_id, created_at DESC)');
    logger.info('✅ Índice idx_audit_log_account_created criado');
    
    logger.info('✅ Migration 057 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 057:', error.message);
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
    logger.info('🔄 Revertendo migration 057: Remover tabela audit_log');
    
    await db.query('DROP TABLE IF EXISTS audit_log');
    logger.info('✅ Tabela audit_log removida');
    
    logger.info('✅ Migration 057 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 057:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 57,
  description: 'Create audit_log table for multi-user system'
};
