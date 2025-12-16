/**
 * Migration: Create agents table for multi-user system
 * Version: 051
 * Date: 2025-12-09
 * 
 * This migration creates the agents table to store sub-users within accounts.
 * Each agent has individual credentials and permissions.
 * 
 * Requirements: 2.4, 2.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 051: Criar tabela agents');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agents'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela agents já existe');
      return;
    }
    
    // Create agents table
    const createTableSql = `
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'agent' CHECK(role IN ('owner', 'administrator', 'agent', 'viewer')),
        custom_role_id TEXT,
        availability TEXT DEFAULT 'offline' CHECK(availability IN ('online', 'busy', 'offline')),
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending')),
        last_activity_at DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, email)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela agents criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_agents_account_id ON agents(account_id)');
    logger.info('✅ Índice idx_agents_account_id criado');
    
    await db.query('CREATE INDEX idx_agents_email ON agents(email)');
    logger.info('✅ Índice idx_agents_email criado');
    
    await db.query('CREATE INDEX idx_agents_status ON agents(status)');
    logger.info('✅ Índice idx_agents_status criado');
    
    await db.query('CREATE INDEX idx_agents_role ON agents(role)');
    logger.info('✅ Índice idx_agents_role criado');
    
    await db.query('CREATE INDEX idx_agents_availability ON agents(availability)');
    logger.info('✅ Índice idx_agents_availability criado');
    
    logger.info('✅ Migration 051 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 051:', error.message);
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
    logger.info('🔄 Revertendo migration 051: Remover tabela agents');
    
    await db.query('DROP TABLE IF EXISTS agents');
    logger.info('✅ Tabela agents removida');
    
    logger.info('✅ Migration 051 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 051:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 51,
  description: 'Create agents table for multi-user system'
};
