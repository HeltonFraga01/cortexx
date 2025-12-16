/**
 * Migration: Create agent_sessions table for multi-user system
 * Version: 053
 * Date: 2025-12-09
 * 
 * This migration creates the agent_sessions table to store individual agent sessions.
 * Each session contains agent ID, account ID, and expiration time.
 * 
 * Requirements: 2.10, 6.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 053: Criar tabela agent_sessions');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela agent_sessions já existe');
      return;
    }
    
    // Create agent_sessions table
    const createTableSql = `
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela agent_sessions criada');
    
    // Create indexes for performance
    await db.query('CREATE UNIQUE INDEX idx_agent_sessions_token ON agent_sessions(token)');
    logger.info('✅ Índice idx_agent_sessions_token criado');
    
    await db.query('CREATE INDEX idx_agent_sessions_agent_id ON agent_sessions(agent_id)');
    logger.info('✅ Índice idx_agent_sessions_agent_id criado');
    
    await db.query('CREATE INDEX idx_agent_sessions_account_id ON agent_sessions(account_id)');
    logger.info('✅ Índice idx_agent_sessions_account_id criado');
    
    await db.query('CREATE INDEX idx_agent_sessions_expires_at ON agent_sessions(expires_at)');
    logger.info('✅ Índice idx_agent_sessions_expires_at criado');
    
    logger.info('✅ Migration 053 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 053:', error.message);
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
    logger.info('🔄 Revertendo migration 053: Remover tabela agent_sessions');
    
    await db.query('DROP TABLE IF EXISTS agent_sessions');
    logger.info('✅ Tabela agent_sessions removida');
    
    logger.info('✅ Migration 053 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 053:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 53,
  description: 'Create agent_sessions table for multi-user system'
};
