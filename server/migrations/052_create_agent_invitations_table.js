/**
 * Migration: Create agent_invitations table for multi-user system
 * Version: 052
 * Date: 2025-12-09
 * 
 * This migration creates the agent_invitations table to store pending invitations.
 * Invitations have unique tokens and expire after 48 hours.
 * 
 * Requirements: 2.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 052: Criar tabela agent_invitations');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_invitations'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela agent_invitations já existe');
      return;
    }
    
    // Create agent_invitations table
    const createTableSql = `
      CREATE TABLE agent_invitations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        email TEXT,
        token TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'agent',
        custom_role_id TEXT,
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES agents(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela agent_invitations criada');
    
    // Create indexes for performance
    await db.query('CREATE UNIQUE INDEX idx_agent_invitations_token ON agent_invitations(token)');
    logger.info('✅ Índice idx_agent_invitations_token criado');
    
    await db.query('CREATE INDEX idx_agent_invitations_account_id ON agent_invitations(account_id)');
    logger.info('✅ Índice idx_agent_invitations_account_id criado');
    
    await db.query('CREATE INDEX idx_agent_invitations_expires_at ON agent_invitations(expires_at)');
    logger.info('✅ Índice idx_agent_invitations_expires_at criado');
    
    logger.info('✅ Migration 052 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 052:', error.message);
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
    logger.info('🔄 Revertendo migration 052: Remover tabela agent_invitations');
    
    await db.query('DROP TABLE IF EXISTS agent_invitations');
    logger.info('✅ Tabela agent_invitations removida');
    
    logger.info('✅ Migration 052 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 052:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 52,
  description: 'Create agent_invitations table for multi-user system'
};
